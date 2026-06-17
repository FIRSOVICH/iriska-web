import axios from 'axios';

const BASE = import.meta.env.VITE_API_URL || '/api';

export const api = axios.create({ baseURL: BASE, withCredentials: false });

// Подставляем access-токен
api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem('iriska:access');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// Refresh при 401
let refreshing: Promise<string> | null = null;
api.interceptors.response.use(
  (r) => r,
  async (err) => {
    if (err.response?.status !== 401) return Promise.reject(err);
    const refresh = localStorage.getItem('iriska:refresh');
    if (!refresh) { window.location.href = '/'; return Promise.reject(err); }
    if (!refreshing) {
      refreshing = axios.post(`${BASE}/auth/refresh`, { refreshToken: refresh })
        .then((r) => {
          localStorage.setItem('iriska:access', r.data.access);
          return r.data.access;
        })
        .catch(() => { localStorage.clear(); window.location.href = '/'; return ''; })
        .finally(() => { refreshing = null; });
    }
    const access = await refreshing;
    err.config.headers.Authorization = `Bearer ${access}`;
    return axios(err.config);
  }
);

// Типы
export interface User {
  id: string; name: string; username: string; email: string;
  avatar_url?: string; created_at: string;
  status_preset?: string; mood?: string; music_track?: string; bio?: string;
  theme?: string; font?: string; accent_color?: string; bubble_style?: string; cozy_mode?: string;
}

export interface Message {
  id: string; chat_id: string; user_id: string; type: string;
  text?: string; file_url?: string; file_name?: string;
  reply_to?: { id: string; text: string; user_name: string } | null;
  reactions: Array<{ emoji: string; user_id: string }>;
  is_edited: boolean; is_deleted: boolean; duration?: number;
  user_name: string; username: string; avatar_url?: string;
  created_at: string; no_forward?: boolean; self_destruct_after?: number;
  e2eCiphertext?: string;
}

export interface Chat {
  id: string; type: 'dm' | 'group' | 'channel'; name?: string; avatar_url?: string;
  e2e_enabled: boolean; role: string; unread_count: number;
  last_message?: Message;
  peer?: { id: string; name: string; username: string; avatar_url?: string };
  members?: Array<{ user_id: string; role: string; name: string; avatar_url?: string }>;
}

export interface Story {
  id: string; user_id: string; type: string;
  media_url?: string; text?: string; bg_color?: string; text_color?: string;
  expires_at: string; created_at: string; seen: boolean; view_count: number;
  name: string; avatar_url?: string; my_reaction?: string;
}

// API методы
export const authApi = {
  register: (d: {name:string;email:string;password:string;username:string}) => api.post('/auth/register', d),
  login: (d: {email:string;password:string}) => api.post('/auth/login', d),
  refresh: (refreshToken: string) => api.post('/auth/refresh', { refreshToken }),
  logout: (refreshToken: string) => api.post('/auth/logout', { refreshToken }),
};

export const usersApi = {
  me: () => api.get<User>('/users/me'),
  update: (d: Partial<User>) => api.patch('/users/me', d),
  search: (q: string) => api.get<User[]>(`/users/search?q=${encodeURIComponent(q)}`),
  get: (id: string) => api.get<User>(`/users/${id}`),
  contacts: () => api.get('/users/me/contacts'),
  addContact: (contactId: string, nickname?: string) => api.post('/users/me/contacts', { contactId, nickname }),
  removeContact: (id: string) => api.delete(`/users/me/contacts/${id}`),
  uploadAvatar: (file: File) => {
    const fd = new FormData(); fd.append('avatar', file);
    return api.post('/users/me/avatar', fd);
  },
};

export const chatsApi = {
  list: () => api.get<Chat[]>('/chats'),
  dm: (userId: string) => api.post<Chat>('/chats/dm', { userId }),
  group: (name: string, memberIds: string[], description?: string) =>
    api.post<Chat>('/chats/group', { name, memberIds, description }),
  get: (id: string) => api.get<Chat>(`/chats/${id}`),
  addMember: (chatId: string, userId: string) => api.post(`/chats/${chatId}/members`, { userId }),
  removeMember: (chatId: string, userId: string) => api.delete(`/chats/${chatId}/members/${userId}`),
  invite: (chatId: string) => api.get(`/chats/${chatId}/invite`),
  resetInvite: (chatId: string) => api.post(`/chats/${chatId}/invite/reset`),
  callHistory: (chatId: string) => api.get(`/chats/${chatId}/call-history`),
};

export const messagesApi = {
  list: (chatId: string, before?: string, limit = 50) =>
    api.get<Message[]>(`/chats/${chatId}/messages`, { params: { before, limit } }),
  send: (chatId: string, d: {type?:string;text?:string;replyToId?:string;e2eCiphertext?:string}) =>
    api.post<Message>(`/chats/${chatId}/messages`, d),
  upload: (chatId: string, file: File, type: string, duration?: number) => {
    const fd = new FormData(); fd.append('file', file); fd.append('type', type);
    if (duration) fd.append('duration', String(duration));
    return api.post<Message>(`/chats/${chatId}/messages/upload`, fd);
  },
  edit: (chatId: string, msgId: string, text: string) =>
    api.patch(`/chats/${chatId}/messages/${msgId}`, { text }),
  delete: (chatId: string, msgId: string) =>
    api.delete(`/chats/${chatId}/messages/${msgId}`),
  read: (chatId: string, upToMessageId: string) =>
    api.post(`/chats/${chatId}/messages/read`, { upToMessageId }),
  react: (chatId: string, msgId: string, emoji: string) =>
    api.post(`/chats/${chatId}/messages/${msgId}/reactions`, { emoji }),
};

export const profilesApi = {
  get: (userId: string) => api.get(`/profiles/${userId}`),
  updateMe: (d: object) => api.patch('/profiles/me', d),
  theme: () => api.get('/profiles/me/theme'),
  updateTheme: (d: object) => api.patch('/profiles/me/theme', d),
  achievements: () => api.get('/profiles/me/achievements'),
};

export const storiesApi = {
  feed: () => api.get<Story[]>('/stories/feed'),
  postText: (text: string, bgColor: string, textColor: string) =>
    api.post('/stories/text', { text, bgColor, textColor }),
  view: (id: string, emoji?: string) => api.post(`/stories/${id}/view`, { emoji }),
  viewers: (id: string) => api.get(`/stories/${id}/viewers`),
  delete: (id: string) => api.delete(`/stories/${id}`),
};

export const pokesApi = {
  send: (toId: string, type: string) => api.post('/pokes', { toId, type }),
  inbox: () => api.get('/pokes/inbox'),
  count: () => api.get<{count:number}>('/pokes/inbox/count'),
};

export const e2eApi = {
  registerKey: (deviceId: string, publicKey: string) => api.post('/e2e/keys', { deviceId, publicKey }),
  getKeys: (userId: string) => api.get(`/e2e/keys/${userId}`),
  enable: (chatId: string) => api.post(`/e2e/enable/${chatId}`),
  sendEnvelopes: (messageId: string, envelopes: Array<{recipientId:string;encryptedKey:string}>) =>
    api.post('/e2e/envelopes', { messageId, envelopes }),
  getEnvelope: (msgId: string) => api.get(`/e2e/envelopes/${msgId}`),
};

export const pushApi = {
  vapid: () => api.get<{publicKey:string}>('/push/vapid'),
  subscribe: (endpoint: string, keys: object) => api.post('/push/subscribe', { endpoint, keys }),
  unsubscribe: (endpoint: string) => api.post('/push/unsubscribe', { endpoint }),
};

export const momentsApi = {
  get: () => api.get('/moments'),
  unseen: () => api.get<{count:number}>('/moments/unseen'),
};
