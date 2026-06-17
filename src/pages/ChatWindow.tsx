import { useState, useEffect, useRef, useCallback } from 'react';
import { useStore } from '../state/store';
import { messagesApi, chatsApi, e2eApi, pokesApi } from '../api/client';
import { useTheme } from '../state/theme';
import { useCall } from '../hooks/useCall';
import { encryptMessage, decryptMessage, getPublicKeyBase64 } from '../crypto/e2e';
import GroupCall from '../components/GroupCall';
import SharedNote from '../components/SharedNote';
import Poll from '../components/Poll';

const REACTIONS = ['❤️','😂','🔥','👍','😮','😢','🎉','🤗'];
const POKES = [['👉','Тknуть','poke'],['👋','Помахать','wave'],['☕','Кофе','coffee'],['🎮','В игру','game'],['📞','Позвонить','call'],['🤗','Обнять','hug']];

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('ru-RU', { hour:'2-digit', minute:'2-digit' });
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('ru-RU', { day:'numeric', month:'long' });
}

export default function ChatWindow() {
  const { user, messages: allMsgs, activeChat: chatId, chats, typing, online, setActiveChat, setMessages, addMessage, editMessage, deleteMessage, socket } = useStore();
  const { accent } = useTheme();

  const chat = chats.find(c=>c.id===chatId);
  const msgs = allMsgs[chatId!] || [];
  const peer = chat?.peer;

  const [draft, setDraft] = useState('');
  const [reply, setReply] = useState<any>(null);
  const [editing, setEditing] = useState<string|null>(null);
  const [reactFor, setReactFor] = useState<string|null>(null);
  const [showPokes, setShowPokes] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const [showPoll, setShowPoll] = useState(false);
  const [polls, setPolls] = useState<any[]>([]);
  const [groupCallId, setGroupCallId] = useState<string|null>(null);
  const [incomingCall, setIncomingCall] = useState<any>(null);
  const [toast, setToast] = useState('');

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout>>();
  const fileRef = useRef<HTMLInputElement>(null);

  const { callState, localVideoRef, remoteVideoRef, startCall, answerCall, endCall, toggleMute, toggleVideo, handleIncoming } = useCall();

  const showToast = (m: string) => { setToast(m); setTimeout(()=>setToast(''), 2200); };

  // Загрузка сообщений при смене чата
  useEffect(() => {
    if (!chatId) return;
    setDraft(''); setReply(null); setEditing(null);
    if (allMsgs[chatId]) return;
    messagesApi.list(chatId).then(r => setMessages(chatId, r.data));
    // Отмечаем прочитанными
    if (msgs.length) {
      const last = msgs[msgs.length-1];
      messagesApi.read(chatId, last.id).catch(()=>{});
    }
  }, [chatId]);

  // Автоскролл
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs.length, typing[chatId!]]);

  // Чтение при появлении новых сообщений
  useEffect(() => {
    if (!chatId || !msgs.length) return;
    const last = msgs[msgs.length-1];
    if (last.user_id !== user?.id) {
      messagesApi.read(chatId, last.id).catch(()=>{});
      socket?.emit('chat:read', { chatId, upToMessageId: last.id });
    }
  }, [msgs.length]);

  // Входящий звонок
  useEffect(() => {
    if (!socket) return;
    socket.on('call:incoming', (data: any) => {
      setIncomingCall(data);
      handleIncoming(data);
    });
    socket.on('call:ended', () => endCall());
    socket.on('call:declined', () => { endCall(); showToast('Звонок отклонён'); });
    return () => { socket.off('call:incoming'); socket.off('call:ended'); socket.off('call:declined'); };
  }, [socket]);

  // Отправка
  async function send() {
    const text = draft.trim();
    if (!text || !chatId) return;

    if (editing) {
      socket?.emit('chat:edit', { chatId, messageId: editing, text });
      editMessage(chatId, editing, text);
      setEditing(null); setDraft(''); return;
    }

    // E2E шифрование
    let ciphertext: string | undefined;
    if (chat?.e2e_enabled && peer) {
      try {
        const keys = await e2eApi.getKeys(peer.id);
        if (keys.data[0]) {
          ciphertext = encryptMessage(text, keys.data[0].public_key);
        }
      } catch {}
    }

    const msg = { type:'text' as const, text, replyToId: reply?.id, e2eCiphertext: ciphertext };
    socket?.emit('chat:send', { chatId, ...msg });

    // Оптимистичный апдейт
    addMessage(chatId, {
      id: `tmp-${Date.now()}`, chat_id: chatId, user_id: user!.id, type:'text', text,
      reply_to: reply ? { id:reply.id, text:reply.text, user_name:'' } : null,
      reactions:[], is_edited:false, is_deleted:false,
      user_name: user!.name, username: user!.username,
      created_at: new Date().toISOString(),
    });

    setDraft(''); setReply(null);
  }

  // Typing indicator
  function onDraftChange(v: string) {
    setDraft(v);
    if (!chatId) return;
    socket?.emit('chat:typing', { chatId, isTyping: true });
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(()=>{
      socket?.emit('chat:typing', { chatId, isTyping: false });
    }, 3000);
  }

  // Загрузка файла
  async function uploadFile(file: File) {
    if (!chatId) return;
    const type = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : file.type.startsWith('audio/') ? 'audio' : 'file';
    await messagesApi.upload(chatId, file, type);
    const updated = await messagesApi.list(chatId);
    setMessages(chatId, updated.data);
  }

  // Реакция
  function react(msgId: string, emoji: string) {
    if (!chatId) return;
    socket?.emit('chat:react', { chatId, messageId: msgId, emoji });
    setReactFor(null);
  }

  // Удаление
  function delMsg(msgId: string) {
    if (!chatId) return;
    socket?.emit('chat:delete', { chatId, messageId: msgId });
    deleteMessage(chatId, msgId);
  }

  // Тычок
  async function poke(type: string, label: string, emoji: string) {
    if (!peer) return;
    try {
      socket?.emit('iriska:poke', { toId: peer.id, type });
      showToast(`${emoji} «${label}» отправлено!`);
    } catch { showToast('Подождите 30 секунд'); }
    setShowPokes(false);
  }

  // Клавиши
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
    if (e.key === 'Escape') { setReply(null); setEditing(null); setDraft(''); }
    if (e.key === 'ArrowUp' && !draft) {
      const myLast = [...msgs].reverse().find(m=>m.user_id===user?.id && !m.is_deleted);
      if (myLast) { setEditing(myLast.id); setDraft(myLast.text||''); }
    }
  }

  const typingUsers = (typing[chatId!] || []).filter(id=>id!==user?.id);
  const isOnline = peer ? online[peer.id] : false;

  // Группируем сообщения по дням
  const grouped: Array<{date:string; msgs:typeof msgs}> = [];
  let curDate = '';
  msgs.forEach(m => {
    const d = fmtDate(m.created_at);
    if (d !== curDate) { curDate = d; grouped.push({ date:d, msgs:[] }); }
    grouped[grouped.length-1].msgs.push(m);
  });

  if (groupCallId) return <GroupCall callId={groupCallId} chatId={chatId!} onLeave={()=>setGroupCallId(null)} />;

  return (
    <main style={{ flex:1, display:'flex', flexDirection:'column', height:'100%', position:'relative', zIndex:10, background:'var(--chat-bg)' }}>
      {/* Шапка */}
      <div style={{ padding:'11px 16px', display:'flex', alignItems:'center', gap:12, borderBottom:'1px solid var(--border)', background:'var(--panel)' }}>
        <button onClick={()=>setActiveChat(null)} style={{ display:'none', '@media(max-width:768px)':{ display:'grid' } as any, color:'var(--dim)', fontSize:22 }}>‹</button>
        <div style={{ width:40, height:40, borderRadius:20, background:'var(--bg)', display:'grid', placeItems:'center', fontSize:20, flexShrink:0, overflow:'hidden' }}>
          {peer?.avatar_url ? <img src={peer.avatar_url} style={{ width:'100%', height:'100%' }}/> : chat?.type==='dm'?'👤':'👥'}
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontWeight:700, fontSize:15, display:'flex', gap:6, alignItems:'center' }}>
            {chat?.type==='dm' ? peer?.name : chat?.name}
            {chat?.e2e_enabled && <span title="E2E шифрование" style={{ fontSize:13 }}>🔒</span>}
          </div>
          <div style={{ fontSize:12, color: typingUsers.length ? accent.c : 'var(--dim)' }}>
            {typingUsers.length > 0 ? 'печатает…' : isOnline ? '🟢 в сети' : 'не в сети'}
          </div>
        </div>
        {/* Тычки */}
        {chat?.type==='dm' && (
          <button onClick={()=>setShowPokes(!showPokes)} title="Взаимодействие" style={{ color:'var(--dim)', fontSize:18, padding:6 }}>👋</button>
        )}
        <button onClick={()=>setShowNote(true)} title="Заметка" style={{ color:'var(--dim)', fontSize:18, padding:6 }}>📝</button>
        {chat?.type==='dm' && (
          <>
            <button onClick={()=>startCall(peer!.id,'audio')} title="Звонок" style={{ color:'var(--dim)', fontSize:18, padding:6 }}>📞</button>
            <button onClick={()=>startCall(peer!.id,'video')} title="Видеозвонок" style={{ color:'var(--dim)', fontSize:18, padding:6 }}>🎥</button>
          </>
        )}
        {chat?.type!=='dm' && (
          <button onClick={()=>{ const id=crypto.randomUUID(); setGroupCallId(id); }} title="Групповой звонок" style={{ color:'var(--dim)', fontSize:18, padding:6 }}>📞</button>
        )}
      </div>

      {/* Попап тычков */}
      {showPokes && (
        <div style={{ position:'absolute', top:64, right:16, zIndex:50, background:'var(--panel)', border:'1px solid var(--border)', borderRadius:18, padding:12, display:'flex', flexWrap:'wrap', gap:8, maxWidth:260, boxShadow:'0 10px 30px rgba(0,0,0,.35)' }}>
          {POKES.map(([e,l,t])=>(
            <button key={t} onClick={()=>poke(t,l,e)} style={{ background:'var(--bg)', border:'1px solid var(--border)', color:'var(--text)', borderRadius:12, padding:'7px 12px', fontSize:13 }}>{e} {l}</button>
          ))}
        </div>
      )}

      {/* E2E баннер */}
      {chat?.e2e_enabled && (
        <div style={{ alignSelf:'center', background:`${accent.c}18`, border:`1px solid ${accent.c}40`, borderRadius:20, padding:'4px 14px', fontSize:12, color:accent.c, margin:'8px 0 0' }}>
          🔒 Сообщения зашифрованы E2E · ключ только у вас
        </div>
      )}

      {/* Сообщения */}
      <div ref={scrollRef} style={{ flex:1, overflowY:'auto', padding:'12px 16px', display:'flex', flexDirection:'column', gap:4 }}
        onClick={()=>{ setReactFor(null); setShowPokes(false); }}>
        {grouped.map(({ date, msgs: gMsgs }) => (
          <div key={date}>
            <div style={{ textAlign:'center', color:'var(--dim)', fontSize:12, margin:'10px 0 8px', userSelect:'none' }}>
              <span style={{ background:'var(--panel)', padding:'3px 12px', borderRadius:12 }}>{date}</span>
            </div>
            {gMsgs.map(m => <MsgBubble key={m.id} m={m} isMine={m.user_id===user?.id} accent={accent}
              onReact={(e)=>react(m.id,e)} onReply={()=>{ setReply(m); inputRef.current?.focus(); }}
              onEdit={()=>{ setEditing(m.id); setDraft(m.text||''); inputRef.current?.focus(); }}
              onDelete={()=>delMsg(m.id)}
              reactFor={reactFor===m.id}
              onShowReact={()=>setReactFor(reactFor===m.id?null:m.id)}
              chatId={chatId!}
            />)}
          </div>
        ))}

        {typingUsers.length > 0 && (
          <div style={{ alignSelf:'flex-start', background:'var(--bubble-in)', padding:'10px 14px', borderRadius:18, borderBottomLeftRadius:4 }}>
            <span className="typing-dots"><span>•</span><span>•</span><span>•</span></span>
          </div>
        )}
      </div>

      {/* Ответ / правка */}
      {(reply || editing) && (
        <div style={{ margin:'0 12px', background:'var(--panel)', borderLeft:`3px solid ${accent.c}`, borderRadius:'0 10px 10px 0', padding:'8px 12px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ fontSize:13, color:'var(--dim)' }}>
            {editing ? '✏️ Редактирование сообщения' : `↩️ ${reply?.text?.slice(0,50)}`}
          </span>
          <button onClick={()=>{ setReply(null); setEditing(null); setDraft(''); }} style={{ color:'var(--dim)', fontSize:18 }}>✕</button>
        </div>
      )}

      {/* Поле ввода */}
      <div style={{ padding:12, borderTop:'1px solid var(--border)', background:'var(--panel)', display:'flex', gap:8, alignItems:'center' }}>
        <button onClick={()=>fileRef.current?.click()} style={{ color:'var(--dim)', fontSize:22, padding:4, flexShrink:0 }}>📎</button>
        <input ref={fileRef} type="file" hidden accept="image/*,video/*,audio/*,.pdf,.docx,.zip" onChange={e=>{ const f=e.target.files?.[0]; if(f) uploadFile(f); e.target.value=''; }} />
        <input
          ref={inputRef}
          value={draft}
          onChange={e=>onDraftChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={editing ? 'Редактировать…' : 'Сообщение… (Enter — отправить)'}
          style={{
            flex:1, background:'var(--bg)', border:'1px solid var(--border)', color:'var(--text)',
            borderRadius:18, padding:'11px 16px', fontSize:15,
          }}
        />
        <button onClick={send} disabled={!draft.trim()} style={{
          width:42, height:42, borderRadius:21, background: draft.trim() ? accent.c : 'var(--bg)',
          color: draft.trim() ? '#fff' : 'var(--dim)',
          display:'grid', placeItems:'center', fontSize:18, flexShrink:0,
          border:'none', transition:'all .15s',
        }}>➤</button>
      </div>

      {/* Активный звонок (1-на-1) */}
      {(callState==='calling'||callState==='active') && (
        <div style={{ position:'fixed', inset:0, zIndex:100, background:'#0D0A08', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
          <video ref={remoteVideoRef} autoPlay playsInline style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', zIndex:1 }}/>
          <video ref={localVideoRef} autoPlay playsInline muted style={{ position:'absolute', right:16, bottom:100, width:120, height:180, borderRadius:16, objectFit:'cover', zIndex:2, border:`2px solid ${accent.c}` }}/>
          <div style={{ position:'absolute', bottom:0, left:0, right:0, zIndex:3, padding:'20px 0', display:'flex', gap:16, justifyContent:'center', background:'linear-gradient(transparent,rgba(0,0,0,.6))' }}>
            <CallBtn icon="🎤" label="Микр." onClick={toggleMute}/>
            <CallBtn icon="📹" label="Камера" onClick={toggleVideo}/>
            <button onClick={endCall} style={{ width:64, height:64, borderRadius:32, background:'#E25670', border:'none', fontSize:26, cursor:'pointer', display:'grid', placeItems:'center' }}>📞</button>
          </div>
        </div>
      )}

      {/* Входящий звонок */}
      {callState==='incoming' && incomingCall && (
        <div style={{ position:'fixed', bottom:24, right:24, zIndex:200, background:'var(--panel)', border:`1px solid ${accent.c}`, borderRadius:20, padding:20, minWidth:240, boxShadow:'0 20px 60px rgba(0,0,0,.5)' }}>
          <div style={{ fontWeight:800, marginBottom:6 }}>Входящий звонок</div>
          <div style={{ color:'var(--dim)', fontSize:14, marginBottom:14 }}>{incomingCall.caller?.name}</div>
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={()=>answerCall(incomingCall.callId, incomingCall.offer, incomingCall.type)}
              style={{ flex:1, background:'#46C2A0', color:'#fff', borderRadius:12, padding:'10px', fontWeight:700 }}>Принять</button>
            <button onClick={()=>{ socket?.emit('call:decline',{callId:incomingCall.callId}); setIncomingCall(null); }}
              style={{ flex:1, background:'#E25670', color:'#fff', borderRadius:12, padding:'10px', fontWeight:700 }}>Отклонить</button>
          </div>
        </div>
      )}

      {/* Заметка */}
      {showNote && chatId && <SharedNote chatId={chatId} onClose={()=>setShowNote(false)}/>}

      {toast && (
        <div style={{ position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)', zIndex:300, background:'var(--panel)', border:'1px solid var(--border)', color:'var(--text)', padding:'10px 18px', borderRadius:22, fontSize:14, boxShadow:'0 10px 30px rgba(0,0,0,.4)', whiteSpace:'nowrap' }}>
          {toast}
        </div>
      )}
    </main>
  );
}

// ── Пузырь сообщения ────────────────────────────────────
function MsgBubble({ m, isMine, accent, onReact, onReply, onEdit, onDelete, reactFor, onShowReact, chatId }: {
  m:any; isMine:boolean; accent:any; onReact:(e:string)=>void;
  onReply:()=>void; onEdit:()=>void; onDelete:()=>void;
  reactFor:boolean; onShowReact:()=>void; chatId:string;
}) {
  const { bubble } = useStore(s=>s.theme);
  const r = bubble === 'round' ? 18 : 8;

  const groupedReactions: Record<string, number> = {};
  (m.reactions||[]).forEach((r: any) => { groupedReactions[r.emoji] = (groupedReactions[r.emoji]||0)+1; });

  if (m.is_deleted) return (
    <div style={{ alignSelf: isMine?'flex-end':'flex-start', color:'var(--dim)', fontSize:13, fontStyle:'italic', padding:'6px 0' }}>сообщение удалено</div>
  );

  return (
    <div className="msg-bubble" style={{ alignSelf: isMine?'flex-end':'flex-start', maxWidth:'72%' }}>
      {!isMine && <div style={{ fontSize:11, color:'var(--dim)', marginBottom:3, marginLeft:4 }}>{m.user_name}</div>}
      <div
        onDoubleClick={onShowReact}
        style={{
          background: isMine ? accent.c : 'var(--bubble-in)',
          color: isMine ? '#fff' : 'var(--text)',
          padding:'9px 13px', fontSize:14.5, lineHeight:1.45, wordBreak:'break-word',
          borderRadius:r,
          borderBottomRightRadius: isMine ? Math.min(r,5) : r,
          borderBottomLeftRadius:  !isMine ? Math.min(r,5) : r,
          boxShadow:'0 1px 3px rgba(0,0,0,.12)',
          position:'relative',
        }}
      >
        {/* Ответ */}
        {m.reply_to && (
          <div style={{ borderLeft:`2px solid ${isMine?'rgba(255,255,255,.6)':accent.c}`, paddingLeft:8, marginBottom:6, fontSize:12.5, opacity:.85 }}>
            {m.reply_to.text?.slice(0,80)}
          </div>
        )}

        {/* Медиа */}
        {m.type==='image' && m.file_url && (
          <img src={m.file_url} style={{ maxWidth:260, borderRadius:10, display:'block', marginBottom:m.text?6:0 }} onClick={()=>window.open(m.file_url,'_blank')}/>
        )}
        {m.type==='video' && m.file_url && (
          <video src={m.file_url} controls style={{ maxWidth:260, borderRadius:10, display:'block', marginBottom:m.text?6:0 }}/>
        )}
        {m.type==='audio' && m.file_url && (
          <audio src={m.file_url} controls style={{ display:'block', marginBottom:m.text?6:0, maxWidth:240 }}/>
        )}
        {m.type==='file' && m.file_url && (
          <a href={m.file_url} download={m.file_name} style={{ display:'flex', gap:8, alignItems:'center', color:isMine?'#fff':accent.c, marginBottom:m.text?6:0 }}>
            📎 {m.file_name||'Файл'}
          </a>
        )}
        {m.type==='video_note' && m.file_url && (
          <video src={m.file_url} controls style={{ width:200, height:200, borderRadius:100, display:'block' }}/>
        )}

        {m.text && <span>{m.text}</span>}

        <span style={{ fontSize:10, opacity:.65, marginLeft:8, float:'right', marginTop:4 }}>
          {m.is_edited && 'ред. '}{fmtTime(m.created_at)}
          {isMine && <span style={{ marginLeft:3 }}>{m.read_by_count>0?'✓✓':'✓'}</span>}
        </span>

        {/* Действия при наведении */}
        <div className="actions" style={{
          position:'absolute', top:-12, [isMine?'left':'right']:-8,
          display:'flex', gap:2, background:'var(--panel)',
          border:'1px solid var(--border)', borderRadius:14, padding:3,
        }}>
          <MiniBtn onClick={onShowReact}>😊</MiniBtn>
          <MiniBtn onClick={onReply}>↩️</MiniBtn>
          {isMine && <MiniBtn onClick={onEdit}>✏️</MiniBtn>}
          {isMine && <MiniBtn onClick={onDelete}>🗑️</MiniBtn>}
        </div>

        {/* Пикер реакций */}
        {reactFor && (
          <div style={{
            position:'absolute', bottom:'100%', [isMine?'right':'left']:0, zIndex:30,
            background:'var(--panel)', border:'1px solid var(--border)',
            borderRadius:24, padding:6, display:'flex', gap:2, boxShadow:'0 8px 24px rgba(0,0,0,.3)',
            marginBottom:4,
          }}>
            {REACTIONS.map(e=>( <span key={e} onClick={()=>onReact(e)} style={{ cursor:'pointer', fontSize:20, padding:3, borderRadius:8, transition:'transform .1s' }}>{e}</span> ))}
          </div>
        )}
      </div>

      {/* Реакции под сообщением */}
      {Object.keys(groupedReactions).length > 0 && (
        <div style={{ display:'flex', gap:4, marginTop:4, justifyContent: isMine?'flex-end':'flex-start', flexWrap:'wrap' }}>
          {Object.entries(groupedReactions).map(([e,cnt])=>(
            <span key={e} onClick={()=>onReact(e)} className="reaction-chip">{e} {cnt}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function MiniBtn({ onClick, children }: { onClick:()=>void; children:React.ReactNode }) {
  return <span onClick={e=>{e.stopPropagation();onClick();}} style={{ cursor:'pointer', fontSize:14, padding:'2px 5px', borderRadius:8 }}>{children}</span>;
}

function CallBtn({ icon, label, onClick }: { icon:string; label:string; onClick:()=>void }) {
  return (
    <button onClick={onClick} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, background:'rgba(255,255,255,.1)', border:'none', borderRadius:16, padding:'10px 20px', cursor:'pointer', color:'#fff' }}>
      <span style={{ fontSize:24 }}>{icon}</span>
      <span style={{ fontSize:11 }}>{label}</span>
    </button>
  );
}
