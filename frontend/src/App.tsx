import React, { useState, useEffect, createContext, useContext, useRef } from 'react';
import {
  MessageCircle,
  Plus,
  LogOut,
  Send,
  Upload,
  Trash2,
  Edit,
  User,
  Bot,
  FileText,
  Loader2
} from 'lucide-react';

// Types
interface User {
  id: number;
  email: string;
  full_name: string;
  is_active: boolean;
  created_at: string;
  projects_count?: number;
}

interface Project {
  id: number;
  name: string;
  description?: string;
  system_prompt?: string;
  created_at: string;
  updated_at: string;
  messages_count?: number;
  files_count?: number;
}

interface Message {
  id: number;
  project_id: number;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

interface FileUpload {
  id: number;
  filename: string;
  original_name: string;
  content_type?: string;
  size?: number;
  created_at: string;
}

// API Service
class ApiService {
  private baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
  private token: string | null = localStorage.getItem('token');

  private async request(endpoint: string, options: RequestInit = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(this.token && { Authorization: `Bearer ${this.token}` }),
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      this.logout();
      throw new Error('Unauthorized');
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Network error' }));
      throw new Error(error.error || 'Request failed');
    }

    return response.json();
  }

  async login(email: string, password: string) {
    const response = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.token = response.access_token;
    localStorage.setItem('token', this.token!);
    return response;
  }

  async register(full_name: string, email: string, password: string) {
    const response = await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ full_name, email, password }),
    });
    this.token = response.access_token;
    localStorage.setItem('token', this.token!);
    return response;
  }

  async getMe(): Promise<{ user: User }> {
    return this.request('/auth/me');
  }

  async getProjects(): Promise<{ projects: Project[] }> {
    return this.request('/projects/');
  }

  async createProject(data: { name: string; description?: string; system_prompt?: string }): Promise<{ project: Project }> {
    return this.request('/projects/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateProject(id: number, data: { name: string; description?: string; system_prompt?: string }): Promise<{ project: Project }> {
    return this.request(`/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteProject(id: number) {
    return this.request(`/projects/${id}`, {
      method: 'DELETE',
    });
  }

  async sendMessage(projectId: number, message: string) {
    return this.request(`/chat/${projectId}`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  }

  async getChatHistory(projectId: number): Promise<{ messages: Message[] }> {
    return this.request(`/chat/${projectId}/history`);
  }

  async uploadFile(projectId: number, file: File) {
    const formData = new FormData();
    formData.append('file', file);

    return fetch(`${this.baseURL}/files/${projectId}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
      body: formData,
    }).then(async (res) => {
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(error.error || 'Upload failed');
      }
      return res.json();
    });
  }

  async getFiles(projectId: number): Promise<{ files: FileUpload[] }> {
    return this.request(`/files/${projectId}`);
  }

  logout() {
    this.token = null;
    localStorage.removeItem('token');
  }
}

const api = new ApiService();

// Auth Context
const AuthContext = createContext<{
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
} | null>(null);

const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      api.getMe()
        .then(({ user }) => setUser(user))
        .catch(() => {
          localStorage.removeItem('token');
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    await api.login(email, password);
    const { user } = await api.getMe();
    setUser(user);
  };

  const register = async (full_name: string, email: string, password: string) => {
    await api.register(full_name, email, password);
    const { user } = await api.getMe();
    setUser(user);
  };

  const logout = () => {
    api.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

// Toast Hook
const useToast = () => {
  const [toasts, setToasts] = useState<Array<{ id: number; message: string; type: 'success' | 'error' }>>([]);

  const addToast = (message: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
    }, 4000);
  };

  const removeToast = (id: number) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  return { toasts, addToast, removeToast, success: (msg: string) => addToast(msg, 'success'), error: (msg: string) => addToast(msg, 'error') };
};

// Components
const Toast: React.FC<{ toast: { id: number; message: string; type: 'success' | 'error' }; onRemove: (id: number) => void }> = ({ toast, onRemove }) => (
  <div className={`fixed top-4 right-4 p-4 rounded-md shadow-lg text-white z-50 ${toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'
    }`}>
    <div className="flex items-center justify-between">
      <span>{toast.message}</span>
      <button onClick={() => onRemove(toast.id)} className="ml-2 text-white hover:text-gray-200">
        ×
      </button>
    </div>
  </div>
);

const LoginForm: React.FC<{ onRegisterClick: () => void }> = ({ onRegisterClick }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const toast = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success('Login successful!');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Login failed');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to your account
          </h2>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <input
                type="email"
                required
                className="relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <input
                type="password"
                required
                className="relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sign in'}
            </button>
          </div>

          <div className="text-center">
            <button
              type="button"
              onClick={onRegisterClick}
              className="text-blue-600 hover:text-blue-500"
            >
              Don't have an account? Sign up
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const RegisterForm: React.FC<{ onLoginClick: () => void }> = ({ onLoginClick }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const toast = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register(name, email, password);
      toast.success('Registration successful!');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Registration failed');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Create your account
          </h2>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <input
                type="text"
                required
                className="relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <input
                type="email"
                required
                className="relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <input
                type="password"
                required
                minLength={6}
                className="relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Password (min 6 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sign up'}
            </button>
          </div>

          <div className="text-center">
            <button
              type="button"
              onClick={onLoginClick}
              className="text-blue-600 hover:text-blue-500"
            >
              Already have an account? Sign in
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const Navbar: React.FC<{ onCreateProject: () => void }> = ({ onCreateProject }) => {
  const { user, logout } = useAuth();

  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <MessageCircle className="h-8 w-8 text-blue-600" />
            <span className="ml-2 text-xl font-bold text-gray-900">ChatBot Platform</span>
          </div>

          {user && (
            <div className="flex items-center space-x-4">
              <button
                onClick={onCreateProject}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Project
              </button>

              <div className="flex items-center space-x-2">
                <User className="h-5 w-5 text-gray-500" />
                <span className="text-sm text-gray-700">{user.full_name}</span>
              </div>

              <button
                onClick={logout}
                className="text-gray-500 hover:text-gray-700"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

const ProjectCard: React.FC<{
  project: Project;
  onEdit: () => void;
  onDelete: () => void;
  onChat: () => void;
}> = ({ project, onEdit, onDelete, onChat }) => (
  <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
    <div className="flex justify-between items-start mb-4">
      <h3 className="text-lg font-semibold text-gray-900">{project.name}</h3>
      <div className="flex space-x-2">
        <button onClick={onEdit} className="text-gray-500 hover:text-blue-600">
          <Edit className="h-4 w-4" />
        </button>
        <button onClick={onDelete} className="text-gray-500 hover:text-red-600">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>

    {project.description && (
      <p className="text-gray-600 mb-4">{project.description}</p>
    )}

    <div className="flex items-center justify-between">
      <div className="flex space-x-4 text-sm text-gray-500">
        <span>{project.messages_count || 0} messages</span>
        <span>{project.files_count || 0} files</span>
      </div>

      <button
        onClick={onChat}
        className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
      >
        <MessageCircle className="h-4 w-4 mr-2" />
        Chat
      </button>
    </div>
  </div>
);

const ProjectModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  project?: Project;
  onSave: (data: { name: string; description?: string; system_prompt?: string }) => void;
}> = ({ isOpen, onClose, project, onSave }) => {
  const [name, setName] = useState(project?.name || '');
  const [description, setDescription] = useState(project?.description || '');
  const [systemPrompt, setSystemPrompt] = useState(project?.system_prompt || '');

  useEffect(() => {
    if (project) {
      setName(project.name);
      setDescription(project.description || '');
      setSystemPrompt(project.system_prompt || '');
    } else {
      setName('');
      setDescription('');
      setSystemPrompt('');
    }
  }, [project]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ name, description, system_prompt: systemPrompt });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full">
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-4">
            {project ? 'Edit Project' : 'Create New Project'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Project Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                rows={3}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                System Prompt
              </label>
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="Define how the AI should behave in this project..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                rows={4}
              />
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-md"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
              >
                {project ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

const ChatInterface: React.FC<{ project: Project; onBack: () => void }> = ({ project, onBack }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<FileUpload[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  useEffect(() => {
    loadChatHistory();
    loadFiles();
  }, [project.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadChatHistory = async () => {
    try {
      const { messages } = await api.getChatHistory(project.id);
      setMessages(messages);
    } catch (error) {
      toast.error('Failed to load chat history');
    }
  };

  const loadFiles = async () => {
    try {
      const { files } = await api.getFiles(project.id);
      setFiles(files);
    } catch (error) {
      console.error('Failed to load files:', error);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    setLoading(true);
    try {
      const response = await api.sendMessage(project.id, input);
      setMessages(prev => [...prev, response.user_message, response.assistant_message]);
      setInput('');
    } catch (error) {
      toast.error('Failed to send message');
    }
    setLoading(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      await api.uploadFile(project.id, file);
      toast.success('File uploaded successfully');
      loadFiles();
    } catch (error) {
      toast.error('Failed to upload file');
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <button
            onClick={onBack}
            className="text-blue-600 hover:text-blue-800 mb-2 text-sm"
          >
            ← Back to Dashboard
          </button>
          <h2 className="text-lg font-semibold text-gray-900">{project.name}</h2>
          {project.description && (
            <p className="text-sm text-gray-600 mt-1">{project.description}</p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-4">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Files</h3>
            <div className="space-y-2">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center p-2 bg-gray-50 rounded-md text-sm"
                >
                  <FileText className="h-4 w-4 text-gray-500 mr-2" />
                  <span className="truncate">{file.original_name}</span>
                </div>
              ))}
            </div>
            <label className="mt-3 inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 cursor-pointer">
              <Upload className="h-4 w-4 mr-2" />
              Upload File
              <input
                type="file"
                className="hidden"
                onChange={handleFileUpload}
                accept=".txt,.csv,.json,.pdf,.jpg,.png"
              />
            </label>
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-3xl px-4 py-2 rounded-lg ${message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-900'
                  }`}
              >
                <div className="flex items-start space-x-2">
                  {message.role === 'assistant' && <Bot className="h-5 w-5 mt-0.5 text-gray-500" />}
                  <div className="flex-1">
                    <p className="whitespace-pre-wrap">{message.content}</p>
                    <p className={`text-xs mt-1 ${message.role === 'user' ? 'text-blue-200' : 'text-gray-500'
                      }`}>
                      {new Date(message.created_at).toLocaleTimeString()}
                    </p>
                  </div>
                  {message.role === 'user' && <User className="h-5 w-5 mt-0.5 text-blue-200" />}
                </div>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-white border border-gray-200 text-gray-900 max-w-3xl px-4 py-2 rounded-lg">
                <div className="flex items-center space-x-2">
                  <Bot className="h-5 w-5 text-gray-500" />
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>AI is thinking...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-gray-200 p-4">
          <form onSubmit={sendMessage} className="flex space-x-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

const Dashboard: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | undefined>();
  const [currentView, setCurrentView] = useState<'dashboard' | 'chat'>('dashboard');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const toast = useToast();

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const { projects } = await api.getProjects();
      setProjects(projects);
    } catch (error) {
      toast.error('Failed to load projects');
    }
    setLoading(false);
  };

  const handleCreateProject = () => {
    setEditingProject(undefined);
    setShowModal(true);
  };

  const handleEditProject = (project: Project) => {
    setEditingProject(project);
    setShowModal(true);
  };

  const handleSaveProject = async (data: { name: string; description?: string; system_prompt?: string }) => {
    try {
      if (editingProject) {
        await api.updateProject(editingProject.id, data);
        toast.success('Project updated successfully');
      } else {
        await api.createProject(data);
        toast.success('Project created successfully');
      }
      setShowModal(false);
      loadProjects();
    } catch (error) {
      toast.error(editingProject ? 'Failed to update project' : 'Failed to create project');
    }
  };

  const handleDeleteProject = async (project: Project) => {
    if (!confirm(`Are you sure you want to delete "${project.name}"?`)) return;

    try {
      await api.deleteProject(project.id);
      toast.success('Project deleted successfully');
      loadProjects();
    } catch (error) {
      toast.error('Failed to delete project');
    }
  };

  const handleStartChat = (project: Project) => {
    setSelectedProject(project);
    setCurrentView('chat');
  };

  const handleBackToDashboard = () => {
    setCurrentView('dashboard');
    setSelectedProject(null);
  };

  if (currentView === 'chat' && selectedProject) {
    return <ChatInterface project={selectedProject} onBack={handleBackToDashboard} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar onCreateProject={handleCreateProject} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Your Projects</h1>
          <p className="text-gray-600">Create and manage your AI chatbot projects</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-12">
            <MessageCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No projects yet</h3>
            <p className="text-gray-600 mb-6">Get started by creating your first chatbot project</p>
            <button
              onClick={handleCreateProject}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Project
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onEdit={() => handleEditProject(project)}
                onDelete={() => handleDeleteProject(project)}
                onChat={() => handleStartChat(project)}
              />
            ))}
          </div>
        )}
      </div>

      <ProjectModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        project={editingProject}
        onSave={handleSaveProject}
      />
    </div>
  );
};

// Main App Component
function ChatbotPlatform() {
  const [showRegister, setShowRegister] = useState(false);
  const toast = useToast();

  return (
    <AuthProvider>
      <div className="min-h-screen bg-gray-50">
        {/* Toast notifications */}
        {toast.toasts.map((toastItem) => (
          <Toast key={toastItem.id} toast={toastItem} onRemove={toast.removeToast} />
        ))}

        <AuthContent
          showRegister={showRegister}
          setShowRegister={setShowRegister}
        />
      </div>
    </AuthProvider>
  );
}

const AuthContent: React.FC<{ showRegister: boolean; setShowRegister: (show: boolean) => void }> = ({ showRegister, setShowRegister }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return showRegister ? (
      <RegisterForm onLoginClick={() => setShowRegister(false)} />
    ) : (
      <LoginForm onRegisterClick={() => setShowRegister(true)} />
    );
  }

  return <Dashboard />;
};

export default ChatbotPlatform;