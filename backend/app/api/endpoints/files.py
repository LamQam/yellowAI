# app/api/endpoints/files.py
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File as FastAPIFile
from sqlalchemy.orm import Session
from openai import OpenAI
import os
import uuid
import magic
import aiofiles
from typing import List

from app.database.database import get_db
from app.database.config import settings
from app.structure.structure import Project, File
from app.schemas.file import FileUploadResponse, FileListResponse
from app.api.dependencies import get_user_project

router = APIRouter()

# Initialize OpenAI client
openai_client = OpenAI(
    api_key=settings.OPENAI_API_KEY) if settings.OPENAI_API_KEY else None


@router.post("/{project_id}", response_model=FileUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_file(
    file: UploadFile = FastAPIFile(...),
    project: Project = Depends(get_user_project),
    db: Session = Depends(get_db)
):
    """Upload a file to a project."""

    # Validate file size
    if file.size and file.size > settings.MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File size exceeds maximum allowed size of {settings.MAX_FILE_SIZE} bytes"
        )

    # Read file content to validate
    content = await file.read()

    # Reset file position
    await file.seek(0)

    # Detect content type
    content_type = magic.from_buffer(content, mime=True)

    # Validate file type
    if content_type not in settings.ALLOWED_FILE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"File type {content_type} not allowed"
        )

    try:
        # Generate unique filename
        file_extension = os.path.splitext(
            file.filename)[1] if file.filename else ""
        unique_filename = f"{uuid.uuid4()}{file_extension}"
        file_path = os.path.join(settings.UPLOAD_DIRECTORY, unique_filename)

        # Save file locally
        async with aiofiles.open(file_path, 'wb') as f:
            await f.write(content)

        # Upload to OpenAI (optional)
        openai_file_id = None
        if openai_client and content_type in ["text/plain", "text/csv", "application/json"]:
            try:
                with open(file_path, 'rb') as f:
                    openai_file = openai_client.files.create(
                        file=f,
                        purpose='assistants'
                    )
                    openai_file_id = openai_file.id
            except Exception as e:
                # Log error but don't fail the upload
                print(f"Failed to upload to OpenAI: {str(e)}")

        # Save file record to database
        db_file = File(
            project_id=project.id,
            filename=unique_filename,
            original_name=file.filename or "unknown",
            content_type=content_type,
            size=len(content),
            openai_file_id=openai_file_id
        )

        db.add(db_file)
        db.commit()
        db.refresh(db_file)

        return FileUploadResponse(
            id=db_file.id,
            project_id=db_file.project_id,
            filename=db_file.filename,
            original_name=db_file.original_name,
            content_type=db_file.content_type,
            size=db_file.size,
            openai_file_id=db_file.openai_file_id,
            created_at=db_file.created_at
        )

    except Exception as e:
        # Clean up file if database operation fails
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload file: {str(e)}"
        )


@router.get("/{project_id}", response_model=FileListResponse)
async def list_project_files(
    project: Project = Depends(get_user_project),
    db: Session = Depends(get_db)
):
    """List all files for a project."""
    files = db.query(File).filter(
        File.project_id == project.id
    ).order_by(File.created_at.desc()).all()

    file_responses = []
    for file in files:
        file_responses.append(FileUploadResponse(
            id=file.id,
            project_id=file.project_id,
            filename=file.filename,
            original_name=file.original_name,
            content_type=file.content_type,
            size=file.size,
            openai_file_id=file.openai_file_id,
            created_at=file.created_at
        ))

    return FileListResponse(
        files=file_responses,
        total=len(file_responses)
    )


@router.delete("/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_file(
    file_id: int,
    db: Session = Depends(get_db),
    # This ensures user owns the project
    current_user=Depends(get_user_project)
):
    """Delete a file."""
    # Get file record
    db_file = db.query(File).filter(File.id == file_id).first()

    if not db_file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found"
        )

    # Verify file belongs to user's project
    project = db.query(Project).filter(
        Project.id == db_file.project_id,
        Project.user_id == current_user.id
    ).first()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this file"
        )

    try:
        # Delete from OpenAI if exists
        if openai_client and db_file.openai_file_id:
            try:
                openai_client.files.delete(db_file.openai_file_id)
            except Exception as e:
                print(f"Failed to delete from OpenAI: {str(e)}")

        # Delete local file
        file_path = os.path.join(settings.UPLOAD_DIRECTORY, db_file.filename)
        if os.path.exists(file_path):
            os.remove(file_path)

        # Delete database record
        db.delete(db_file)
        db.commit()

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete file: {str(e)}"
        )
