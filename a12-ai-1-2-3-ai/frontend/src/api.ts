export type Task = {
  id: number;
  title: string;
  subject: string | null;
  audience: string | null;
  duration_minutes: number | null;
  status: string;
  requirement_summary: string | null;
  teaching_topic: string | null;
  knowledge_points: string | null;
  key_difficulties: string | null;
  interaction_design: string | null;
  intent_status: string;
  intent_confidence: string | null;
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

export type PptDesignSystem = {
  ornament: string;
  cardStyle: string;
  titleStyle: string;
  radius: Record<string, number>;
  shadow: boolean;
  type: Record<string, number>;
};

export type PptTemplate = {
  id: string;
  name: string;
  version: number;
  generation: number;
  series: string;
  category: string;
  description: string;
  suitable: string[];
  tags: string[];
  ratio: string;
  font: string;
  bodyFont: string;
  dark: boolean;
  footer: string;
  colors: Record<string, string>;
  design: PptDesignSystem;
  layouts: Record<string, string[]>;
  layoutCount: number;
  masterCount: number;
};

export type LayoutGroup = {
  key: string;
  name: string;
  hint: string;
};

export type TemplatePreviewSlide = {
  kind: string;
  svg: string;
};

export type TemplateBoardEntry = {
  key: string;
  name: string;
  hint: string;
  masters: string[];
  masterCount: number;
};

export type TemplateBoard = PptTemplate & {
  board: TemplateBoardEntry[];
  groups: LayoutGroup[];
};

export type DeckChart = {
  type: 'bar' | 'line' | 'pie' | 'doughnut' | 'radar' | 'area' | 'bar3D';
  name: string;
  labels: string[];
  values: number[];
};

export type DeckTable = {
  head: string[];
  rows: string[][];
};

export type DeckCompare = {
  leftTitle: string;
  rightTitle: string;
  left: string[];
  right: string[];
};

export type DeckPage = {
  index: number;
  type: 'cover' | 'agenda' | 'section' | 'content' | 'case' | 'activity' | 'quote' | 'metrics'
    | 'chart' | 'table' | 'timeline' | 'process' | 'compare' | 'summary' | 'ending';
  section: string;
  title: string;
  bullets: string[];
  side: string;
  notes: string;
  visual?: string;
  layout?: string;
  interaction?: string | null;
  chart?: DeckChart;
  table?: DeckTable;
  compare?: DeckCompare;
};

export type DeckQuality = {
  pageCount: number;
  placeholderRatio: number;
  avgBullets: number;
  visualPages?: number;
  notesPages?: number;
  needsEnrich: boolean;
};

export type PptDeck = {
  taskId: number;
  title: string;
  subject: string;
  audience: string;
  templateId: string;
  updatedAt?: string;
  pages: DeckPage[];
};

export type SlideRevision = {
  index: number;
  instruction: string;
  summary: string;
  issues: string[];
  suggestions: string[];
  before: DeckPage;
  after: DeckPage;
  trace: string[];
};

export type DeckResponse = {
  deck: PptDeck;
  templates: PptTemplate[];
  versions: GeneratedAsset[];
  quality?: DeckQuality;
};

export type EnrichResponse = {
  deck: PptDeck;
  quality: DeckQuality;
  materialCount: number;
  pageCount: number;
  summary: string;
};

export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api';

export type ChatSendResult = {
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
  references?: KnowledgeSearchResult[];
  task?: Task;
};

export type StreamHandlers = {
  onThinking?: (step: { step: string; text: string; status?: string }) => void;
  onReasoning?: (text: string) => void;
  onDelta?: (text: string) => void;
  onError?: (detail: string) => void;
};

function parseSseFrame(frame: string): { event: string; data: string } {
  let event = 'message';
  const dataLines: string[] = [];
  for (const line of frame.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
  }
  return { event, data: dataLines.join('\n') };
}

/** 消费后端 SSE 事件流：thinking（智能体思考步骤）/ reasoning（模型思考）/ delta（正文增量）/ done（最终结果）。 */
async function streamSse(
  path: string,
  body: unknown,
  handlers: StreamHandlers,
  signal?: AbortSignal,
): Promise<ChatSendResult | undefined> {
  const token = getApiToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error((error as { detail?: string }).detail || `请求失败：${response.status}`);
  }
  if (!response.body) throw new Error('当前浏览器不支持流式响应');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let result: ChatSendResult | undefined;

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let boundary = buffer.indexOf('\n\n');
    while (boundary >= 0) {
      const frame = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      boundary = buffer.indexOf('\n\n');
      if (!frame.trim()) continue;
      const { event, data } = parseSseFrame(frame);
      if (!data) continue;
      let payload: Record<string, unknown>;
      try {
        payload = JSON.parse(data) as Record<string, unknown>;
      } catch {
        continue;
      }
      if (event === 'thinking') {
        handlers.onThinking?.(payload as { step: string; text: string; status?: string });
      } else if (event === 'reasoning') {
        handlers.onReasoning?.(String(payload.text ?? ''));
      } else if (event === 'delta') {
        handlers.onDelta?.(String(payload.text ?? ''));
      } else if (event === 'done') {
        result = payload as unknown as ChatSendResult;
      } else if (event === 'error') {
        handlers.onError?.(String(payload.detail ?? '流式输出中断'));
      }
    }
  }
  return result;
}

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
    request<ChatSendResult>(`/tasks/${taskId}/chat`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    }),
  streamMessage: (taskId: number, message: string, handlers: StreamHandlers, signal?: AbortSignal) =>
    streamSse(`/tasks/${taskId}/chat/stream`, { message }, handlers, signal),
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
  getParsedFile: (fileId: number) => request<{ file_id: number; title: string; file_type: string; text: string; markdown?: string | null; metadata: Record<string, unknown> }>(`/files/${fileId}/parsed`),
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
  generateDocx: (taskId: number) => request<JobEnqueue>(`/tasks/${taskId}/generate-docx`, { method: 'POST' }),
  generatePptx: (taskId: number) => request<JobEnqueue>(`/tasks/${taskId}/generate-pptx`, { method: 'POST' }),
  iterateAssets: (taskId: number, feedback: string, regenerateDocx = true, regeneratePptx = true) =>
    request<JobEnqueue>(`/tasks/${taskId}/iterate`, {
      method: 'POST',
      body: JSON.stringify({ feedback, regenerate_docx: regenerateDocx, regenerate_pptx: regeneratePptx }),
    }),
  listAssets: (taskId: number) => request<GeneratedAsset[]>(`/assets/tasks/${taskId}`),
  getJob: (jobId: number) => request<Job>(`/jobs/${jobId}`),
  listJobs: (taskId: number) => request<Job[]>(`/jobs/tasks/${taskId}`),
  revisePpt: (taskId: number, instruction: string) =>
    request<JobEnqueue>(`/assets/tasks/${taskId}/revise-ppt`, {
      method: 'POST',
      body: JSON.stringify({ instruction }),
    }),
  getPptTemplates: () => request<{ templates: PptTemplate[]; groups: LayoutGroup[] }>('/ppt-studio/templates'),
  getTemplatePreview: (templateId: string) =>
    request<{ templateId: string; slides: TemplatePreviewSlide[] }>(`/ppt-studio/templates/${templateId}/preview`),
  getTemplateLayouts: (templateId: string) => request<TemplateBoard>(`/ppt-studio/templates/${templateId}/layouts`),
  autoLayoutDeck: (taskId: number, templateId?: string) =>
    request<{ deck: PptDeck; plan: { index: number; group: string; layout: string }[]; templateId: string }>(
      `/ppt-studio/tasks/${taskId}/deck/auto-layout`,
      { method: 'POST', body: JSON.stringify({ templateId }) },
    ),
  getDeck: (taskId: number) => request<DeckResponse>(`/ppt-studio/tasks/${taskId}/deck`),
  enrichDeck: (taskId: number, focus = '') =>
    request<EnrichResponse>(`/ppt-studio/tasks/${taskId}/deck/enrich`, {
      method: 'POST',
      body: JSON.stringify({ focus }),
    }),
  addDeckPage: (taskId: number, payload: { title: string; type: string }) =>
    request<{ deck: PptDeck; index: number }>(`/ppt-studio/tasks/${taskId}/deck/pages`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateDeckPage: (taskId: number, index: number, patch: Partial<DeckPage>) =>
    request<{ deck: PptDeck; page: DeckPage }>(`/ppt-studio/tasks/${taskId}/deck/pages/${index}`, {
      method: 'PUT',
      body: JSON.stringify(patch),
    }),
  deleteDeckPage: (taskId: number, index: number) =>
    request<{ deck: PptDeck }>(`/ppt-studio/tasks/${taskId}/deck/pages/${index}`, { method: 'DELETE' }),
  reviseDeckPage: (taskId: number, index: number, instruction: string) =>
    request<SlideRevision>(`/ppt-studio/tasks/${taskId}/deck/pages/${index}/revise`, {
      method: 'POST',
      body: JSON.stringify({ instruction }),
    }),
  applyRevision: (taskId: number, index: number, page: DeckPage, render = false) =>
    request<{ deck: PptDeck; asset: GeneratedAsset | null }>(`/ppt-studio/tasks/${taskId}/deck/pages/${index}/apply`, {
      method: 'POST',
      body: JSON.stringify({ page, render }),
    }),
  renderDeck: (taskId: number, templateId?: string) =>
    request<{ deck: PptDeck; asset: GeneratedAsset; layouts: { index: number; group: string; layout: string }[] }>(
      `/ppt-studio/tasks/${taskId}/render`,
      { method: 'POST', body: JSON.stringify({ templateId }) },
    ),
  listModelConfigs: () => request<ModelConfigState>('/model-configs'),
  saveModelConfig: (payload: ModelConfig) =>
    request<ModelConfigState>('/model-configs', { method: 'POST', body: JSON.stringify(payload) }),
  activateModelConfig: (modelId: string) =>
    request<ModelConfigState>('/model-configs/activate', { method: 'POST', body: JSON.stringify({ modelId }) }),
  testModelConfig: (modelId: string) => request<ModelConfigState>(`/model-configs/${modelId}/test`, { method: 'POST' }),
  deleteModelConfig: (modelId: string) => request<ModelConfigState>(`/model-configs/${modelId}`, { method: 'DELETE' }),
};
