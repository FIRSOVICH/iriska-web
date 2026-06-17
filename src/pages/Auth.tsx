import { useState } from 'react';
import { authApi, usersApi, chatsApi, storiesApi } from '../api/client';
import { useStore } from '../state/store';
import { getPublicKeyBase64 } from '../crypto/e2e';
import { e2eApi } from '../api/client';

export default function Auth() {
  const [tab, setTab] = useState<'login'|'register'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { setAuth, setChats, setStories, setTheme, connectSocket } = useStore();

  // Login form
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // Register extras
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      let access = '', refresh = '';
      if (tab === 'login') {
        const r = await authApi.login({ email, password });
        access = r.data.access; refresh = r.data.refresh;
      } else {
        const r = await authApi.register({ name, email, password, username });
        access = r.data.access; refresh = r.data.refresh;
      }
      localStorage.setItem('iriska:access', access);
      localStorage.setItem('iriska:refresh', refresh);
      const userR = await usersApi.me();
      const u = userR.data;
      setAuth(u, access, refresh);
      setTheme({
        mode: (u.theme as any) || 'dark',
        accent: u.accent_color || 'iriska',
        bubble: u.bubble_style || 'round',
        cozy: u.cozy_mode || 'soft',
        font: u.font || 'Inter',
      });
      const [chatsR, storiesR] = await Promise.all([
        chatsApi.list(),
        storiesApi.feed().catch(() => ({ data: [] })),
      ]);
      setChats(chatsR.data);
      setStories(storiesR.data);
      connectSocket(access);
      // E2E
      const pk = getPublicKeyBase64();
      const deviceId = localStorage.getItem('iriska:deviceId') || crypto.randomUUID();
      localStorage.setItem('iriska:deviceId', deviceId);
      e2eApi.registerKey(deviceId, pk).catch(() => {});
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка входа');
    } finally { setLoading(false); }
  }

  return (
    <div style={{ height: '100vh', display: 'grid', placeItems: 'center', background: 'var(--bg)' }}>
      <div style={{
        width: 380, maxWidth: '94vw', padding: 32,
        background: 'var(--panel)', borderRadius: 28,
        border: '1px solid var(--border)',
        boxShadow: '0 30px 80px rgba(0,0,0,.45)',
        animation: 'slideInUp .3s ease',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 60 }}>🍬</div>
          <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: -1, margin: '8px 0 4px' }}>Ириска</h1>
          <p style={{ color: 'var(--dim)', fontSize: 14 }}>Уютный мессенджер · E2E · Без VPN</p>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', background: 'var(--bg)', borderRadius: 14, padding: 3, marginBottom: 24 }}>
          {(['login','register'] as const).map((t) => (
            <button key={t} onClick={() => { setTab(t); setError(''); }} style={{
              flex: 1, padding: '9px 0', borderRadius: 12, fontSize: 14, fontWeight: 600,
              background: tab === t ? 'var(--panel)' : 'transparent',
              color: tab === t ? 'var(--text)' : 'var(--dim)',
              boxShadow: tab === t ? '0 1px 6px rgba(0,0,0,.2)' : 'none',
              transition: 'all .15s',
            }}>
              {t === 'login' ? 'Войти' : 'Зарегистрироваться'}
            </button>
          ))}
        </div>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {tab === 'register' && (
            <>
              <input value={name} onChange={e=>setName(e.target.value)} placeholder="Имя" required
                style={inputStyle} />
              <input value={username} onChange={e=>setUsername(e.target.value)} placeholder="@username"
                required style={inputStyle} />
            </>
          )}
          <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email"
            type="email" required style={inputStyle} />
          <input value={password} onChange={e=>setPassword(e.target.value)} placeholder="Пароль"
            type="password" required style={inputStyle} />

          {error && (
            <div style={{ background: '#E2567022', border: '1px solid #E2567055', borderRadius: 10,
              padding: '9px 13px', color: '#E25670', fontSize: 13 }}>{error}</div>
          )}

          <button type="submit" disabled={loading} style={{
            background: 'var(--accent)', color: '#fff', borderRadius: 14, padding: '13px',
            fontSize: 15, fontWeight: 700, marginTop: 4,
            opacity: loading ? 0.7 : 1, transition: 'opacity .15s',
          }}>
            {loading ? '...' : tab === 'login' ? 'Войти' : 'Создать аккаунт'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 20, color: 'var(--dim)', fontSize: 12, lineHeight: 1.6 }}>
          E2E-шифрование · Socket.io real-time · PWA-уведомления<br/>
          Разворачивается на своём сервере · Без VPN в России
        </p>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: 'var(--bg)', border: '1px solid var(--border)',
  color: 'var(--text)', borderRadius: 14, padding: '13px 16px', fontSize: 15,
};
