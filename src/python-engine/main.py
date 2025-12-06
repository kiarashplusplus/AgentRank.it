"""
AgentRank Engine - Browser Use with Video Recording

Self-hosted Python engine for Level 2 Visual Resolver.
Captures video recordings of agent sessions for replay.
"""

from fastapi import FastAPI
from pydantic import BaseModel
from browser_use import Agent, Browser
import os
import uuid
from pathlib import Path
from dotenv import load_dotenv
from r2_upload import upload_video, cleanup_local_video

# Import LLM classes
try:
    from browser_use import ChatOpenAI, ChatAnthropic
except ImportError:
    from langchain_openai import ChatOpenAI
    from langchain_anthropic import ChatAnthropic

load_dotenv()

app = FastAPI()

# Ensure recordings directory exists
RECORDINGS_DIR = Path("/app/recordings")
RECORDINGS_DIR.mkdir(exist_ok=True)


def get_llm():
    """Get LLM based on available API keys"""
    openai_key = os.getenv("OPENAI_API_KEY")
    anthropic_key = os.getenv("ANTHROPIC_API_KEY")
    
    if openai_key:
        return ChatOpenAI(model="gpt-4o", api_key=openai_key)
    elif anthropic_key:
        return ChatAnthropic(model="claude-3-5-sonnet-20241022", api_key=anthropic_key)
    else:
        raise ValueError("No API key found. Set OPENAI_API_KEY or ANTHROPIC_API_KEY")


class TaskRequest(BaseModel):
    task: str
    url: str
    record_video: bool = True


@app.post("/task")
async def run_task(request: TaskRequest):
    scan_id = str(uuid.uuid4())[:8]
    video_url = None
    video_dir = RECORDINGS_DIR / scan_id
    browser = None
    
    try:
        # Create scan-specific video directory
        video_dir.mkdir(exist_ok=True)
        
        # Construct the full task prompt
        full_task = f"Navigate to {request.url}. {request.task}"
        
        # Get LLM
        llm = get_llm()
        
        # Configure browser with video recording
        # Note: Passing params directly to Browser as per latest docs
        browser = Browser(
            headless=True,
            record_video_dir=str(video_dir) if request.record_video else None,
        )
        
        # Initialize Agent with browser
        agent = Agent(
            task=full_task,
            llm=llm,
            browser=browser,
        )
        
        # Run the agent
        history = await agent.run()
        
        # Get the final result
        result = history.final_result()
        
        # Close browser to finalize video
        if browser:
            # Handle potential API differences or if it's already closed
            if hasattr(browser, 'close'):
                await browser.close()
        
        # Find and upload the video file
        if request.record_video:
            video_files = list(video_dir.glob("*.mp4")) + list(video_dir.glob("*.webm"))
            if video_files:
                video_path = str(video_files[0])
                video_url = upload_video(video_path, scan_id)
                if video_url:
                    cleanup_local_video(video_path)
        
        return {
            "success": True,
            "output": result,
            "steps": len(history.history) if hasattr(history, 'history') else 0,
            "transcript": [str(step) for step in history.history] if hasattr(history, 'history') else [],
            "videoUrl": video_url,
            "scanId": scan_id,
        }
        
    except Exception as e:
        import traceback
        print(f"Error running task: {e}")
        traceback.print_exc()
        
        # Cleanup browser
        if browser and hasattr(browser, 'close'):
            try:
                await browser.close()
            except:
                pass
        
        return {
            "success": False, 
            "error": str(e),
            "scanId": scan_id,
        }


@app.get("/health")
def health():
    return {"status": "ok", "video_recording": True}
