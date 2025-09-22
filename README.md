# Chatbot Platform 

A minimal but scalable chatbot platform with user authentication, project management, and AI chat capabilities built with Python FastAPI.

## Architecture Overview

### Tech Stack
- **Backend**: Python FastAPI with SQLAlchemy ORM
- **Frontend**: React with TypeScript, Tailwind CSS, Vite
- **Database**: PostgreSQL
- **Authentication**: JWT with bcrypt password hashing
- **AI Integration**: OpenAI API (configurable for OpenRouter or other providers)
- **File Storage**: Local filesystem with API endpoints (production: AWS S3)
- **Deployment**: Docker containers with Docker Compose

### System Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Client  │    │   FastAPI       │    │   PostgreSQL    │
│                 │    │                 │    │                 │
│ • Authentication│◄──►│ • JWT Auth      │◄──►│ • Users         │
│ • Project Mgmt  │    │ • Project CRUD  │    │ • Projects      │
│ • Chat Interface│    │ • Chat Logic    │    │ • Messages      │
│ • File Upload   │    │ • File Upload   │    │ • Files         │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   OpenAI API    │
                       │                 │
                       │ • Chat Completions
                       │ • File Processing
                       └─────────────────┘
```

### Key Features

1. **User Management**
   - JWT-based authentication
   - User registration and login
   - Secure password hashing with bcrypt
   - Protected routes with FastAPI dependencies

2. **Project/Agent Management**
   - Create and manage multiple projects per user
   - Associate custom prompts with projects
   - Project-based chat isolation

3. **Chat Interface**
   - Real-time chat with AI agents
   - Message history persistence
   - Context-aware conversations
   - Streaming responses support

4. **File Management**
   - Upload files to projects
   - Integration with OpenAI Files API
   - File association with chat contexts

5. **Security & Scalability**
   - Input validation with Pydantic models
   - Rate limiting with slowapi
   - Error handling and logging
   - Database connection pooling
   - Async request handling

## Installation & Setup

### Prerequisites
- Python 3.9+ and pip
- PostgreSQL 14+
- Node.js 18+ (for frontend)
- Docker and Docker Compose (optional)

### Environment Variables

Create `.env` files in both backend and frontend directories:

**Backend (.env)**
```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/chatbot_platform"

# Authentication
SECRET_KEY="your-super-secret-jwt-key-here"
ALGORITHM="HS256"
ACCESS_TOKEN_EXPIRE_MINUTES=10080

# OpenAI
OPENAI_API_KEY="sk-your-openai-api-key"

# Server
BACKEND_PORT=8000
ENVIRONMENT=development

# CORS
FRONTEND_URL="http://localhost:5173"

# File Upload
MAX_FILE_SIZE=10485760  # 10MB
UPLOAD_DIRECTORY="uploads"
```

**Frontend (.env)**
```env
VITE_API_URL=http://localhost:8000
```

### Quick Start with Docker

```bash
# Clone the repository
git clone <repository-url>
cd chatbot-platform

# Start all services
docker compose up -d db

# The application will be available at:
# Frontend: http://localhost:5173
# Backend: http://localhost:8000
```

### Manual Installation

#### Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt

# System dependencies

brew install libmagic # On Windows: sudo apt-get install libmagic1

# Setup database
alembic upgrade head

# Start development server
uvicorn app.main:app --reload --port 8000
```

#### Frontend Setup
```bash
cd frontend
npm install

# Start development server
npm run dev
```

## API Endpoints

### Authentication
- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `GET /auth/me` - Get current user (protected)

### Projects
- `GET /projects/` - List user projects (protected)
- `POST /projects/` - Create new project (protected)
- `GET /projects/{project_id}` - Get project details (protected)
- `PUT /projects/{project_id}` - Update project (protected)
- `DELETE /projects/{project_id}` - Delete project (protected)

### Chat
- `POST /chat/{project_id}` - Send chat message (protected)
- `GET /chat/{project_id}/history` - Get chat history (protected)

### Files
- `POST /files/{project_id}` - Upload file to project (protected)
- `GET /files/{project_id}` - List project files (protected)
- `DELETE /files/{file_id}` - Delete file (protected)

### Documentation
- `GET /docs` - Interactive API documentation (Swagger UI)
- `GET /redoc` - Alternative API documentation

## Database Schema

```python
# SQLAlchemy Models
class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class Project(Base):
    __tablename__ = "projects"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text)
    system_prompt = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class Message(Base):
    __tablename__ = "messages"
    
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    role = Column(String, nullable=False)  # 'user' or 'assistant'
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class File(Base):
    __tablename__ = "files"
    
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    filename = Column(String, nullable=False)
    original_name = Column(String, nullable=False)
    content_type = Column(String)
    size = Column(Integer)
    openai_file_id = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
```

## Deployment

### Production Considerations

1. **Database**: Use managed PostgreSQL (AWS RDS, Google Cloud SQL)
2. **File Storage**: Use object storage (AWS S3, Google Cloud Storage)
3. **Environment**: Set ENVIRONMENT=production
4. **SSL**: Enable HTTPS with proper certificates
5. **Monitoring**: Add logging and monitoring
6. **Scaling**: Use multiple worker processes with Gunicorn

### Docker Deployment

The application includes production-ready Docker configurations:

```bash
# Build and deploy
docker-compose -f docker-compose.prod.yml up -d
```

### Cloud Deployment Options

1. **AWS**: ECS with RDS and S3
2. **Google Cloud**: Cloud Run with Cloud SQL and Cloud Storage
3. **DigitalOcean**: App Platform with Managed Database
4. **Railway**: Simplified deployment with built-in PostgreSQL

## Performance Optimizations

1. **Database**: Connection pooling with SQLAlchemy
2. **Async Operations**: Full async/await support
3. **Caching**: Redis integration for session caching
4. **Rate Limiting**: Built-in rate limiting
5. **Response Models**: Optimized Pydantic response models

## Security Features

1. **Input Validation**: Pydantic model validation
2. **SQL Injection Prevention**: SQLAlchemy ORM protection
3. **Password Security**: bcrypt hashing
4. **JWT Security**: Proper token validation and expiration
5. **CORS Configuration**: Controlled cross-origin requests
6. **Rate Limiting**: API endpoint protection

## Testing

```bash
# Backend tests
cd backend
pytest

# Frontend tests
cd frontend
npm test
```

## Project Structure

```
chatbot-platform/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py
│   │   ├── core/
│   │   │   ├── config.py
│   │   │   ├── security.py
│   │   │   └── database.py
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   └── models.py
│   │   ├── schemas/
│   │   │   ├── __init__.py
│   │   │   ├── user.py
│   │   │   ├── project.py
│   │   │   └── chat.py
│   │   ├── api/
│   │   │   ├── __init__.py
│   │   │   ├── deps.py
│   │   │   └── endpoints/
│   │   │       ├── auth.py
│   │   │       ├── projects.py
│   │   │       ├── chat.py
│   │   │       └── files.py
│   │   └── services/
│   │       ├── __init__.py
│   │       ├── auth.py
│   │       ├── openai.py
│   │       └── file.py
│   ├── alembic/
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env
├── frontend/
│   ├── src/
│   ├── package.json
│   ├── Dockerfile
│   └── .env
├── docker-compose.yml
├── docker-compose.prod.yml
└── README.md
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## License

MIT License - see LICENSE file for details