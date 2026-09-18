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
  status?: 'sending' | 'error';
  createdAt: string;
  thinking?: string[];
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
