from pydantic import BaseModel, validator
from datetime import datetime
from typing import Optional
# app/schemas/project.py


class ProjectBase(BaseModel):
    name: str
    description: Optional[str] = None
    system_prompt: Optional[str] = None

    @validator('name')
    def validate_name(cls, v):
        if not v or len(v.strip()) == 0:
            raise ValueError('Project name cannot be empty')
        if len(v) > 200:
            raise ValueError('Project name must be less than 200 characters')
        return v.strip()


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(ProjectBase):
    pass


class ProjectResponse(ProjectBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime
    messages_count: Optional[int] = 0
    files_count: Optional[int] = 0

    class Config:
        from_attributes = True
