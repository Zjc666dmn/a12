import {
  AppstoreOutlined,
  ArrowRightOutlined,
  AudioOutlined,
  BookOutlined,
  CheckCircleFilled,
  CheckOutlined,
  ClockCircleOutlined,
  CloudUploadOutlined,
  CodeOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  ExperimentOutlined,
  FileImageOutlined,
  FilePdfOutlined,
  FilePptOutlined,
  FileSearchOutlined,
  FileTextOutlined,
  FileWordOutlined,
  FolderOpenOutlined,
  HistoryOutlined,
  HomeOutlined,
  LayoutOutlined,
  LoadingOutlined,
  MessageOutlined,
  MoreOutlined,
  PlusOutlined,
  RobotOutlined,
  SearchOutlined,
  SendOutlined,
  SettingOutlined,
  BulbOutlined as SparklesOutlined,
  ThunderboltOutlined,
  UploadOutlined,
  UserOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons';
import {
  Badge,
  Button,
  Dropdown,
  Empty,
  Form,
  Input,
  List,
  Modal,
  Progress,
  Segmented,
  Select,
  Space,
  Spin,
  Switch,
  Tag,
  Tooltip,
  Upload,
  message,
} from 'antd';
import type { MenuProps, UploadProps } from 'antd';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  API_BASE,
  api,
  pollJob,
  type GeneratedAsset,
  type Job,
  type KnowledgeSearchResult,
  type DeckPage,
  type DeckQuality,
  type LayoutGroup,
  type PptDeck,
  type PptTemplate,
  type SlideRevision,
  type TemplateBoard,
  type TemplatePreviewSlide,
  type ModelConfig,
  type ModelConfigState,
  type RequirementResponse,
  type Task,
  type UploadedFile,
} from './api';
import type { LocalMessage, StageKey } from './types';

type ViewKey = 'home' | 'studio' | 'knowledge' | 'generate' | 'editor' | 'projects' | 'models';

const stageFlow: Array<{ key: StageKey; title: string; short: string }> = [
  { key: 'requirement', title: '需求输入', short: '需求' },
  { key: 'clarification', title: '智能澄清', short: '澄清' },
  { key: 'teaching_design', title: '教学设计', short: '设计' },
  { key: 'outline', title: '内容大纲', short: '大纲' },
  { key: 'style', title: '视觉风格', short: '风格' },
  { key: 'generating', title: '智能生成', short: '生成' },
  { key: 'editor', title: '课件工作台', short: '工作台' },
];

const navItems: Array<{ key: ViewKey; label: string; hint: string; icon: ReactNode }> = [
  { key: 'home', label: '工作台', hint: '项目概览', icon: <HomeOutlined /> },
  { key: 'studio', label: '需求对话', hint: 'Teaching Agent', icon: <MessageOutlined /> },
  { key: 'knowledge', label: '资料知识库', hint: 'RAG 与解析', icon: <DatabaseOutlined /> },
  { key: 'generate', label: '生成中心', hint: '课件与教案', icon: <SparklesOutlined /> },
  { key: 'editor', label: 'AI课件工作台', hint: '页面与风格', icon: <EditOutlined /> },
  { key: 'projects', label: '项目记录', hint: '历史作品', icon: <FolderOpenOutlined /> },
  { key: 'models', label: '模型设置', hint: '能力配置', icon: <SettingOutlined /> },
];

const purposeOptions = [
  { value: 'content', label: '内容依据' },
  { value: 'style', label: '风格参考' },
  { value: 'case', label: '案例素材' },
  { value: 'activity', label: '互动设计' },
];

const purposeName = (value?: string) => purposeOptions.find((item) => item.value === value)?.label ?? '内容依据';
const dateText = (value: string) => new Date(value).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });

function fileVisual(file: Pick<UploadedFile, 'file_name' | 'file_type'>) {
  const ext = file.file_name.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return { icon: <FilePdfOutlined />, tone: 'rose', name: 'PDF' };
  if (['doc', 'docx'].includes(ext ?? '')) return { icon: <FileWordOutlined />, tone: 'blue', name: 'Word' };
  if (['ppt', 'pptx'].includes(ext ?? '')) return { icon: <FilePptOutlined />, tone: 'amber', name: 'PPT' };
  if (['png', 'jpg', 'jpeg', 'webp'].includes(ext ?? '') || file.file_type.startsWith('image/')) return { icon: <FileImageOutlined />, tone: 'mint', name: '图片' };
  if (['mp4', 'mov', 'webm'].includes(ext ?? '') || file.file_type.startsWith('video/')) return { icon: <VideoCameraOutlined />, tone: 'violet', name: '视频' };
  return { icon: <FileTextOutlined />, tone: 'blue', name: '文件' };
}

function assetVisual(type: string) {
  if (type === 'pptx') return { icon: <FilePptOutlined />, title: '演示课件', tone: 'amber', desc: '可编辑 PPTX' };
  if (type === 'docx') return { icon: <FileWordOutlined />, title: '详细教案', tone: 'blue', desc: 'Word 教学设计' };
  if (type === 'pdf') return { icon: <FilePdfOutlined />, title: '教学资料', tone: 'rose', desc: '便携 PDF' };
  if (type === 'html') return { icon: <CodeOutlined />, title: '互动活动', tone: 'violet', desc: 'HTML5 课堂互动' };
  if (type === 'image') return { icon: <FileImageOutlined />, title: '课程封面', tone: 'mint', desc: '视觉封面图' };
  return { icon: <FileTextOutlined />, title: '讲解稿', tone: 'blue', desc: '教师讲解脚本' };
}

function App() {
  const [view, setView] = useState<ViewKey>('home');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskId, setTaskId] = useState<number>();
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [requirement, setRequirement] = useState<RequirementResponse>();
  const [assets, setAssets] = useState<GeneratedAsset[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [models, setModels] = useState<ModelConfigState>();
  const [online, setOnline] = useState(false);
  const [loadingContext, setLoadingContext] = useState(false);
  const [sending, setSending] = useState(false);
  const [jobRunning, setJobRunning] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm] = Form.useForm();
  const [lastThinking, setLastThinking] = useState<string[]>([]);

  const activeTask = tasks.find((item) => item.id === taskId);
  const stage = requirement?.stage ?? 'requirement';

  const refreshTasks = async () => {
    const next = await api.listTasks();
    setTasks(next);
    setTaskId((current) => current ?? next[0]?.id);
  };

  const loadContext = async (id: number, quiet = false) => {
    if (!quiet) setLoadingContext(true);
    try {
      const [history, nextFiles, nextRequirement, nextAssets, nextJobs] = await Promise.all([
        api.listMessages(id), api.listFiles(id), api.getRequirements(id), api.listAssets(id), api.listJobs(id),
      ]);
      setMessages(history.messages.map((item) => ({ id: String(item.id), role: item.role, content: item.content, createdAt: item.created_at })));
      setFiles(nextFiles);
      setRequirement(nextRequirement);
      setAssets(nextAssets);
      setJobs(nextJobs);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '任务内容加载失败');
    } finally {
      setLoadingContext(false);
    }
  };

  useEffect(() => {
    api.health().then(() => setOnline(true)).catch(() => setOnline(false));
    refreshTasks().catch(() => undefined);
    api.listModelConfigs().then(setModels).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (taskId) void loadContext(taskId);
  }, [taskId]);

  const createTask = async (values: { title: string; subject?: string; audience?: string; duration_minutes?: number }) => {
    try {
      const created = await api.createTask(values);
      setTasks((current) => [created, ...current]);
      setTaskId(created.id);
      setCreateOpen(false);
      createForm.resetFields();
      setView('studio');
      message.success('教学项目已创建');
    } catch (error) {
      message.error(error instanceof Error ? error.message : '创建失败');
    }
  };

  const ensureTask = async (seed: string) => {
    if (activeTask) return activeTask;
    const created = await api.createTask({ title: seed.slice(0, 28) || '新教学项目' });
    setTasks((current) => [created, ...current]);
    setTaskId(created.id);
    return created;
  };

  const sendMessage = async (text: string) => {
    const clean = text.trim();
    if (!clean || sending) return;
    const task = await ensureTask(clean);
    const userId = `local-${Date.now()}`;
    const assistantId = `stream-${Date.now()}`;
    const now = new Date().toISOString();
    setMessages((current) => [
      ...current,
      { id: userId, role: 'user', content: clean, createdAt: now, status: 'sending' },
      { id: assistantId, role: 'assistant', content: '', createdAt: now, status: 'thinking', thinking: [] },
    ]);
    setSending(true);

    const patchAssistant = (updater: (item: LocalMessage) => LocalMessage) =>
      setMessages((current) => current.map((item) => (item.id === assistantId ? updater(item) : item)));

    const applyResponse = (response: Awaited<ReturnType<typeof api.sendMessage>>) => {
      setMessages((current) => current.map((item) => {
        if (item.id === userId) return { ...item, status: undefined };
        if (item.id === assistantId) {
          return {
            ...item,
            id: String(response.message.id),
            content: response.message.content || item.content,
            createdAt: response.message.created_at,
            status: undefined,
            thinking: response.thinking?.length ? response.thinking : item.thinking,
          };
        }
        return item;
      }));
      setLastThinking(response.thinking ?? []);
      if (response.session) {
        setRequirement({
          task_id: task.id,
          state: response.requirement,
          session: response.session,
          stage: response.stage,
          next_question: response.next_question,
          completeness: response.completeness,
          missing_fields: response.missing_fields,
        });
      }
      if (response.task) setTasks((current) => current.map((item) => item.id === response.task!.id ? response.task! : item));
    };

    try {
      const response = await api.streamMessage(task.id, clean, {
        onThinking: (step) => patchAssistant((item) => ({
          ...item,
          status: 'thinking',
          thinking: [...(item.thinking ?? []), step.text],
        })),
        onReasoning: (chunk) => patchAssistant((item) => ({
          ...item,
          status: 'thinking',
          reasoning: `${item.reasoning ?? ''}${chunk}`,
        })),
        onDelta: (chunk) => patchAssistant((item) => ({
          ...item,
          status: 'streaming',
          content: `${item.content}${chunk}`,
        })),
        onError: (detail) => message.warning(detail),
      });
      if (response) {
        applyResponse(response);
      } else {
        patchAssistant((item) => ({ ...item, status: undefined }));
      }
    } catch (error) {
      // 流式通道不可用时退回一次性请求，保证教师不丢这一轮消息
      try {
        applyResponse(await api.sendMessage(task.id, clean));
      } catch (inner) {
        setMessages((current) => current.map((item) => item.id === userId ? { ...item, status: 'error' } : item));
        patchAssistant((item) => ({ ...item, status: 'error', content: item.content || '本轮回复中断，请重试。' }));
        message.error(inner instanceof Error ? inner.message : (error instanceof Error ? error.message : '发送失败'));
      }
    } finally {
      setSending(false);
    }
  };

  const runJob = async (enqueue: () => Promise<{ job_id: number }>, success: string) => {
    if (!activeTask || jobRunning) return;
    setJobRunning(true);
    try {
      const queued = await enqueue();
      await pollJob(queued.job_id, 1200, (job) => setJobs((current) => [job, ...current.filter((item) => item.id !== job.id)]));
      await Promise.all([loadContext(activeTask.id, true), refreshTasks()]);
      message.success(success);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '任务执行失败');
    } finally {
      setJobRunning(false);
    }
  };

  const pageProps = { activeTask, requirement, files, assets, jobs, loadingContext, sendMessage, sending, runJob };

  return (
    <div className="tn-shell">
      <aside className="tn-sidebar">
        <button className="tn-brand" type="button" onClick={() => setView('home')}>
          <span className="tn-brand-mark"><i /><i /></span>
          <span><strong>TeachNova</strong><small>AI TEACHING STUDIO</small></span>
        </button>
        <nav>
          <small className="tn-nav-label">创作空间</small>
          {navItems.slice(0, 5).map((item) => (
            <button type="button" key={item.key} className={view === item.key ? 'active' : ''} onClick={() => setView(item.key)}>
              <span>{item.icon}</span><div><strong>{item.label}</strong><small>{item.hint}</small></div>
            </button>
          ))}
          <small className="tn-nav-label second">管理</small>
          {navItems.slice(5).map((item) => (
            <button type="button" key={item.key} className={view === item.key ? 'active' : ''} onClick={() => setView(item.key)}>
              <span>{item.icon}</span><div><strong>{item.label}</strong><small>{item.hint}</small></div>
            </button>
          ))}
        </nav>
        <div className="tn-sidebar-foot">
          <div className="tn-ai-orb"><RobotOutlined /></div>
          <strong>教学创作助手</strong>
          <p>从模糊想法到完整课堂</p>
          <Badge status={online ? 'success' : 'error'} text={online ? '服务运行中' : '服务未连接'} />
        </div>
      </aside>

      <main className="tn-main">
        <header className="tn-topbar">
          <div className="tn-context-select">
            <small>当前教学项目</small>
            <Select
              variant="borderless"
              value={activeTask?.id}
              placeholder="尚未创建项目"
              onChange={setTaskId}
              options={tasks.map((task) => ({ value: task.id, label: task.title }))}
            />
          </div>
          <div className="tn-top-actions">
            {activeTask && <Tag className="tn-stage-tag">{stageFlow.find((item) => item.key === stage)?.title ?? '准备中'}</Tag>}
            <Button icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>新建项目</Button>
            <div className="tn-profile"><span>林</span><div><strong>教师用户</strong><small>创作工作区</small></div></div>
          </div>
        </header>

        <section className="tn-content">
          {view === 'home' && <HomePage tasks={tasks} {...pageProps} onNavigate={setView} onCreate={() => setCreateOpen(true)} />}
          {view === 'studio' && <StudioPage {...pageProps} messages={messages} lastThinking={lastThinking} />}
          {view === 'knowledge' && <KnowledgePage {...pageProps} reload={() => activeTask && loadContext(activeTask.id, true)} />}
          {view === 'generate' && <GeneratePage {...pageProps} onNavigate={setView} />}
          {view === 'editor' && <WorkbenchPage {...pageProps} />}
          {view === 'projects' && <ProjectsPage tasks={tasks} activeTask={activeTask} onSelect={(id) => { setTaskId(id); setView('studio'); }} onCreate={() => setCreateOpen(true)} />}
          {view === 'models' && <ModelsPage state={models} onChange={setModels} />}
        </section>
      </main>

      <Modal open={createOpen} onCancel={() => setCreateOpen(false)} footer={null} title={null} width={560} className="tn-modal" destroyOnHidden>
        <div className="tn-modal-heading"><span><SparklesOutlined /></span><div><small>NEW TEACHING PROJECT</small><h2>创建教学项目</h2><p>先填写已知信息，缺失内容将由 Agent 在对话中逐项澄清。</p></div></div>
        <Form form={createForm} layout="vertical" onFinish={createTask}>
          <Form.Item name="title" label="课程题目" rules={[{ required: true, message: '请输入课程题目' }]}><Input size="large" placeholder="例如：TCP 三次握手的工作原理" /></Form.Item>
          <div className="tn-form-grid">
            <Form.Item name="subject" label="学科 / 课程"><Input placeholder="计算机网络" /></Form.Item>
            <Form.Item name="audience" label="授课对象"><Input placeholder="高职一年级学生" /></Form.Item>
          </div>
          <Form.Item name="duration_minutes" label="课程时长"><Input type="number" suffix="分钟" placeholder="45" /></Form.Item>
          <Button type="primary" size="large" htmlType="submit" block>进入需求对话 <ArrowRightOutlined /></Button>
        </Form>
      </Modal>
    </div>
  );
}

type SharedPageProps = {
  activeTask?: Task;
  requirement?: RequirementResponse;
  files: UploadedFile[];
  assets: GeneratedAsset[];
  jobs: Job[];
  loadingContext: boolean;
  sending: boolean;
  sendMessage: (text: string) => Promise<void>;
  runJob: (enqueue: () => Promise<{ job_id: number }>, success: string) => Promise<void>;
};

function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <div className="tn-page-heading"><div><small>{eyebrow}</small><h1>{title}</h1><p>{description}</p></div>{action}</div>;
}

function EmptyProject({ onCreate }: { onCreate?: () => void }) {
  return <div className="tn-empty"><span><SparklesOutlined /></span><h2>从一个教学主题开始</h2><p>创建项目后，Teaching Agent 会主动澄清需求，并把资料、设计、课件和教案串成完整工作流。</p>{onCreate && <Button type="primary" size="large" icon={<PlusOutlined />} onClick={onCreate}>创建第一个项目</Button>}</div>;
}

function StageRail({ stage }: { stage: StageKey }) {
  const current = Math.max(0, stageFlow.findIndex((item) => item.key === stage));
  return <div className="tn-stage-rail">{stageFlow.map((item, index) => <div key={item.key} className={index < current ? 'done' : index === current ? 'current' : ''}><span>{index < current ? <CheckOutlined /> : index + 1}</span><strong>{item.short}</strong>{index < stageFlow.length - 1 && <i />}</div>)}</div>;
}

function HomePage(props: SharedPageProps & { tasks: Task[]; onNavigate: (view: ViewKey) => void; onCreate: () => void }) {
  const [prompt, setPrompt] = useState('');
  if (!props.activeTask && props.tasks.length === 0) return <EmptyProject onCreate={props.onCreate} />;
  const completeness = Math.round((props.requirement?.completeness ?? 0) * 100);
  const readyFiles = props.files.filter((file) => file.parse_status === 'ready').length;
  const latestAssets = props.assets.slice(0, 3);
  const submit = async () => { if (!prompt.trim()) return; props.onNavigate('studio'); await props.sendMessage(prompt); setPrompt(''); };
  return <div className="tn-page tn-home-page">
    <section className="tn-hero-card">
      <div className="tn-hero-copy">
        <Tag bordered={false}>TEACHING AGENT · READY</Tag>
        <h1>把教学想法，变成一堂<br /><em>真正可用的课</em></h1>
        <p>对话澄清需求，融合教材知识，自动生成课件、教案和课堂互动，并支持持续修改。</p>
        <div className="tn-hero-input">
          <SparklesOutlined /><Input.TextArea autoSize={{ minRows: 1, maxRows: 3 }} value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="告诉我你想制作什么，例如：给高职学生讲 TCP 三次握手，45 分钟…" onPressEnter={(event) => { if (!event.shiftKey) { event.preventDefault(); void submit(); } }} />
          <button type="button" onClick={() => void submit()} disabled={!prompt.trim()}><ArrowRightOutlined /></button>
        </div>
        <div className="tn-prompt-chips">{['根据教材生成课件', '设计课堂互动', '生成完整教案'].map((item) => <button type="button" key={item} onClick={() => setPrompt(item)}>{item}</button>)}</div>
      </div>
      <div className="tn-hero-art" aria-hidden="true"><div className="tn-orbit orbit-one" /><div className="tn-orbit orbit-two" /><div className="tn-gem"><span>TN</span></div><i className="dot dot-one" /><i className="dot dot-two" /><i className="dot dot-three" /></div>
    </section>

    <section className="tn-overview-row">
      <button type="button" className="tn-project-focus" onClick={() => props.onNavigate('studio')}>
        <div className="tn-section-title"><span>当前项目</span><ArrowRightOutlined /></div>
        <h2>{props.activeTask?.teaching_topic || props.activeTask?.title}</h2>
        <p>{props.activeTask?.subject || '待确认课程'} · {props.activeTask?.audience || '待确认对象'} · {props.activeTask?.duration_minutes ? `${props.activeTask.duration_minutes} 分钟` : '待确认时长'}</p>
        <StageRail stage={props.requirement?.stage ?? 'requirement'} />
      </button>
      <div className="tn-metric-cards">
        <button type="button" onClick={() => props.onNavigate('studio')}><span className="mint"><MessageOutlined /></span><div><strong>{completeness}%</strong><small>需求完整度</small></div></button>
        <button type="button" onClick={() => props.onNavigate('knowledge')}><span className="blue"><DatabaseOutlined /></span><div><strong>{readyFiles}</strong><small>已解析资料</small></div></button>
        <button type="button" onClick={() => props.onNavigate('generate')}><span className="amber"><SparklesOutlined /></span><div><strong>{props.assets.length}</strong><small>教学产物</small></div></button>
        <button type="button" onClick={() => props.onNavigate('editor')}><span className="violet"><HistoryOutlined /></span><div><strong>{props.assets.filter((item) => item.asset_type === 'pptx').length}</strong><small>PPT 版本</small></div></button>
      </div>
    </section>

    <section className="tn-home-bottom">
      <div className="tn-white-card tn-path-card">
        <div className="tn-card-heading"><div><small>SMART WORKFLOW</small><h3>从需求到课堂，一条链路完成</h3></div><Button type="text" onClick={() => props.onNavigate('studio')}>继续创作 <ArrowRightOutlined /></Button></div>
        <div className="tn-path-grid">
          {[
            [<MessageOutlined />, '01', '对话澄清', '主动补齐题目、对象、时长与场景'],
            [<DatabaseOutlined />, '02', '知识融合', '教材、案例和视频进入本地知识库'],
            [<SparklesOutlined />, '03', '多模态生成', '同步产出课件、教案与互动活动'],
            [<EditOutlined />, '04', '持续优化', '通过自然语言修改内容和页面'],
          ].map(([icon, num, title, text]) => <article key={String(num)}><span>{icon}</span><small>{num}</small><strong>{title}</strong><p>{text}</p></article>)}
        </div>
      </div>
      <div className="tn-white-card tn-recent-card">
        <div className="tn-card-heading"><div><small>LATEST OUTPUT</small><h3>最近产物</h3></div></div>
        {latestAssets.length ? latestAssets.map((asset) => { const visual = assetVisual(asset.asset_type); return <a key={asset.id} href={`${API_BASE}/assets/${asset.id}/download`} target="_blank" rel="noreferrer"><span className={visual.tone}>{visual.icon}</span><div><strong>{visual.title}</strong><small>版本 v{asset.version} · {dateText(asset.created_at)}</small></div><DownloadOutlined /></a>; }) : <div className="tn-mini-empty"><FileSearchOutlined /><span>完成需求后即可生成教学产物</span></div>}
      </div>
    </section>
  </div>;
}

function ChatComposer({ sendMessage, sending, compact = false }: { sendMessage: (text: string) => Promise<void>; sending: boolean; compact?: boolean }) {
  const [value, setValue] = useState('');
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const send = async () => { const text = value.trim(); if (!text) return; setValue(''); await sendMessage(text); };
  const voice = () => {
    const Recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Recognition) { message.warning('当前浏览器不支持语音识别，请使用 Chrome 或 Edge'); return; }
    if (listening && recognitionRef.current) { recognitionRef.current.stop(); return; }
    const recognition = new Recognition(); recognition.lang = 'zh-CN'; recognition.interimResults = true;
    recognition.onresult = (event: any) => { let text = ''; for (let index = 0; index < event.results.length; index += 1) text += event.results[index][0].transcript; setValue(text); };
    recognition.onend = () => setListening(false); recognition.onerror = () => { setListening(false); message.error('语音识别失败，请检查麦克风权限'); };
    recognitionRef.current = recognition; recognition.start(); setListening(true);
  };
  return <div className={`tn-composer ${compact ? 'compact' : ''}`}>
    <Input.TextArea value={value} autoSize={{ minRows: compact ? 1 : 2, maxRows: 5 }} onChange={(event) => setValue(event.target.value)} placeholder={compact ? '输入修改要求…' : '输入你的回答，或直接补充教学要求…'} onPressEnter={(event) => { if (!event.shiftKey) { event.preventDefault(); void send(); } }} />
    <div className="tn-composer-tools"><button type="button" className={listening ? 'listening' : ''} onClick={voice}><AudioOutlined />{listening ? '正在聆听' : '语音输入'}</button><span>Enter 发送 · Shift + Enter 换行</span><button className="send" type="button" onClick={() => void send()} disabled={!value.trim() || sending}>{sending ? <LoadingOutlined /> : <SendOutlined />}</button></div>
  </div>;
}

function StudioPage(props: SharedPageProps & { messages: LocalMessage[]; lastThinking: string[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [props.messages, props.sending]);
  if (!props.activeTask) return <EmptyProject />;
  const session = props.requirement?.session;
  const state = props.requirement?.state;
  const quick = props.requirement?.next_question ? ['确认', '新授课', '45 分钟', '高职一年级学生'] : ['确认当前方案', '补充教学重点', '调整课堂活动'];
  return <div className="tn-page tn-studio-page">
    <PageHeading eyebrow="TEACHING AGENT" title="需求对话" description="Agent 会遵循固定状态机主动追问，每轮只解决一个关键问题。" action={<Tag color="green"><CheckCircleFilled /> 多轮记忆已开启</Tag>} />
    <StageRail stage={props.requirement?.stage ?? 'requirement'} />
    <div className="tn-studio-grid">
      <section className="tn-chat-panel tn-white-card">
        <header><div className="tn-agent-id"><span><RobotOutlined /></span><div><strong>TeachNova Agent</strong><small><i /> 正在理解你的教学意图</small></div></div><Dropdown menu={{ items: [{ key: 'clear', label: '保留任务并开始新话题' }] }}><Button type="text" icon={<MoreOutlined />} /></Dropdown></header>
        <div className="tn-chat-scroll">
          {!props.messages.length && <div className="tn-agent-welcome"><span><SparklesOutlined /></span><h3>你好，我是你的教学设计搭档</h3><p>告诉我课程主题即可。我会逐项确认授课对象、学生基础、时长和教学场景，再为你生成准确方案。</p></div>}
          {props.messages.map((item) => <article key={item.id} className={`tn-message ${item.role} ${item.status ?? ''}`}>
            <span>{item.role === 'assistant' ? <RobotOutlined /> : <UserOutlined />}</span>
            <div>
              <small>{item.role === 'assistant' ? 'TeachNova Agent' : '你'}</small>
              {item.role === 'assistant' && !!item.thinking?.length && <div className={`tn-think-panel ${item.status ?? ''}`}>
                <div className="tn-think-head">
                  {item.status === 'thinking' ? <LoadingOutlined spin /> : <CheckCircleFilled />}
                  <strong>{item.status === 'thinking' ? '智能体正在思考' : '智能体工作过程'}</strong>
                  <em>{item.thinking.length} 步</em>
                </div>
                <ul>
                  {item.thinking.map((step, index) => <li key={`${item.id}-step-${index}`}><CheckCircleFilled />{step}</li>)}
                  {item.status === 'thinking' && <li className="pending"><LoadingOutlined spin />正在生成这一轮的结论…</li>}
                </ul>
                {item.reasoning ? <details className="tn-think-reasoning"><summary>查看模型思考原文</summary><p>{item.reasoning}</p></details> : null}
              </div>}
              {item.content ? <p>{item.content}{item.status === 'streaming' && <i className="tn-cursor" />}</p> : null}
              {item.status === 'sending' && <em>发送中…</em>}
              {item.status === 'error' && <em>发送失败</em>}
            </div>
          </article>)}
          {props.sending && !props.messages.some((item) => item.status === 'thinking' || item.status === 'streaming') && <div className="tn-typing"><i /><i /><i /><span>正在分析需求与资料…</span></div>}
          <div ref={bottomRef} />
        </div>
        <div className="tn-quick-row">{quick.map((item) => <button type="button" key={item} onClick={() => void props.sendMessage(item)}>{item}</button>)}</div>
        <ChatComposer sendMessage={props.sendMessage} sending={props.sending} />
      </section>

      <aside className="tn-brief-panel">
        <div className="tn-white-card tn-brief-card">
          <header><div><small>LIVE BRIEF</small><h3>结构化需求</h3></div><Progress type="circle" size={46} percent={Math.round((props.requirement?.completeness ?? 0) * 100)} strokeColor="#45a978" /></header>
          <div className="tn-brief-fields">
            {[
              ['课程主题', state?.topic, 'topic'], ['学科课程', state?.subject, 'subject'], ['年级学段', state?.grade, 'grade'], ['学生基础', state?.audience, 'audience'], ['课程时长', state?.duration ? `${state.duration} 分钟` : null, 'duration'], ['教学场景', state?.scene, 'scene'],
            ].map(([label, value, key]) => <div key={String(key)} className={value ? 'filled' : ''}><span>{label}</span><strong>{value || '等待确认'}</strong>{value ? <CheckCircleFilled /> : <i />}</div>)}
          </div>
        </div>
        <div className="tn-white-card tn-intelligence-card">
          <header><small>AGENT WORKFLOW</small><h3>本轮工作流</h3></header>
          {(props.lastThinking.length ? props.lastThinking : ['读取当前任务和历史对话', '定位最关键的缺失信息', '等待你的下一条回答']).slice(-4).map((item, index) => <p key={`${item}-${index}`}><span>{index + 1}</span>{item}</p>)}
        </div>
        <div className="tn-white-card tn-design-snapshot">
          <header><small>TEACHING DESIGN</small><h3>教学设计快照</h3></header>
          {session?.teaching.keyPoints.length ? <>{session.teaching.keyPoints.slice(0, 3).map((item) => <Tag key={item}>{item}</Tag>)}<p>{session.teaching.activities.slice(0, 2).join(' · ') || '课堂活动待生成'}</p></> : <div className="tn-mini-empty"><BookOutlined /><span>需求确认后自动形成教学目标、重难点和活动</span></div>}
        </div>
      </aside>
    </div>
  </div>;
}

function KnowledgePage(props: SharedPageProps & { reload: () => void }) {
  const [purpose, setPurpose] = useState('content');
  const [focus, setFocus] = useState('');
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<{ title: string; text: string; metadata: Record<string, unknown> }>();
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<'keyword' | 'vector'>('vector');
  const [results, setResults] = useState<KnowledgeSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [vectorizing, setVectorizing] = useState(false);
  const ready = props.files.filter((file) => file.parse_status === 'ready').length;
  const uploadProps: UploadProps = {
    multiple: true,
    showUploadList: false,
    accept: '.pdf,.doc,.docx,.pptx,.png,.jpg,.jpeg,.webp,.mp4,.mov,.webm',
    beforeUpload: async (file) => {
      if (!props.activeTask) { message.warning('请先创建教学项目'); return Upload.LIST_IGNORE; }
      setUploading(true);
      try {
        const uploaded = await api.uploadFile(props.activeTask.id, file, { purpose, focus });
        const parsed = await api.parseFile(uploaded.id);
        if (parsed.parse_status === 'ready') {
          await api.vectorizeFile(uploaded.id).catch(() => undefined);
          message.success(`${file.name} 已解析并接入知识库`);
        }
        props.reload();
      } catch (error) { message.error(error instanceof Error ? error.message : '资料处理失败'); }
      finally { setUploading(false); }
      return Upload.LIST_IGNORE;
    },
  };
  const previewFile = async (file: UploadedFile) => { try { const parsed = await api.getParsedFile(file.id); setPreview({ title: parsed.title, text: parsed.markdown || parsed.text, metadata: parsed.metadata }); } catch (error) { message.error(error instanceof Error ? error.message : '预览失败'); } };
  const removeFile = async (file: UploadedFile) => { try { await api.deleteFile(file.id); props.reload(); message.success('资料已移除'); } catch (error) { message.error(error instanceof Error ? error.message : '移除失败'); } };
  const search = async () => { if (!query.trim()) return; setSearching(true); try { const response = mode === 'vector' ? await api.vectorSearchKnowledge(query) : await api.searchKnowledge(query, props.activeTask?.id); setResults(response.results); message.success(response.message); } catch (error) { message.error(error instanceof Error ? error.message : '检索失败'); } finally { setSearching(false); } };
  const vectorizeAll = async () => { setVectorizing(true); try { const response = await api.vectorizeAll(); message.success(response.message); } catch (error) { message.error(error instanceof Error ? error.message : '向量化失败'); } finally { setVectorizing(false); } };
  if (!props.activeTask) return <EmptyProject />;
  return <div className="tn-page">
    <PageHeading eyebrow="LOCAL RAG" title="资料知识库" description="把教师意图与教材、案例、图片和视频明确关联，所有内容在生成时保留来源。" action={<Button icon={<ThunderboltOutlined />} loading={vectorizing} onClick={() => void vectorizeAll()}>更新全部向量</Button>} />
    <div className="tn-knowledge-stats"><div><span><DatabaseOutlined /></span><strong>{props.files.length}</strong><small>资料总数</small></div><div><span><CheckCircleFilled /></span><strong>{ready}</strong><small>解析完成</small></div><div><span><AppstoreOutlined /></span><strong>{new Set(props.files.map((file) => file.file_type)).size}</strong><small>资料类型</small></div><div><span><ExperimentOutlined /></span><strong>384D</strong><small>本地向量维度</small></div></div>
    <div className="tn-knowledge-grid">
      <section className="tn-white-card tn-upload-card">
        <header><div><small>SOURCE INTAKE</small><h3>资料接入</h3></div><Tag color="green">多模态</Tag></header>
        <div className="tn-purpose-box"><label><span>资料用途</span><Segmented block options={purposeOptions} value={purpose} onChange={(value) => setPurpose(String(value))} /></label><label><span>重点关联</span><Input value={focus} onChange={(event) => setFocus(event.target.value)} placeholder="例如：用于解释握手流程；参考第 3 章版式" /></label></div>
        <Upload.Dragger {...uploadProps} disabled={uploading}><div className="tn-upload-icon">{uploading ? <LoadingOutlined /> : <CloudUploadOutlined />}</div><h3>{uploading ? '正在解析并建立索引…' : '拖入资料，自动理解内容'}</h3><p>支持 PDF、Word、PPT、图片、视频</p><Button icon={<UploadOutlined />}>选择文件</Button></Upload.Dragger>
        <div className="tn-format-row"><span><FilePdfOutlined />PDF</span><span><FileWordOutlined />Word</span><span><FilePptOutlined />PPT</span><span><FileImageOutlined />图片</span><span><VideoCameraOutlined />视频</span></div>
      </section>
      <section className="tn-white-card tn-source-list">
        <header><div><small>CONNECTED SOURCES</small><h3>已关联资料</h3></div><span>{ready}/{props.files.length} 就绪</span></header>
        <List dataSource={props.files} locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="还没有上传资料" /> }} renderItem={(file) => { const visual = fileVisual(file); return <List.Item actions={[<Tooltip title="解析预览" key="preview"><Button type="text" icon={<FileSearchOutlined />} disabled={file.parse_status !== 'ready'} onClick={() => void previewFile(file)} /></Tooltip>, <Tooltip title="移除资料" key="delete"><Button danger type="text" icon={<DeleteOutlined />} onClick={() => void removeFile(file)} /></Tooltip>]}><div className={`tn-file-icon ${visual.tone}`}>{visual.icon}</div><List.Item.Meta title={<Space wrap><strong>{file.file_name}</strong><Tag>{purposeName(file.purpose)}</Tag></Space>} description={<span>{visual.name}{file.focus ? ` · 关联：${file.focus}` : ''}</span>} /><Tag color={file.parse_status === 'ready' ? 'green' : file.parse_status === 'failed' ? 'red' : 'processing'}>{file.parse_status === 'ready' ? '已入库' : file.parse_status === 'failed' ? '解析失败' : '处理中'}</Tag></List.Item>; }} />
      </section>
    </div>
    <section className="tn-white-card tn-search-lab">
      <header><div><small>RETRIEVAL LAB</small><h3>知识检索验证</h3><p>在生成前验证教材中的知识点是否能够被准确召回。</p></div><Segmented value={mode} onChange={(value) => setMode(value as 'keyword' | 'vector')} options={[{ value: 'vector', label: '语义向量' }, { value: 'keyword', label: '关键词' }]} /></header>
      <div className="tn-search-bar"><SearchOutlined /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索知识点，例如：SYN-ACK 的作用是什么？" onPressEnter={() => void search()} /><Button type="primary" loading={searching} onClick={() => void search()}>检索知识库</Button></div>
      <div className="tn-result-grid">{results.length ? results.map((result, index) => <article key={`${result.source}-${index}`}><header><span>{String(index + 1).padStart(2, '0')}</span><strong>{result.source}</strong><Tag color="blue">{result.score?.toFixed(3) ?? '语义匹配'}</Tag></header><p>{result.content}</p><footer>{result.page && <span>第 {result.page} 页</span>}{result.section && <span>{result.section}</span>}{result.tags?.slice(0, 3).map((tag) => <em key={tag}>#{tag}</em>)}</footer></article>) : <div className="tn-search-empty"><SearchOutlined /><span>输入问题，查看知识库召回结果与来源</span></div>}</div>
    </section>
    <Modal open={Boolean(preview)} onCancel={() => setPreview(undefined)} footer={null} width={820} title={preview?.title} className="tn-preview-modal"><div className="tn-preview-meta">{preview && Object.entries(preview.metadata).slice(0, 5).map(([key, value]) => <Tag key={key}>{key}: {String(value)}</Tag>)}</div><pre>{preview?.text}</pre></Modal>
  </div>;
}

function GeneratePage(props: SharedPageProps & { onNavigate: (view: ViewKey) => void }) {
  if (!props.activeTask) return <EmptyProject />;
  const complete = Math.round((props.requirement?.completeness ?? 0) * 100);
  const latestJob = props.jobs[0];
  const generate = (type: 'all' | 'pptx' | 'docx') => props.runJob(() => type === 'all' ? api.generateAssets(props.activeTask!.id) : type === 'pptx' ? api.generatePptx(props.activeTask!.id) : api.generateDocx(props.activeTask!.id), type === 'all' ? '全部教学产物已生成' : `${type.toUpperCase()} 已生成`);
  return <div className="tn-page">
    <PageHeading eyebrow="GENERATION HUB" title="生成中心" description="将结构化需求、教学设计与知识库依据融合为可直接使用的课堂资源。" action={<Button type="primary" size="large" icon={<SparklesOutlined />} loading={props.loadingContext} onClick={() => void generate('all')}>生成完整课程包</Button>} />
    <section className="tn-white-card tn-readiness">
      <div><small>GENERATION READINESS</small><h2>生成准备度</h2><p>系统已自动检查当前项目的关键条件。</p></div>
      {[
        ['需求确认', `${complete}%`, complete >= 100], ['参考资料', `${props.files.filter((file) => file.parse_status === 'ready').length} 份`, props.files.some((file) => file.parse_status === 'ready')], ['教学设计', `${props.requirement?.session.teaching.keyPoints.length ?? 0} 个要点`, Boolean(props.requirement?.session.teaching.keyPoints.length)], ['生成模型', '已连接', true],
      ].map(([label, value, done]) => <article key={String(label)} className={done ? 'done' : ''}><span>{done ? <CheckOutlined /> : <ClockCircleOutlined />}</span><div><small>{label}</small><strong>{value}</strong></div></article>)}
    </section>
    <div className="tn-generation-grid">
      <section className="tn-white-card tn-output-builder">
        <header><div><small>OUTPUT BUILDER</small><h3>选择生成内容</h3></div><Tag color="blue">支持后台任务</Tag></header>
        <div className="tn-output-options">
          <button type="button" onClick={() => void generate('pptx')}><span className="amber"><FilePptOutlined /></span><div><strong>演示课件</strong><p>封面、大纲、知识讲解、案例、练习与总结</p><small>PPTX · 可继续对话修改</small></div><ArrowRightOutlined /></button>
          <button type="button" onClick={() => void generate('docx')}><span className="blue"><FileWordOutlined /></span><div><strong>详细教案</strong><p>目标、重难点、教学过程、师生活动与作业</p><small>DOCX · 教研评审友好</small></div><ArrowRightOutlined /></button>
          <button type="button" onClick={() => void generate('all')}><span className="violet"><SparklesOutlined /></span><div><strong>完整课程包</strong><p>同时生成 PPT、教案及后端支持的配套资源</p><small>推荐 · 一次完成</small></div><ArrowRightOutlined /></button>
        </div>
      </section>
      <section className="tn-white-card tn-job-card">
        <header><div><small>LIVE PROCESS</small><h3>生成任务</h3></div>{latestJob && <Tag color={latestJob.status === 'succeeded' ? 'green' : latestJob.status === 'failed' ? 'red' : 'processing'}>{latestJob.status === 'succeeded' ? '已完成' : latestJob.status === 'failed' ? '失败' : '进行中'}</Tag>}</header>
        {latestJob ? <><div className={`tn-job-orb ${latestJob.status}`}><SparklesOutlined /></div><h3>{latestJob.progress || '任务等待执行'}</h3><p>{latestJob.job_type.replaceAll('_', ' ')} · #{latestJob.id}</p><Progress percent={latestJob.status === 'succeeded' ? 100 : latestJob.status === 'running' ? 68 : latestJob.status === 'failed' ? 100 : 12} status={latestJob.status === 'failed' ? 'exception' : latestJob.status === 'succeeded' ? 'success' : 'active'} showInfo={false} /><small>{latestJob.error || '你可以离开此页面，生成会在后台继续。'}</small></> : <div className="tn-job-empty"><SparklesOutlined /><h3>准备开始生成</h3><p>选择左侧产物，进度会显示在这里。</p></div>}
      </section>
    </div>
    <section className="tn-white-card tn-assets-section">
      <header><div><small>COURSE DELIVERABLES</small><h3>教学产物</h3></div><Button type="text" onClick={() => props.onNavigate('editor')}>进入课件编辑 <ArrowRightOutlined /></Button></header>
      <div className="tn-assets-grid">{props.assets.length ? props.assets.map((asset) => { const visual = assetVisual(asset.asset_type); return <article key={asset.id}><span className={visual.tone}>{visual.icon}</span><Tag>v{asset.version}</Tag><h3>{visual.title}</h3><p>{visual.desc}</p><small>{asset.file_name}</small><a href={`${API_BASE}/assets/${asset.id}/download`} target="_blank" rel="noreferrer"><DownloadOutlined /> 下载文件</a></article>; }) : <div className="tn-assets-empty"><SparklesOutlined /><h3>还没有生成产物</h3><p>确认需求后，点击“生成完整课程包”。</p></div>}</div>
    </section>
  </div>;
}

const PAGE_TYPE_META: Record<string, { label: string; tone: string }> = {
  cover: { label: '封面', tone: 'blue' },
  agenda: { label: '目录', tone: 'blue' },
  section: { label: '章节', tone: 'blue' },
  content: { label: '内容', tone: 'mint' },
  chart: { label: '图表', tone: 'violet' },
  table: { label: '对比表', tone: 'violet' },
  timeline: { label: '时间轴', tone: 'amber' },
  process: { label: '流程', tone: 'amber' },
  compare: { label: '辨析', tone: 'rose' },
  case: { label: '案例', tone: 'amber' },
  activity: { label: '互动', tone: 'violet' },
  quote: { label: '金句', tone: 'mint' },
  metrics: { label: '数据', tone: 'violet' },
  summary: { label: '总结', tone: 'rose' },
  ending: { label: '结束', tone: 'rose' },
};

const SECTION_ORDER = ['课程导入', '核心概念', '案例分析', '课堂互动', '总结作业'];

/** 画布内的结构化预览：图表 / 对比表 / 辨析 / 流程 / 时间轴 */
function DeckStructure({ page, colors }: { page: DeckPage; colors: Record<string, string> }) {
  const chart = page.chart;
  if (chart && chart.values?.length) {
    const max = Math.max(...chart.values.map((value) => Math.abs(value) || 1));
    return <div className="tn-wb-chart">
      {chart.values.map((value, i) => <div className="tn-wb-chart-col" key={`${i}-${value}`}>
        <span style={{ color: colors.primary }}>{value}</span>
        <i style={{ height: `${Math.max(10, (Math.abs(value) / max) * 100)}%`, background: i % 2 ? colors.accent : colors.primary }} />
        <small style={{ color: colors.muted }}>{chart.labels?.[i] ?? ''}</small>
      </div>)}
    </div>;
  }

  const table = page.table;
  if (table?.head?.length) {
    return <div className="tn-wb-table" style={{ borderColor: colors.line }}>
      <div className="tn-wb-table-row head" style={{ background: colors.primary, color: '#fff' }}>
        {table.head.map((cell) => <span key={cell}>{cell}</span>)}
      </div>
      {table.rows.slice(0, 6).map((row, i) => <div className="tn-wb-table-row" key={`row-${i}`}
        style={{ background: i % 2 ? colors.primarySoft : colors.surface, color: colors.text, borderColor: colors.line }}>
        {table.head.map((_, col) => <span key={`cell-${col}`}>{row[col] ?? ''}</span>)}
      </div>)}
    </div>;
  }

  const compare = page.compare;
  if (compare && (compare.left?.length || compare.right?.length)) {
    const col = (title: string, items: string[], tone: string) => <div className="tn-wb-cmp-col" key={title}>
      <em style={{ background: tone }}>{title}</em>
      <ul style={{ borderColor: colors.line, background: colors.surface }}>
        {items.slice(0, 4).map((item) => <li key={item} style={{ color: colors.text }}>{item}</li>)}
      </ul>
    </div>;
    return <div className="tn-wb-compare">
      {col(compare.leftTitle || '正确做法', compare.left || [], colors.primary)}
      <b style={{ color: colors.muted }}>VS</b>
      {col(compare.rightTitle || '常见错误', compare.right || [], colors.accent)}
    </div>;
  }

  if (page.type === 'process' || page.type === 'timeline') {
    return <div className={`tn-wb-flow ${page.type}`}>
      {page.bullets.slice(0, 5).map((bullet, i) => {
        const [head, ...rest] = bullet.split(/[|｜]/);
        return <div className="tn-wb-flow-step" key={`${i}-${bullet}`}>
          <em style={{ background: i % 2 ? colors.primary : colors.accent }}>{page.type === 'process' ? i + 1 : ''}</em>
          <strong style={{ color: colors.text }}>{head.trim()}</strong>
          {rest.length ? <small style={{ color: colors.muted }}>{rest.join(' ').trim()}</small> : null}
        </div>;
      })}
    </div>;
  }

  if (page.type === 'metrics') {
    return <div className="tn-wb-metrics">
      {page.bullets.slice(0, 4).map((bullet) => {
        const [label, ...rest] = bullet.split(/[：:]/);
        return <div className="tn-wb-metric" key={bullet} style={{ background: colors.surface, borderColor: colors.line }}>
          <strong style={{ color: colors.primary }}>{rest.join('').trim().slice(0, 8)}</strong>
          <small style={{ color: colors.muted }}>{label.trim()}</small>
        </div>;
      })}
    </div>;
  }

  return null;
}

const AI_CAPABILITIES = [
  '优化当前页面',
  '修改整套课件',
  '调整教学结构',
  '增加课堂互动',
  '优化视觉布局',
  '补充教学案例',
  '调整文字难度',
];

const QUICK_ACTIONS = ['优化当前页面', '文字精简 30%', '增加一个案例', '增加一个互动', '重新设计本页'];

const TRACE_STEPS = ['读取页面内容', '分析信息密度与结构', '生成优化方案', '校验版面字数', '等待教师确认'];

const TEMPLATE_CATEGORIES = [
  { key: 'all', name: '全部' },
  { key: 'education', name: '教育' },
  { key: 'tech', name: '科技' },
  { key: 'academic', name: '学术' },
  { key: 'business', name: '商务' },
  { key: 'creative', name: '创意' },
  { key: 'classic', name: '经典' },
];

const ORNAMENT_LABELS: Record<string, string> = {
  'circle-soft': '柔和圆形',
  'glow-grid': '科技网格',
  'glass-orb': '玻璃光球',
  'ink-corner': '水墨印章',
  'chalk-doodle': '粉笔手绘',
  blueprint: '坐标蓝图',
  'organic-curve': '有机曲线',
  'dot-matrix': '点阵',
  sticker: '贴纸',
  'paper-edge': '纸感边框',
  'corner-fold': '折角',
  'edge-block': '色块边',
  'neon-line': '霓虹线',
  minimal: '极简',
};

const CARD_STYLE_LABELS: Record<string, string> = {
  flat: '平涂卡片',
  outline: '描边卡片',
  glass: '玻璃卡片',
  hard: '立体卡片',
  tinted: '淡底卡片',
  underline: '底线分隔',
};

const TITLE_STYLE_LABELS: Record<string, string> = {
  rule: '短横线标题',
  bar: '顶部色条标题',
  boxed: '色块反白标题',
  number: '编号标题',
  underline: '下划线标题',
  center: '居中标题',
};

function svgToDataUri(svg: string) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function TemplateCenterModal(props: {
  open: boolean;
  templates: PptTemplate[];
  groups: LayoutGroup[];
  activeId?: string;
  applying: boolean;
  onClose: () => void;
  onApply: (templateId: string) => void;
}) {
  const [category, setCategory] = useState('all');
  const [selected, setSelected] = useState<string>();
  const [previews, setPreviews] = useState<Record<string, TemplatePreviewSlide[]>>({});
  const [board, setBoard] = useState<TemplateBoard>();

  const filtered = useMemo(() => {
    if (category === 'all') return props.templates;
    if (category === 'classic') return props.templates.filter((item) => item.generation < 2);
    return props.templates.filter((item) => item.category === category);
  }, [props.templates, category]);

  // 打开时载入当前分类模板的真实版面缩略图（每套 6 张页面母版）
  useEffect(() => {
    if (!props.open) return;
    let alive = true;
    const pending = filtered.filter((item) => !previews[item.id]).slice(0, 12);
    if (!pending.length) return;
    void (async () => {
      for (const item of pending) {
        try {
          const data = await api.getTemplatePreview(item.id);
          if (!alive) return;
          setPreviews((prev) => ({ ...prev, [item.id]: data.slides }));
        } catch {
          /* 缩略图失败不影响选择 */
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [props.open, filtered, previews]);

  useEffect(() => {
    if (!selected) {
      setBoard(undefined);
      return;
    }
    let alive = true;
    void (async () => {
      try {
        const data = await api.getTemplateLayouts(selected);
        if (alive) setBoard(data);
      } catch {
        if (alive) setBoard(undefined);
      }
    })();
    return () => {
      alive = false;
    };
  }, [selected]);

  const active = props.templates.find((item) => item.id === (selected ?? props.activeId));
  const current = board ?? (selected ? (props.templates.find((item) => item.id === selected) as TemplateBoard | undefined) : undefined);

  return <Modal
    open={props.open}
    onCancel={props.onClose}
    footer={null}
    width={1140}
    title={<span>PPT 模板中心 <em style={{ fontWeight: 400, fontSize: 12, color: '#8a94a6' }}>模板 = 设计系统 + 16 组页面母版</em></span>}
    className="tn-modal tn-tc-modal"
  >
    <div className="tn-tc-head">
      <p>
        每套模板都是一套<b>完整设计系统</b>：配色、字体、圆角、阴影、装饰、卡片语言、标题语言，再加上 16 组页面母版。
        选定后，AI 布局引擎会按每页内容自动匹配这套模板自己的页面母版，而不是只换颜色。
      </p>
      <div className="tn-tc-tabs">
        {TEMPLATE_CATEGORIES.map((item) => <button type="button" key={item.key} className={category === item.key ? 'active' : ''} onClick={() => setCategory(item.key)}>{item.name}</button>)}
      </div>
    </div>

    <div className="tn-tc-body">
      <div className="tn-tc-grid">
        {filtered.map((item) => {
          const slides = previews[item.id] ?? [];
          const chosen = (selected ?? props.activeId) === item.id;
          return <button type="button" key={item.id} className={`tn-tc-card ${chosen ? 'active' : ''}`} onClick={() => setSelected(item.id)}>
            <div className="tn-tc-thumbs" style={{ background: item.colors.surfaceAlt, borderColor: item.colors.line }}>
              {slides.length
                ? slides.slice(0, 6).map((slide) => <img key={slide.kind} src={svgToDataUri(slide.svg)} alt={slide.kind} />)
                : <span className="tn-tc-thumbs-loading" style={{ background: item.colors.primarySoft }} />}
            </div>
            <div className="tn-tc-meta">
              <div className="tn-tc-title">
                <strong>{item.name}</strong>
                {item.id === props.activeId && <Tag color="blue">当前</Tag>}
              </div>
              <small>{item.masterCount} 种页面布局 · {item.font}{item.dark ? ' · 深色底' : ''}</small>
              <p>{item.description}</p>
              <div className="tn-tc-tags">
                {(item.suitable.length ? item.suitable : item.tags).slice(0, 3).map((tag) => <i key={tag}>{tag}</i>)}
              </div>
            </div>
            <div className="tn-tc-swatches">
              {['primary', 'accent', 'background', 'surface', 'text'].map((key) => item.colors[key] && <i key={key} style={{ background: item.colors[key] }} />)}
            </div>
          </button>;
        })}
        {!filtered.length && <Empty description="该分类下暂无模板" />}
      </div>

      <aside className="tn-tc-detail">
        {active ? <>
          <header>
            <strong>{active.name}</strong>
            <span>{active.dark ? '深色' : '浅色'} · {active.ratio} · {active.font}</span>
          </header>
          <p className="tn-tc-detail-desc">{active.description}</p>

          <div className="tn-tc-system">
            <span>设计系统</span>
            <div>
              <i>{ORNAMENT_LABELS[active.design?.ornament ?? ''] ?? active.design?.ornament ?? '装饰'}</i>
              <i>{CARD_STYLE_LABELS[active.design?.cardStyle ?? ''] ?? active.design?.cardStyle ?? '卡片'}</i>
              <i>{TITLE_STYLE_LABELS[active.design?.titleStyle ?? ''] ?? active.design?.titleStyle ?? '标题'}</i>
              {active.design?.shadow && <i>投影</i>}
            </div>
          </div>

          {active.suitable.length > 0 && <div className="tn-tc-fit">
            <span>适合</span>
            <div>{active.suitable.map((item) => <i key={item}>✓ {item}</i>)}</div>
          </div>}

          <div className="tn-tc-layouts">
            <span>页面母版（{current?.masterCount ?? active.masterCount}）</span>
            <div className="tn-tc-layout-grid">
              {(current?.board ?? props.groups.map((group) => ({ key: group.key, name: group.name, hint: group.hint, masters: active.layouts?.[group.key] ?? [], masterCount: (active.layouts?.[group.key] ?? []).length }))).map((entry) => <div key={entry.key} className={entry.masterCount ? '' : 'empty'}>
                <strong>{entry.name}</strong>
                <small>{entry.hint}</small>
                <em>{entry.masterCount ? entry.masters.join(' / ') : '默认母版'}</em>
              </div>)}
            </div>
          </div>
        </> : <Empty description="选择一套模板查看它的页面母版" />}
      </aside>
    </div>

    <div className="tn-tc-actions">
      <span>{selected ? `已选择：${props.templates.find((item) => item.id === selected)?.name ?? ''}` : `当前模板：${props.templates.find((item) => item.id === props.activeId)?.name ?? '未选择'}`}</span>
      <Space>
        <Button onClick={props.onClose}>取消</Button>
        <Button type="primary" loading={props.applying} onClick={() => props.onApply(selected ?? props.activeId ?? 'fresh-luxury')}>应用模板并重新生成</Button>
      </Space>
    </div>
  </Modal>;
}

function WorkbenchPage(props: SharedPageProps) {
  const [deck, setDeck] = useState<PptDeck>();
  const [templates, setTemplates] = useState<PptTemplate[]>([]);
  const [versions, setVersions] = useState<GeneratedAsset[]>([]);
  const [index, setIndex] = useState(0);
  const [mode, setMode] = useState<'ai' | 'manual'>('ai');
  const [instruction, setInstruction] = useState('');
  const [revision, setRevision] = useState<SlideRevision>();
  const [busy, setBusy] = useState<'revise' | 'render' | 'save' | null>(null);
  const [loading, setLoading] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [pendingTemplate, setPendingTemplate] = useState<string>();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [quality, setQuality] = useState<DeckQuality>();
  const [busyEnrich, setBusyEnrich] = useState(false);
  const [layoutGroups, setLayoutGroups] = useState<LayoutGroup[]>([]);
  const [busyLayout, setBusyLayout] = useState(false);
  const [layoutHint, setLayoutHint] = useState('');

  const taskId = props.activeTask?.id;

  const load = async (silent = false) => {
    if (!taskId) return;
    if (!silent) setLoading(true);
    try {
      const data = await api.getDeck(taskId);
      setDeck(data.deck);
      setTemplates(data.templates);
      setVersions(data.versions);
      setQuality(data.quality);
      setRevision(undefined);
      setIndex((current) => Math.min(current, Math.max(data.deck.pages.length - 1, 0)));
    } catch (error) {
      message.error(error instanceof Error ? error.message : '课件数据加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    void api.getPptTemplates()
      .then((data) => {
        if (data.templates.length) setTemplates(data.templates);
        setLayoutGroups(data.groups);
      })
      .catch(() => { /* 模板目录加载失败时沿用 deck 接口返回的模板 */ });
  }, [taskId]);

  if (!props.activeTask) return <EmptyProject />;

  const pages = deck?.pages ?? [];
  const current = pages[Math.min(index, Math.max(pages.length - 1, 0))];
  const template = templates.find((item) => item.id === (pendingTemplate ?? deck?.templateId));
  const colors = template?.colors ?? {};
  const sections = [...new Set([...SECTION_ORDER, ...pages.map((page) => page.section)])]
    .map((name) => ({ name, items: pages.filter((page) => page.section === name) }))
    .filter((group) => group.items.length > 0);

  const patchPage = async (patch: Partial<DeckPage>, silent = true) => {
    if (!taskId || !current) return;
    const nextPages = pages.map((page) => (page.index === current.index ? { ...page, ...patch } : page));
    setDeck(deck ? { ...deck, pages: nextPages } : deck);
    if (!silent) setBusy('save');
    try {
      const result = await api.updateDeckPage(taskId, current.index, patch);
      setDeck(result.deck);
      if (!silent) message.success('页面已保存');
    } catch (error) {
      message.error(error instanceof Error ? error.message : '保存失败');
      void load(true);
    } finally {
      if (!silent) setBusy(null);
    }
  };

  const runRevision = async (text: string) => {
    if (!taskId || !current || !text.trim()) return;
    setBusy('revise');
    setRevision(undefined);
    try {
      const result = await api.reviseDeckPage(taskId, current.index, text);
      setRevision(result);
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'AI 修改失败');
    } finally {
      setBusy(null);
    }
  };

  const acceptRevision = async () => {
    if (!taskId || !revision) return;
    setBusy('save');
    try {
      const result = await api.applyRevision(taskId, revision.index, revision.after, true);
      setDeck(result.deck);
      if (result.asset) setVersions((prev) => [result.asset as GeneratedAsset, ...prev]);
      setRevision(undefined);
      setInstruction('');
      message.success('已采用修改并生成新版本');
    } catch (error) {
      message.error(error instanceof Error ? error.message : '应用修改失败');
    } finally {
      setBusy(null);
    }
  };

  const renderDeck = async (templateId?: string) => {
    if (!taskId) return;
    setBusy('render');
    try {
      const result = await api.renderDeck(taskId, templateId);
      setDeck(result.deck);
      setVersions((prev) => [result.asset, ...prev]);
      setPendingTemplate(undefined);
      setTemplateOpen(false);
      message.success(`已生成 PPTX v${result.asset.version}`);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '渲染失败');
    } finally {
      setBusy(null);
    }
  };

  const autoLayout = async () => {
    if (!taskId) return;
    setBusyLayout(true);
    try {
      const result = await api.autoLayoutDeck(taskId, deck?.templateId);
      setDeck(result.deck);
      const groups = [...new Set(result.plan.map((item) => item.group))];
      setLayoutHint(`已为 ${result.plan.length} 页匹配母版，覆盖 ${groups.length} 个布局组`);
      message.success(`AI 布局匹配完成：${result.plan.length} 页 · ${groups.length} 种布局`);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '布局匹配失败');
    } finally {
      setBusyLayout(false);
    }
  };

  const enrichDeck = async () => {
    if (!taskId) return;
    setBusyEnrich(true);
    try {
      const result = await api.enrichDeck(taskId, '');
      setDeck(result.deck);
      setQuality(result.quality);
      setIndex(0);
      message.success(`${result.summary}（引用知识库 ${result.materialCount} 条素材）`);
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'AI 充实课件失败');
    } finally {
      setBusyEnrich(false);
    }
  };

  const addPage = async () => {
    if (!taskId) return;
    try {
      const result = await api.addDeckPage(taskId, { title: '新页面', type: 'content' });
      setDeck(result.deck);
      setIndex(result.index);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '新增页面失败');
    }
  };

  const removePage = async () => {
    if (!taskId || !current || pages.length <= 1) return;
    try {
      const result = await api.deleteDeckPage(taskId, current.index);
      setDeck(result.deck);
      setIndex(Math.max(0, current.index - 1));
    } catch (error) {
      message.error(error instanceof Error ? error.message : '删除页面失败');
    }
  };

  const latest = versions[0];

  return <div className="tn-page tn-wb-page">
    <div className="tn-wb-topbar">
      <div>
        <small>AI COURSEWARE WORKBENCH</small>
        <h1>AI 课件工作台</h1>
        <p>
          {props.activeTask.teaching_topic || props.activeTask.title} · 共 {pages.length} 页 · 风格 {template?.name ?? '清新简奢'}
          {quality && <> · 平均 {quality.avgBullets} 个要点/页{quality.visualPages ? ` · ${quality.visualPages} 页图表/表格/流程` : ''}</>}
        </p>
      </div>
      <Space>
        <Segmented value={mode} onChange={(value) => setMode(value as 'ai' | 'manual')} options={[{ label: 'AI 模式', value: 'ai' }, { label: '手动模式', value: 'manual' }]} />
        <Button type={quality?.needsEnrich ? 'primary' : 'default'} icon={<ThunderboltOutlined />} loading={busyEnrich} onClick={() => void enrichDeck()}>
          AI 充实课件
        </Button>
        <Button icon={<LayoutOutlined />} loading={busyLayout} onClick={() => void autoLayout()}>AI 智能布局</Button>
        <Button icon={<AppstoreOutlined />} onClick={() => setTemplateOpen(true)}>模板中心（{templates.length}）</Button>
        <Button icon={<CheckOutlined />} loading={busy === 'save'} onClick={() => void patchPage({}, false)}>保存</Button>
        <Button type="primary" icon={<DownloadOutlined />} loading={busy === 'render'} onClick={() => void renderDeck(pendingTemplate ?? deck?.templateId)}>导出 PPTX</Button>
      </Space>
    </div>

    <div className="tn-wb-layout">
      <aside className="tn-white-card tn-wb-tree">
        <header>
          <div><small>COURSE STRUCTURE</small><h3>课件结构</h3></div>
          <Tag>{pages.length} 页</Tag>
        </header>
        <div className="tn-wb-tree-body">
          {sections.map((group) => <section key={group.name}>
            <button type="button" className="tn-wb-group" onClick={() => setCollapsed((prev) => ({ ...prev, [group.name]: !prev[group.name] }))}>
              <ArrowRightOutlined className={collapsed[group.name] ? 'arrow' : 'arrow open'} />
              <strong>{group.name}</strong>
              <em>{group.items.length}</em>
            </button>
            {!collapsed[group.name] && group.items.map((page) => {
              const meta = PAGE_TYPE_META[page.type] ?? PAGE_TYPE_META.content;
              return <button type="button" key={page.index} className={`tn-wb-node ${page.index === current?.index ? 'active' : ''}`} onClick={() => setIndex(page.index)}>
                <span>{String(page.index + 1).padStart(2, '0')}</span>
                <div><strong>{page.title}</strong><small>{meta.label} · {page.bullets.length} 个要点</small></div>
                <i className={meta.tone}>{meta.label}</i>
              </button>;
            })}
          </section>)}
        </div>
        <footer><Button block icon={<PlusOutlined />} onClick={() => void addPage()}>添加页面</Button></footer>
      </aside>

      <section className="tn-white-card tn-wb-stage">
        <header>
          <div>
            <button type="button" onClick={() => setIndex(Math.max(0, (current?.index ?? 0) - 1))}>‹</button>
            <strong>{String((current?.index ?? 0) + 1).padStart(2, '0')} / {String(pages.length).padStart(2, '0')}</strong>
            <button type="button" onClick={() => setIndex(Math.min(pages.length - 1, (current?.index ?? 0) + 1))}>›</button>
          </div>
          <span>{template?.ratio ?? '16:9'} · {mode === 'ai' ? 'AI 模式' : '手动编辑'}</span>
        </header>

        {current ? <div className="tn-wb-canvas" style={{ background: colors.background, color: colors.text }}>
          <span className="tn-wb-canvas-deco" style={{ background: colors.primarySoft }} />
          <span className="tn-wb-canvas-deco two" style={{ background: colors.accent }} />
          <div className="tn-wb-canvas-inner">
            <small style={{ color: colors.primary }}>{current.side || template?.name}</small>
            {mode === 'manual'
              ? <Input className="tn-wb-title-input" value={current.title} style={{ color: colors.text }} onChange={(event) => void patchPage({ title: event.target.value })} />
              : <h2 style={{ color: colors.text }}>{current.title}</h2>}
            <DeckStructure page={current} colors={colors} />
            {!['process', 'timeline', 'metrics'].includes(current.type) && !current.table?.head?.length && !current.compare
              ? <ul>
                  {current.bullets.map((bullet, bulletIndex) => <li key={`${bulletIndex}-${bullet}`} style={{ color: colors.text }}>
                    <i style={{ background: colors.primary }} />
                    {mode === 'manual'
                      ? <Input value={bullet} onChange={(event) => {
                          const next = [...current.bullets];
                          next[bulletIndex] = event.target.value;
                          void patchPage({ bullets: next });
                        }} suffix={<DeleteOutlined onClick={() => void patchPage({ bullets: current.bullets.filter((_, item) => item !== bulletIndex) })} />} />
                      : <span>{bullet}</span>}
                  </li>)}
                </ul>
              : null}
            {mode === 'manual' && <Button size="small" icon={<PlusOutlined />} onClick={() => void patchPage({ bullets: [...current.bullets, '新增要点'] })}>添加要点</Button>}
            {current.interaction && <p className="tn-wb-interaction" style={{ borderColor: colors.line, color: colors.muted }}><ThunderboltOutlined /> {current.interaction}</p>}
          </div>
          <footer style={{ borderColor: colors.line, color: colors.muted }}>
            <span>{template?.footer || 'AI 互动式教学智能体 · TeachNova'}</span>
            <em>{String((current?.index ?? 0) + 1).padStart(2, '0')}</em>
          </footer>
        </div> : <div className="tn-wb-stage-empty"><Spin spinning={loading}><Empty description="还没有课件页面" /></Spin></div>}

        <div className="tn-wb-thumbs">
          {pages.map((page) => {
            const meta = PAGE_TYPE_META[page.type] ?? PAGE_TYPE_META.content;
            return <button type="button" key={page.index} className={page.index === current?.index ? 'active' : ''} onClick={() => setIndex(page.index)}>
              <span>{String(page.index + 1).padStart(2, '0')}</span>
              <div style={{ background: colors.surface, borderColor: colors.line }}>
                <strong style={{ color: colors.text }}>{page.title}</strong>
                <i className={meta.tone}>{meta.label}</i>
              </div>
            </button>;
          })}
        </div>

        <div className="tn-wb-stylebar">
          <span>PPT 风格：<strong>{template?.name ?? '清新简奢'}</strong>{template?.masterCount ? <i className="tn-wb-chip">{template.masterCount} 种页面母版</i> : null}</span>
          <em>{template?.font} · {template?.ratio}{layoutHint ? ` · ${layoutHint}` : ''}</em>
          <Space>
            <Button size="small" onClick={() => setTemplateOpen(true)}>更换模板</Button>
            {mode === 'manual' && <Button size="small" danger icon={<DeleteOutlined />} onClick={() => void removePage()}>删除本页</Button>}
          </Space>
        </div>
      </section>

      <aside className="tn-white-card tn-wb-assistant">
        <header><div><small>AI ASSISTANT</small><h3>AI 课件助手</h3></div><span><RobotOutlined /></span></header>
        <div className="tn-wb-abilities">
          <p>我可以帮你：</p>
          {AI_CAPABILITIES.map((item) => <button type="button" key={item} onClick={() => setInstruction(item)}><SparklesOutlined />{item}</button>)}
        </div>

        {busy === 'revise' && <div className="tn-wb-trace">
          <p><Spin size="small" /> AI 正在分析第 {(current?.index ?? 0) + 1} 页…</p>
          {TRACE_STEPS.map((step, stepIndex) => <div key={step} className={stepIndex === 0 ? 'running' : ''}><i /><span>{step}</span></div>)}
        </div>}

        {revision && <div className="tn-wb-diff">
          <div className="tn-wb-diff-head"><strong>AI 修改建议</strong><Tag color="blue">第 {revision.index + 1} 页</Tag></div>
          <p>{revision.summary}</p>
          {revision.issues.length > 0 && <div className="tn-wb-issues">{revision.issues.map((item) => <div key={item}><ExperimentOutlined />{item}</div>)}</div>}
          {revision.suggestions.length > 0 && <div className="tn-wb-suggest">{revision.suggestions.map((item) => <div key={item}><CheckCircleFilled />{item}</div>)}</div>}
          <div className="tn-wb-diff-grid">
            <article><small>修改前</small><h4>{revision.before.title}</h4>{revision.before.bullets.map((item) => <p key={item}>{item}</p>)}</article>
            <article className="after"><small>修改后</small><h4>{revision.after.title}</h4>{revision.after.bullets.map((item) => <p key={item}>{item}</p>)}</article>
          </div>
          <div className="tn-wb-diff-actions">
            <Button size="small" onClick={() => setRevision(undefined)}>撤销</Button>
            <Button size="small" type="primary" loading={busy === 'save'} onClick={() => void acceptRevision()}>采用修改</Button>
          </div>
        </div>}

        <div className="tn-wb-quick">
          <span>快捷操作</span>
          <div>{QUICK_ACTIONS.map((item) => <button type="button" key={item} onClick={() => void runRevision(item)}>{item}</button>)}</div>
        </div>

        <Input.TextArea value={instruction} onChange={(event) => setInstruction(event.target.value)} autoSize={{ minRows: 3, maxRows: 6 }} placeholder="例如：第 4 页文字太多，请精简成 3 个要点，并增加一个课堂提问。" />
        <Button block type="primary" icon={<SparklesOutlined />} loading={busy === 'revise'} disabled={!instruction.trim()} onClick={() => void runRevision(instruction)}>让 AI 修改这一页</Button>

        <div className="tn-wb-versions">
          <span>版本历史</span>
          <div>
            {versions.slice(0, 6).map((item, itemIndex) => <a key={item.id} className={itemIndex === 0 ? 'active' : ''} href={`${API_BASE}/assets/${item.id}/download`} target="_blank" rel="noreferrer">v{item.version}</a>)}
            {!versions.length && <em>还没有版本，导出后自动生成</em>}
          </div>
        </div>
        {latest && <a className="tn-wb-export" href={`${API_BASE}/assets/${latest.id}/download`} target="_blank" rel="noreferrer"><DownloadOutlined /> 下载最新 PPTX</a>}
      </aside>
    </div>

    <TemplateCenterModal
      open={templateOpen}
      templates={templates}
      groups={layoutGroups}
      activeId={pendingTemplate ?? deck?.templateId}
      applying={busy === 'render'}
      onClose={() => { setTemplateOpen(false); setPendingTemplate(undefined); }}
      onApply={(templateId) => void renderDeck(templateId)}
    />
  </div>;
}

function ProjectsPage({ tasks, activeTask, onSelect, onCreate }: { tasks: Task[]; activeTask?: Task; onSelect: (id: number) => void; onCreate: () => void }) {
  const [search, setSearch] = useState('');
  const filtered = tasks.filter((task) => `${task.title}${task.subject ?? ''}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="tn-page"><PageHeading eyebrow="PROJECT LIBRARY" title="项目记录" description="查看所有教学项目，随时继续对话、生成或修改。" action={<Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>新建项目</Button>} /><div className="tn-project-toolbar"><Input prefix={<SearchOutlined />} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索课程或学科" /><span>共 {tasks.length} 个项目</span></div><div className="tn-project-grid">{filtered.map((task, index) => <button type="button" key={task.id} className={activeTask?.id === task.id ? 'active' : ''} onClick={() => onSelect(task.id)}><div className={`tn-project-cover cover-${index % 4}`}><span>TN / {String(task.id).padStart(3, '0')}</span><strong>{task.teaching_topic || task.title}</strong><small>{task.subject || 'AI 教学项目'}</small></div><div className="tn-project-meta"><div><Tag color={task.intent_status === 'confirmed' ? 'green' : 'blue'}>{task.intent_status === 'confirmed' ? '需求已确认' : '需求完善中'}</Tag><small>{dateText(task.updated_at)}</small></div><p>{task.audience || '授课对象待确认'} · {task.duration_minutes ? `${task.duration_minutes} 分钟` : '时长待确认'}</p><span>继续创作 <ArrowRightOutlined /></span></div></button>)}</div>{!filtered.length && <Empty description="没有匹配的项目" />}</div>;
}

function ModelsPage({ state, onChange }: { state?: ModelConfigState; onChange: (state: ModelConfigState) => void }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ModelConfig>();
  const [form] = Form.useForm();
  const edit = (model?: ModelConfig) => { setEditing(model); form.setFieldsValue(model ?? { provider: '', remark: '', website: '', apiKey: '', endpoint: '', model: '', logo: 'AI', configJson: '{}', useStandaloneTest: false, useStandaloneBilling: false }); setOpen(true); };
  const save = async (values: Partial<ModelConfig>) => { try { const next = await api.saveModelConfig({ id: editing?.id ?? `model-${Date.now()}`, provider: values.provider ?? '自定义模型', remark: values.remark ?? '', website: values.website ?? '', apiKey: values.apiKey ?? '', endpoint: values.endpoint ?? '', model: values.model ?? '', logo: (values.logo ?? 'AI').slice(0, 2), status: '未检测', useStandaloneTest: false, useStandaloneBilling: false, configJson: values.configJson ?? '{}' }); onChange(next); setOpen(false); message.success('模型配置已保存'); } catch (error) { message.error(error instanceof Error ? error.message : '保存失败'); } };
  const activate = async (id: string) => { try { onChange(await api.activateModelConfig(id)); message.success('已切换生成模型'); } catch (error) { message.error(error instanceof Error ? error.message : '切换失败'); } };
  const test = async (id: string) => { try { const next = await api.testModelConfig(id); onChange(next); const model = next.models.find((item) => item.id === id); model?.status === '连接正常' ? message.success('连接测试成功') : message.error('连接测试失败'); } catch (error) { message.error(error instanceof Error ? error.message : '测试失败'); } };
  return <div className="tn-page"><PageHeading eyebrow="MODEL ORCHESTRATION" title="模型设置" description="配置 Teaching Agent 的推理模型；知识库向量模型由后端独立管理。" action={<Button type="primary" icon={<PlusOutlined />} onClick={() => edit()}>添加模型</Button>} /><section className="tn-model-hero"><div><small>ACTIVE MODEL</small><h2>{state?.models.find((item) => item.id === state.activeModelId)?.provider || '尚未配置'}</h2><p>负责需求理解、教学设计和内容生成</p></div><span><RobotOutlined /></span></section><div className="tn-model-list">{state?.models.map((model) => { const active = model.id === state.activeModelId; return <article key={model.id} className={active ? 'active' : ''}><span className="tn-model-logo">{model.logo}</span><div><div><strong>{model.provider}</strong>{active && <Tag color="blue">当前模型</Tag>}{model.status === '连接正常' && <Tag color="green">已连接</Tag>}</div><p>{model.remark || model.model}</p><small>{model.endpoint}</small></div><Space><Button onClick={() => void test(model.id)} icon={<ThunderboltOutlined />}>测试</Button><Button onClick={() => edit(model)}>编辑</Button>{!active && <Button type="primary" onClick={() => void activate(model.id)}>启用</Button>}</Space></article>; })}</div><Modal open={open} onCancel={() => setOpen(false)} onOk={() => form.submit()} title={editing ? '编辑模型' : '添加模型'} width={680} className="tn-modal"><Form form={form} layout="vertical" onFinish={save}><div className="tn-form-grid"><Form.Item name="provider" label="供应商名称" rules={[{ required: true }]}><Input placeholder="DeepSeek" /></Form.Item><Form.Item name="model" label="模型名称" rules={[{ required: true }]}><Input placeholder="deepseek-chat" /></Form.Item></div><Form.Item name="endpoint" label="API 地址"><Input placeholder="https://api.example.com/v1" /></Form.Item><Form.Item name="apiKey" label="API Key"><Input.Password placeholder="仅保存在本地工程配置中" /></Form.Item><div className="tn-form-grid"><Form.Item name="remark" label="用途备注"><Input placeholder="课程生成主模型" /></Form.Item><Form.Item name="logo" label="图标缩写"><Input maxLength={2} placeholder="DS" /></Form.Item></div><Form.Item name="website" label="官方网站"><Input placeholder="https://example.com" /></Form.Item><Form.Item name="configJson" label="高级配置"><Input.TextArea rows={5} /></Form.Item></Form></Modal></div>;
}

export default App;
