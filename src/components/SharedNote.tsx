import { useState, useEffect } from 'react';
import { api } from '../api/client';

interface Props { chatId: string; onClose: () => void; }

export default function SharedNote({ chatId, onClose }: Props) {
  const [content, setContent] = useState('');
  const [saved, setSaved] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/chats/${chatId}/note`).then(r => {
      setContent(r.data.content || '');
    }).finally(() => setLoading(false));
  }, [chatId]);

  useEffect(() => {
    setSaved(false);
    const t = setTimeout(async () => {
      try {
        await api.put(`/chats/${chatId}/note`, { content });
        setSaved(true);
      } catch {}
    }, 800);
    return () => clearTimeout(t);
  }, [content]);

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:80, background:'rgba(0,0,0,.6)', display:'grid', placeItems:'center' }}>
      <div onClick={e=>e.stopPropagation()} style={{
        width:520, maxWidth:'94vw', height:'70vh',
        background:'var(--panel)', borderRadius:20,
        border:'1px solid var(--border)', display:'flex', flexDirection:'column',
        animation:'slideInUp .2s ease',
      }}>
        <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <h3 style={{ fontWeight:800, fontSize:17 }}>📝 Общая заметка</h3>
            <div style={{ fontSize:12, color:'var(--dim)', marginTop:2 }}>Редактируют все участники чата</div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <span style={{ fontSize:12, color: saved ? '#46C2A0' : 'var(--dim)' }}>
              {loading ? '' : saved ? '✓ Сохранено' : '…'}
            </span>
            <button onClick={onClose} style={{ color:'var(--dim)', fontSize:22 }}>✕</button>
          </div>
        </div>
        <textarea
          value={content}
          onChange={e=>setContent(e.target.value)}
          placeholder="Начни писать… Все участники видят изменения в реальном времени."
          disabled={loading}
          style={{
            flex:1, background:'transparent', border:'none', color:'var(--text)',
            padding:'18px 20px', fontSize:15, lineHeight:1.7, resize:'none',
            fontFamily:'var(--font)',
          }}
        />
      </div>
    </div>
  );
}
