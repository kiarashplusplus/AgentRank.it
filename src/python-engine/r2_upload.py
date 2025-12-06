"""
Cloudflare R2 Upload Utility

Uploads video recordings to Cloudflare R2 for agent replay playback.
Uses boto3 with S3-compatible API.
"""

import boto3
import os
import uuid
from pathlib import Path

# R2 Configuration from environment
R2_ACCOUNT_ID = os.getenv("R2_ACCOUNT_ID", "")
R2_ACCESS_KEY = os.getenv("R2_ACCESS_KEY", "")
R2_SECRET_KEY = os.getenv("R2_SECRET_KEY", "")
R2_BUCKET_NAME = os.getenv("R2_BUCKET_NAME", "agentrank-replays")
R2_PUBLIC_URL = os.getenv("R2_PUBLIC_URL", "")  # e.g., https://replays.agentrank.it


def get_r2_client():
    """Get configured R2 client"""
    if not all([R2_ACCOUNT_ID, R2_ACCESS_KEY, R2_SECRET_KEY]):
        return None
    
    return boto3.client(
        's3',
        endpoint_url=f'https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com',
        aws_access_key_id=R2_ACCESS_KEY,
        aws_secret_access_key=R2_SECRET_KEY,
        region_name='auto',
    )


def upload_video(local_path: str, scan_id: str = None) -> str | None:
    """
    Upload a video file to R2 and return the public URL.
    
    Args:
        local_path: Path to the local video file
        scan_id: Optional scan ID for naming, generates UUID if not provided
        
    Returns:
        Public URL to the video, or None if upload fails
    """
    client = get_r2_client()
    if not client:
        print("R2 not configured, skipping upload")
        return None
    
    try:
        file_path = Path(local_path)
        if not file_path.exists():
            print(f"Video file not found: {local_path}")
            return None
        
        # Generate key
        if not scan_id:
            scan_id = str(uuid.uuid4())[:8]
        
        extension = file_path.suffix or ".webm"
        key = f"replays/{scan_id}{extension}"
        
        # Upload with content type
        client.upload_file(
            str(file_path),
            R2_BUCKET_NAME,
            key,
            ExtraArgs={
                'ContentType': 'video/webm',
            }
        )
        
        # Return public URL
        if R2_PUBLIC_URL:
            return f"{R2_PUBLIC_URL}/{key}"
        else:
            # Return R2 URL (requires public bucket or signed URLs)
            return f"https://{R2_BUCKET_NAME}.{R2_ACCOUNT_ID}.r2.cloudflarestorage.com/{key}"
        
    except Exception as e:
        print(f"Failed to upload video to R2: {e}")
        return None


def cleanup_local_video(local_path: str):
    """Remove local video file after upload"""
    try:
        Path(local_path).unlink(missing_ok=True)
    except Exception as e:
        print(f"Failed to cleanup local video: {e}")
