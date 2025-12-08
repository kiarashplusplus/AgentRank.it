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
import logging

# Import LLM classes
try:
    from browser_use import ChatOpenAI, ChatAnthropic
except ImportError:
    from langchain_openai import ChatOpenAI
    from langchain_anthropic import ChatAnthropic

load_dotenv()

app = FastAPI()

# Setup structured logging
logging.basicConfig(
    level=logging.INFO,
    format='{"timestamp": "%(asctime)s", "level": "%(levelname)s", "message": "%(message)s"}',
    datefmt='%Y-%m-%dT%H:%M:%S%z'
)
logger = logging.getLogger("agentrank-engine")

# Ensure recordings directory exists
RECORDINGS_DIR = Path("/app/recordings")
RECORDINGS_DIR.mkdir(exist_ok=True, parents=True)

async def cleanup_old_recordings():
    """Background task to clean up recordings older than 1 hour"""
    while True:
        try:
            logger.info("Running background cleanup of old recordings")
            now = asyncio.get_event_loop().time() # Use loop time for relative check or time.time
            import time
            current_time = time.time()
            one_hour_ago = current_time - 3600
            
            # Check for files older than 1 hour
            if RECORDINGS_DIR.exists():
                for scan_dir in RECORDINGS_DIR.iterdir():
                    if scan_dir.is_dir():
                        # Check modification time
                        stat = scan_dir.stat()
                        if stat.st_mtime < one_hour_ago:
                            logger.info(f"Removing old recording directory: {scan_dir}")
                            import shutil
                            shutil.rmtree(scan_dir, ignore_errors=True)
                            
        except Exception as e:
            logger.error(f"Error in background cleanup: {e}")
            
        # Run every 15 minutes
        await asyncio.sleep(900)

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(cleanup_old_recordings())


def get_llm():
    """Get LLM based on available API keys
    
    Priority:
    1. Azure OpenAI (if AZURE_OPENAI_* vars are set) - recommended for data privacy
    2. OpenAI (if OPENAI_API_KEY is set)
    3. Anthropic (if ANTHROPIC_API_KEY is set)
    """
    # Check Azure OpenAI first (enterprise-grade with Zero Data Retention)
    azure_endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
    azure_key = os.getenv("AZURE_OPENAI_API_KEY")
    azure_deployment = os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-4o")
    azure_version = os.getenv("AZURE_OPENAI_API_VERSION", "2024-02-15-preview")
    
    if azure_endpoint and azure_key:
        # Use browser_use's ChatAzureOpenAI (compatible with browser-use Agent)
        from browser_use.llm import ChatAzureOpenAI
        
        return ChatAzureOpenAI(
            model=azure_deployment,  # Required positional arg for browser_use's wrapper
            azure_endpoint=azure_endpoint,
            api_key=azure_key,
            azure_deployment=azure_deployment,
            api_version=azure_version,
        )
    
    # Fallback to standard OpenAI
    openai_key = os.getenv("OPENAI_API_KEY")
    if openai_key:
        return ChatOpenAI(model="gpt-4o", api_key=openai_key)
    
    # Fallback to Anthropic
    anthropic_key = os.getenv("ANTHROPIC_API_KEY")
    if anthropic_key:
        return ChatAnthropic(model="claude-3-5-sonnet-20241022", api_key=anthropic_key)
    
    raise ValueError("No API key found. Set AZURE_OPENAI_* (recommended), OPENAI_API_KEY, or ANTHROPIC_API_KEY")


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
            
            # Quick URL reachability check (5 second timeout)
            # Use GET instead of HEAD for better compatibility, follow redirects
            yield sse_event("step", {"step": 0, "action": f"Checking URL: {request.url}", "status": "running"})
            final_url = request.url
            try:
                import aiohttp
                async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=10)) as session:
                    async with session.get(request.url, allow_redirects=True) as resp:
                        final_url = str(resp.url)
                        
                        # Check for redirects - inform user of final URL
                        if final_url != request.url:
                            yield sse_event("step", {"step": 0, "action": f"Redirected to: {final_url}", "status": "done"})
                        
                        # Require 2xx status code
                        if not (200 <= resp.status < 300):
                            yield sse_event("error", {"message": f"URL returned status {resp.status} (expected 200-299): {final_url}"})
                            return
            except asyncio.TimeoutError:
                yield sse_event("error", {"message": f"URL timed out after 10 seconds: {request.url}"})
                return
            except Exception as url_err:
                yield sse_event("error", {"message": f"URL is unreachable: {request.url}. Error: {str(url_err)[:100]}"})
                return
            
            # Update request URL to final URL after redirects
            request.url = final_url
            yield sse_event("step", {"step": 0, "action": f"URL verified (status 200): {final_url}", "status": "done"})
            
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
                
                try:
                    # Navigate and run prep with 60 second timeout
                    full_task = f"Navigate to {request.url}. {request.prep_prompt}"
                    agent = Agent(task=full_task, llm=llm, browser=browser)
                    history = await asyncio.wait_for(agent.run(), timeout=60.0)
                    
                    # Get token usage
                    prep_input_tokens = history.total_input_tokens() if hasattr(history, 'total_input_tokens') else 0
                    prep_output_tokens = history.total_output_tokens() if hasattr(history, 'total_output_tokens') else 0
                    print(f"[Token Usage] Prep action: input={prep_input_tokens}, output={prep_output_tokens}")
                    
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
                        "inputTokens": prep_input_tokens,
                        "outputTokens": prep_output_tokens,
                    })
                except asyncio.TimeoutError:
                    yield sse_event("task_failed", {
                        "signal": "prep",
                        "error": f"Prep action timed out after 60 seconds. URL may be unreachable: {request.url}",
                    })
                    # Continue with diagnostic tasks anyway - they might still work
                except Exception as prep_err:
                    yield sse_event("task_failed", {
                        "signal": "prep",
                        "error": f"Prep action failed: {str(prep_err)[:200]}",
                    })
                    # Continue with diagnostic tasks anyway
            
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
                    
                    # Get token usage
                    task_input_tokens = history.total_input_tokens() if hasattr(history, 'total_input_tokens') else 0
                    task_output_tokens = history.total_output_tokens() if hasattr(history, 'total_output_tokens') else 0
                    print(f"[Token Usage] {task.name}: input={task_input_tokens}, output={task_output_tokens}")
                    
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
                        "inputTokens": task_input_tokens,
                        "outputTokens": task_output_tokens,
                    })
                    
                    yield sse_event("task_complete", {
                        "signal": task.signal,
                        "output": result[:500] if result else "Completed",
                        "inputTokens": task_input_tokens,
                        "outputTokens": task_output_tokens,
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
            
            # Calculate total tokens
            total_input_tokens = sum(r.get("inputTokens", 0) for r in results)
            total_output_tokens = sum(r.get("outputTokens", 0) for r in results)
            print(f"[Token Usage] TOTAL: input={total_input_tokens}, output={total_output_tokens}")
            
            # Final complete event
            yield sse_event("complete", {
                "success": True,
                "results": results,
                "videoUrl": video_url,
                "scanId": scan_id,
                "totalInputTokens": total_input_tokens,
                "totalOutputTokens": total_output_tokens,
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
            
            # Get token usage
            input_tokens = history.total_input_tokens() if hasattr(history, 'total_input_tokens') else 0
            output_tokens = history.total_output_tokens() if hasattr(history, 'total_output_tokens') else 0
            print(f"[Token Usage] Task: input={input_tokens}, output={output_tokens}")
            
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
                "inputTokens": input_tokens,
                "outputTokens": output_tokens,
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
        
        # Get token usage
        input_tokens = history.total_input_tokens() if hasattr(history, 'total_input_tokens') else 0
        output_tokens = history.total_output_tokens() if hasattr(history, 'total_output_tokens') else 0
        print(f"[Token Usage] Task: input={input_tokens}, output={output_tokens}")
        
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
            "inputTokens": input_tokens,
            "outputTokens": output_tokens,
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

