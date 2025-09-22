# app/api/endpoints/chat.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from openai import OpenAI
from typing import List
import logging

from app.database.db import get_db
from app.database.config import settings
from app.structure.structure import Project, Message
from app.schemas.chat import ChatMessage, ChatResponse, MessageResponse, ChatHistoryResponse
from app.api.dependencies import get_user_project

router = APIRouter()
logger = logging.getLogger(__name__)

# Initialize OpenAI client
openai_client = OpenAI(
    api_key=settings.OPENAI_API_KEY) if settings.OPENAI_API_KEY else None


@router.post("/{project_id}", response_model=ChatResponse)
async def send_message(
    message_data: ChatMessage,
    project: Project = Depends(get_user_project),
    db: Session = Depends(get_db)
):
    """Send a message to the AI agent for a specific project."""
    if not openai_client:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OpenAI API key not configured"
        )

    try:
        # Save user message
        user_message = Message(
            project_id=project.id,
            role="user",
            content=message_data.message
        )
        db.add(user_message)
        db.commit()
        db.refresh(user_message)

        # Get conversation history (last 20 messages for context)
        recent_messages = db.query(Message).filter(
            Message.project_id == project.id
        ).order_by(Message.created_at.desc()).limit(20).all()

        # Prepare messages for OpenAI (reverse order for chronological)
        openai_messages = []

        # Add system prompt if available
        if project.system_prompt:
            openai_messages.append({
                "role": "system",
                "content": project.system_prompt
            })

        # Add conversation history
        for msg in reversed(recent_messages):
            openai_messages.append({
                "role": msg.role,
                "content": msg.content
            })

        # Generate AI response
        response = openai_client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=openai_messages,
            max_tokens=1000,
            temperature=0.7
        )

        ai_content = response.choices[0].message.content

        # Save AI response
        assistant_message = Message(
            project_id=project.id,
            role="assistant",
            content=ai_content
        )
        db.add(assistant_message)
        db.commit()
        db.refresh(assistant_message)

        return ChatResponse(
            user_message=MessageResponse(
                id=user_message.id,
                project_id=user_message.project_id,
                role=user_message.role,
                content=user_message.content,
                created_at=user_message.created_at
            ),
            assistant_message=MessageResponse(
                id=assistant_message.id,
                project_id=assistant_message.project_id,
                role=assistant_message.role,
                content=assistant_message.content,
                created_at=assistant_message.created_at
            )
        )

    except Exception as e:
        logger.error(f"Error generating AI response: {str(e)}")
        # If AI call fails, still save the user message but return an error response

        error_message = Message(
            project_id=project.id,
            role="assistant",
            content="I'm sorry, I'm having trouble processing your request right now. Please try again later."
        )
        db.add(error_message)
        db.commit()
        db.refresh(error_message)

        return ChatResponse(
            user_message=MessageResponse(
                id=user_message.id,
                project_id=user_message.project_id,
                role=user_message.role,
                content=user_message.content,
                created_at=user_message.created_at
            ),
            assistant_message=MessageResponse(
                id=error_message.id,
                project_id=error_message.project_id,
                role=error_message.role,
                content=error_message.content,
                created_at=error_message.created_at
            )
        )


@router.get("/{project_id}/history", response_model=ChatHistoryResponse)
async def get_chat_history(
    project: Project = Depends(get_user_project),
    db: Session = Depends(get_db),
    limit: int = 50,
    offset: int = 0
):
    """Get chat history for a project."""
    # Get messages with pagination
    messages = db.query(Message).filter(
        Message.project_id == project.id
    ).order_by(Message.created_at.desc()).offset(offset).limit(limit).all()

    # Get total count
    total = db.query(Message).filter(Message.project_id == project.id).count()

    # Convert to response format (reverse for chronological order)
    message_responses = []
    for message in reversed(messages):
        message_responses.append(MessageResponse(
            id=message.id,
            project_id=message.project_id,
            role=message.role,
            content=message.content,
            created_at=message.created_at
        ))

    return ChatHistoryResponse(
        messages=message_responses,
        total=total
    )
