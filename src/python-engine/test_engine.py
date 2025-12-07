"""
Tests for AgentRank Python Engine

Run: pytest src/python-engine/test_engine.py -v
"""

import pytest
import asyncio
import os
from unittest.mock import Mock, patch, AsyncMock


class TestBrowserConfiguration:
    """Tests for browser initialization settings"""
    
    def test_browser_uses_local_not_cloud(self):
        """Verify Browser() is configured to use local Chromium, not cloud"""
        from browser_use import Browser
        
        browser = Browser(
            headless=True,
            use_cloud=False,
            is_local=True,
        )
        
        assert browser.browser_profile.use_cloud == False, "use_cloud should be False"
        assert browser.browser_profile.is_local == True, "is_local should be True"
        assert browser.browser_profile.cloud_browser_params is None, "cloud_browser_params should be None"
    
    def test_timeout_param_causes_cloud_mode(self):
        """Document the browser-use bug: timeout param triggers cloud mode"""
        from browser_use import Browser
        
        # This demonstrates the bug we worked around
        browser_with_timeout = Browser(
            headless=True,
            use_cloud=False,
            is_local=True,
            timeout=120,  # This triggers the bug
        )
        
        # With timeout, cloud_browser_params gets created incorrectly
        # This test documents the bug behavior
        assert browser_with_timeout.browser_profile.cloud_browser_params is not None, \
            "Bug: timeout param incorrectly creates cloud_browser_params"
    
    def test_video_recording_enabled(self):
        """Verify video recording can be configured"""
        from browser_use import Browser
        import tempfile
        
        with tempfile.TemporaryDirectory() as tmpdir:
            browser = Browser(
                headless=True,
                use_cloud=False,
                is_local=True,
                record_video_dir=tmpdir,
            )
            
            # Check that video recording is configured (exact implementation varies)
            assert str(browser.browser_profile.record_video_dir) == tmpdir


class TestHealthEndpoint:
    """Tests for /health endpoint"""
    
    def test_health_returns_ok(self):
        """Health endpoint returns status ok"""
        from main import app
        from fastapi.testclient import TestClient
        
        client = TestClient(app)
        response = client.get("/health")
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["video_recording"] == True
        assert data["streaming"] == True


class TestLLMConfiguration:
    """Tests for LLM initialization"""
    
    def test_get_llm_with_azure_openai(self):
        """get_llm returns AzureChatOpenAI when Azure vars are set"""
        with patch.dict(os.environ, {
            "AZURE_OPENAI_ENDPOINT": "https://test.openai.azure.com/",
            "AZURE_OPENAI_API_KEY": "test-key",
            "OPENAI_API_KEY": "",
            "ANTHROPIC_API_KEY": ""
        }):
            from main import get_llm
            llm = get_llm()
            assert "Azure" in type(llm).__name__
    
    def test_azure_takes_priority_over_openai(self):
        """Azure OpenAI takes priority over standard OpenAI"""
        with patch.dict(os.environ, {
            "AZURE_OPENAI_ENDPOINT": "https://test.openai.azure.com/",
            "AZURE_OPENAI_API_KEY": "azure-key",
            "OPENAI_API_KEY": "openai-key",
            "ANTHROPIC_API_KEY": ""
        }):
            from main import get_llm
            llm = get_llm()
            assert "Azure" in type(llm).__name__
    
    def test_get_llm_with_openai_key(self):
        """get_llm returns ChatOpenAI when OPENAI_API_KEY is set (no Azure)"""
        with patch.dict(os.environ, {
            "AZURE_OPENAI_ENDPOINT": "",
            "AZURE_OPENAI_API_KEY": "",
            "OPENAI_API_KEY": "test-key",
            "ANTHROPIC_API_KEY": ""
        }):
            from main import get_llm
            llm = get_llm()
            
            # Should be OpenAI instance
            assert "OpenAI" in type(llm).__name__ or "ChatOpenAI" in type(llm).__name__
    
    def test_get_llm_with_anthropic_key(self):
        """get_llm returns ChatAnthropic when ANTHROPIC_API_KEY is set"""
        with patch.dict(os.environ, {
            "AZURE_OPENAI_ENDPOINT": "",
            "AZURE_OPENAI_API_KEY": "",
            "OPENAI_API_KEY": "",
            "ANTHROPIC_API_KEY": "test-key"
        }):
            from main import get_llm
            llm = get_llm()
            
            assert "Anthropic" in type(llm).__name__ or "ChatAnthropic" in type(llm).__name__
    
    def test_get_llm_raises_without_key(self):
        """get_llm raises ValueError when no API key is set"""
        with patch.dict(os.environ, {
            "AZURE_OPENAI_ENDPOINT": "",
            "AZURE_OPENAI_API_KEY": "",
            "OPENAI_API_KEY": "",
            "ANTHROPIC_API_KEY": ""
        }, clear=False):
            # Clear the keys
            os.environ.pop("AZURE_OPENAI_ENDPOINT", None)
            os.environ.pop("AZURE_OPENAI_API_KEY", None)
            os.environ.pop("OPENAI_API_KEY", None)
            os.environ.pop("ANTHROPIC_API_KEY", None)
            
            from main import get_llm
            with pytest.raises(ValueError, match="No API key found"):
                get_llm()


class TestSSEEventFormat:
    """Tests for SSE event formatting"""
    
    def test_sse_event_format(self):
        """Verify SSE events are correctly formatted"""
        from main import sse_event
        
        result = sse_event("test", {"key": "value"})
        
        assert result.startswith("data: ")
        assert result.endswith("\n\n")
        assert '"type": "test"' in result
        assert '"key": "value"' in result
    
    def test_sse_event_start(self):
        """Start event includes expected fields"""
        from main import sse_event
        import json
        
        result = sse_event("start", {"scanId": "abc123", "message": "Starting..."})
        data_part = result.replace("data: ", "").strip()
        data = json.loads(data_part)
        
        assert data["type"] == "start"
        assert data["scanId"] == "abc123"
        assert data["message"] == "Starting..."
    
    def test_sse_event_complete(self):
        """Complete event includes expected fields"""
        from main import sse_event
        import json
        
        result = sse_event("complete", {
            "success": True,
            "results": [],
            "videoUrl": "https://example.com/video.mp4"
        })
        data_part = result.replace("data: ", "").strip()
        data = json.loads(data_part)
        
        assert data["type"] == "complete"
        assert data["success"] == True
        assert data["videoUrl"] == "https://example.com/video.mp4"


class TestTaskRequestValidation:
    """Tests for TaskRequest and ScanRequest models"""
    
    def test_task_request_valid(self):
        """TaskRequest accepts valid input"""
        from main import TaskRequest
        
        request = TaskRequest(
            task="Click the button",
            url="https://example.com",
            record_video=True
        )
        
        assert request.task == "Click the button"
        assert request.url == "https://example.com"
        assert request.record_video == True
    
    def test_task_request_defaults(self):
        """TaskRequest has correct defaults"""
        from main import TaskRequest
        
        request = TaskRequest(
            task="Test task",
            url="https://example.com"
        )
        
        assert request.record_video == True  # Default
    
    def test_scan_request_valid(self):
        """ScanRequest accepts valid input with multiple tasks"""
        from main import ScanRequest, ScanTask
        
        request = ScanRequest(
            url="https://example.com",
            tasks=[
                ScanTask(name="Task 1", signal="signal1", prompt="Do task 1"),
                ScanTask(name="Task 2", signal="signal2", prompt="Do task 2"),
            ],
            prep_prompt="Accept cookies",
            record_video=True
        )
        
        assert request.url == "https://example.com"
        assert len(request.tasks) == 2
        assert request.prep_prompt == "Accept cookies"
    
    def test_scan_request_optional_prep(self):
        """ScanRequest prep_prompt is optional"""
        from main import ScanRequest, ScanTask
        
        request = ScanRequest(
            url="https://example.com",
            tasks=[ScanTask(name="Task", signal="sig", prompt="Do it")]
        )
        
        assert request.prep_prompt is None


class TestEndpointExists:
    """Tests to verify all endpoints exist"""
    
    def test_scan_stream_endpoint_exists(self):
        """POST /scan/stream endpoint exists"""
        from main import app
        
        routes = [route.path for route in app.routes]
        assert "/scan/stream" in routes
    
    def test_task_stream_endpoint_exists(self):
        """POST /task/stream endpoint exists"""
        from main import app
        
        routes = [route.path for route in app.routes]
        assert "/task/stream" in routes
    
    def test_task_endpoint_exists(self):
        """POST /task endpoint exists"""
        from main import app
        
        routes = [route.path for route in app.routes]
        assert "/task" in routes


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
