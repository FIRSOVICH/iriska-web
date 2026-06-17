import { useState } from 'react';
import { api } from '../api/client';
import { useTheme } from '../state/theme';

interface Option { id: string; text: string; votes: number; voted: boolean; }
interface PollData { id: string; question: string; is_multiple: boolean; is_closed: boolean; options: Option[]; }

interface Props { poll: PollData; chatId: string; onVoted?: () => void; }

export default function Poll({ poll, chatId, onVoted }: Props) {
  const { accent } = useTheme();
  const [local, setLocal] = useState<PollData>(poll);
  const [selected, setSelected] = useState<string[]>(
    poll.options.filter(o=>o.voted).map(o=>o.id)
  );
  const [loading, setLoading] = useState(false);

  const total = local.options.reduce((s,o)=>s+o.votes, 0);

  function toggle(id: string) {
    if (local.is_closed) return;
    if (local.is_multiple) {
      setSelected(p => p.includes(id) ? p.filter(x=>x!==id) : [...p, id]);
    } else {
      setSelected([id]);
    }
  }

  async function vote() {
    if (!selected.length || loading) return;
    setLoading(true);
    try {
      await api.post(`/chats/${chatId}/polls/${local.id}/vote`, { optionIds: selected });
      // Обновляем локально
      setLocal(p => ({
        ...p,
        options: p.options.map(o => ({
          ...o,
          voted: selected.includes(o.id),
          votes: selected.includes(o.id) ? (o.voted ? o.votes : o.votes+1) : (o.voted ? o.votes-1 : o.votes),
        }))
      }));
      onVoted?.();
    } finally { setLoading(false); }
  }

  const hasVoted = local.options.some(o=>o.voted);

  return (
    <div style={{ background:'var(--bg)', borderRadius:16, padding:16, minWidth:240 }}>
      <div style={{ fontWeight:700, marginBottom:12, fontSize:15 }}>{local.question}</div>
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {local.options.map(o => {
          const pct = total > 0 ? Math.round((o.votes/total)*100) : 0;
          const isSelected = selected.includes(o.id);
          return (
            <div key={o.id} onClick={()=>toggle(o.id)} style={{
              position:'relative', overflow:'hidden', borderRadius:10,
              border:`1px solid ${isSelected ? accent.c : 'var(--border)'}`,
              padding:'9px 13px', cursor: local.is_closed ? 'default' : 'pointer',
              transition:'border-color .15s',
            }}>
              {/* Прогресс-бар */}
              {hasVoted && <div style={{
                position:'absolute', inset:0, background:`${accent.c}18`,
                width:`${pct}%`, borderRadius:10, pointerEvents:'none',
                transition:'width .4s ease',
              }}/>}
              <div style={{ position:'relative', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontSize:14 }}>
                  {isSelected && !hasVoted && <span style={{ marginRight:6, color:accent.c }}>✓</span>}
                  {o.text}
                </span>
                {hasVoted && <span style={{ fontSize:12, color:'var(--dim)', minWidth:36, textAlign:'right' }}>
                  {pct}% · {o.votes}
                </span>}
              </div>
            </div>
          );
        })}
      </div>
      {!hasVoted && !local.is_closed && (
        <button onClick={vote} disabled={!selected.length || loading} style={{
          marginTop:12, width:'100%', background:'var(--accent)', color:'#fff',
          borderRadius:10, padding:'9px', fontSize:14, fontWeight:700,
          opacity: (!selected.length||loading) ? .5 : 1,
        }}>
          {loading ? 'Отправка…' : 'Голосовать'}
        </button>
      )}
      <div style={{ marginTop:8, color:'var(--dim)', fontSize:12 }}>
        {total} {total===1?'голос':total<5?'голоса':'голосов'} · {local.is_closed ? 'Закрыт' : local.is_multiple ? 'Мультивыбор' : 'Один вариант'}
      </div>
    </div>
  );
}
