from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional


class FileUploadResponse(BaseModel):
    id: int
    project_id: int
    filename: str
    original_name: str
    content_type: Optional[str]
    size: Optional[int]
    openai_file_id: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class FileListResponse(BaseModel):
    files: List[FileUploadResponse]
    total: int
