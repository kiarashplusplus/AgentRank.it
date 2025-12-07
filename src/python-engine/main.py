"""
AgentRank Engine - Browser Use with Video Recording & SSE Streaming

Self-hosted Python engine for Level 2 Visual Resolver.
Captures video recordings and streams step-by-step progress.
"""

from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from browser_use import Agent, Browser
import os
import uuid
import json
import asyncio
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


class ScanTask(BaseModel):
    """A single task within a multi-task scan"""
    name: str
    signal: str
    prompt: str


class ScanRequest(BaseModel):
    """Request for multi-task scan in single browser session"""
    url: str
    tasks: list[ScanTask]
    prep_prompt: str | None = None
    record_video: bool = True


def sse_event(event_type: str, data: dict) -> str:
    """Format a Server-Sent Event"""
    return f"data: {json.dumps({'type': event_type, **data})}\n\n"


@app.post("/scan/stream")
async def run_scan_stream(request: ScanRequest):
    """
    Multi-task scan endpoint - runs all tasks in a SINGLE browser session.
    This preserves state (cookies, DOM changes) between prep and diagnostic tasks.
    """
    
    async def event_generator():
        scan_id = str(uuid.uuid4())[:8]
        video_url = None
        video_dir = RECORDINGS_DIR / scan_id
        browser = None
        total_step_count = 0
        
        try:
            # Create scan-specific video directory
            video_dir.mkdir(exist_ok=True)
            
            total_tasks = len(request.tasks) + (1 if request.prep_prompt else 0)
            yield sse_event("start", {
                "scanId": scan_id, 
                "message": "Starting scan...",
                "total": total_tasks
            })
            
            # Get LLM
            llm = get_llm()
            
            yield sse_event("step", {"step": 0, "action": "Launching browser", "status": "running"})
            
            # Configure browser with video recording - ONE session for all tasks
            # use_cloud=False, is_local=True to use local Chromium, not cloud service
            # NOTE: Don't use timeout param - it incorrectly triggers cloud_browser_params
            browser = Browser(
                headless=True,
                use_cloud=False,
                is_local=True,
                record_video_dir=str(video_dir) if request.record_video else None,
            )
            
            yield sse_event("step", {"step": 0, "action": "Browser launched", "status": "done"})
            
            task_index = 0
            results = []
            
            # Run prep prompt first if provided
            if request.prep_prompt:
                task_index += 1
                yield sse_event("progress", {
                    "task_index": task_index,
                    "total": total_tasks,
                    "signal": "prep",
                    "name": "Prep Action",
                })
                
                yield sse_event("step", {"step": total_step_count + 1, "action": f"Running prep: {request.prep_prompt[:50]}...", "status": "running"})
                
                # Navigate and run prep
                full_task = f"Navigate to {request.url}. {request.prep_prompt}"
                agent = Agent(task=full_task, llm=llm, browser=browser)
                history = await agent.run()
                
                # Emit history steps
                if hasattr(history, 'history'):
                    for i, step in enumerate(history.history):
                        total_step_count += 1
                        step_str = str(step)[:200]
                        yield sse_event("step", {
                            "step": total_step_count,
                            "action": step_str,
                            "status": "done",
                            "signal": "prep"
                        })
                
                yield sse_event("task_complete", {
                    "signal": "prep",
                    "output": "Prep action completed",
                })
            
            # Run each diagnostic task in the SAME browser session
            for task in request.tasks:
                task_index += 1
                yield sse_event("progress", {
                    "task_index": task_index,
                    "total": total_tasks,
                    "signal": task.signal,
                    "name": task.name,
                })
                
                yield sse_event("step", {"step": total_step_count + 1, "action": f"Running: {task.name}", "status": "running"})
                
                # Run diagnostic task (browser is already at the page from prep or previous task)
                # Include instruction about current page state
                task_prompt = f"You are already on {request.url}. {task.prompt}"
                agent = Agent(task=task_prompt, llm=llm, browser=browser)
                
                try:
                    history = await agent.run()
                    result = history.final_result()
                    
                    # Emit history steps
                    if hasattr(history, 'history'):
                        for i, step in enumerate(history.history):
                            total_step_count += 1
                            step_str = str(step)[:200]
                            yield sse_event("step", {
                                "step": total_step_count,
                                "action": step_str,
                                "status": "done",
                                "signal": task.signal
                            })
                    
                    results.append({
                        "signal": task.signal,
                        "success": True,
                        "output": result,
                    })
                    
                    yield sse_event("task_complete", {
                        "signal": task.signal,
                        "output": result[:500] if result else "Completed",
                    })
                    
                except Exception as task_err:
                    results.append({
                        "signal": task.signal,
                        "success": False,
                        "error": str(task_err),
                    })
                    yield sse_event("task_failed", {
                        "signal": task.signal,
                        "error": str(task_err),
                    })
            
            # Close browser and upload video
            yield sse_event("step", {"step": total_step_count + 1, "action": "Closing browser", "status": "running"})
            
            if browser and hasattr(browser, 'close'):
                await browser.close()
            
            yield sse_event("step", {"step": total_step_count + 1, "action": "Browser closed", "status": "done"})
            
            # Upload video
            if request.record_video:
                yield sse_event("step", {"step": total_step_count + 2, "action": "Uploading video...", "status": "running"})
                video_files = list(video_dir.glob("*.mp4")) + list(video_dir.glob("*.webm"))
                if video_files:
                    video_path = str(video_files[0])
                    video_url = upload_video(video_path, scan_id)
                    if video_url:
                        cleanup_local_video(video_path)
                        yield sse_event("step", {"step": total_step_count + 2, "action": "Video uploaded", "status": "done"})
            
            # Final complete event
            yield sse_event("complete", {
                "success": True,
                "results": results,
                "videoUrl": video_url,
                "scanId": scan_id,
            })
            
        except Exception as e:
            import traceback
            print(f"Error in scan: {e}")
            traceback.print_exc()
            
            if browser and hasattr(browser, 'close'):
                try:
                    await browser.close()
                except:
                    pass
            
            yield sse_event("error", {
                "message": str(e),
                "scanId": scan_id,
            })
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )


@app.post("/task/stream")
async def run_task_stream(request: TaskRequest):
    """SSE streaming endpoint - emits step-by-step progress"""
    
    async def event_generator():
        scan_id = str(uuid.uuid4())[:8]
        video_url = None
        video_dir = RECORDINGS_DIR / scan_id
        browser = None
        step_count = 0
        
        try:
            # Create scan-specific video directory
            video_dir.mkdir(exist_ok=True)
            
            yield sse_event("start", {"scanId": scan_id, "message": "Initializing browser..."})
            
            # Construct the full task prompt
            full_task = f"Navigate to {request.url}. {request.task}"
            
            # Get LLM
            llm = get_llm()
            
            yield sse_event("step", {"step": 0, "action": "Launching browser", "status": "running"})
            
            # Configure browser with video recording
            # use_cloud=False, is_local=True to use local Chromium, not cloud service
            # NOTE: Don't use timeout param - it incorrectly triggers cloud_browser_params
            browser = Browser(
                headless=True,
                use_cloud=False,
                is_local=True,
                record_video_dir=str(video_dir) if request.record_video else None,
            )
            
            yield sse_event("step", {"step": 0, "action": "Browser launched", "status": "done"})
            
            # Initialize Agent with browser
            agent = Agent(
                task=full_task,
                llm=llm,
                browser=browser,
            )
            
            yield sse_event("step", {"step": 1, "action": "Starting agent task", "status": "running"})
            
            # Run the agent with step tracking
            # Browser-use runs in steps, we'll track via history
            history = await agent.run()
            
            # Process history steps and emit them
            if hasattr(history, 'history'):
                for i, step in enumerate(history.history):
                    step_count = i + 1
                    step_str = str(step)[:200]  # Truncate for streaming
                    yield sse_event("step", {
                        "step": step_count,
                        "action": step_str,
                        "status": "done"
                    })
            
            # Get the final result
            result = history.final_result()
            
            yield sse_event("step", {"step": step_count + 1, "action": "Closing browser", "status": "running"})
            
            # Close browser to finalize video
            if browser:
                if hasattr(browser, 'close'):
                    await browser.close()
            
            yield sse_event("step", {"step": step_count + 1, "action": "Browser closed", "status": "done"})
            
            # Find and upload the video file
            if request.record_video:
                yield sse_event("step", {"step": step_count + 2, "action": "Uploading video...", "status": "running"})
                video_files = list(video_dir.glob("*.mp4")) + list(video_dir.glob("*.webm"))
                if video_files:
                    video_path = str(video_files[0])
                    video_url = upload_video(video_path, scan_id)
                    if video_url:
                        cleanup_local_video(video_path)
                        yield sse_event("step", {"step": step_count + 2, "action": "Video uploaded", "status": "done"})
            
            # Final complete event
            yield sse_event("complete", {
                "success": True,
                "output": result,
                "steps": step_count,
                "videoUrl": video_url,
                "scanId": scan_id,
            })
            
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
            
            yield sse_event("error", {
                "message": str(e),
                "scanId": scan_id,
            })
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )


@app.post("/task")
async def run_task(request: TaskRequest):
    """Non-streaming endpoint (backward compatible)"""
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
        # use_cloud=False, is_local=True to use local Chromium, not cloud service
        # NOTE: Don't use timeout param - it incorrectly triggers cloud_browser_params
        browser = Browser(
            headless=True,
            use_cloud=False,
            is_local=True,
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
    return {"status": "ok", "video_recording": True, "streaming": True}

