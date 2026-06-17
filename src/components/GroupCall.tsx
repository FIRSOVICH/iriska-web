import { useState, useEffect, useRef } from 'react';
import { useStore } from '../state/store';
import { useTheme } from '../state/theme';

interface Peer { userId: string; name: string; stream?: MediaStream; }

interface Props { callId: string; chatId: string; onLeave: () => void; }

export default function GroupCall({ callId, chatId, onLeave }: Props) {
  const socket = useStore(s => s.socket);
  const user   = useStore(s => s.user);
  const { accent } = useTheme();

  const [peers, setPeers] = useState<Peer[]>([]);
  const [muted, setMuted]         = useState(false);
  const [videoOff, setVideoOff]   = useState(false);
  const [screenSharing, setScreen]= useState(false);

  const localRef  = useRef<HTMLVideoElement>(null);
  const localStream = useRef<MediaStream | null>(null);
  const pcs = useRef<Record<string, RTCPeerConnection>>({});

  const RTCConfig = { iceServers:[{urls:'stun:stun.l.google.com:19302'}] };

  useEffect(() => {
    (async () => {
      const stream = await navigator.mediaDevices.getUserMedia({ audio:true, video:true });
      localStream.current = stream;
      if (localRef.current) localRef.current.srcObject = stream;
      socket?.emit('gcall:join', { callId, chatId });
    })();

    socket?.on('gcall:peer_joined', async ({ userId, user: u }: any) => {
      if (userId === user?.id) return;
      const pc = createPC(userId);
      const stream = localStream.current;
      stream?.getTracks().forEach(t => pc.addTrack(t, stream));
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket?.emit('gcall:offer', { callId, toUserId: userId, offer });
      setPeers(p => [...p.filter(x=>x.userId!==userId), { userId, name: u.name }]);
    });

    socket?.on('gcall:offer', async ({ fromUserId, offer }: any) => {
      const pc = createPC(fromUserId);
      const stream = localStream.current;
      stream?.getTracks().forEach(t => pc.addTrack(t, stream));
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket?.emit('gcall:answer', { callId, toUserId: fromUserId, answer });
    });

    socket?.on('gcall:answer', async ({ fromUserId, answer }: any) => {
      await pcs.current[fromUserId]?.setRemoteDescription(new RTCSessionDescription(answer));
    });

    socket?.on('gcall:ice', async ({ fromUserId, candidate }: any) => {
      await pcs.current[fromUserId]?.addIceCandidate(new RTCIceCandidate(candidate));
    });

    socket?.on('gcall:peer_left', ({ userId }: any) => {
      pcs.current[userId]?.close();
      delete pcs.current[userId];
      setPeers(p => p.filter(x => x.userId !== userId));
    });

    return () => {
      socket?.emit('gcall:leave', { callId });
      localStream.current?.getTracks().forEach(t=>t.stop());
      Object.values(pcs.current).forEach(pc=>pc.close());
      socket?.off('gcall:peer_joined');
      socket?.off('gcall:offer');
      socket?.off('gcall:answer');
      socket?.off('gcall:ice');
      socket?.off('gcall:peer_left');
    };
  }, []);

  function createPC(userId: string) {
    const pc = new RTCPeerConnection(RTCConfig);
    pcs.current[userId] = pc;
    pc.onicecandidate = e => {
      if (e.candidate) socket?.emit('gcall:ice', { callId, toUserId: userId, candidate: e.candidate });
    };
    pc.ontrack = e => {
      setPeers(p => p.map(peer =>
        peer.userId === userId ? { ...peer, stream: e.streams[0] } : peer
      ));
    };
    return pc;
  }

  function toggleMute() {
    const a = localStream.current?.getAudioTracks()[0];
    if (a) { a.enabled = !a.enabled; setMuted(!muted); }
  }
  function toggleVideo() {
    const v = localStream.current?.getVideoTracks()[0];
    if (v) { v.enabled = !v.enabled; setVideoOff(!videoOff); }
  }
  async function toggleScreen() {
    if (!screenSharing) {
      const screen = await (navigator.mediaDevices as any).getDisplayMedia({ video:true });
      const vt = screen.getVideoTracks()[0];
      const sender = Object.values(pcs.current)[0]?.getSenders().find(s=>s.track?.kind==='video');
      if (sender) await sender.replaceTrack(vt);
      setScreen(true);
      socket?.emit('screen:start', { callId });
      vt.onended = () => { setScreen(false); socket?.emit('screen:stop', { callId }); };
    } else {
      const vt = localStream.current?.getVideoTracks()[0];
      const sender = Object.values(pcs.current)[0]?.getSenders().find(s=>s.track?.kind==='video');
      if (sender && vt) await sender.replaceTrack(vt);
      setScreen(false);
      socket?.emit('screen:stop', { callId });
    }
  }

  const total = peers.length + 1; // +1 себя
  const cols  = total <= 2 ? 2 : total <= 4 ? 2 : 3;

  return (
    <div style={{ position:'fixed', inset:0, zIndex:100, background:'#0D0A08', display:'flex', flexDirection:'column' }}>
      {/* Сетка видео */}
      <div style={{
        flex:1, display:'grid', padding:12, gap:8,
        gridTemplateColumns:`repeat(${cols}, 1fr)`,
      }}>
        {/* Себя */}
        <VideoTile name={`${user?.name} (вы)`} isSelf muted={muted} videoOff={videoOff} videoRef={localRef} />
        {/* Участников */}
        {peers.map(p => <VideoTile key={p.userId} name={p.name} stream={p.stream} />)}
      </div>

      {/* Панель управления */}
      <div style={{ padding:'16px 20px', background:'#1A1410', display:'flex', gap:12, justifyContent:'center', alignItems:'center' }}>
        <Btn active={muted}         onClick={toggleMute}   icon={muted?'🔇':'🎤'} label={muted?'Вкл.':'Выкл.'} />
        <Btn active={videoOff}      onClick={toggleVideo}  icon={videoOff?'📵':'📹'} label={videoOff?'Вкл.':'Выкл.'} />
        <Btn active={screenSharing} onClick={toggleScreen} icon="🖥" label={screenSharing?'Стоп':'Экран'} />
        <button onClick={onLeave} style={{
          background:'#E25670', color:'#fff', borderRadius:50,
          width:56, height:56, fontSize:24, display:'grid', placeItems:'center',
          border:'none', cursor:'pointer',
        }}>📞</button>
      </div>
    </div>
  );
}

function VideoTile({ name, stream, isSelf, muted, videoOff, videoRef }: {
  name:string; stream?: MediaStream; isSelf?:boolean; muted?:boolean; videoOff?:boolean;
  videoRef?: React.RefObject<HTMLVideoElement>;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const vRef = videoRef || ref;

  useEffect(() => {
    if (stream && vRef.current) vRef.current.srcObject = stream;
  }, [stream]);

  return (
    <div style={{
      borderRadius:16, overflow:'hidden', background:'#1E1813', position:'relative',
      aspectRatio:'16/9',
    }}>
      {videoOff ? (
        <div style={{ width:'100%', height:'100%', display:'grid', placeItems:'center', fontSize:40 }}>🙈</div>
      ) : (
        <video ref={vRef} autoPlay playsInline muted={isSelf}
          style={{ width:'100%', height:'100%', objectFit:'cover' }} />
      )}
      <div style={{
        position:'absolute', bottom:8, left:8, background:'rgba(0,0,0,.6)',
        padding:'3px 8px', borderRadius:8, fontSize:12, color:'#fff',
      }}>
        {muted && '🔇 '}{name}
      </div>
    </div>
  );
}

function Btn({ active, onClick, icon, label }: { active?:boolean; onClick:()=>void; icon:string; label:string; }) {
  return (
    <button onClick={onClick} style={{
      display:'flex', flexDirection:'column', alignItems:'center', gap:4,
      background: active ? 'rgba(255,255,255,.15)' : 'rgba(255,255,255,.07)',
      border:'none', borderRadius:16, padding:'10px 18px', cursor:'pointer', color:'#fff',
    }}>
      <span style={{ fontSize:22 }}>{icon}</span>
      <span style={{ fontSize:10 }}>{label}</span>
    </button>
  );
}
