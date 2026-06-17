import { useState, useEffect, useRef } from 'react';
import { api } from '../api/client';
import { useStore } from '../state/store';
import { useTheme } from '../state/theme';

interface Room { id:string; name:string; type:string; topic?:string; slug:string; member_count:number; }

interface Props { onClose: () => void; }

export default function Rooms({ onClose }: Props) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [active, setActive] = useState<any>(null);
  const [type, setType] = useState<'music'|'watch'>('music');
  const { accent } = useTheme();

  useEffect(() => {
    api.get(`/rooms?type=${type}`).then(r=>setRooms(r.data)).catch(()=>{});
  }, [type]);

  async function join(slug: string) {
    await api.post(`/rooms/join/${slug}`);
    const { id } = rooms.find(r=>r.slug===slug)!;
    const r = await api.get(`/rooms/${id}`);
    setActive(r.data);
  }

  async function create() {
    const name = prompt(`Название ${type==='music'?'музыкальной':'смотровой'} комнаты:`);
    if (!name) return;
    const r = await api.post('/rooms', { type, name });
    const detail = await api.get(`/rooms/${r.data.id}`);
    setActive(detail.data);
  }

  if (active) return <RoomView room={active} onLeave={()=>setActive(null)} />;

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:80, background:'rgba(0,0,0,.6)', display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
      <div onClick={e=>e.stopPropagation()} style={{
        width:'100%', maxWidth:500, height:'70vh', background:'var(--panel)',
        borderRadius:'20px 20px 0 0', display:'flex', flexDirection:'column',
        animation:'slideInUp .22s ease',
      }}>
        <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border)' }}>
          <h3 style={{ fontWeight:800, fontSize:18 }}>🎵 Комнаты</h3>
          <div style={{ display:'flex', gap:8, marginTop:12 }}>
            {(['music','watch'] as const).map(t=>(
              <button key={t} onClick={()=>setType(t)} style={{
                background: type===t ? 'var(--accent)' : 'var(--bg)',
                color: type===t ? '#fff' : 'var(--dim)',
                border:'none', borderRadius:12, padding:'7px 16px', fontSize:13, fontWeight:600,
              }}>{t==='music'?'🎵 Музыка':'📺 Смотреть'}</button>
            ))}
            <button onClick={create} style={{ marginLeft:'auto', background:'var(--accent)22', color:'var(--accent)', border:`1px solid var(--accent)40`, borderRadius:12, padding:'7px 14px', fontSize:13, fontWeight:600 }}>+ Создать</button>
          </div>
        </div>
        <div style={{ flex:1, overflowY:'auto', padding:16, display:'flex', flexDirection:'column', gap:10 }}>
          {rooms.length === 0 && <div style={{ color:'var(--dim)', textAlign:'center', marginTop:40 }}>Комнат нет. Создай первую!</div>}
          {rooms.map(r=>(
            <div key={r.id} onClick={()=>join(r.slug)} style={{
              background:'var(--bg)', borderRadius:16, padding:'14px 16px', cursor:'pointer',
              border:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center',
            }}>
              <div>
                <div style={{ fontWeight:700 }}>{r.name}</div>
                {r.topic && <div style={{ color:'var(--dim)', fontSize:13, marginTop:3 }}>{r.topic}</div>}
              </div>
              <div style={{ color:'var(--dim)', fontSize:13 }}>👥 {r.member_count}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RoomView({ room, onLeave }: { room: any; onLeave: () => void }) {
  const socket = useStore(s=>s.socket);
  const user   = useStore(s=>s.user);
  const { accent } = useTheme();
  const [msgs, setMsgs] = useState<any[]>(room.messages || []);
  const [text, setText] = useState('');
  const [members, setMembers] = useState<any[]>(room.members || []);
  const [playback, setPlayback] = useState(room.playback_state || {});
  const [url, setUrl] = useState(playback.url || '');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    socket?.emit('room:join', { roomId: room.id });
    socket?.on('room:message', (m: any) => setMsgs(p=>[...p, m]));
    socket?.on('room:user_joined', ({ user: u }: any) => setMembers(p=>[...p, u]));
    socket?.on('room:user_left', ({ userId }: any) => setMembers(p=>p.filter((m:any)=>m.user_id!==userId)));
    socket?.on('room:playback', ({ state }: any) => setPlayback(state));
    return () => {
      socket?.emit('room:leave', { roomId: room.id });
      socket?.off('room:message');
      socket?.off('room:user_joined');
      socket?.off('room:user_left');
      socket?.off('room:playback');
    };
  }, []);

  useEffect(() => { if(scrollRef.current) scrollRef.current.scrollTop=scrollRef.current.scrollHeight; }, [msgs]);

  function sendMsg() {
    if (!text.trim()) return;
    socket?.emit('room:message', { roomId: room.id, text: text.trim() });
    setText('');
  }

  function setMedia(newUrl: string) {
    const state = { url: newUrl, playing: true, time: 0, setAt: Date.now() };
    socket?.emit('room:playback', { roomId: room.id, state });
    setPlayback(state);
  }

  return (
    <div style={{ position:'fixed', inset:0, zIndex:80, background:'#0D0A08', display:'flex', flexDirection:'column' }}>
      {/* Шапка */}
      <div style={{ padding:'14px 20px', borderBottom:'1px solid #2E251D', display:'flex', alignItems:'center', gap:12 }}>
        <button onClick={onLeave} style={{ color:'var(--dim)', fontSize:22 }}>‹</button>
        <div style={{ flex:1 }}>
          <div style={{ fontWeight:800 }}>{room.name}</div>
          <div style={{ color:'var(--dim)', fontSize:13 }}>👥 {members.length} участников</div>
        </div>
      </div>

      <div style={{ flex:1, display:'flex', overflow:'hidden' }}>
        {/* Плеер / видео */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', padding:16, gap:12 }}>
          {room.type === 'watch' && playback.url ? (
            <iframe src={playback.url.includes('youtube') ? playback.url.replace('watch?v=','embed/') : playback.url}
              style={{ flex:1, border:'none', borderRadius:16 }} allowFullScreen />
          ) : (
            <div style={{ flex:1, background:'#1E1813', borderRadius:16, display:'grid', placeItems:'center' }}>
              {room.type === 'music' ? (
                <div style={{ textAlign:'center' }}>
                  <div style={{ fontSize:60 }}>🎵</div>
                  <p style={{ color:'var(--dim)', marginTop:12 }}>Синхронное аудио</p>
                </div>
              ) : (
                <div style={{ textAlign:'center' }}>
                  <div style={{ fontSize:60 }}>📺</div>
                  <p style={{ color:'var(--dim)', marginTop:12 }}>Вставь YouTube-ссылку ниже</p>
                </div>
              )}
            </div>
          )}

          {/* Управление URL */}
          <div style={{ display:'flex', gap:8 }}>
            <input value={url} onChange={e=>setUrl(e.target.value)} onKeyDown={e=>e.key==='Enter'&&setMedia(url)}
              placeholder={room.type==='music'?'Ссылка на аудио…':'Ссылка на YouTube…'}
              style={{ flex:1, background:'#1E1813', border:'1px solid #2E251D', color:'var(--text)', borderRadius:12, padding:'10px 14px', fontSize:14 }} />
            <button onClick={()=>setMedia(url)} style={{ background:'var(--accent)', color:'#fff', borderRadius:12, padding:'10px 16px', fontWeight:700 }}>▶</button>
          </div>
        </div>

        {/* Чат */}
        <div style={{ width:260, borderLeft:'1px solid #2E251D', display:'flex', flexDirection:'column' }}>
          <div ref={scrollRef} style={{ flex:1, overflowY:'auto', padding:12, display:'flex', flexDirection:'column', gap:8 }}>
            {msgs.map((m,i)=>(
              <div key={i}>
                <span style={{ color:'var(--accent)', fontSize:12, fontWeight:700 }}>{m.user_name}: </span>
                <span style={{ fontSize:13 }}>{m.text}</span>
              </div>
            ))}
          </div>
          <div style={{ padding:10, borderTop:'1px solid #2E251D', display:'flex', gap:8 }}>
            <input value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sendMsg()}
              placeholder="Сообщение…" style={{ flex:1, background:'#1E1813', border:'1px solid #2E251D', color:'var(--text)', borderRadius:10, padding:'8px 12px', fontSize:14 }} />
            <button onClick={sendMsg} style={{ background:'var(--accent)', color:'#fff', borderRadius:10, padding:'8px 12px' }}>➤</button>
          </div>
        </div>
      </div>
    </div>
  );
}
