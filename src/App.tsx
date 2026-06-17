import { useState, useEffect } from 'react';
import { useStore } from './state/store';
import { usersApi, chatsApi, storiesApi, profilesApi } from './api/client';
import { getPublicKeyBase64 } from './crypto/e2e';
import { e2eApi } from './api/client';
import { usePush } from './hooks/usePush';
import Auth from './pages/Auth';
import Main from './pages/Main';

export default function App() {
  const { user, access, setAuth, setChats, setStories, setTheme, connectSocket } = useStore();
  const [loading, setLoading] = useState(true);

  usePush(user?.id || null);

  useEffect(() => {
    if (!access) { setLoading(false); return; }
    // Загружаем данные пользователя
    usersApi.me()
      .then(async (r) => {
        const u = r.data;
        const refresh = localStorage.getItem('iriska:refresh') || '';
        setAuth(u, access, refresh);
        // Применяем тему
        setTheme({
          mode: (u.theme as any) || 'dark',
          accent: u.accent_color || 'iriska',
          bubble: u.bubble_style || 'round',
          cozy: u.cozy_mode || 'soft',
          font: u.font || 'Inter',
        });
        // Загружаем чаты и истории
        const [chatsR, storiesR] = await Promise.all([
          chatsApi.list(),
          storiesApi.feed().catch(() => ({ data: [] })),
        ]);
        setChats(chatsR.data);
        setStories(storiesR.data);
        // Подключаем сокет
        connectSocket(access);
        // Регистрируем E2E ключ
        const pk = getPublicKeyBase64();
        const deviceId = localStorage.getItem('iriska:deviceId') || crypto.randomUUID();
        localStorage.setItem('iriska:deviceId', deviceId);
        e2eApi.registerKey(deviceId, pk).catch(() => {});
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'grid', placeItems: 'center', background: '#191512', fontSize: 56 }}>
        🍬
      </div>
    );
  }

  if (!user) return <Auth />;
  return <Main />;
}
