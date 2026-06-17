import { useState, useEffect } from 'react';
import { useStore } from '../state/store';
import { chatsApi, storiesApi, usersApi } from '../api/client';
import { useTheme } from '../state/theme';

const STATUS_ICON: Record<string, string> = {
  online:'🟢', work:'💼', sleep:'😴', dnd:'⛔', coffee:'☕', shift:'🛠️', gaming:'🎮', away:'🚗',
};

interface Props {
  onSettings: () => void;
  onProfile: () => void;
  onRooms: () => void;
}

export default function ChatList({ onSettings, onProfile, onRooms }: Props) {
  const { user, chats, stories, online, setChats, setStories, setActiveChat, activeChat } = useStore();
  const { accent } = useTheme();
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [storyOpen, setStoryOpen] = useState<any>(null);
  const [newGroupOpen, setNewGroupOpen] = useState(false);

  // Поиск пользователей
  useEffect(() => {
    if (!search.trim()) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      const r = await usersApi.search(search);
      setSearchResults(r.data);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  async function openDM(userId: string) {
    const r = await chatsApi.dm(userId);
    const updated = await chatsApi.list();
    setChats(updated.data);
    setActiveChat(r.data.id);
    setSearch('');
  }

  function fmtTime(iso: string) {
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString('ru-RU', { hour:'2-digit', minute:'2-digit' });
    }
    return d.toLocaleDateString('ru-RU', { day:'2-digit', month:'2-digit' });
  }

  const filteredChats = chats.filter(c => {
    const name = c.type === 'dm' ? c.peer?.name : c.name;
    return !search || name?.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <aside style={{
      width: 340, flexShrink:0,
      borderRight:'1px solid var(--border)',
      background:'var(--panel)',
      display:'flex', flexDirection:'column',
      height:'100%', position:'relative', zIndex:10,
    }}>
      {/* Шапка */}
      <div style={{ padding:'12px 14px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:10 }}>
        <button onClick={onProfile} style={{
          width:40, height:40, borderRadius:20, background:'var(--bg)',
          display:'grid', placeItems:'center', fontSize:20, flexShrink:0,
          border:`2px solid ${accent.c}`, cursor:'pointer',
        }}>
          {user?.avatar_url ? <img src={user.avatar_url} style={{ width:'100%', height:'100%', borderRadius:20 }}/> : '🦊'}
        </button>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontWeight:700, fontSize:15 }}>{user?.name}</div>
          <div style={{ color:'var(--dim)', fontSize:12 }}>{STATUS_ICON[user?.status_preset||'online']} {user?.status_preset}</div>
        </div>
        <button onClick={onRooms} title="Комнаты" style={{ padding:6, color:'var(--dim)', fontSize:18 }}>🎵</button>
        <button onClick={onSettings} title="Настройки" style={{ padding:6, color:'var(--dim)', fontSize:18 }}>⚙️</button>
      </div>

      {/* Поиск */}
      <div style={{ padding:'10px 14px', borderBottom:'1px solid var(--border)' }}>
        <div style={{ position:'relative' }}>
          <span style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'var(--dim)' }}>🔍</span>
          <input
            value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="Поиск чата или пользователя…"
            style={{
              width:'100%', background:'var(--bg)', border:'1px solid var(--border)',
              color:'var(--text)', borderRadius:14, padding:'9px 12px 9px 36px', fontSize:14,
            }}
          />
          {search && <button onClick={()=>setSearch('')} style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', color:'var(--dim)', fontSize:16 }}>✕</button>}
        </div>
        {/* Результаты поиска пользователей */}
        {searchResults.length > 0 && (
          <div style={{ marginTop:8, background:'var(--bg)', borderRadius:14, border:'1px solid var(--border)', overflow:'hidden' }}>
            {searchResults.map(u=>(
              <div key={u.id} onClick={()=>openDM(u.id)} style={{
                display:'flex', gap:10, padding:'10px 14px', cursor:'pointer', alignItems:'center',
              }}>
                <div style={{ width:36, height:36, borderRadius:18, background:'var(--panel)', display:'grid', placeItems:'center', fontSize:18 }}>
                  {u.avatar_url ? <img src={u.avatar_url} style={{ width:'100%', height:'100%', borderRadius:18 }}/> : '👤'}
                </div>
                <div>
                  <div style={{ fontWeight:600, fontSize:14 }}>{u.name}</div>
                  <div style={{ color:'var(--dim)', fontSize:12 }}>@{u.username}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Истории */}
      {stories.length > 0 && (
        <div style={{ display:'flex', gap:12, padding:'12px 14px', overflowX:'auto', borderBottom:'1px solid var(--border)' }}>
          {stories.map(s=>(
            <div key={s.id} onClick={()=>setStoryOpen(s)} style={{ textAlign:'center', cursor:'pointer', flexShrink:0 }}>
              <div style={{
                width:50, height:50, borderRadius:25, display:'grid', placeItems:'center', fontSize:22,
                border:`2.5px solid ${s.seen ? 'var(--dim)' : accent.c}`,
                background:'var(--bg)',
              }}>
                {s.avatar_url ? <img src={s.avatar_url} style={{ width:'100%', height:'100%', borderRadius:25, objectFit:'cover' }}/> : '👤'}
              </div>
              <div style={{ fontSize:11, color:'var(--text)', marginTop:4, maxWidth:52, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.name}</div>
            </div>
          ))}
        </div>
      )}

      {/* Список чатов */}
      <div style={{ flex:1, overflowY:'auto' }}>
        {/* Кнопка создать группу */}
        <div onClick={()=>setNewGroupOpen(true)} style={{
          display:'flex', gap:12, padding:'12px 14px', cursor:'pointer', alignItems:'center',
          borderBottom:'1px solid var(--border)',
        }}>
          <div style={{ width:44, height:44, borderRadius:22, background:`${accent.c}22`, display:'grid', placeItems:'center', fontSize:20, border:`1px dashed ${accent.c}` }}>+</div>
          <div style={{ color:'var(--dim)', fontSize:14 }}>Создать группу</div>
        </div>

        {filteredChats.map(chat => {
          const name  = chat.type==='dm' ? chat.peer?.name : chat.name;
          const avatar = chat.type==='dm' ? chat.peer?.avatar_url : chat.avatar_url;
          const peerId = chat.peer?.id;
          const isOnline = peerId ? online[peerId] : false;
          const active = chat.id === activeChat;
          const last = chat.last_message;

          return (
            <div key={chat.id} onClick={()=>setActiveChat(chat.id)} style={{
              display:'flex', gap:12, padding:'12px 14px', cursor:'pointer', alignItems:'center',
              background: active ? 'var(--active-row)' : 'transparent',
              borderLeft:`3px solid ${active ? accent.c : 'transparent'}`,
              transition:'background .1s',
            }}>
              {/* Аватар */}
              <div style={{ position:'relative', flexShrink:0 }}>
                <div style={{ width:44, height:44, borderRadius:22, background:'var(--bg)', display:'grid', placeItems:'center', fontSize:22, overflow:'hidden' }}>
                  {avatar ? <img src={avatar} style={{ width:'100%', height:'100%', borderRadius:22 }}/> : (chat.type==='dm'?'👤':'👥')}
                </div>
                {isOnline && <span style={{ position:'absolute', right:0, bottom:0, width:12, height:12, borderRadius:6, background:'#46C2A0', border:'2px solid var(--panel)' }}/>}
              </div>

              {/* Инфо */}
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontWeight:600, fontSize:14, display:'flex', alignItems:'center', gap:4 }}>
                    {name}
                    {chat.e2e_enabled && <span style={{ fontSize:11 }} title="E2E">🔒</span>}
                  </span>
                  <span style={{ fontSize:11, color:'var(--dim)', flexShrink:0 }}>
                    {last?.created_at ? fmtTime(last.created_at) : ''}
                  </span>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:2 }}>
                  <span style={{ fontSize:13, color:'var(--dim)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {last?.user_id === user?.id ? 'Вы: ' : ''}{last?.text || (last?.type !== 'text' ? '📎 Файл' : '')}
                  </span>
                  {chat.unread_count > 0 && (
                    <span style={{
                      background:'var(--accent)', color:'#fff', borderRadius:12,
                      minWidth:20, height:20, padding:'0 5px', fontSize:11, fontWeight:700,
                      display:'grid', placeItems:'center', flexShrink:0, marginLeft:6,
                    }}>{chat.unread_count}</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Story viewer */}
      {storyOpen && (
        <div onClick={()=>setStoryOpen(null)} style={{ position:'fixed', inset:0, zIndex:200, background:'rgba(0,0,0,.9)', display:'grid', placeItems:'center' }}>
          <div onClick={e=>e.stopPropagation()} style={{
            width:340, height:580, borderRadius:24, overflow:'hidden', position:'relative',
            background: storyOpen.bg_color || '#1E1813',
          }}>
            {storyOpen.media_url && (
              storyOpen.type === 'video'
                ? <video src={storyOpen.media_url} autoPlay muted loop style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                : <img src={storyOpen.media_url} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
            )}
            {storyOpen.text && (
              <div style={{
                position:'absolute', inset:0, display:'grid', placeItems:'center',
                color: storyOpen.text_color || '#fff', fontSize:26, fontWeight:800,
                textAlign:'center', padding:28,
              }}>{storyOpen.text}</div>
            )}
            <div style={{ position:'absolute', top:14, left:14, display:'flex', alignItems:'center', gap:8 }}>
              <div style={{ width:34, height:34, borderRadius:17, background:'rgba(255,255,255,.2)', display:'grid', placeItems:'center', fontSize:18 }}>
                {storyOpen.avatar_url ? <img src={storyOpen.avatar_url} style={{ width:'100%', height:'100%', borderRadius:17 }}/> : '👤'}
              </div>
              <span style={{ color:'#fff', fontWeight:700, fontSize:14 }}>{storyOpen.name}</span>
            </div>
            <button onClick={()=>setStoryOpen(null)} style={{ position:'absolute', top:14, right:14, color:'#fff', fontSize:22, background:'rgba(255,255,255,.2)', borderRadius:16, width:34, height:34, display:'grid', placeItems:'center' }}>✕</button>
          </div>
        </div>
      )}

      {/* New group modal */}
      {newGroupOpen && <NewGroupModal onClose={()=>setNewGroupOpen(false)} onCreated={(id)=>{ setNewGroupOpen(false); setActiveChat(id); chatsApi.list().then(r=>setChats(r.data)); }} />}
    </aside>
  );
}

function NewGroupModal({ onClose, onCreated }: { onClose:()=>void; onCreated:(id:string)=>void }) {
  const [name, setName] = useState('');
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [selected, setSelected] = useState<any[]>([]);

  useEffect(() => {
    if (!search.trim()) { setResults([]); return; }
    const t = setTimeout(()=>usersApi.search(search).then(r=>setResults(r.data)), 300);
    return ()=>clearTimeout(t);
  }, [search]);

  async function create() {
    if (!name.trim()) return;
    const r = await chatsApi.group(name, selected.map(u=>u.id));
    onCreated(r.data.id);
  }

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:100, background:'rgba(0,0,0,.6)', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div onClick={e=>e.stopPropagation()} style={{ width:380, maxWidth:'94vw', background:'var(--panel)', borderRadius:20, padding:24, border:'1px solid var(--border)' }}>
        <h3 style={{ fontWeight:800, fontSize:18, marginBottom:18 }}>👥 Новая группа</h3>
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="Название группы"
          style={{ width:'100%', background:'var(--bg)', border:'1px solid var(--border)', color:'var(--text)', borderRadius:12, padding:'11px 14px', fontSize:14, marginBottom:14 }} />
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Найти участников…"
          style={{ width:'100%', background:'var(--bg)', border:'1px solid var(--border)', color:'var(--text)', borderRadius:12, padding:'11px 14px', fontSize:14 }} />
        {results.map(u=>(
          <div key={u.id} onClick={()=>{ if(!selected.find(s=>s.id===u.id)) setSelected(p=>[...p,u]); }} style={{ display:'flex', gap:10, padding:'10px 0', cursor:'pointer', alignItems:'center', opacity: selected.find(s=>s.id===u.id)?0.5:1 }}>
            <div style={{ width:34, height:34, borderRadius:17, background:'var(--bg)', display:'grid', placeItems:'center', fontSize:18 }}>👤</div>
            <div><div style={{ fontWeight:600, fontSize:14 }}>{u.name}</div><div style={{ color:'var(--dim)', fontSize:12 }}>@{u.username}</div></div>
          </div>
        ))}
        {selected.length > 0 && (
          <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginTop:12, marginBottom:4 }}>
            {selected.map(u=>(
              <span key={u.id} onClick={()=>setSelected(p=>p.filter(x=>x.id!==u.id))} style={{ background:'var(--accent)22', color:'var(--accent)', borderRadius:12, padding:'4px 10px', fontSize:13, cursor:'pointer', border:'1px solid var(--accent)44' }}>{u.name} ✕</span>
            ))}
          </div>
        )}
        <div style={{ display:'flex', gap:10, marginTop:18 }}>
          <button onClick={onClose} style={{ flex:1, padding:'11px', borderRadius:12, border:'1px solid var(--border)', color:'var(--dim)', fontSize:14 }}>Отмена</button>
          <button onClick={create} disabled={!name.trim()} style={{ flex:1, padding:'11px', borderRadius:12, background:'var(--accent)', color:'#fff', fontSize:14, fontWeight:700, opacity: name.trim()?1:.5 }}>Создать</button>
        </div>
      </div>
    </div>
  );
}
