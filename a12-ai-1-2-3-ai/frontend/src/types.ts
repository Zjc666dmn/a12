export type StageKey =
  | 'requirement'
  | 'clarification'
  | 'teaching_design'
  | 'outline'
  | 'style'
  | 'generating'
  | 'editor';

export type LocalMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  status?: 'sending' | 'error' | 'thinking' | 'streaming';
  createdAt: string;
  thinking?: string[];
  /** 流式输出中模型给出的思考原文（推理模型的 reasoning_content） */
  reasoning?: string;
};

export type ReferenceFile = {
  id: string;
  name: string;
  type: string;
  status: 'uploading' | 'parsing' | 'ready' | 'error';
  size?: number;
  parsedContent?: string;
  purpose?: 'content' | 'style' | 'case' | 'activity';
  focus?: string;
};
