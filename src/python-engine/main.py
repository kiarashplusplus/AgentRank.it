from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from browser_use import Agent
from browser_use.llm.models import get_llm_by_name
import os
import asyncio
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

class TaskRequest(BaseModel):
    task: str
    url: str

@app.post("/task")
async def run_task(request: TaskRequest):
    try:
        # Construct the full task prompt
        full_task = f"Navigate to {request.url}. {request.task}"
        
        # Initialize LLM using browser-use's factory
        llm = get_llm_by_name("openai_gpt_4o")
        
        # Initialize Agent
        agent = Agent(
            task=full_task,
            llm=llm,
        )
        
        # Run the agent
        history = await agent.run()
        
        # Get the final result
        result = history.final_result()
        
        # Extract screenshots if available (browser-use usually saves them locally)
        # For now, we'll just return the text result and step count
        
        return {
            "success": True,
            "output": result,
            "steps": len(history.history) if hasattr(history, 'history') else 0,
            "transcript": [str(step) for step in history.history] if hasattr(history, 'history') else []
        }
        
    except Exception as e:
        import traceback
        print(f"Error running task: {e}")
        traceback.print_exc()
        return {
            "success": False, 
            "error": str(e)
        }

@app.get("/health")
def health():
    return {"status": "ok"}
