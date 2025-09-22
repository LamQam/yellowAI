# app/api/endpoints/projects.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List

from app.database.db import get_db
from app.structure.structure import User, Project, Message, File
from app.schemas.project import ProjectCreate, ProjectUpdate, ProjectResponse
from app.api.dependencies import get_current_user, get_user_project

router = APIRouter()


@router.get("/", response_model=List[ProjectResponse])
async def list_projects(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all projects for the current user."""
    projects = db.query(
        Project,
        func.count(Message.id).label('messages_count'),
        func.count(File.id).label('files_count')
    ).outerjoin(Message).outerjoin(File).filter(
        Project.user_id == current_user.id
    ).group_by(Project.id).order_by(Project.created_at.desc()).all()

    project_responses = []
    for project, messages_count, files_count in projects:
        project_response = ProjectResponse(
            id=project.id,
            user_id=project.user_id,
            name=project.name,
            description=project.description,
            system_prompt=project.system_prompt,
            created_at=project.created_at,
            updated_at=project.updated_at,
            messages_count=messages_count or 0,
            files_count=files_count or 0
        )
        project_responses.append(project_response)

    return project_responses


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project: Project = Depends(get_user_project),
    db: Session = Depends(get_db)
):
    """Get a specific project."""
    # Count messages and files
    messages_count = db.query(Message).filter(
        Message.project_id == project.id).count()
    files_count = db.query(File).filter(File.project_id == project.id).count()

    return ProjectResponse(
        id=project.id,
        user_id=project.user_id,
        name=project.name,
        description=project.description,
        system_prompt=project.system_prompt,
        created_at=project.created_at,
        updated_at=project.updated_at,
        messages_count=messages_count,
        files_count=files_count
    )


@router.post("/", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    project_data: ProjectCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new project."""
    project = Project(
        name=project_data.name,
        description=project_data.description,
        system_prompt=project_data.system_prompt,
        user_id=current_user.id
    )

    db.add(project)
    db.commit()
    db.refresh(project)

    return ProjectResponse(
        id=project.id,
        user_id=project.user_id,
        name=project.name,
        description=project.description,
        system_prompt=project.system_prompt,
        created_at=project.created_at,
        updated_at=project.updated_at,
        messages_count=0,
        files_count=0
    )


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_data: ProjectUpdate,
    project: Project = Depends(get_user_project),
    db: Session = Depends(get_db)
):
    """Update a project."""
    project.name = project_data.name
    project.description = project_data.description
    project.system_prompt = project_data.system_prompt

    db.commit()
    db.refresh(project)

    # Count messages and files
    messages_count = db.query(Message).filter(
        Message.project_id == project.id).count()
    files_count = db.query(File).filter(File.project_id == project.id).count()

    return ProjectResponse(
        id=project.id,
        user_id=project.user_id,
        name=project.name,
        description=project.description,
        system_prompt=project.system_prompt,
        created_at=project.created_at,
        updated_at=project.updated_at,
        messages_count=messages_count,
        files_count=files_count
    )


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project: Project = Depends(get_user_project),
    db: Session = Depends(get_db)
):
    """Delete a project."""
    db.delete(project)
    db.commit()
    return None
