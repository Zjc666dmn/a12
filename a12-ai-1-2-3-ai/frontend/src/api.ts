export type Task = {
  id: number;
  title: string;
  subject: string | null;
  audience: string | null;
  duration_minutes: number | null;
  status: string;
  requirement_summary: string | null;
  created_at: string;
  updated_at: string;
};

export type ChatMessage = {
  id: number;
  task_id: number;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
};

export type RequirementState = {
  subject?: string | null;
  grade?: string | null;
  topic?: string | null;
  audience?: string | null;
  duration?: number | null;
  scene?: string | null;
};

export type AgentSession = {
  stage: import('./types').StageKey;
  requirement: RequirementState;
  teaching: {
    objectives: string[];
    keyPoints: string[];
    difficultPoints: string[];
    activities: string[];
    exercises: string[];
  };
  outline: Array<{ order: number; title: string; purpose: string }>;
  style: { theme?: string | null; layout?: string | null; imageStyle?: string | null };
  ppt: { id?: number | null; slides: Array<{ order: number; title: string; purpose: string }> };
  control: {
    pendingField?: string | null;
    requirementConfirmed: boolean;
    teachingConfirmed: boolean;
    outlineConfirmed: boolean;
    styleConfirmed: boolean;
    lastTransition?: { from: string; to: string } | null;
  };
};

export type RequirementResponse = {
  task_id: number;
  state: RequirementState;
  session: AgentSession;
  stage: import('./types').StageKey;
  next_question?: string | null;
  completeness: number;
  missing_fields: string[];
};

export type EmbeddingProfile = {
  provider: string;
  model: string;
  dimension: number;
  collection: string;
};

export type KnowledgeSearchResult = {
  chunk_id?: number;
  source: string;
  content: string;
  score?: number | null;
  lexical_score?: number;
  vector_score?: number;
  match_type?: string;
  file_id?: number | null;
  chunk_index?: number | null;
  page?: number | null;
  section?: string | null;
  tags?: string[];
};

export type KnowledgeSearchResponse = {
  query: string;
  results: KnowledgeSearchResult[];
  message: string;
  embedding?: EmbeddingProfile | null;
};

export type KnowledgeVectorizeResponse = {
  file_id?: number | null;
  chunk_count: number;
  total_vectors: number;
  message: string;
  embedding: EmbeddingProfile;
};

export type GeneratedAsset = {
  id: number;
  task_id: number;
  asset_type: 'pptx' | 'docx' | 'pdf' | 'html' | 'image' | 'script' | string;
  file_path: string;
  file_name: string;
  version: number;
  created_at: string;
  download_url: string;
};

export type UploadedFile = {
  id: number;
  task_id: number;
  file_name: string;
  file_type: string;
  file_path: string;
  parse_status: string;
  parsed_content: string | null;
  purpose: 'content' | 'style' | 'case' | 'activity';
  focus: string | null;
  created_at: string;
};

export type ModelConfig = {
  id: string;
  provider: string;
  remark: string;
  website: string;
  apiKey: string;
  endpoint: string;
  model: string;
  logo: string;
  status: '未检测' | '连接正常' | '连接失败';
  useStandaloneTest: boolean;
  useStandaloneBilling: boolean;
  configJson: string;
  active?: boolean;
  hasApiKey?: boolean;
};

export type ModelConfigState = {
  activeModelId: string;
  models: ModelConfig[];
};

export type JobStatus = 'pending' | 'running' | 'succeeded' | 'failed';

export type JobEnqueue = {
  job_id: number;
  status: string;
  job_type: string;
};

export type Job = {
  id: number;
  task_id: number | null;
  job_type: string;
  status: JobStatus;
  progress?: string | null;
  payload?: Record<string, unknown> | null;
  result?: Record<string, unknown> | null;
  error?: string | null;
  created_at: string;
  updated_at: string;
};

export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api';

const TOKEN_STORAGE_KEY = 'teachnova_api_token';

export function getApiToken(): string {
  return localStorage.getItem(TOKEN_STORAGE_KEY) ?? import.meta.env.VITE_API_TOKEN ?? '';
}

export function setApiToken(token: string): void {
  if (token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getApiToken();
  const headers: Record<string, string> = {};
  if (!(options?.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('未授权：请在浏览器中设置本地访问 Token（控制台执行 localStorage.setItem("teachnova_api_token", "你的令牌")，或在 frontend/.env.local 设置 VITE_API_TOKEN）');
    }
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `请求失败：${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function pollJob(jobId: number, intervalMs = 1500, onTick?: (job: Job) => void): Promise<Job> {
  for (;;) {
    const job = await request<Job>(`/jobs/${jobId}`);
    onTick?.(job);
    if (job.status === 'succeeded') return job;
    if (job.status === 'failed') throw new Error(job.error || '任务执行失败');
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

export const api = {
  health: () => request<{ status: string }>('/health'),
  listTasks: () => request<Task[]>('/tasks'),
  createTask: (payload: {
    title: string;
    subject?: string;
    audience?: string;
    duration_minutes?: number;
  }) => request<Task>('/tasks', { method: 'POST', body: JSON.stringify(payload) }),
  updateTask: (id: number, payload: Partial<Task>) =>
    request<Task>(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  sendMessage: (taskId: number, message: string) =>
    request<{
      task_id: number;
      message: ChatMessage;
      requirement: RequirementState;
      session: AgentSession;
      completeness: number;
      missing_fields: string[];
      stage: import('./types').StageKey;
      next_question?: string | null;
      transition?: { from: string; to: string } | null;
      generated_asset_id?: number | null;
      thinking?: string[];
    }>(`/tasks/${taskId}/chat`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    }),
  listMessages: (taskId: number) =>
    request<{ task_id: number; messages: ChatMessage[] }>(`/tasks/${taskId}/messages`),
  getRequirements: (taskId: number) => request<RequirementResponse>(`/tasks/${taskId}/requirements`),
  uploadFile: (taskId: number, file: File, metadata?: { purpose?: string; focus?: string }) => {
    const form = new FormData();
    form.append('file', file);
    form.append('purpose', metadata?.purpose ?? 'content');
    form.append('focus', metadata?.focus ?? '');
    return request<UploadedFile>(`/files/tasks/${taskId}`, { method: 'POST', body: form });
  },
  parseFile: (fileId: number) => request<UploadedFile>(`/files/${fileId}/parse`, { method: 'POST' }),
  listFiles: (taskId: number) => request<UploadedFile[]>(`/files/tasks/${taskId}`),
  deleteFile: (fileId: number) => request<{ status: string }>(`/files/${fileId}`, { method: 'DELETE' }),
  searchKnowledge: (query: string, taskId?: number) =>
    request<KnowledgeSearchResponse>(
      '/knowledge/search',
      { method: 'POST', body: JSON.stringify({ query, task_id: taskId, top_k: 5 }) },
    ),
  vectorSearchKnowledge: (query: string) =>
    request<KnowledgeSearchResponse>('/knowledge/vector-search', {
      method: 'POST',
      body: JSON.stringify({ query, top_k: 5 }),
    }),
  vectorizeFile: (fileId: number) =>
    request<KnowledgeVectorizeResponse>(`/knowledge/vectorize/${fileId}`, { method: 'POST' }),
  vectorizeAll: () =>
    request<KnowledgeVectorizeResponse>('/knowledge/vectorize/all', { method: 'POST' }),
  generateAssets: (taskId: number) => request<JobEnqueue>(`/tasks/${taskId}/generate`, { method: 'POST' }),
  listAssets: (taskId: number) => request<GeneratedAsset[]>(`/assets/tasks/${taskId}`),
  getJob: (jobId: number) => request<Job>(`/jobs/${jobId}`),
  listJobs: (taskId: number) => request<Job[]>(`/jobs/tasks/${taskId}`),
  revisePpt: (taskId: number, instruction: string) =>
    request<JobEnqueue>(`/assets/tasks/${taskId}/revise-ppt`, {
      method: 'POST',
      body: JSON.stringify({ instruction }),
    }),
  listModelConfigs: () => request<ModelConfigState>('/model-configs'),
  saveModelConfig: (payload: ModelConfig) =>
    request<ModelConfigState>('/model-configs', { method: 'POST', body: JSON.stringify(payload) }),
  activateModelConfig: (modelId: string) =>
    request<ModelConfigState>('/model-configs/activate', { method: 'POST', body: JSON.stringify({ modelId }) }),
  testModelConfig: (modelId: string) => request<ModelConfigState>(`/model-configs/${modelId}/test`, { method: 'POST' }),
  deleteModelConfig: (modelId: string) => request<ModelConfigState>(`/model-configs/${modelId}`, { method: 'DELETE' }),
};
