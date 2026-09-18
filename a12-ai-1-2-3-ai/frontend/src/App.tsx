import {
  ApiOutlined,
  ArrowRightOutlined,
  AudioOutlined,
  BookOutlined,
  CheckOutlined,
  CheckCircleOutlined,
  ClusterOutlined,
  CloudUploadOutlined,
  CodeOutlined,
  ControlOutlined,
  CopyOutlined,
  DatabaseOutlined,
  DashboardOutlined,
  DeleteOutlined,
  DeploymentUnitOutlined,
  EditOutlined,
  ExperimentOutlined,
  FileDoneOutlined,
  FileExcelOutlined,
  FileImageOutlined,
  FilePdfOutlined,
  FilePptOutlined,
  FileTextOutlined,
  FileWordOutlined,
  FolderOpenOutlined,
  FormOutlined,
  HomeOutlined,
  LoadingOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  MessageOutlined,
  PaperClipOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  SafetyCertificateOutlined,
  RobotOutlined,
  SearchOutlined,
  SendOutlined,
  SettingOutlined,
  ThunderboltOutlined,
  ToolOutlined,
  UploadOutlined,
  UserOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Divider,
  Flex,
  Form,
  Input,
  Layout,
  List,
  Menu,
  Modal,
  Progress,
  Row,
  Segmented,
  Select,
  Slider,
  Space,
  Statistic,
  Steps,
  Switch,
  Table,
  Tag,
  Timeline,
  Tooltip,
  Typography,
  Upload,
  message,
} from 'antd';
import type { MenuProps, UploadProps } from 'antd';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  API_BASE,
  api,
  pollJob,
  type GeneratedAsset,
  type Job,
  type ModelConfig,
  type ModelConfigState,
  type RequirementResponse,
  type Task,
} from './api';
import type { LocalMessage, ReferenceFile, StageKey } from './types';
import GlareHover from './reactbits/GlareHover';
import SpotlightCard from './reactbits/SpotlightCard';
import StarBorder from './reactbits/StarBorder';

const { Content, Sider } = Layout;
const { Text, Title, Paragraph } = Typography;

const stageLabels: Record<StageKey, string> = {
  requirement: '新建任务',
  clarification: '主动追问',
  teaching_design: '意图结构化',
  outline: 'RAG 融合',
  style: '大纲规划',
  generating: '异步生成',
  editor: '反馈迭代',
};

const navLabels: Record<string, string> = {
  home: '首页',
  lesson: '意图与教案',
  workspace: 'Agent 共创台',
  course: '产物中心',
  templates: 'PPT 模板',
  editor: '反馈编辑',
  materials: 'RAG 知识库',
  history: '历史作品',
  model: '模型设置',
};

const stageItems = [
  { key: 'requirement', title: '建任务' },
  { key: 'clarification', title: '追问' },
  { key: 'teaching_design', title: '抽取' },
  { key: 'outline', title: '检索' },
  { key: 'style', title: '大纲' },
  { key: 'generating', title: '生成' },
  { key: 'editor', title: '迭代' },
];

const agentFieldLabels: Record<string, string> = {
  topic: '准确题目',
  subject: '学科/课程',
  grade: '年级/学段',
  audience: '学生基础',
  duration: '课程时长',
  scene: '教学场景',
  confirmation: '需求确认',
  theme: '视觉主题',
  layout: '版式偏好',
  imageStyle: '图片风格',
  style_confirmation: '风格确认',
};

const materialPurposes = [
  { value: 'content', label: '内容依据' },
  { value: 'style', label: '风格参考' },
  { value: 'case', label: '案例素材' },
  { value: 'activity', label: '互动设计' },
] as const;

function materialPurposeLabel(value?: string) {
  return materialPurposes.find((item) => item.value === value)?.label ?? '内容依据';
}

function fileIcon(type: string, name: string) {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'].includes(ext) || type.startsWith('image/'))
    return <FileImageOutlined />;
  if (['mp4', 'avi', 'mov', 'mkv', 'wmv', 'webm'].includes(ext) || type.startsWith('video/'))
    return <VideoCameraOutlined />;
  if (['mp3', 'wav', 'ogg', 'flac', 'm4a'].includes(ext) || type.startsWith('audio/'))
    return <AudioOutlined />;
  if (ext === 'pdf') return <FilePdfOutlined />;
  if (['doc', 'docx'].includes(ext)) return <FileWordOutlined />;
  if (['ppt', 'pptx'].includes(ext)) return <FilePptOutlined />;
  if (['xls', 'xlsx'].includes(ext)) return <FileExcelOutlined />;
  return <FileTextOutlined />;
}

function formatFileSize(bytes?: number) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const designSystems = [
  { name: '锐捷教育云课堂', tone: '清晰、可信、轻量协作', tokens: '蓝 / 青 / 草绿', status: '推荐' },
  { name: '高校课程建设', tone: '严谨、密集、适合教研评审', tokens: '靛蓝 / 墨灰 / 金', status: '可用' },
  { name: '项目式教学', tone: '任务驱动、活泼但克制', tokens: '海蓝 / 珊瑚 / 石墨', status: '可用' },
];

const modelPresets: Record<string, Pick<ModelConfig, 'provider' | 'website' | 'endpoint' | 'model' | 'logo' | 'remark'>> = {
  deepseek: {
    provider: 'DeepSeek',
    website: 'https://platform.deepseek.com',
    endpoint: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    logo: 'DS',
    remark: '课堂生成主模型',
  },
  qwen: {
    provider: 'Qwen',
    website: 'https://dashscope.aliyuncs.com',
    endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-plus',
    logo: 'QW',
    remark: '通义千问备用模型',
  },
  mimo: {
    provider: 'Xiaomi MiMo',
    website: 'https://token-plan-cn.xiaomimimo.com/api',
    endpoint: 'https://token-plan-cn.xiaomimimo.com/api/v1',
    model: 'mimo-chat',
    logo: 'Mi',
    remark: '小米 MiMo 模型配置',
  },
  claude: {
    provider: 'Claude Official',
    website: 'https://www.anthropic.com/claude-code',
    endpoint: 'https://api.anthropic.com/v1',
    model: 'claude-sonnet-4-5',
    logo: 'AI',
    remark: '长文本教案生成',
  },
  custom: {
    provider: '自定义模型',
    website: 'https://example.com',
    endpoint: 'https://your-api-endpoint.com',
    model: 'custom-model',
    logo: 'P',
    remark: '手动配置',
  },
};

const createDeepSeekAdvancedConfig = (apiKey = '') => JSON.stringify(
  {
    env: {
      ANTHROPIC_AUTH_TOKEN: apiKey,
      ANTHROPIC_BASE_URL: 'https://api.deepseek.com/anthropic',
      ANTHROPIC_MODEL: 'deepseek-v4-pro',
    },
    theme: 'light',
    codemossProviderId: '58aec044-3fad-45c2-966a-20de796306e5',
    enabledPlugins: {
      'swift-lsp@claude-plugins-official': true,
    },
  },
  null,
  2,
);

const createModelConfig = (preset: keyof typeof modelPresets = 'deepseek'): ModelConfig => {
  const model = modelPresets[preset];
  return {
    id: `${preset}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    ...model,
    apiKey: '',
    status: '未检测',
    useStandaloneTest: false,
    useStandaloneBilling: false,
    configJson: preset === 'deepseek' ? createDeepSeekAdvancedConfig() : '{\n  "env": {},\n  "theme": "light"\n}',
  };
};

function formatTaskTime(value: string) {
  const date = new Date(value);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
}

function statusColor(status: string) {
  if (status === 'generating') return 'processing';
  if (status === 'complete') return 'success';
  return 'default';
}

function App() {
  const [activeNav, setActiveNav] = useState('home');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeTaskId, setActiveTaskId] = useState<number | null>(null);
  const [messagesByTask, setMessagesByTask] = useState<Record<number, LocalMessage[]>>({});
  const [filesByTask, setFilesByTask] = useState<Record<number, ReferenceFile[]>>({});
  const [requirementsByTask, setRequirementsByTask] = useState<Record<number, RequirementResponse>>({});
  const [assetsByTask, setAssetsByTask] = useState<Record<number, GeneratedAsset[]>>({});
  const [stageByTask, setStageByTask] = useState<Record<number, StageKey>>({});
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [backendReady, setBackendReady] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [knowledgeQuery, setKnowledgeQuery] = useState('TCP 三次握手');
  const [knowledgeResult, setKnowledgeResult] = useState('等待检索');
  const [knowledgeMode, setKnowledgeMode] = useState<'hybrid' | 'vector'>('vector');
  const [vectorizing, setVectorizing] = useState(false);
  const [jobByTask, setJobByTask] = useState<Record<number, Job | undefined>>({});
  const [uploadIntent, setUploadIntent] = useState<{ purpose: ReferenceFile['purpose']; focus: string }>({ purpose: 'content', focus: '' });
  const [form] = Form.useForm();
  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);

  const activeTask = useMemo(() => tasks.find((task) => task.id === activeTaskId) ?? tasks[0], [activeTaskId, tasks]);
  const activeMessages = activeTask ? messagesByTask[activeTask.id] ?? [] : [];
  const activeFiles = activeTask ? filesByTask[activeTask.id] ?? [] : [];
  const activeRequirement = activeTask ? requirementsByTask[activeTask.id] : undefined;
  const activeAssets = activeTask ? assetsByTask[activeTask.id] ?? [] : [];
  const activeJob = activeTask ? jobByTask[activeTask.id] : undefined;
  const activeStage = activeTask ? stageByTask[activeTask.id] ?? 'requirement' : 'requirement';

  useEffect(() => {
    document.documentElement.scrollLeft = 0;
    document.body.scrollLeft = 0;
    window.scrollTo({ left: 0, top: 0, behavior: 'auto' });
  }, [activeNav]);

  useEffect(() => {
    api
      .health()
      .then(() => setBackendReady(true))
      .catch(() => setBackendReady(false));
    api
      .listTasks()
      .then((items) => {
        setTasks(items);
        if (items[0]) setActiveTaskId(items[0].id);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!activeTaskId) return;
    let cancelled = false;
    Promise.all([
      api.listMessages(activeTaskId),
      api.listFiles(activeTaskId),
      api.getRequirements(activeTaskId),
      api.listAssets(activeTaskId),
      api.listJobs(activeTaskId),
    ]).then(([history, files, requirement, assets, jobs]) => {
      if (cancelled) return;
      setMessagesByTask((current) => ({
        ...current,
        [activeTaskId]: history.messages.map((item) => ({
          id: `${item.role[0]}-${item.id}`,
          role: item.role,
          content: item.content,
          createdAt: item.created_at,
        })),
      }));
      setFilesByTask((current) => ({
        ...current,
        [activeTaskId]: files.map((file) => ({
          id: String(file.id),
          name: file.file_name,
          type: file.file_type,
          status: ['completed', 'ready'].includes(file.parse_status) ? 'ready' : file.parse_status === 'failed' ? 'error' : 'parsing',
          parsedContent: file.parsed_content ?? undefined,
          purpose: file.purpose,
          focus: file.focus ?? undefined,
        })),
      }));
      setRequirementsByTask((current) => ({ ...current, [activeTaskId]: requirement }));
      setAssetsByTask((current) => ({ ...current, [activeTaskId]: assets }));
      setJobByTask((current) => ({ ...current, [activeTaskId]: jobs[0] }));
      setStageByTask((current) => ({ ...current, [activeTaskId]: requirement.stage }));
    }).catch((error) => {
      if (!cancelled) message.error(error instanceof Error ? error.message : '任务上下文加载失败');
    });
    return () => { cancelled = true; };
  }, [activeTaskId]);

  // Initialize speech recognition
  const finalTranscriptRef = useRef('');
  const baseTextRef = useRef('');

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'zh-CN';
      recognition.maxAlternatives = 1;

      recognition.onresult = (event: any) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const t = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscriptRef.current += t;
          } else {
            interim += t;
          }
        }
        const base = baseTextRef.current;
        const speech = finalTranscriptRef.current;
        const parts = [base, speech].filter(Boolean).join('');
        if (interim) {
          setInput(parts + ' ' + interim + ' [识别中...]');
        } else {
          setInput(parts);
        }
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          message.error('麦克风权限被拒绝，请在浏览器设置中允许麦克风访问');
        } else if (event.error !== 'no-speech') {
          message.error(`语音识别错误: ${event.error}`);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
        finalTranscriptRef.current = '';
      };

      setRecognition(recognition);
    }
  }, []);

  const toggleListening = () => {
    if (!recognition) {
      message.warning('您的浏览器不支持语音识别功能，请使用Chrome或Edge浏览器');
      return;
    }

    if (isListening) {
      recognition.stop();
      setIsListening(false);
    } else {
      finalTranscriptRef.current = '';
      baseTextRef.current = input.trimEnd();
      recognition.start();
      setIsListening(true);
    }
  };

  const navItems: MenuProps['items'] = [
    { key: 'home', icon: <HomeOutlined />, label: '首页' },
    { key: 'lesson', icon: <RobotOutlined />, label: 'AI 生成教案' },
    { key: 'workspace', icon: <MessageOutlined />, label: 'AI 生成课件' },
    { key: 'course', icon: <FileWordOutlined />, label: '文档生成' },
    { key: 'templates', icon: <DashboardOutlined />, label: 'PPT 模板' },
    { key: 'editor', icon: <EditOutlined />, label: 'PPT 编辑' },
    { key: 'materials', icon: <DatabaseOutlined />, label: '知识库' },
    { key: 'history', icon: <FolderOpenOutlined />, label: '历史作品' },
    { key: 'model', icon: <DeploymentUnitOutlined />, label: '模型设置' },
  ];

  const createTask = async (values: { title: string; subject?: string; audience?: string; duration_minutes?: number }) => {
    try {
      const task = await api.createTask(values);
      setTasks((current) => [task, ...current]);
      setActiveTaskId(task.id);
      setCreateOpen(false);
      form.resetFields();
      message.success('任务已创建');
    } catch (error) {
      message.error(error instanceof Error ? error.message : '任务创建失败');
    }
  };

  const sendMessage = async (messageText?: string, taskOverride?: Task) => {
    const text = (messageText ?? input).trim();
    if (!text) return;

    let task = taskOverride ?? activeTask;
    if (!task) {
      task = await api.createTask({ title: text.slice(0, 24), subject: '未分组课程' });
      setTasks((current) => [task!, ...current]);
      setActiveTaskId(task.id);
    }

    const userMessage: LocalMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    };
    setMessagesByTask((current) => ({
      ...current,
      [task.id]: [...(current[task.id] ?? []), userMessage],
    }));
    setInput('');
    setLoading(true);

    try {
      const response = await api.sendMessage(task.id, text);
      setMessagesByTask((current) => ({
        ...current,
        [task.id]: [
          ...(current[task.id] ?? []),
          {
            id: `a-${response.message.id}`,
            role: 'assistant',
            content: response.message.content,
            createdAt: response.message.created_at,
            thinking: response.thinking,
          },
        ],
      }));
      setRequirementsByTask((current) => ({
        ...current,
        [task.id]: {
          task_id: task.id,
          state: response.requirement,
          session: response.session,
          stage: response.stage,
          next_question: response.next_question,
          completeness: response.completeness,
          missing_fields: response.missing_fields,
        },
      }));
      setStageByTask((current) => ({ ...current, [task.id]: response.stage }));
      if (response.generated_asset_id) {
        const assets = await api.listAssets(task.id);
        setAssetsByTask((current) => ({ ...current, [task.id]: assets }));
      }
    } catch (error) {
      setMessagesByTask((current) => ({
        ...current,
        [task.id]: [
          ...(current[task.id] ?? []),
          {
            id: `e-${Date.now()}`,
            role: 'assistant',
            status: 'error',
            content: error instanceof Error ? error.message : '对话失败，请检查后端服务。',
            createdAt: new Date().toISOString(),
          },
        ],
      }));
    } finally {
      setLoading(false);
    }
  };

  const startFromHome = async (text: string) => {
    const title = text.trim().slice(0, 24) || '新教学任务';
    try {
      const task = await api.createTask({ title });
      setTasks((current) => [task, ...current]);
      setActiveTaskId(task.id);
      setActiveNav('workspace');
      await sendMessage(text, task);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '新教学任务创建失败');
    }
  };

  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

  const uploadProps: UploadProps = {
    multiple: true,
    showUploadList: false,
    beforeUpload: async (file) => {
      if (!activeTask) {
        message.warning('请先创建或选择一个教学任务');
        return Upload.LIST_IGNORE;
      }
      if (file.size > MAX_FILE_SIZE) {
        message.warning(`文件 ${file.name} 超过 50MB 限制`);
        return Upload.LIST_IGNORE;
      }
      const localFile: ReferenceFile = {
        id: `${file.uid}`,
        name: file.name,
        type: file.type || '未知类型',
        status: 'uploading',
        size: file.size,
        purpose: uploadIntent.purpose,
        focus: uploadIntent.focus.trim(),
      };
      setFilesByTask((current) => ({
        ...current,
        [activeTask.id]: [localFile, ...(current[activeTask.id] ?? [])],
      }));
      try {
        const uploaded = await api.uploadFile(activeTask.id, file, uploadIntent);
        setFilesByTask((current) => ({
          ...current,
          [activeTask.id]: (current[activeTask.id] ?? []).map((item) =>
            item.id === localFile.id ? { ...item, id: String(uploaded.id), status: 'parsing', purpose: uploaded.purpose, focus: uploaded.focus ?? undefined } : item,
          ),
        }));
        const parsed = await api.parseFile(uploaded.id);
        setFilesByTask((current) => ({
          ...current,
          [activeTask.id]: (current[activeTask.id] ?? []).map((item) =>
            item.id === String(uploaded.id) ? { ...item, status: ['completed', 'ready'].includes(parsed.parse_status) ? 'ready' : 'error', parsedContent: parsed.parsed_content ?? undefined } : item,
          ),
        }));
        if (!['completed', 'ready'].includes(parsed.parse_status)) throw new Error(parsed.parsed_content || '资料解析失败');
        message.success(`${file.name} 已完成解析`);
      } catch (error) {
        setFilesByTask((current) => ({
          ...current,
          [activeTask.id]: (current[activeTask.id] ?? []).map((item) =>
            item.id === localFile.id ? { ...item, status: 'error' } : item,
          ),
        }));
        message.error(error instanceof Error ? error.message : '上传失败');
      }
      return Upload.LIST_IGNORE;
    },
  };

  const searchKnowledge = async () => {
    try {
      const result = knowledgeMode === 'vector'
        ? await api.vectorSearchKnowledge(knowledgeQuery)
        : await api.searchKnowledge(knowledgeQuery, activeTask?.id);
      const embedding = result.embedding ? `\n\n向量配置：${result.embedding.provider} · ${result.embedding.model} · ${result.embedding.dimension}维` : '';
      const excerpts = result.results.slice(0, 3).map((item) => {
        const score = typeof item.score === 'number' ? ` · score ${item.score}` : '';
        const section = item.section ? ` · ${item.section}` : '';
        return `【${item.source}${section}${score}】${item.content.slice(0, 140)}`;
      }).join('\n\n');
      setKnowledgeResult(excerpts ? `${result.message}${embedding}\n\n${excerpts}` : `${result.message}${embedding}`);
    } catch (error) {
      setKnowledgeResult(error instanceof Error ? error.message : '知识库检索失败');
    }
  };

  const vectorizeKnowledge = async (fileId?: string) => {
    setVectorizing(true);
    try {
      const result = fileId && /^\d+$/.test(fileId)
        ? await api.vectorizeFile(Number(fileId))
        : await api.vectorizeAll();
      setKnowledgeResult(`${result.message}\n\n向量库：${result.embedding.collection}\n模型：${result.embedding.provider} · ${result.embedding.model}\n当前向量总数：${result.total_vectors}`);
      message.success('知识库向量化完成');
    } catch (error) {
      message.error(error instanceof Error ? error.message : '向量化失败');
    } finally {
      setVectorizing(false);
    }
  };

  const generateAssets = async () => {
    if (!activeTask) return;
    setLoading(true);
    try {
      const enqueued = await api.generateAssets(activeTask.id);
      setJobByTask((current) => ({
        ...current,
        [activeTask.id]: {
          id: enqueued.job_id,
          task_id: activeTask.id,
          job_type: enqueued.job_type,
          status: 'pending',
          progress: '已加入生成队列',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      }));
      const job = await pollJob(enqueued.job_id, 1500, (nextJob) => {
        setJobByTask((current) => ({ ...current, [activeTask.id]: nextJob }));
      });
      const assets = await api.listAssets(activeTask.id);
      setAssetsByTask((current) => ({ ...current, [activeTask.id]: assets }));
      const requirement = await api.getRequirements(activeTask.id);
      setRequirementsByTask((current) => ({ ...current, [activeTask.id]: requirement }));
      setStageByTask((current) => ({ ...current, [activeTask.id]: requirement.stage }));
      setTasks((current) => current.map((item) => item.id === activeTask.id ? { ...item, status: 'complete' } : item));
      const msg = typeof job.result?.message === 'string' ? job.result.message : '教学产物生成成功';
      message.success(msg);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '教学产物生成失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout className={`app-shell nova-app-shell ${activeNav === 'model' ? 'model-config-shell' : 'teachnova-shell'}`}>
      <Sider width={188} className="app-sider nova-sider">
        <Menu className="app-menu" theme="light" mode="inline" selectedKeys={[activeNav]} items={navItems} onClick={(item) => setActiveNav(item.key)} />
        <div className="sider-status">
          <strong>让每一堂课</strong>
          <Text>都有 AI 的力量</Text>
          <Badge status={backendReady ? 'success' : 'error'} text={backendReady ? '服务在线' : '服务离线'} />
        </div>
      </Sider>

      <Layout>
        <Content className="app-content">
          <header className="nova-topbar">
            <span>{navLabels[activeNav] ?? stageLabels[activeStage]}</span>
            <div className="nova-topbar-actions">
              <div className="nova-user"><span className="nova-avatar">师</span>教师用户 <Badge status={backendReady ? 'success' : 'error'} /></div>
              <div className="nova-header-brand"><span>✦</span><strong>TeachNova</strong></div>
            </div>
          </header>
          {activeNav === 'home' && (
            <HomeHero
              backendReady={backendReady}
              loading={loading}
              onNavigate={setActiveNav}
              onSubmit={(text) => void startFromHome(text)}
            />
          )}
          {activeNav === 'workspace' && (
            <WorkspaceView
              activeTask={activeTask}
              tasks={tasks}
              messages={activeMessages}
              input={input}
              loading={loading}
              stage={activeStage}
              files={activeFiles}
              requirement={activeRequirement}
              assets={activeAssets}
              activeJob={activeJob}
              setInput={setInput}
              setActiveTaskId={setActiveTaskId}
              sendMessage={(text) => void sendMessage(text)}
              uploadProps={uploadProps}
              generateAssets={generateAssets}
              onNewTask={() => setCreateOpen(true)}
              toggleListening={toggleListening}
              isListening={isListening}
            />
          )}
          {activeNav === 'materials' && (
            <MaterialsView
              files={activeFiles}
              uploadProps={uploadProps}
              activeTask={activeTask}
              setFilesByTask={setFilesByTask}
              knowledgeQuery={knowledgeQuery}
              setKnowledgeQuery={setKnowledgeQuery}
              knowledgeResult={knowledgeResult}
              searchKnowledge={searchKnowledge}
              vectorizeKnowledge={vectorizeKnowledge}
              knowledgeMode={knowledgeMode}
              setKnowledgeMode={setKnowledgeMode}
              vectorizing={vectorizing}
              uploadIntent={uploadIntent}
              setUploadIntent={setUploadIntent}
            />
          )}
          {activeNav === 'model' && <ModelConfigView />}
          {activeNav === 'course' && (
            <CourseAssetsView
              mode="documents"
              stage={activeStage}
              assets={activeAssets}
              activeJob={activeJob}
              loading={loading}
              generateAssets={generateAssets}
              onNavigate={setActiveNav}
            />
          )}
          {activeNav === 'history' && (
            <HistoryView
              tasks={tasks}
              activeTaskId={activeTask?.id}
              setActiveTaskId={setActiveTaskId}
              onNavigate={setActiveNav}
            />
          )}
          {activeNav === 'lesson' && (
            <LessonPlanView
              activeTask={activeTask}
              requirement={activeRequirement}
              onNavigate={setActiveNav}
              onNewTask={() => setCreateOpen(true)}
            />
          )}
          {activeNav === 'templates' && <TemplateGalleryView onNavigate={setActiveNav} />}
          {activeNav === 'editor' && (
            <WorkspaceView
              activeTask={activeTask}
              tasks={tasks}
              messages={activeMessages}
              input={input}
              loading={loading}
              stage={activeStage}
              files={activeFiles}
              requirement={activeRequirement}
              assets={activeAssets}
              activeJob={activeJob}
              setInput={setInput}
              setActiveTaskId={setActiveTaskId}
              sendMessage={(text) => void sendMessage(text)}
              uploadProps={uploadProps}
              generateAssets={generateAssets}
              onNewTask={() => setCreateOpen(true)}
              toggleListening={toggleListening}
              isListening={isListening}
              forceEditor
            />
          )}
        </Content>
      </Layout>

      <Modal title="创建教学任务" open={createOpen} onCancel={() => setCreateOpen(false)} footer={null} destroyOnHidden>
        <Form layout="vertical" form={form} onFinish={createTask}>
          <Form.Item name="title" label="课程主题" rules={[{ required: true, message: '请输入课程主题' }]}>
            <Input placeholder="例如：TCP 三次握手原理" />
          </Form.Item>
          <Form.Item name="subject" label="所属课程">
            <Input placeholder="例如：计算机网络" />
          </Form.Item>
          <Form.Item name="audience" label="授课对象">
            <Input placeholder="例如：高职一年级学生" />
          </Form.Item>
          <Form.Item name="duration_minutes" label="课时长度">
            <Input type="number" suffix="分钟" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block>
            创建并开始备课
          </Button>
        </Form>
      </Modal>
    </Layout>
  );
}

function AgentCapabilityStrip(props: { job?: Job; files: ReferenceFile[]; assets: GeneratedAsset[] }) {
  const readyFiles = props.files.filter((file) => file.status === 'ready').length;
  const jobStatus = props.job?.status;
  const jobText = jobStatus === 'running'
    ? props.job?.progress || '正在生成'
    : jobStatus === 'succeeded'
      ? '生成完成'
      : jobStatus === 'failed'
        ? '生成失败'
        : '等待任务';
  const nodes = [
    ['意图抽取', '课程主题、对象、课时自动沉淀', <RobotOutlined />],
    ['RAG 检索', `已解析 ${readyFiles} 份资料，支持 Chroma/BGE`, <DatabaseOutlined />],
    ['结构化大纲', '生成 lesson_plan JSON，再驱动 Word/PPT', <ClusterOutlined />],
    ['异步生成', jobText, jobStatus === 'running' ? <LoadingOutlined /> : <ThunderboltOutlined />],
    ['反馈迭代', props.assets.length ? `${props.assets.length} 个产物可继续修改` : '生成后可再生新版', <EditOutlined />],
  ];
  return (
    <div className="nova-capability-strip">
      {nodes.map(([title, text, icon], index) => (
        <div key={String(title)} className={jobStatus === 'running' && index === 3 ? 'is-active' : ''}>
          <span>{icon}</span>
          <strong>{title}</strong>
          <small>{text}</small>
        </div>
      ))}
    </div>
  );
}

function WorkspaceView(props: {
  activeTask?: Task;
  tasks: Task[];
  messages: LocalMessage[];
  input: string;
  loading: boolean;
  stage: StageKey;
  files: ReferenceFile[];
  requirement?: RequirementResponse;
  assets: GeneratedAsset[];
  activeJob?: Job;
  setInput: (value: string) => void;
  setActiveTaskId: (id: number) => void;
  sendMessage: (text?: string) => void;
  uploadProps: UploadProps;
  generateAssets: () => void;
  onNewTask: () => void;
  toggleListening: () => void;
  isListening: boolean;
  forceEditor?: boolean;
}) {
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const currentStep = stageItems.findIndex((item) => item.key === props.stage);
  const attachmentNames = props.files.map((file) => file.name);
  const session = props.requirement?.session;
  const requirement = props.requirement?.state;
  const pptVersions = props.assets.filter((asset) => asset.asset_type === 'pptx').sort((left, right) => right.version - left.version);
  const latestPpt = pptVersions[0];

  const workflow = (
    <div className="nova-workflow">
      {stageItems.map((item, index) => (
        <div key={item.key} className={`${index === currentStep ? 'is-current' : ''} ${index < currentStep ? 'is-done' : ''}`}>
          <span>{index < currentStep ? <CheckOutlined /> : index + 1}</span>
          <em>{item.title}</em>
        </div>
      ))}
    </div>
  );
  const pipeline = <AgentCapabilityStrip job={props.activeJob} files={props.files} assets={props.assets} />;

  const composer = (
    <div className="nova-composer">
      <Upload {...props.uploadProps}>
        <button type="button" aria-label="添加资料"><PaperClipOutlined /></button>
      </Upload>
      <textarea
        rows={1}
        value={props.input}
        onChange={(event) => props.setInput(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            props.sendMessage();
          }
        }}
        placeholder="请输入你的回答或修改要求..."
        disabled={props.loading}
      />
      <button type="button" onClick={props.toggleListening} className={props.isListening ? 'is-listening' : ''}><AudioOutlined /></button>
      <button type="button" className="nova-send" onClick={() => props.sendMessage()} disabled={props.loading || !props.input.trim()}>
        {props.loading ? <LoadingOutlined /> : <ArrowRightOutlined />}
      </button>
    </div>
  );

  const chatMessages = (
    <div className="nova-chat-messages">
      {props.messages.length === 0 ? (
        <div className="nova-welcome-bubble">告诉我想制作的课程题目，我会逐项帮你完善需求。</div>
      ) : props.messages.slice(-10).map((item) => (
        <article key={item.id} className={item.role}>
          <span>{item.role === 'assistant' ? <RobotOutlined /> : <UserOutlined />}</span>
          <div>
            <p>{item.content}</p>
            {item.role === 'assistant' && item.thinking?.length ? (
              <details className="nova-tool-trace">
                <summary>查看本轮工作流</summary>
                {item.thinking.map((step) => <small key={step}>{step}</small>)}
              </details>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );

  if (props.stage === 'editor' || props.forceEditor) {
    const slides = session?.ppt.slides.length ? session.ppt.slides : session?.outline ?? [];
    const shownSlides = slides.length ? slides : [{ order: 1, title: requirement?.topic || '封面', purpose: '' }];
    const activeSlide = shownSlides[Math.min(activeSlideIndex, shownSlides.length - 1)];
    return (
      <main className="nova-page nova-editor-page">
        {workflow}
        {pipeline}
        <div className="nova-editor-grid">
          <section className="nova-panel nova-editor-assistant">
            <header><RobotOutlined /><strong>AI 助手</strong></header>
            <ul className="nova-check-list">
              <li><CheckCircleOutlined />需求分析</li>
              <li><CheckCircleOutlined />知识库检索</li>
              <li><CheckCircleOutlined />教学设计</li>
              <li className="active"><LoadingOutlined />PPT 已生成</li>
            </ul>
            {chatMessages}
            <div className="nova-quick-revisions">
              {['简化 PPT 第 3 页', '给 PPT 增加一页案例分析', '调整 PPT 顺序，把练习放到总结前', '把 PPT 标题改为更有吸引力的课程标题'].map((instruction) => (
                <button type="button" key={instruction} onClick={() => props.sendMessage(instruction)}>{instruction}</button>
              ))}
            </div>
            {composer}
          </section>
          <section className="nova-panel nova-slide-stage">
            <header><span>‹</span><strong>{activeSlideIndex + 1} / {shownSlides.length}</strong><span>{latestPpt ? `版本 v${latestPpt.version}` : '预览'}</span></header>
            <div className="nova-slide-canvas">
              <small>{requirement?.subject || '智慧课堂'}</small>
              <h2>{activeSlide?.title || requirement?.topic || props.activeTask?.title || '课程主题'}</h2>
              <p>{activeSlide?.purpose || `${requirement?.grade || '面向学习者'} · ${requirement?.scene || '课堂教学'}`}</p>
              <div className="nova-horizon" />
            </div>
            <div className="nova-thumbnails">
              {shownSlides.slice(0, 8).map((slide, index) => (
                <button type="button" key={`${slide.order}-${slide.title}`} className={index === activeSlideIndex ? 'active' : ''} onClick={() => setActiveSlideIndex(index)}>
                  <span>{slide.title}</span><small>{index + 1}</small>
                </button>
              ))}
            </div>
          </section>
          <aside className="nova-panel nova-settings-panel">
            <header><strong>内容设置</strong></header>
            <label>主题<span>{session?.style.theme || '清新简约'}</span></label>
            <label>图片来源<span>AI 生成</span></label>
            <label>版式<span>{session?.style.layout || '图文均衡'}</span></label>
            <label>图片风格<span>{session?.style.imageStyle || '扁平插画'}</span></label>
            {pptVersions.length > 0 && <div className="nova-version-list"><small>修改历史</small>{pptVersions.slice(0, 5).map((asset) => <a key={asset.id} href={`${API_BASE}/assets/${asset.id}/download`} target="_blank" rel="noreferrer">v{asset.version}<span>{asset.file_name}</span></a>)}</div>}
            {latestPpt && (
              <Button type="primary" href={`${API_BASE}/assets/${latestPpt.id}/download`} target="_blank">导出 PPTX</Button>
            )}
          </aside>
        </div>
      </main>
    );
  }

  if (['outline', 'style', 'generating'].includes(props.stage)) {
    const themes = [
      { name: '清新简约', className: 'fresh' },
      { name: '科技未来', className: 'tech' },
      { name: '极简学术', className: 'academic' },
    ];
    return (
      <main className="nova-page nova-style-page">
        {workflow}
        {pipeline}
        <div className="nova-style-grid">
          <aside className="nova-panel nova-outline-panel">
            <header><FilePptOutlined /><strong>PPT 大纲 · {session?.outline.length || 0} 张</strong></header>
            {(session?.outline ?? []).map((slide) => (
              <button key={slide.order} type="button"><span>{String(slide.order).padStart(2, '0')}</span><em>{slide.title}</em></button>
            ))}
            {!session?.outline.length && <p>完成教学设计确认后自动生成大纲。</p>}
          </aside>
          <section className="nova-panel nova-style-settings">
            <header><div><strong>风格设置</strong><p>确定课件的视觉语言，选择后在对话框中发送即可。</p></div></header>
            <h3>主题风格</h3>
            <div className="nova-theme-cards">
              {themes.map((theme) => (
                <button key={theme.name} type="button" className={`${theme.className} ${session?.style.theme === theme.name ? 'active' : ''}`} onClick={() => props.sendMessage(theme.name)}>
                  <span /><strong>{theme.name}</strong>
                </button>
              ))}
            </div>
            <h3>配色方案</h3>
            <div className="nova-palette"><i /><i /><i /><i /><i /><i /></div>
            <h3>页面布局</h3>
            <div className="nova-layout-choices">
              {['简洁留白', '图文均衡', '信息丰富'].map((item) => <button key={item} onClick={() => props.sendMessage(item)}>{item}</button>)}
            </div>
            <h3>图片风格</h3>
            <div className="nova-image-choices">
              {['扁平插画', '真实摄影', '3D 科技'].map((item) => <button key={item} onClick={() => props.sendMessage(item)}>{item}</button>)}
            </div>
            <div className="nova-fusion-brief">
              <header><ClusterOutlined /><strong>生成指令包</strong><Tag color="green">已融合</Tag></header>
              <div><span>需求状态</span><strong>{Math.round((props.requirement?.completeness ?? 0) * 100)}%</strong></div>
              <div><span>参考资料</span><strong>{props.files.filter((file) => file.status === 'ready').length} 份</strong></div>
              <div><span>教学要点</span><strong>{(session?.teaching.keyPoints.length ?? 0) + (session?.teaching.objectives.length ?? 0)} 项</strong></div>
              <div><span>课件大纲</span><strong>{session?.outline.length ?? 0} 页</strong></div>
            </div>
            <div className="nova-style-action">
              {composer}
              <Button type="primary" size="large" disabled={props.stage !== 'generating'} onClick={props.generateAssets} loading={props.loading}>生成课件</Button>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="nova-page nova-requirement-page">
      {workflow}
      {pipeline}
      <div className="nova-requirement-grid">
        <section className="nova-panel nova-assistant-card">
          <header>
            <div><span><RobotOutlined /></span><strong>AI 助手</strong></div>
            <Select
              size="small"
              value={props.activeTask?.id}
              placeholder="选择任务"
              onChange={props.setActiveTaskId}
              options={props.tasks.map((task) => ({ value: task.id, label: task.title }))}
            />
          </header>
          {chatMessages}
          {attachmentNames.length > 0 && <div className="nova-files">{attachmentNames.map((name) => <Tag key={name}>{name}</Tag>)}</div>}
          {composer}
        </section>
        <aside className="nova-panel nova-requirement-overview">
          <header><div><FileTextOutlined /><strong>需求概览</strong></div><Tag color="blue">已收集 {Math.round((props.requirement?.completeness ?? 0) * 100)}%</Tag></header>
          {([
            ['学科/课程', requirement?.subject],
            ['年级/学段', requirement?.grade],
            ['准确题目', requirement?.topic],
            ['学生基础', requirement?.audience],
            ['课程时长', requirement?.duration ? `${requirement.duration} 分钟` : null],
            ['教学场景', requirement?.scene],
          ] as Array<[string, string | number | null | undefined]>).map(([label, value]) => (
            <div className="nova-requirement-row" key={label}><span>{label}</span><strong>{value || '等待确认'}</strong>{value ? <CheckCircleOutlined /> : <span className="pending-dot" />}</div>
          ))}
          <div className="nova-content-needs">
            <h4>内容需求</h4>
            {session?.teaching.objectives.length ? session.teaching.objectives.slice(0, 4).map((item) => <p key={item}><CheckCircleOutlined />{item}</p>) : <p><span className="pending-dot" />完成需求确认后生成教学设计</p>}
          </div>
          <div className="nova-readiness-card">
            <h4>生成就绪检查</h4>
            <p className={(props.requirement?.completeness ?? 0) >= 1 ? 'done' : ''}><span>{(props.requirement?.completeness ?? 0) >= 1 ? <CheckOutlined /> : '1'}</span>需求字段完整</p>
            <p className={props.files.some((file) => file.status === 'ready') ? 'done' : ''}><span>{props.files.some((file) => file.status === 'ready') ? <CheckOutlined /> : '2'}</span>参考资料解析（可选）</p>
            <p className={(session?.teaching.objectives.length ?? 0) > 0 ? 'done' : ''}><span>{(session?.teaching.objectives.length ?? 0) > 0 ? <CheckOutlined /> : '3'}</span>教学设计已形成</p>
          </div>
          <Button block type="primary" onClick={() => props.sendMessage('确认')} disabled={!session || Boolean(props.requirement?.missing_fields.length)}>确认当前需求</Button>
          <Button block icon={<PlusOutlined />} onClick={props.onNewTask}>新建教学任务</Button>
        </aside>
      </div>
    </main>
  );
}

function NovaPageHeader(props: {
  icon: ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="nova-tool-hero">
      <div className="nova-tool-heading">
        <span className="nova-tool-icon">{props.icon}</span>
        <div><small>{props.eyebrow}</small><h1>{props.title}</h1><p>{props.description}</p></div>
      </div>
      {props.action && <div className="nova-tool-action">{props.action}</div>}
    </header>
  );
}

function MaterialsView(props: {
  files: ReferenceFile[];
  uploadProps: UploadProps;
  activeTask: Task | undefined;
  setFilesByTask: React.Dispatch<React.SetStateAction<Record<number, ReferenceFile[]>>>;
  knowledgeQuery: string;
  setKnowledgeQuery: (value: string) => void;
  knowledgeResult: string;
  searchKnowledge: () => void;
  vectorizeKnowledge: (fileId?: string) => void;
  knowledgeMode: 'hybrid' | 'vector';
  setKnowledgeMode: (value: 'hybrid' | 'vector') => void;
  vectorizing: boolean;
  uploadIntent: { purpose: ReferenceFile['purpose']; focus: string };
  setUploadIntent: React.Dispatch<React.SetStateAction<{ purpose: ReferenceFile['purpose']; focus: string }>>;
}) {
  const [previewFile, setPreviewFile] = useState<ReferenceFile>();
  const deleteFile = async (file: ReferenceFile) => {
    if (!props.activeTask) return;
    try {
      if (/^\d+$/.test(file.id)) await api.deleteFile(Number(file.id));
      props.setFilesByTask((current) => ({
        ...current,
        [props.activeTask!.id]: (current[props.activeTask!.id] ?? []).filter((item) => item.id !== file.id),
      }));
      message.success('资料已移除');
    } catch (error) {
      message.error(error instanceof Error ? error.message : '移除失败');
    }
  };

  const readyFormats = new Set(props.files.filter((file) => file.status === 'ready').map((file) => file.name.split('.').pop()?.toUpperCase()).filter(Boolean));
  return (
    <section className="nova-tool-page nova-library-page">
      <NovaPageHeader
        icon={<DatabaseOutlined />}
        eyebrow="RAG KNOWLEDGE BASE"
        title="教学知识库"
        description="上传 PDF、Word、PPT 后转 Markdown、切片并写入 Chroma，让 Agent 基于你的资料生成。"
        action={<Space><Button icon={<ClusterOutlined />} loading={props.vectorizing} onClick={() => props.vectorizeKnowledge()}>全部向量化</Button><Upload {...props.uploadProps}><Button type="primary" icon={<UploadOutlined />}>上传资料</Button></Upload></Space>}
      />
      <div className="nova-library-metrics">
        <div><strong>{props.files.length}</strong><span>资料总数</span></div>
        <div><strong>{props.files.filter((file) => file.status === 'ready').length}</strong><span>已完成解析</span></div>
        <div><strong>{props.activeTask ? '1' : '0'}</strong><span>关联教学任务</span></div>
        <div><strong>{readyFormats.size}</strong><span>已解析格式</span></div>
        <div><strong>{props.knowledgeMode === 'vector' ? 'BGE' : 'Hybrid'}</strong><span>{props.knowledgeMode === 'vector' ? 'Chroma 语义检索' : '关键词切片检索'}</span></div>
      </div>
      <div className="nova-library-grid">
        <section className="nova-panel nova-upload-panel">
          <header><div><CloudUploadOutlined /><strong>资料中心</strong></div><Tag color="blue">PDF / Word / PPT</Tag></header>
          <div className="nova-upload-intent">
            <div>
              <small>这份资料用于</small>
              <Segmented
                block
                value={props.uploadIntent.purpose}
                options={materialPurposes.map((item) => ({ value: item.value, label: item.label }))}
                onChange={(value) => props.setUploadIntent((current) => ({ ...current, purpose: value as ReferenceFile['purpose'] }))}
              />
            </div>
            <label>
              <small>重点关联到哪个知识点或设计要求</small>
              <Input
                value={props.uploadIntent.focus}
                onChange={(event) => props.setUploadIntent((current) => ({ ...current, focus: event.target.value }))}
                placeholder="例如：用于解释三次握手；参考第 3 章的图示风格"
                allowClear
              />
            </label>
          </div>
          <Upload.Dragger {...props.uploadProps} className="large-upload">
            <CloudUploadOutlined />
            <p>拖入教学资料，或点击选择文件</p>
            <Text>当前主链路接收 PDF、Word、PPT；解析后自动生成 Markdown 与知识切片</Text>
          </Upload.Dragger>
          <List
            className="file-list"
            dataSource={props.files}
            locale={{ emptyText: '暂无资料' }}
            renderItem={(file) => (
              <List.Item
                actions={[
                  <Tooltip title="查看解析内容" key="preview">
                    <Button type="text" size="small" icon={<FileTextOutlined />} disabled={!file.parsedContent} onClick={() => setPreviewFile(file)} />
                  </Tooltip>,
                  <Tooltip title="移除" key="remove">
                    <Button
                      type="text"
                      size="small"
                      icon={<DeleteOutlined />}
                      disabled={file.status === 'uploading' || file.status === 'parsing'}
                      onClick={() => void deleteFile(file)}
                    />
                  </Tooltip>,
                  <Tooltip title="写入 Chroma 向量库" key="vectorize">
                    <Button
                      type="text"
                      size="small"
                      icon={<ClusterOutlined />}
                      loading={props.vectorizing}
                      disabled={file.status !== 'ready'}
                      onClick={() => props.vectorizeKnowledge(file.id)}
                    />
                  </Tooltip>,
                ]}
              >
                <List.Item.Meta
                  avatar={fileIcon(file.type, file.name)}
                  title={<Space wrap><span>{file.name}</span><Tag color="geekblue">{materialPurposeLabel(file.purpose)}</Tag></Space>}
                  description={
                    <Space size={4} wrap>
                      <span>{file.type || '未识别类型'}</span>
                      {file.size ? <span>· {formatFileSize(file.size)}</span> : null}
                      {file.focus ? <span>· 关联：{file.focus}</span> : null}
                    </Space>
                  }
                />
                <Tag
                  color={
                    file.status === 'ready' ? 'green' :
                    file.status === 'error' ? 'red' :
                    'processing'
                  }
                >
                  {(file.status === 'uploading' || file.status === 'parsing') && <LoadingOutlined style={{ marginRight: 4 }} />}
                  {file.status === 'ready' ? '已解析' :
                   file.status === 'parsing' ? '解析中' :
                   file.status === 'uploading' ? '上传中' :
                   file.status === 'error' ? '失败' : file.status}
                </Tag>
              </List.Item>
            )}
          />
        </section>
        <section className="nova-panel nova-rag-panel">
          <header><div><SearchOutlined /><strong>知识检索</strong></div><Tag color="cyan">{props.knowledgeMode === 'vector' ? 'Chroma' : 'Chunk'}</Tag></header>
          <div className="nova-rag-intro">
            <span><ClusterOutlined /></span>
            <div><strong>资料已接入生成链路</strong><p>检索结果会自动成为教案和课件的事实依据，并保留来源。</p></div>
          </div>
          <div className="nova-rag-search">
            <Segmented
              value={props.knowledgeMode}
              options={[
                { value: 'vector', label: '语义向量' },
                { value: 'hybrid', label: '基础切片' },
              ]}
              onChange={(value) => props.setKnowledgeMode(value as 'hybrid' | 'vector')}
            />
            <Input
              prefix={<SearchOutlined />}
              value={props.knowledgeQuery}
              onChange={(event) => props.setKnowledgeQuery(event.target.value)}
              placeholder="输入知识点进行检索"
            />
            <Button type="primary" icon={<ArrowRightOutlined />} onClick={props.searchKnowledge}>检索</Button>
          </div>
          <div className="nova-rag-result"><small>检索结果</small><p>{props.knowledgeResult}</p></div>
          <div className="nova-rag-flow">
            {[['01', '智能解析', '提取正文、表格与图示'], ['02', '语义切片', '按章节保留上下文'], ['03', '精准召回', '匹配当前教学意图'], ['04', '生成融合', '约束教案与课件内容']].map(([num, title, text]) => (
              <div key={num}><span>{num}</span><strong>{title}</strong><small>{text}</small></div>
            ))}
          </div>
        </section>
      </div>
      <Modal
        title={previewFile ? `解析预览 · ${previewFile.name}` : '解析预览'}
        open={Boolean(previewFile)}
        onCancel={() => setPreviewFile(undefined)}
        footer={<Button onClick={() => setPreviewFile(undefined)}>关闭</Button>}
        width={760}
      >
        <div className="nova-parsed-preview">
          <div><Tag color="blue">{materialPurposeLabel(previewFile?.purpose)}</Tag>{previewFile?.focus && <span>重点关联：{previewFile.focus}</span>}</div>
          <pre>{previewFile?.parsedContent || '暂无可预览内容'}</pre>
        </div>
      </Modal>
    </section>
  );
}

function ModelConfigView() {
  const [models, setModels] = useState<ModelConfig[]>(() => [createModelConfig('deepseek'), createModelConfig('mimo')]);
  const [selectedModelId, setSelectedModelId] = useState<string>('deepseek');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingModelId, setEditingModelId] = useState<string | null>(null);
  const [draftModel, setDraftModel] = useState<ModelConfig>(() => createModelConfig('custom'));

  const selectedModel = models.find((model) => model.id === selectedModelId) ?? models[0];

  const readDraftConfig = () => {
    try {
      return JSON.parse(draftModel.configJson || '{}') as { env?: Record<string, string>; [key: string]: unknown };
    } catch {
      return { env: {} };
    }
  };

  const getConfigEnvValue = (key: string) => {
    const config = readDraftConfig();
    return config.env?.[key];
  };

  const setConfigEnvValue = (key: string, value: string | undefined) => {
    setDraftModel((current) => {
      let config: { env?: Record<string, string>; [key: string]: unknown };
      try {
        config = JSON.parse(current.configJson || '{}');
      } catch {
        config = {};
      }
      const env = { ...(config.env ?? {}) };
      if (value === undefined) {
        delete env[key];
      } else {
        env[key] = value;
      }
      config.env = env;
      return { ...current, configJson: JSON.stringify(config, null, 2) };
    });
  };

  const setConfigTheme = (theme: 'light' | 'dark') => {
    setDraftModel((current) => {
      let config: { env?: Record<string, string>; [key: string]: unknown };
      try {
        config = JSON.parse(current.configJson || '{}');
      } catch {
        config = { env: {} };
      }
      config.theme = theme;
      return { ...current, configJson: JSON.stringify(config, null, 2) };
    });
  };

  const formatConfigJson = () => {
    try {
      setDraftModel((current) => ({ ...current, configJson: JSON.stringify(JSON.parse(current.configJson), null, 2) }));
      message.success('配置 JSON 已格式化');
    } catch {
      message.error('配置 JSON 格式有误');
    }
  };

  const syncModelState = (state: ModelConfigState) => {
    setModels(state.models);
    setSelectedModelId(state.activeModelId || state.models[0]?.id || '');
  };

  useEffect(() => {
    api
      .listModelConfigs()
      .then(syncModelState)
      .catch((error) => {
        message.error(error instanceof Error ? error.message : '模型配置加载失败');
      });
  }, []);

  const openAddModel = () => {
    setEditingModelId(null);
    setDraftModel(createModelConfig('custom'));
    setEditorOpen(true);
  };

  const openEditModel = (model: ModelConfig) => {
    setEditingModelId(model.id);
    setDraftModel({ ...model });
    setEditorOpen(true);
  };

  const saveModel = async () => {
    const nextModel = {
      ...draftModel,
      provider: draftModel.provider.trim() || '自定义模型',
      website: draftModel.website.trim(),
      endpoint: draftModel.endpoint.trim(),
      model: draftModel.model.trim() || 'custom-model',
      logo: (draftModel.logo.trim() || draftModel.provider.slice(0, 2) || 'AI').slice(0, 2).toUpperCase(),
    };

    try {
      const state = await api.saveModelConfig(nextModel);
      syncModelState(state);
      message.success(editingModelId ? '模型配置已更新' : '模型配置已添加');
      setEditorOpen(false);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '模型配置保存失败');
    }
  };

  const duplicateModel = async (model: ModelConfig) => {
    const duplicated = {
      ...model,
      id: `copy-${Date.now()}`,
      provider: `${model.provider} 副本`,
      status: '未检测' as const,
    };
    try {
      const state = await api.saveModelConfig(duplicated);
      syncModelState(state);
      message.success('已复制一份模型配置');
    } catch (error) {
      message.error(error instanceof Error ? error.message : '模型配置复制失败');
    }
  };

  const activateModel = async (model: ModelConfig) => {
    try {
      const state = await api.activateModelConfig(model.id);
      syncModelState(state);
      message.success(`已启用 ${model.provider}`);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '模型启用失败');
    }
  };

  const checkModelConnection = async (model: ModelConfig) => {
    if (!models.some((item) => item.id === model.id)) {
      message.warning('请先保存模型配置，再进行连接检测');
      return;
    }
    try {
      const state = await api.testModelConfig(model.id);
      syncModelState(state);
      const tested = state.models.find((item) => item.id === model.id);
      if (tested?.status === '连接正常') {
        message.success(`${model.provider} 连接检测通过`);
      } else {
        message.error(`${model.provider} 连接检测失败`);
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : '连接检测失败');
    }
  };

  const deleteModel = async (model: ModelConfig) => {
    if (models.length <= 1) {
      message.warning('至少需要保留一个模型配置');
      return;
    }

    try {
      const state = await api.deleteModelConfig(model.id);
      syncModelState(state);
      message.success(`已删除 ${model.provider}`);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '模型配置删除失败');
    }
  };

  const applyPreset = (preset: keyof typeof modelPresets) => {
    const presetModel = modelPresets[preset];
    setDraftModel((current) => ({
      ...current,
      ...presetModel,
      logo: presetModel.logo,
      configJson: preset === 'deepseek' ? createDeepSeekAdvancedConfig(current.apiKey) : current.configJson,
    }));
  };

  return (
    <section className="model-config-page nova-tool-page">
      <NovaPageHeader
        icon={<DeploymentUnitOutlined />}
        eyebrow="MODEL HUB"
        title="模型设置"
        description="统一管理 TeachNova 的模型供应商、调用地址和连接状态。"
        action={
          <Tooltip title="新增模型配置">
            <Button
              aria-label="新增模型配置"
              className="model-add-button"
              type="primary"
              shape="circle"
              icon={<PlusOutlined />}
              onClick={openAddModel}
            />
          </Tooltip>
        }
      />

      <div className="nova-model-summary">
        <div><span>当前模型</span><strong>{selectedModel?.provider || '未配置'}</strong></div>
        <div><span>模型数量</span><strong>{models.length}</strong></div>
        <div><span>连接正常</span><strong>{models.filter((model) => model.status === '连接正常').length}</strong></div>
      </div>

      <div className="model-provider-list">
        {models.map((model) => {
          const isActive = model.id === selectedModel?.id;
          return (
            <article
              key={model.id}
              className={`model-provider-row ${isActive ? 'is-active' : ''}`}
              onClick={() => activateModel(model)}
            >
              <button className="model-drag-handle" type="button" aria-label="拖动排序">
                <span />
                <span />
                <span />
              </button>
              <div className="model-provider-logo">{model.logo}</div>
              <div className="model-provider-copy">
                <div>
                  <strong>{model.provider}</strong>
                  {model.provider.includes('Claude') && <Tag>不支持路由</Tag>}
                  {isActive && <Tag color="blue">当前模型</Tag>}
                  {model.status === '连接正常' && <Tag color="success">已连接</Tag>}
                </div>
                <a href={model.website} onClick={(event) => event.preventDefault()}>
                  {model.website}
                </a>
              </div>
              <div className="model-row-actions">
                <Button
                  type={isActive ? 'default' : 'primary'}
                  className={isActive ? 'model-active-button' : undefined}
                  icon={isActive ? <CheckOutlined /> : <PlayCircleOutlined />}
                  disabled={isActive}
                  onClick={(event) => {
                    event.stopPropagation();
                    void activateModel(model);
                  }}
                >
                  {isActive ? '使用中' : '启用'}
                </Button>
                <Tooltip title="编辑模型">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      openEditModel(model);
                    }}
                    aria-label="编辑模型"
                  >
                    <EditOutlined />
                  </button>
                </Tooltip>
                <Tooltip title="复制配置">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      duplicateModel(model);
                    }}
                    aria-label="复制模型配置"
                  >
                    <CopyOutlined />
                  </button>
                </Tooltip>
                <Tooltip title="检查连接">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      checkModelConnection(model);
                    }}
                    aria-label="检查模型连接"
                  >
                    <ExperimentOutlined />
                  </button>
                </Tooltip>
                <Tooltip title="删除模型">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      deleteModel(model);
                    }}
                    aria-label="删除模型配置"
                  >
                    <DeleteOutlined />
                  </button>
                </Tooltip>
              </div>
            </article>
          );
        })}
      </div>

      <Modal
        title={editingModelId ? '编辑模型配置' : '添加模型配置'}
        open={editorOpen}
        onCancel={() => setEditorOpen(false)}
        onOk={saveModel}
        okText={editingModelId ? '保存' : '添加'}
        cancelText="取消"
        width={780}
        className="model-editor-modal"
        destroyOnHidden
      >
        <div className="model-editor">
          <p className="model-editor-tip">自定义配置需手动填写所有必要字段。</p>
          <div className="model-editor-logo">{draftModel.logo || 'P'}</div>

          <div className="model-preset-row">
            <label>选择模型类型</label>
            <Select
              value={
                Object.keys(modelPresets).find((key) => modelPresets[key].provider === draftModel.provider) ?? 'custom'
              }
              onChange={(value) => applyPreset(value as keyof typeof modelPresets)}
              options={[
                { value: 'deepseek', label: 'DeepSeek' },
                { value: 'mimo', label: 'Xiaomi MiMo' },
                { value: 'qwen', label: 'Qwen' },
                { value: 'claude', label: 'Claude Official' },
                { value: 'custom', label: '自定义模型' },
              ]}
            />
          </div>

          <div className="model-editor-grid">
            <label>
              <span>供应商名称</span>
              <Input
                value={draftModel.provider}
                onChange={(event) => setDraftModel((current) => ({ ...current, provider: event.target.value }))}
                placeholder="例如：Claude 官方"
              />
            </label>
            <label>
              <span>备注</span>
              <Input
                value={draftModel.remark}
                onChange={(event) => setDraftModel((current) => ({ ...current, remark: event.target.value }))}
                placeholder="例如：公司专用账号"
              />
            </label>
          </div>

          <label className="model-editor-field">
            <span>官网链接</span>
            <Input
              value={draftModel.website}
              onChange={(event) => setDraftModel((current) => ({ ...current, website: event.target.value }))}
              placeholder="https://example.com（可选）"
            />
          </label>

          <label className="model-editor-field">
            <span>API Key</span>
            <Input.Password
              value={draftModel.apiKey}
              onChange={(event) => {
                const nextKey = event.target.value;
                setDraftModel((current) => ({ ...current, apiKey: nextKey }));
                setConfigEnvValue('ANTHROPIC_AUTH_TOKEN', nextKey);
              }}
              placeholder={draftModel.hasApiKey ? '已保存密钥（脱敏显示），留空保持不变' : '只需要填这里，下方配置会自动填充'}
            />
            {draftModel.hasApiKey && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                密钥已保存在服务端并做脱敏展示；留空保存不会清除原有密钥，填写新值才会更新。
              </Text>
            )}
          </label>

          <div className="model-editor-line">
            <span>请求地址</span>
            <Segmented size="small" options={['完整 URL', '兼容模式']} defaultValue="完整 URL" />
            <button type="button" onClick={() => checkModelConnection(draftModel)}>
              <ThunderboltOutlined />
              管理与测试
            </button>
          </div>

          <Input
            value={draftModel.endpoint}
            onChange={(event) => {
              const nextEndpoint = event.target.value;
              setDraftModel((current) => ({ ...current, endpoint: nextEndpoint }));
              setConfigEnvValue('ANTHROPIC_BASE_URL', nextEndpoint);
            }}
            placeholder="https://your-api-endpoint.com"
          />

          <div className="model-editor-grid">
            <label>
              <span>模型名称</span>
              <Input
                value={draftModel.model}
                onChange={(event) => {
                  const nextModel = event.target.value;
                  setDraftModel((current) => ({ ...current, model: nextModel }));
                  setConfigEnvValue('ANTHROPIC_MODEL', nextModel);
                }}
                placeholder="deepseek-chat"
              />
            </label>
            <label>
              <span>图标缩写</span>
              <Input
                value={draftModel.logo}
                maxLength={2}
                onChange={(event) => setDraftModel((current) => ({ ...current, logo: event.target.value.toUpperCase() }))}
                placeholder="DS"
              />
            </label>
          </div>

          <details className="model-advanced" open>
            <summary>高级选项</summary>
            <Text>包含 API 格式、认证字段、模型映射等配置。大多数场景下保持默认即可。</Text>
            <div className="model-editor-switches">
              <span>
                Teammates 模式
                <Switch
                  size="small"
                  checked={getConfigEnvValue('CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS') === '1'}
                  onChange={(checked) => setConfigEnvValue('CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS', checked ? '1' : undefined)}
                />
              </span>
              <span>
                启用 Tool Search
                <Switch
                  size="small"
                  checked={getConfigEnvValue('ENABLE_TOOL_SEARCH') === 'true'}
                  onChange={(checked) => setConfigEnvValue('ENABLE_TOOL_SEARCH', checked ? 'true' : undefined)}
                />
              </span>
              <span>
                最大强度思考
                <Switch
                  size="small"
                  checked={getConfigEnvValue('CLAUDE_CODE_EFFORT_LEVEL') === 'max'}
                  onChange={(checked) => setConfigEnvValue('CLAUDE_CODE_EFFORT_LEVEL', checked ? 'max' : undefined)}
                />
              </span>
              <span>
                禁用自动升级
                <Switch
                  size="small"
                  checked={getConfigEnvValue('DISABLE_AUTOUPDATER') === '1'}
                  onChange={(checked) => setConfigEnvValue('DISABLE_AUTOUPDATER', checked ? '1' : undefined)}
                />
              </span>
              <span>
                深色主题
                <Switch
                  size="small"
                  checked={readDraftConfig().theme === 'dark'}
                  onChange={(checked) => setConfigTheme(checked ? 'dark' : 'light')}
                />
              </span>
            </div>
            <Input.TextArea
              value={draftModel.configJson}
              onChange={(event) => setDraftModel((current) => ({ ...current, configJson: event.target.value }))}
              autoSize={{ minRows: 5, maxRows: 8 }}
              className="model-json-editor"
            />
            <button className="model-format-button" type="button" onClick={formatConfigJson}>
              <ToolOutlined />
              格式化
            </button>
          </details>

          <div className="model-nested-options">
            <div>
              <ExperimentOutlined />
              <strong>模型测试配置</strong>
              <span>使用单独配置</span>
              <Switch
                checked={draftModel.useStandaloneTest}
                onChange={(checked) => setDraftModel((current) => ({ ...current, useStandaloneTest: checked }))}
              />
            </div>
            <div>
              <DatabaseOutlined />
              <strong>计费配置</strong>
              <span>使用单独配置</span>
              <Switch
                checked={draftModel.useStandaloneBilling}
                onChange={(checked) => setDraftModel((current) => ({ ...current, useStandaloneBilling: checked }))}
              />
            </div>
          </div>
        </div>
      </Modal>
    </section>
  );
}

function CourseAssetsView(props: {
  mode: 'documents';
  stage: StageKey;
  assets: GeneratedAsset[];
  activeJob?: Job;
  loading: boolean;
  generateAssets: () => void;
  onNavigate: (key: string) => void;
}) {
  const latestAssets = props.assets.reduce<Record<string, GeneratedAsset>>((current, asset) => {
    if (!current[asset.asset_type] || current[asset.asset_type].version < asset.version) current[asset.asset_type] = asset;
    return current;
  }, {});
  const rows = Object.values(latestAssets).filter((asset) => ['docx', 'pdf', 'script', 'html'].includes(asset.asset_type));
  const labels: Record<string, string> = {
    pptx: 'PPT 课件', docx: 'Word 教案', json: '结构化大纲', pdf: 'PDF 教学资料', html: '互动小游戏', image: '课程封面图', script: '课堂讲解稿',
  };
  const icons: Record<string, ReactNode> = {
    docx: <FileWordOutlined />, pptx: <FilePptOutlined />, json: <ClusterOutlined />, pdf: <FilePdfOutlined />, script: <FileTextOutlined />, html: <CodeOutlined />,
  };
  const currentRows = Object.values(latestAssets).filter((asset) => ['docx', 'pptx', 'json'].includes(asset.asset_type));
  const visibleRows = currentRows.length ? currentRows : rows;
  return (
    <section className="nova-tool-page nova-documents-page">
      <NovaPageHeader
        icon={<FileWordOutlined />}
        eyebrow="GENERATION CENTER"
        title="课件产物生成"
        description="后端会先生成结构化大纲，再异步生成 Word 教案与 PPT 课件，并保存版本。"
        action={<Button type="primary" icon={<ThunderboltOutlined />} loading={props.loading} disabled={!['generating', 'editor'].includes(props.stage)} onClick={props.generateAssets}>{visibleRows.length ? '重新生成产物' : '生成 Word / PPT'}</Button>}
      />
      {props.activeJob && (
        <Alert
          className="nova-job-alert"
          type={props.activeJob.status === 'failed' ? 'error' : props.activeJob.status === 'succeeded' ? 'success' : 'info'}
          showIcon
          message={`生成任务：${props.activeJob.job_type} · ${props.activeJob.status}`}
          description={props.activeJob.error || props.activeJob.progress || '等待后端处理'}
        />
      )}
      <div className="nova-format-strip">
        {[['JSON', '结构化课件大纲', <ClusterOutlined />], ['Word', '详细教案文档', <FileWordOutlined />], ['PPT', '演示课件', <FilePptOutlined />], ['QA', '质量检查报告', <SafetyCertificateOutlined />]].map(([name, text, icon]) => (
          <div key={String(name)}><span>{icon}</span><div><strong>{name}</strong><small>{text}</small></div></div>
        ))}
      </div>
      <section className="nova-panel nova-assets-panel">
        <header><div><FolderOpenOutlined /><strong>最近生成</strong></div><Tag color="blue">阶段 {stageItems.findIndex((item) => item.key === props.stage) + 1} / 7</Tag></header>
        {visibleRows.length ? (
          <div className="nova-asset-grid">
            {visibleRows.map((asset) => (
              <article key={asset.id} className={`nova-asset-card type-${asset.asset_type}`}>
                <span>{icons[asset.asset_type] ?? <FileTextOutlined />}</span>
                <Tag color="success">已生成</Tag>
                <strong>{labels[asset.asset_type] ?? asset.asset_type}</strong>
                <p>{asset.file_name}</p>
                <footer><small>版本 v{asset.version}</small><Button type="link" href={`${API_BASE}/assets/${asset.id}/download`} target="_blank">下载文件 <ArrowRightOutlined /></Button></footer>
              </article>
            ))}
          </div>
        ) : (
          <div className="nova-empty-state">
            <span><FileTextOutlined /></span><h3>还没有教学文档</h3><p>先完成课程需求与风格确认，TeachNova 会一次生成完整教学资源包。</p>
            <Button type="primary" onClick={() => props.onNavigate('workspace')}>前往完善需求</Button>
          </div>
        )}
      </section>
    </section>
  );
}

function LessonPlanView(props: {
  activeTask?: Task;
  requirement?: RequirementResponse;
  onNavigate: (key: string) => void;
  onNewTask: () => void;
}) {
  const teaching = props.requirement?.session.teaching;
  const requirement = props.requirement?.state;
  return (
    <section className="nova-tool-page nova-lesson-page">
      <NovaPageHeader
        icon={<RobotOutlined />}
        eyebrow="LESSON DESIGN"
        title="AI 教案设计"
        description="从课程目标到课堂活动，生成可直接授课的完整教学设计。"
        action={<Button type="primary" icon={<PlusOutlined />} onClick={props.onNewTask}>新建教案</Button>}
      />
      <div className="nova-lesson-grid">
        <section className="nova-panel nova-lesson-brief">
          <header><div><FileDoneOutlined /><strong>当前课程</strong></div><Tag color={props.activeTask ? 'blue' : 'default'}>{props.requirement?.stage ? stageLabels[props.requirement.stage] : '等待创建'}</Tag></header>
          <div className="nova-course-cover"><span>✦</span><small>{requirement?.subject || '智能课程设计'}</small><h2>{requirement?.topic || props.activeTask?.title || '创建一个新的教学主题'}</h2><p>{requirement?.grade || '选择年级'} · {requirement?.duration ? `${requirement.duration} 分钟` : '设置课时'}</p></div>
          <Button type="primary" block onClick={() => props.onNavigate('workspace')}>继续完善教案 <ArrowRightOutlined /></Button>
        </section>
        <section className="nova-panel nova-teaching-blueprint">
          <header><div><DashboardOutlined /><strong>教学设计蓝图</strong></div><span>实时同步 Agent 状态</span></header>
          <div className="nova-blueprint-grid">
            {[
              ['01', '教学目标', teaching?.objectives || [], 'objectives'],
              ['02', '重点难点', [...(teaching?.keyPoints || []), ...(teaching?.difficultPoints || [])], 'points'],
              ['03', '课堂活动', teaching?.activities || [], 'activities'],
              ['04', '练习评价', teaching?.exercises || [], 'exercises'],
            ].map(([num, title, items, kind]) => (
              <article key={String(kind)}><span>{String(num)}</span><div><strong>{String(title)}</strong>{(items as string[]).length ? (items as string[]).slice(0, 2).map((item) => <p key={item}><CheckCircleOutlined />{item}</p>) : <p className="muted">完善需求后自动生成</p>}</div></article>
            ))}
          </div>
          <div className="nova-lesson-tips"><ThunderboltOutlined /><div><strong>AI 教学建议</strong><p>目标、活动和练习会围绕同一知识主线自动对齐，避免内容堆砌。</p></div></div>
        </section>
      </div>
    </section>
  );
}

function TemplateGalleryView(props: { onNavigate: (key: string) => void }) {
  const templates = [
    ['清新课堂', 'fresh', '适合基础教育与公开课', '16:9'],
    ['科技未来', 'future', '适合信息技术与理工课程', '16:9'],
    ['极简学术', 'academic', '适合高校讲授与学术汇报', '16:9'],
    ['活力互动', 'vivid', '适合项目课堂与课堂活动', '16:9'],
    ['自然人文', 'nature', '适合语文、历史与通识课程', '16:9'],
    ['深蓝专业', 'navy', '适合职业教育与专业课程', '16:9'],
  ];
  return (
    <section className="nova-tool-page nova-template-page">
      <NovaPageHeader icon={<DashboardOutlined />} eyebrow="TEMPLATE GALLERY" title="PPT 模板中心" description="为不同学科和教学场景准备的高质量课件视觉模板。" action={<Button icon={<PlusOutlined />}>创建自定义模板</Button>} />
      <div className="nova-template-toolbar"><Segmented options={['全部模板', '基础教育', '职业教育', '高校课堂']} /><Input prefix={<SearchOutlined />} placeholder="搜索模板或风格" /></div>
      <div className="nova-template-grid">
        {templates.map(([name, tone, desc, ratio], index) => (
          <article key={name} className="nova-template-card">
            <GlareHover className="nova-template-glare" glareColor="#d9efff" glareOpacity={0.72}>
              <div className={`nova-template-preview ${tone}`}><span>TN</span><small>{name}</small><i /><i /></div>
            </GlareHover>
            <div className="nova-template-meta"><div><strong>{name}</strong><p>{desc}</p></div><Tag>{ratio}</Tag></div>
            <footer><span>{index < 2 ? '热门推荐' : '精品模板'}</span><Button type="primary" size="small" onClick={() => props.onNavigate('workspace')}>使用模板</Button></footer>
          </article>
        ))}
      </div>
    </section>
  );
}

function HistoryView(props: {
  tasks: Task[];
  activeTaskId?: number;
  setActiveTaskId: (id: number) => void;
  onNavigate: (key: string) => void;
}) {
  return (
    <section className="nova-tool-page nova-history-page">
      <NovaPageHeader icon={<FolderOpenOutlined />} eyebrow="PROJECT ARCHIVE" title="历史作品" description="查看、继续编辑和管理所有 AI 教学创作项目。" action={<Button type="primary" icon={<PlusOutlined />} onClick={() => props.onNavigate('workspace')}>开始新项目</Button>} />
      <div className="nova-history-summary">
        <div><strong>{props.tasks.length}</strong><span>全部项目</span></div>
        <div><strong>{props.tasks.filter((task) => task.status === 'complete').length}</strong><span>已完成</span></div>
        <div><strong>{props.tasks.filter((task) => task.status !== 'complete').length}</strong><span>进行中</span></div>
      </div>
      <section className="nova-panel nova-history-panel">
        <header><div><FolderOpenOutlined /><strong>我的作品</strong></div><Segmented options={['全部', '进行中', '已完成']} /></header>
        {props.tasks.length ? <div className="nova-project-grid">{props.tasks.map((task, index) => (
          <article key={task.id} className={task.id === props.activeTaskId ? 'active' : ''}>
            <div className={`nova-project-cover cover-${index % 4}`}><span>TN</span><small>{task.subject || 'AI 智能教学'}</small><strong>{task.title}</strong></div>
            <div className="nova-project-body"><div><Tag color={task.status === 'complete' ? 'success' : 'processing'}>{task.status === 'complete' ? '已完成' : '进行中'}</Tag><small>{formatTaskTime(task.updated_at)}</small></div><h3>{task.title}</h3><p>{task.audience || '教学对象待完善'} · {task.duration_minutes ? `${task.duration_minutes} 分钟` : '课时待完善'}</p><Button block onClick={() => { props.setActiveTaskId(task.id); props.onNavigate('workspace'); }}>继续编辑 <ArrowRightOutlined /></Button></div>
          </article>
        ))}</div> : <div className="nova-empty-state"><span><FolderOpenOutlined /></span><h3>还没有历史作品</h3><p>从一个教学主题开始，作品会自动保存在这里。</p><Button type="primary" onClick={() => props.onNavigate('workspace')}>开始创建</Button></div>}
      </section>
    </section>
  );
}

export default App;

function HomeHero(props: {
  backendReady: boolean;
  loading: boolean;
  onNavigate: (key: string) => void;
  onSubmit: (text: string) => void;
}) {
  const [draft, setDraft] = useState('给高职学生讲 TCP 三次握手，45 分钟，希望结合 PDF 资料和一个流程排序小游戏');
  const quickPrompts = ['上传 PDF 后生成课件', '从视频提取案例', '设计课堂互动', '生成教案与作业'];

  return (
    <section className="nova-home">
      <div className="nova-home-orb" aria-hidden="true"><span>TN</span></div>
      <main className="nova-home-stage">
        <div className="nova-home-title">
          <span>✦</span>
          <div><h1>TeachNova</h1><h2>AI 智能教学　让创作更简单</h2></div>
        </div>
        <p>融合大模型与多模态技术，为教师提供从教案、课件到教学资源的一站式智能创作平台。</p>

        <div className="nova-hero-prompt" role="search">
          <Input.TextArea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            autoSize={{ minRows: 2, maxRows: 4 }}
            placeholder="告诉我，你想制作什么？例如：帮我生成一份八年级物理《牛顿第一定律》的 PPT，45 分钟..."
          />
          <div className="nova-prompt-bar">
            <Space>
              <Button icon={<UploadOutlined />} onClick={() => props.onNavigate('materials')}>上传资料</Button>
              <Button icon={<PlayCircleOutlined />} onClick={() => props.onNavigate('templates')}>示例模板</Button>
              <Badge status={props.backendReady ? 'success' : 'error'} text={props.backendReady ? '后端在线' : '后端未连接'} />
            </Space>
            <StarBorder
              className="nova-star-submit"
              aria-label="开始生成"
              disabled={props.loading}
              color="#8fd8ff"
              speed="4.8s"
              onClick={() => props.onSubmit(draft)}
            >
              {props.loading ? <LoadingOutlined /> : <ArrowRightOutlined />}
            </StarBorder>
          </div>
        </div>

        <div className="nova-home-cards">
          {[
            { icon: <FileDoneOutlined />, title: 'AI 生成教案', text: '智能设计教学方案', nav: 'lesson' },
            { icon: <FilePptOutlined />, title: 'AI 生成课件', text: '一键生成 PPT，支持多种风格', nav: 'workspace' },
            { icon: <FileWordOutlined />, title: '文档生成', text: '支持 Word、PDF、TXT 等格式', nav: 'course' },
            { icon: <DashboardOutlined />, title: 'PPT 模板', text: '海量模板，风格多样', nav: 'templates' },
          ].map((item) => (
            <SpotlightCard key={item.title} className="nova-feature-spotlight" spotlightColor="rgba(92, 165, 255, 0.24)">
              <button type="button" onClick={() => props.onNavigate(item.nav)}>
                <span>{item.icon}</span><strong>{item.title}</strong><small>{item.text}</small><ArrowRightOutlined />
              </button>
            </SpotlightCard>
          ))}
        </div>
        <div className="nova-quick-prompts">{quickPrompts.map((item) => <button key={item} onClick={() => setDraft(item)}>{item}</button>)}</div>
      </main>
    </section>
  );
}
