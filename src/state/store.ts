import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import { User, Chat, Message, Story } from '../api/client';

interface AppState {
  // Auth
  user: User | null;
  access: string | null;
  refresh: string | null;
  setAuth: (user: User, access: string, refresh: string) => void;
  logout: () => void;

  // Chats
  chats: Chat[];
  setChats: (chats: Chat[]) => void;
  updateChat: (chat: Partial<Chat> & { id: string }) => void;
  activeChat: string | null;
  setActiveChat: (id: string | null) => void;

  // Messages
  messages: Record<string, Message[]>;
  setMessages: (chatId: string, msgs: Message[]) => void;
  addMessage: (chatId: string, msg: Message) => void;
  editMessage: (chatId: string, msgId: string, text: string) => void;
  deleteMessage: (chatId: string, msgId: string) => void;
  updateReaction: (chatId: string, msgId: string, userId: string, emoji: string, action: 'added'|'removed') => void;
  markRead: (chatId: string, userId: string, upToMsgId: string) => void;

  // Typing
  typing: Record<string, string[]>; // chatId -> [userId]
  setTyping: (chatId: string, userId: string, isTyping: boolean) => void;

  // Stories
  stories: Story[];
  setStories: (s: Story[]) => void;

  // Theme
  theme: { mode: 'dark'|'light'; accent: string; bubble: string; cozy: string; font: string };
  setTheme: (t: Partial<AppState['theme']>) => void;

  // Online
  online: Record<string, boolean>;
  setOnline: (userId: string, online: boolean) => void;

  // Socket
  socket: Socket | null;
  connectSocket: (token: string) => void;
  disconnectSocket: () => void;
}

export const useStore = create<AppState>((set, get) => ({
  user: null,
  access: localStorage.getItem('iriska:access'),
  refresh: localStorage.getItem('iriska:refresh'),

  setAuth: (user, access, refresh) => {
    localStorage.setItem('iriska:access', access);
    localStorage.setItem('iriska:refresh', refresh);
    set({ user, access, refresh });
  },

  logout: () => {
    localStorage.removeItem('iriska:access');
    localStorage.removeItem('iriska:refresh');
    get().disconnectSocket();
    set({ user: null, access: null, refresh: null, chats: [], messages: {}, socket: null });
  },

  chats: [],
  setChats: (chats) => set({ chats }),
  updateChat: (chat) => set((s) => ({
    chats: s.chats.map((c) => c.id === chat.id ? { ...c, ...chat } : c),
  })),
  activeChat: null,
  setActiveChat: (id) => set({ activeChat: id }),

  messages: {},
  setMessages: (chatId, msgs) => set((s) => ({ messages: { ...s.messages, [chatId]: msgs } })),
  addMessage: (chatId, msg) => set((s) => ({
    messages: { ...s.messages, [chatId]: [...(s.messages[chatId] || []), msg] },
    chats: s.chats.map((c) => c.id === chatId
      ? { ...c, last_message: msg, unread_count: chatId !== s.activeChat ? (c.unread_count || 0) + 1 : c.unread_count }
      : c
    ),
  })),
  editMessage: (chatId, msgId, text) => set((s) => ({
    messages: {
      ...s.messages,
      [chatId]: (s.messages[chatId] || []).map((m) =>
        m.id === msgId ? { ...m, text, is_edited: true } : m
      ),
    },
  })),
  deleteMessage: (chatId, msgId) => set((s) => ({
    messages: {
      ...s.messages,
      [chatId]: (s.messages[chatId] || []).map((m) =>
        m.id === msgId ? { ...m, is_deleted: true, text: undefined } : m
      ),
    },
  })),
  updateReaction: (chatId, msgId, userId, emoji, action) => set((s) => ({
    messages: {
      ...s.messages,
      [chatId]: (s.messages[chatId] || []).map((m) => {
        if (m.id !== msgId) return m;
        let reactions = [...(m.reactions || [])];
        if (action === 'removed') {
          reactions = reactions.filter((r) => !(r.emoji === emoji && r.user_id === userId));
        } else {
          reactions = [...reactions, { emoji, user_id: userId }];
        }
        return { ...m, reactions };
      }),
    },
  })),
  markRead: (chatId, _userId, _upToMsgId) => set((s) => ({
    chats: s.chats.map((c) => c.id === chatId ? { ...c, unread_count: 0 } : c),
  })),

  typing: {},
  setTyping: (chatId, userId, isTyping) => set((s) => {
    const cur = s.typing[chatId] || [];
    const next = isTyping ? [...new Set([...cur, userId])] : cur.filter((u) => u !== userId);
    return { typing: { ...s.typing, [chatId]: next } };
  }),

  stories: [],
  setStories: (stories) => set({ stories }),

  theme: {
    mode: (localStorage.getItem('iriska:theme:mode') as 'dark'|'light') || 'dark',
    accent: localStorage.getItem('iriska:theme:accent') || 'iriska',
    bubble: localStorage.getItem('iriska:theme:bubble') || 'round',
    cozy: localStorage.getItem('iriska:theme:cozy') || 'soft',
    font: localStorage.getItem('iriska:theme:font') || 'Inter',
  },
  setTheme: (t) => {
    set((s) => {
      const next = { ...s.theme, ...t };
      localStorage.setItem('iriska:theme:mode',   next.mode);
      localStorage.setItem('iriska:theme:accent', next.accent);
      localStorage.setItem('iriska:theme:bubble', next.bubble);
      localStorage.setItem('iriska:theme:cozy',   next.cozy);
      localStorage.setItem('iriska:theme:font',   next.font);
      return { theme: next };
    });
  },

  online: {},
  setOnline: (userId, online) => set((s) => ({ online: { ...s.online, [userId]: online } })),

  socket: null,

  connectSocket: (token) => {
    const existing = get().socket;
    if (existing?.connected) return;
    const socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:4000', {
      auth: { token },
      transports: ['websocket'],
      reconnectionAttempts: 5,
    });

    socket.on('connect', () => console.log('🔌 Socket connected'));
    socket.on('disconnect', () => console.log('🔌 Socket disconnected'));

    socket.on('chat:message', (msg: Message) => {
      get().addMessage(msg.chat_id, msg);
    });
    socket.on('chat:edited', ({ id, chatId, text }: any) => {
      get().editMessage(chatId, id, text);
    });
    socket.on('chat:deleted', ({ messageId, chatId }: any) => {
      get().deleteMessage(chatId, messageId);
    });
    socket.on('chat:typing', ({ chatId, userId, isTyping }: any) => {
      get().setTyping(chatId, userId, isTyping);
    });
    socket.on('chat:read', ({ chatId, userId, upToMessageId }: any) => {
      get().markRead(chatId, userId, upToMessageId);
    });
    socket.on('chat:reaction', ({ messageId, userId, emoji, action, chatId }: any) => {
      // Найдём chatId через сообщение
      const msgs = get().messages;
      const cid = chatId || Object.keys(msgs).find((k) => msgs[k].some((m) => m.id === messageId));
      if (cid) get().updateReaction(cid, messageId, userId, emoji, action);
    });
    socket.on('user:presence', ({ userId, online }: any) => {
      get().setOnline(userId, online);
    });

    set({ socket });
  },

  disconnectSocket: () => {
    get().socket?.disconnect();
    set({ socket: null });
  },
}));
