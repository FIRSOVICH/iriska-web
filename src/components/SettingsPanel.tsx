import { useStore } from '../state/store';
import { ACCENTS, FONTS } from '../state/theme';
import { profilesApi } from '../api/client';

const COZY = ['off','rain','snow','fire','stars','soft'] as const;
const COZY_LABELS: Record<string, string> = { off:'Выкл', rain:'🌧 Дождь', snow:'❄️ Снег', fire:'🔥 Камин', stars:'✨ Звёзды', soft:'🌸 Мягкий' };

interface Props { onClose: () => void; }

export default function SettingsPanel({ onClose }: Props) {
  const { theme, setTheme } = useStore();

  function change(k: Partial<typeof theme>) {
    setTheme(k);
    profilesApi.updateTheme({
      theme: k.mode,
      font: k.font,
      accentColor: k.accent,
      bubbleStyle: k.bubble,
      cozyMode: k.cozy,
    }).catch(() => {});
  }

  return (
    <Drawer title="⚙️ Оформление" onClose={onClose}>
      <Section label="Тема">
        <div style={{ display:'flex', gap:8 }}>
          {(['dark','light'] as const).map(m => (
            <Chip key={m} active={theme.mode===m} onClick={()=>change({mode:m})}>
              {m==='dark' ? '🌙 Тёмная' : '☀️ Светлая'}
            </Chip>
          ))}
        </div>
      </Section>

      <Section label="Акцент">
        <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
          {Object.entries(ACCENTS).map(([k, a]) => (
            <div key={k} onClick={()=>change({accent:k})} title={a.name} style={{
              width:34, height:34, borderRadius:17, background:a.c, cursor:'pointer',
              border: theme.accent===k ? '3px solid var(--text)' : '2px solid transparent',
              boxShadow:'0 2px 8px rgba(0,0,0,.35)',
              transform: theme.accent===k ? 'scale(1.15)' : 'scale(1)',
              transition:'all .15s',
            }} />
          ))}
        </div>
        <div style={{ marginTop:8, color:'var(--dim)', fontSize:13 }}>
          {ACCENTS[theme.accent]?.name}
        </div>
      </Section>

      <Section label="Пузырьки">
        <div style={{ display:'flex', gap:8 }}>
          <Chip active={theme.bubble==='round'}   onClick={()=>change({bubble:'round'})}>Скруглённые</Chip>
          <Chip active={theme.bubble==='classic'} onClick={()=>change({bubble:'classic'})}>Классические</Chip>
        </div>
      </Section>

      <Section label="Шрифт">
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          {FONTS.map(f => (
            <Chip key={f} active={theme.font===f} onClick={()=>change({font:f})} style={{ fontFamily:f }}>
              {f}
            </Chip>
          ))}
        </div>
      </Section>

      <Section label="🕯 Уютный режим">
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          {COZY.map(m => (
            <Chip key={m} active={theme.cozy===m} onClick={()=>change({cozy:m})}>
              {COZY_LABELS[m]}
            </Chip>
          ))}
        </div>
        <p style={{ color:'var(--dim)', fontSize:12, marginTop:10, lineHeight:1.6 }}>
          Canvas-анимация поверх интерфейса. Работает везде — даже во время звонка.
        </p>
      </Section>

      <div style={{ marginTop:24, padding:'16px', background:'var(--bg)', borderRadius:14,
        border:'1px solid var(--border)', fontSize:13, color:'var(--dim)', lineHeight:1.7 }}>
        <strong style={{ color:'var(--text)' }}>Горячие клавиши</strong><br/>
        <kbd>Ctrl+Enter</kbd> — отправить<br/>
        <kbd>↑</kbd> — редактировать последнее<br/>
        <kbd>Esc</kbd> — отмена ответа / правки
      </div>
    </Drawer>
  );
}

// ── Helpers ──────────────────────────────────────────────
function Drawer({ title, onClose, children }: { title:string; onClose:()=>void; children:React.ReactNode }) {
  return (
    <div onClick={onClose} style={{
      position:'fixed', inset:0, zIndex:90, background:'rgba(0,0,0,.5)',
      display:'flex', justifyContent:'flex-end',
    }}>
      <div onClick={e=>e.stopPropagation()} style={{
        width:380, maxWidth:'92vw', height:'100%',
        background:'var(--panel)', borderLeft:'1px solid var(--border)',
        padding:22, overflowY:'auto',
        animation:'slideInRight .22s ease',
      }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:22 }}>
          <h2 style={{ fontSize:22, fontWeight:800 }}>{title}</h2>
          <button onClick={onClose} style={{ fontSize:22, color:'var(--dim)', padding:4 }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Section({ label, children }: { label:string; children:React.ReactNode }) {
  return (
    <div style={{ marginBottom:22 }}>
      <div style={{ color:'var(--dim)', fontSize:12, fontWeight:700, letterSpacing:.8,
        textTransform:'uppercase', marginBottom:10 }}>{label}</div>
      {children}
    </div>
  );
}

function Chip({ active, onClick, children, style }: {
  active:boolean; onClick:()=>void; children:React.ReactNode; style?: React.CSSProperties;
}) {
  return (
    <button onClick={onClick} style={{
      background: active ? 'var(--accent)22' : 'transparent',
      color: active ? 'var(--text)' : 'var(--dim)',
      border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
      borderRadius:16, padding:'7px 14px', fontSize:13,
      fontWeight: active ? 700 : 400,
      transition:'all .15s',
      ...style,
    }}>{children}</button>
  );
}
