import { useState, useEffect } from 'react';
import { useStore } from '../state/store';
import { ThemeProvider } from '../state/theme';
import CozyCanvas from '../components/CozyCanvas';
import SettingsPanel from '../components/SettingsPanel';
import ProfilePage from '../components/ProfilePage';
import Rooms from '../components/Rooms';
import ChatList from './ChatList';
import ChatWindow from './ChatWindow';

export default function Main() {
  const { theme, activeChat, user } = useStore();
  const [view, setView] = useState<'none'|'settings'|'profile'|'rooms'>('none');
  const [narrow, setNarrow] = useState(window.innerWidth < 768);

  useEffect(() => {
    const h = () => setNarrow(window.innerWidth < 768);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  const showList = !narrow || !activeChat;
  const showChat = !narrow || !!activeChat;

  return (
    <ThemeProvider>
      <div style={{ height:'100vh', display:'flex', position:'relative', overflow:'hidden', background:'var(--bg)' }}>
        <CozyCanvas mode={theme.cozy} />

        {/* Sidebar */}
        {showList && (
          <ChatList
            onSettings={()=>setView('settings')}
            onProfile={()=>setView('profile')}
            onRooms={()=>setView('rooms')}
          />
        )}

        {/* Chat window */}
        {showChat && (
          activeChat
            ? <ChatWindow />
            : !narrow && (
              <div style={{ flex:1, display:'grid', placeItems:'center', color:'var(--dim)' }}>
                <div style={{ textAlign:'center' }}>
                  <div style={{ fontSize:64, marginBottom:12 }}>🍬</div>
                  <div style={{ fontSize:18, fontWeight:700 }}>Ириска</div>
                  <div style={{ fontSize:14, marginTop:6 }}>Выберите чат слева, чтобы начать</div>
                </div>
              </div>
            )
        )}

        {/* Overlays */}
        {view === 'settings' && <SettingsPanel onClose={()=>setView('none')} />}
        {view === 'profile'  && <ProfilePage onClose={()=>setView('none')} />}
        {view === 'rooms'    && <Rooms onClose={()=>setView('none')} />}
      </div>
    </ThemeProvider>
  );
}
