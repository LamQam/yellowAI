
from pydantic import BaseModel, validator
from datetime import datetime
from typing import List


class ChatMessage(BaseModel):
    message: str

    @validator('message')
    def validate_message(cls, v):
        if not v or len(v.strip()) == 0:
            raise ValueError('Message cannot be empty')
        if len(v) > 5000:
            raise ValueError('Message must be less than 5000 characters')
        return v.strip()


class MessageResponse(BaseModel):
    id: int
    project_id: int
    role: str
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


class ChatResponse(BaseModel):
    user_message: MessageResponse
    assistant_message: MessageResponse


class ChatHistoryResponse(BaseModel):
    messages: List[MessageResponse]
    total: int
