"""
AgentRank Engine - Browser Use with Video Recording

Self-hosted Python engine for Level 2 Visual Resolver.
Captures video recordings of agent sessions for replay.
"""

from fastapi import FastAPI
from pydantic import BaseModel
from browser_use import Agent
from browser_use.browser.browser import Browser, BrowserConfig
from browser_use.browser.context import BrowserContextConfig
from langchain_openai import ChatOpenAI
import os
import uuid
import asyncio
from pathlib import Path
from dotenv import load_dotenv
from r2_upload import upload_video, cleanup_local_video

load_dotenv()

app = FastAPI()

# Ensure recordings directory exists
RECORDINGS_DIR = Path("/app/recordings")
RECORDINGS_DIR.mkdir(exist_ok=True)


class TaskRequest(BaseModel):
    task: str
    url: str
    record_video: bool = True  # Enable video recording by default


@app.post("/task")
async def run_task(request: TaskRequest):
    scan_id = str(uuid.uuid4())[:8]
    video_path = None
    video_url = None
    
    try:
        # Construct the full task prompt
        full_task = f"Navigate to {request.url}. {request.task}"
        
        # Initialize LLM
        llm = ChatOpenAI(model="gpt-4o")
        
        # Configure browser with video recording
        browser_config = BrowserConfig(
            headless=True,
        )
        
        # Create browser with recording context
        browser = Browser(config=browser_config)
        
        # Context config with video recording
        context_config = BrowserContextConfig(
            save_recording_path=str(RECORDINGS_DIR / f"{scan_id}.webm") if request.record_video else None,
        )
        
        # Initialize Agent with browser
        agent = Agent(
            task=full_task,
            llm=llm,
            browser=browser,
            browser_context=await browser.new_context(config=context_config),
        )
        
        # Run the agent
        history = await agent.run()
        
        # Get the final result
        result = history.final_result()
        
        # Close browser to finalize video
        await browser.close()
        
        # Check for video file
        if request.record_video:
            potential_video = RECORDINGS_DIR / f"{scan_id}.webm"
            if potential_video.exists():
                video_path = str(potential_video)
                # Upload to R2
                video_url = upload_video(video_path, scan_id)
                # Cleanup local file after upload
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
        
        # Try to cleanup any partial video
        if video_path:
            cleanup_local_video(video_path)
        
        return {
            "success": False, 
            "error": str(e),
            "scanId": scan_id,
        }


@app.get("/health")
def health():
    return {"status": "ok", "video_recording": True}
