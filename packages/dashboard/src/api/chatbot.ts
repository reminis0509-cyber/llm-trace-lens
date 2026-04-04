import { supabase } from '../lib/supabase';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) || '';

async function getAuthHeaders(token?: string): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    headers['X-User-ID'] = session.user.id;
    headers['X-User-Email'] = session.user.email || '';
  }

  return headers;
}

// ---- Types ----

export interface ChatbotConfig {
  id: string;
  workspace_id: string;
  name: string;
  system_prompt: string | null;
  tone: 'polite' | 'casual' | 'business';
  welcome_message: string | null;
  model: string;
  temperature: number;
  max_tokens: number;
  widget_color: string;
  widget_position: string;
  widget_logo_url: string | null;
  publish_key: string | null;
  is_published: boolean;
  allowed_origins: string | null;
  rate_limit_per_minute: number;
  daily_message_limit: number;
  monthly_token_budget: number | null;
  created_at: string;
  updated_at: string;
}

export interface ChatbotDocument {
  id: string;
  chatbot_id: string;
  filename: string;
  file_type: string;
  file_size: number;
  chunk_count: number;
  status: 'processing' | 'ready' | 'error';
  error_message: string | null;
  created_at: string;
}

export interface ChatSession {
  id: string;
  chatbot_id: string;
  visitor_id: string | null;
  started_at: string;
  last_message_at: string | null;
  message_count: number;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  trace_id: string | null;
  created_at: string;
}

export interface ChatbotStats {
  total_sessions: number;
  total_messages: number;
  today_messages: number;
}

export interface ExchangeRate {
  date: string;
  usd_jpy: number;
}

export type CreateChatbotData = {
  name: string;
  system_prompt?: string;
  tone?: 'polite' | 'casual' | 'business';
  welcome_message?: string;
};

// ---- API Functions ----

export async function fetchChatbots(token?: string): Promise<ChatbotConfig[]> {
  const headers = await getAuthHeaders(token);
  const res = await fetch(`${API_BASE}/api/chatbots`, {
    headers,
    credentials: 'include',
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.message || error.error || 'チャットボット一覧の取得に失敗しました');
  }
  const data = await res.json();
  return data.chatbots || data;
}

export async function createChatbot(data: CreateChatbotData, token?: string): Promise<ChatbotConfig> {
  const headers = await getAuthHeaders(token);
  const res = await fetch(`${API_BASE}/api/chatbots`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.message || error.error || 'チャットボットの作成に失敗しました');
  }
  const json = await res.json();
  return json.chatbot ?? json;
}

export async function fetchChatbot(id: string, token?: string): Promise<ChatbotConfig> {
  const headers = await getAuthHeaders(token);
  const res = await fetch(`${API_BASE}/api/chatbots/${id}`, {
    headers,
    credentials: 'include',
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.message || error.error || 'チャットボットの取得に失敗しました');
  }
  const json = await res.json();
  return json.chatbot ?? json;
}

export async function updateChatbot(id: string, data: Partial<ChatbotConfig>, token?: string): Promise<ChatbotConfig> {
  const headers = await getAuthHeaders(token);
  const res = await fetch(`${API_BASE}/api/chatbots/${id}`, {
    method: 'PUT',
    headers,
    credentials: 'include',
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.message || error.error || 'チャットボットの更新に失敗しました');
  }
  const json = await res.json();
  return json.chatbot ?? json;
}

export async function deleteChatbot(id: string, token?: string): Promise<void> {
  const headers = await getAuthHeaders(token);
  const res = await fetch(`${API_BASE}/api/chatbots/${id}`, {
    method: 'DELETE',
    headers,
    credentials: 'include',
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.message || error.error || 'チャットボットの削除に失敗しました');
  }
}

export async function publishChatbot(id: string, token?: string): Promise<{ publishKey: string; embedScript: string }> {
  const headers = await getAuthHeaders(token);
  const res = await fetch(`${API_BASE}/api/chatbots/${id}/publish`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.message || error.error || 'チャットボットの公開に失敗しました');
  }
  return res.json();
}

export async function uploadDocument(chatbotId: string, file: File, token?: string): Promise<ChatbotDocument> {
  const authHeaders = await getAuthHeaders(token);
  const formData = new FormData();
  formData.append('file', file);

  // Remove Content-Type header so browser sets multipart boundary automatically
  const headers: Record<string, string> = {};
  if (authHeaders['Authorization']) headers['Authorization'] = authHeaders['Authorization'];
  if (authHeaders['X-User-ID']) headers['X-User-ID'] = authHeaders['X-User-ID'];
  if (authHeaders['X-User-Email']) headers['X-User-Email'] = authHeaders['X-User-Email'];

  const res = await fetch(`${API_BASE}/api/chatbots/${chatbotId}/documents`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: formData,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.message || error.error || 'ドキュメントのアップロードに失敗しました');
  }
  return res.json();
}

export async function fetchDocuments(chatbotId: string, token?: string): Promise<ChatbotDocument[]> {
  const headers = await getAuthHeaders(token);
  const res = await fetch(`${API_BASE}/api/chatbots/${chatbotId}/documents`, {
    headers,
    credentials: 'include',
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.message || error.error || 'ドキュメント一覧の取得に失敗しました');
  }
  const data = await res.json();
  return data.documents || data;
}

export async function deleteDocument(chatbotId: string, docId: string, token?: string): Promise<void> {
  const headers = await getAuthHeaders(token);
  const res = await fetch(`${API_BASE}/api/chatbots/${chatbotId}/documents/${docId}`, {
    method: 'DELETE',
    headers,
    credentials: 'include',
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.message || error.error || 'ドキュメントの削除に失敗しました');
  }
}

export async function fetchSessions(chatbotId: string, token?: string): Promise<ChatSession[]> {
  const headers = await getAuthHeaders(token);
  const res = await fetch(`${API_BASE}/api/chatbots/${chatbotId}/sessions`, {
    headers,
    credentials: 'include',
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.message || error.error || 'セッション一覧の取得に失敗しました');
  }
  const data = await res.json();
  return data.sessions || data;
}

export async function fetchSessionMessages(chatbotId: string, sessionId: string, token?: string): Promise<ChatMessage[]> {
  const headers = await getAuthHeaders(token);
  const res = await fetch(`${API_BASE}/api/chatbots/${chatbotId}/sessions/${sessionId}/messages`, {
    headers,
    credentials: 'include',
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.message || error.error || 'メッセージの取得に失敗しました');
  }
  const data = await res.json();
  return data.messages || data;
}

export async function fetchChatbotStats(chatbotId: string, token?: string): Promise<ChatbotStats> {
  const headers = await getAuthHeaders(token);
  const res = await fetch(`${API_BASE}/api/chatbots/${chatbotId}/stats`, {
    headers,
    credentials: 'include',
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.message || error.error || '統計データの取得に失敗しました');
  }
  return res.json();
}

export async function fetchExchangeRate(token?: string): Promise<ExchangeRate> {
  const headers = await getAuthHeaders(token);
  const res = await fetch(`${API_BASE}/api/exchange-rate`, {
    headers,
    credentials: 'include',
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.message || error.error || '為替レートの取得に失敗しました');
  }
  return res.json();
}
