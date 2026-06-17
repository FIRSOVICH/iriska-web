import { useState, useEffect } from 'react';
import { useStore } from '../state/store';
import { profilesApi, usersApi, pokesApi, authApi } from '../api/client';
import { useTheme } from '../state/theme';

const STATUS_PRESETS = [
  ['online','В сети','🟢'], ['work','На работе','💼'], ['sleep','Сплю','😴'],
  ['dnd','Не беспоить','⛔'], ['coffee','Пью кофе','☕'], ['shift','На смене','🛠️'],
  ['gaming','Играю','🎮'], ['away','В дороге','🚗'],
];

const RARITY_COLOR: Record<string, string> = {
  common:'#8a9a8a', rare:'#5bba7a', epic:'#a87ee6', legendary:'#e0a93c',
};

interface Props { userId?: string; onClose: () => void; }

export default function ProfilePage({ userId, onClose }: Props) {
  const { user, logout, setTheme } = useStore();
  const { accent } = useTheme();
  const isSelf = !userId || userId === user?.id;
  const [profile, setProfile] = useState<any>(null);
  const [achievements, setAchievements] = useState<any[]>([]);
  const [editBio, setEditBio] = useState(false);
  const [bio, setBio] = useState('');
  const [toast, setToast] = useState('');

  useEffect(() => {
    const id = userId || user?.id;
    if (!id) return;
    profilesApi.get(id).then(r => {
      setProfile(r.data);
      setBio(r.data.bio || '');
    }).catch(()=>{});
    if (isSelf) {
      profilesApi.achievements().then(r => setAchievements(r.data)).catch(()=>{});
    }
  }, [userId]);

  const showToast = (m: string) => { setToast(m); setTimeout(()=>setToast(''), 2200); };

  async function setStatus(preset: string) {
    await profilesApi.updateMe({ statusPreset: preset });
    setProfile((p: any) => ({ ...p, status_preset: preset }));
  }

  async function saveBio() {
    await profilesApi.updateMe({ bio });
    setEditBio(false);
    setProfile((p: any) => ({ ...p, bio }));
    showToast('Биография сохранена');
  }

  async function poke(type: string, label: string, emoji: string) {
    if (!profile?.id) return;
    try {
      await pokesApi.send(profile.id, type);
      showToast(`${emoji} «${label}» отправлено!`);
    } catch (e: any) {
      showToast(e.response?.data?.error || 'Ошибка');
    }
  }

  async function uploadAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    await usersApi.uploadAvatar(f);
    setProfile((p: any) => ({ ...p, avatar_url: URL.createObjectURL(f) }));
    showToast('Аватар обновлён');
  }

  function doLogout() {
    const refresh = localStorage.getItem('iriska:refresh') || '';
    authApi.logout(refresh).catch(()=>{});
    logout();
  }

  if (!profile) return (
    <Overlay onClose={onClose}>
      <div style={{ display:'grid', placeItems:'center', height:300, color:'var(--dim)' }}>Загрузка…</div>
    </Overlay>
  );

  const statusLabel = STATUS_PRESETS.find(s=>s[0]===profile.status_preset);

  return (
    <Overlay onClose={onClose}>
      {/* Обложка */}
      <div style={{
        height:140, background: profile.cover_url ? `url(${profile.cover_url}) center/cover` : `linear-gradient(135deg, ${accent.c}, ${accent.c2})`,
        borderRadius:'20px 20px 0 0', position:'relative',
      }}>
        {isSelf && (
          <label style={{ position:'absolute', top:10, right:10, background:'rgba(0,0,0,.5)', borderRadius:10, padding:'5px 10px', cursor:'pointer', fontSize:12, color:'#fff' }}>
            📷 Обложка
            <input type="file" accept="image/*" hidden onChange={async e=>{
              const f=e.target.files?.[0]; if(!f) return;
              const fd=new FormData(); fd.append('cover',f);
              const {default:axios}=await import('axios');
              await axios.post('/api/profiles/me/cover', fd, { headers:{Authorization:`Bearer ${localStorage.getItem('iriska:access')}`} });
              setProfile((p:any)=>({...p, cover_url: URL.createObjectURL(f)}));
            }} />
          </label>
        )}
      </div>

      {/* Аватар */}
      <div style={{ padding:'0 24px', marginTop:-40, marginBottom:8 }}>
        <div style={{ position:'relative', display:'inline-block' }}>
          <div style={{
            width:80, height:80, borderRadius:40, background:'var(--panel)',
            border:`3px solid ${accent.c}`, display:'grid', placeItems:'center',
            fontSize:40, overflow:'hidden',
          }}>
            {profile.avatar_url
              ? <img src={profile.avatar_url} style={{ width:'100%', height:'100%' }} />
              : '🦊'}
          </div>
          {isSelf && (
            <label style={{ position:'absolute', right:-2, bottom:-2, background:accent.c, borderRadius:12, width:24, height:24, display:'grid', placeItems:'center', cursor:'pointer', fontSize:12 }}>
              ✏️<input type="file" accept="image/*" hidden onChange={uploadAvatar}/>
            </label>
          )}
        </div>

        <div style={{ marginTop:10 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <h2 style={{ fontSize:22, fontWeight:800 }}>{profile.name}</h2>
            {profile.mood && <span style={{ fontSize:20 }}>{profile.mood}</span>}
          </div>
          <div style={{ color:'var(--dim)', fontSize:14 }}>@{profile.username}</div>
          {statusLabel && <div style={{ color:'var(--dim)', fontSize:13, marginTop:3 }}>{statusLabel[2]} {statusLabel[1]}</div>}
          {profile.music_track && <div style={{ color:'var(--dim)', fontSize:12, marginTop:2 }}>🎵 {profile.music_track}</div>}
          {profile.game_name  && <div style={{ color:'var(--dim)', fontSize:12, marginTop:2 }}>🎮 {profile.game_name}</div>}
        </div>

        {/* Биография */}
        <div style={{ marginTop:12 }}>
          {editBio ? (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              <textarea value={bio} onChange={e=>setBio(e.target.value)} rows={3}
                style={{ background:'var(--bg)', border:'1px solid var(--border)', color:'var(--text)', borderRadius:12, padding:10, fontSize:14, resize:'none' }} />
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={saveBio} style={{ background:'var(--accent)', color:'#fff', borderRadius:10, padding:'7px 16px', fontSize:13, fontWeight:600 }}>Сохранить</button>
                <button onClick={()=>setEditBio(false)} style={{ color:'var(--dim)', padding:'7px 10px', fontSize:13 }}>Отмена</button>
              </div>
            </div>
          ) : (
            <div>
              <p style={{ color:'var(--dim)', fontSize:14, lineHeight:1.6 }}>{profile.bio || (isSelf ? 'Нет описания' : '')}</p>
              {isSelf && <button onClick={()=>setEditBio(true)} style={{ color:'var(--accent)', fontSize:13, marginTop:4 }}>✏️ Изменить</button>}
            </div>
          )}
        </div>
      </div>

      <div style={{ padding:'0 24px 24px', display:'flex', flexDirection:'column', gap:20 }}>
        {/* Статус (только свой) */}
        {isSelf && (
          <Section label="Статус">
            <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
              {STATUS_PRESETS.map(([k,l,e])=>(
                <button key={k} onClick={()=>setStatus(k)} style={{
                  background: profile.status_preset===k ? 'var(--accent)22' : 'var(--bg)',
                  border:`1px solid ${profile.status_preset===k ? 'var(--accent)' : 'var(--border)'}`,
                  color:'var(--text)', borderRadius:14, padding:'6px 12px', fontSize:13,
                  fontWeight: profile.status_preset===k ? 700 : 400,
                }}>{e} {l}</button>
              ))}
            </div>
          </Section>
        )}

        {/* Тычки (чужой профиль) */}
        {!isSelf && (
          <Section label="Взаимодействие">
            <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
              {[['poke','Тknуть','👉'],['wave','Помахать','👋'],['coffee','На кофе','☕'],['game','В игру','🎮'],['call','Позвонить','📞'],['hug','Обнять','🤗']].map(([t,l,e])=>(
                <button key={t} onClick={()=>poke(t,l,e)} style={{
                  background:'var(--bg)', border:'1px solid var(--border)',
                  color:'var(--text)', borderRadius:14, padding:'7px 13px', fontSize:13,
                }}>{e} {l}</button>
              ))}
            </div>
          </Section>
        )}

        {/* Достижения */}
        {(achievements.length > 0 || isSelf) && (
          <Section label="Достижения">
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
              {(isSelf ? achievements : profile.achievements || []).map((a: any) => {
                const got = a.unlocked_at != null;
                return (
                  <div key={a.name} title={`${a.name}\n${a.description || ''}`}
                    style={{ textAlign:'center', opacity: got ? 1 : 0.3 }}>
                    <div style={{
                      width:54, height:54, borderRadius:16, margin:'0 auto',
                      display:'grid', placeItems:'center', fontSize:26,
                      background:'var(--bg)',
                      border:`2px solid ${got ? RARITY_COLOR[a.rarity] : 'var(--border)'}`,
                      boxShadow: got ? `0 0 10px ${RARITY_COLOR[a.rarity]}40` : 'none',
                    }}>{a.icon}</div>
                    <div style={{ fontSize:10, color:'var(--dim)', marginTop:5, lineHeight:1.2 }}>{a.name}</div>
                    {got && <div style={{ fontSize:9, color:RARITY_COLOR[a.rarity], textTransform:'uppercase', fontWeight:700 }}>{a.rarity}</div>}
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        {/* Выход */}
        {isSelf && (
          <button onClick={doLogout} style={{
            width:'100%', padding:'12px', borderRadius:14, fontSize:14, fontWeight:600,
            color:'#E25670', border:'1px solid #E2567040', background:'transparent',
          }}>Выйти из аккаунта</button>
        )}
      </div>

      {toast && <Toast msg={toast}/>}
    </Overlay>
  );
}

function Overlay({ onClose, children }: { onClose:()=>void; children:React.ReactNode }) {
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:80, background:'rgba(0,0,0,.6)', display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
      <div onClick={e=>e.stopPropagation()} style={{
        width:'100%', maxWidth:480, maxHeight:'92vh', overflowY:'auto',
        background:'var(--panel)', borderRadius:'20px 20px 0 0',
        animation:'slideInUp .25s ease',
      }}>
        <div style={{ width:40, height:4, background:'var(--border)', borderRadius:2, margin:'10px auto' }}/>
        {children}
      </div>
    </div>
  );
}

function Section({ label, children }: { label:string; children:React.ReactNode }) {
  return (
    <div>
      <div style={{ color:'var(--dim)', fontSize:11, fontWeight:700, letterSpacing:.8, textTransform:'uppercase', marginBottom:10 }}>{label}</div>
      {children}
    </div>
  );
}

function Toast({ msg }: { msg:string }) {
  return (
    <div style={{ position:'fixed', bottom:28, left:'50%', transform:'translateX(-50%)', zIndex:200,
      background:'var(--panel)', border:'1px solid var(--border)', color:'var(--text)',
      padding:'10px 18px', borderRadius:22, fontSize:14, boxShadow:'0 10px 30px rgba(0,0,0,.4)' }}>
      {msg}
    </div>
  );
}
