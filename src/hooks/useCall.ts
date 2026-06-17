import { useRef, useState, useCallback } from 'react';
import { useStore } from '../state/store';

export type CallState = 'idle' | 'calling' | 'incoming' | 'active';

export function useCall() {
  const socket = useStore((s) => s.socket);
  const [callState, setCallState] = useState<CallState>('idle');
  const [callId, setCallId] = useState<string | null>(null);
  const [peerId, setPeerId] = useState<string | null>(null);
  const [peerInfo, setPeerInfo] = useState<{name:string;avatar_url?:string} | null>(null);
  const [callType, setCallType] = useState<'audio'|'video'>('audio');
  const [screenSharing, setScreenSharing] = useState(false);

  const pc = useRef<RTCPeerConnection | null>(null);
  const localStream = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const RTCConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  };

  const createPC = useCallback(() => {
    const conn = new RTCPeerConnection(RTCConfig);
    conn.onicecandidate = (e) => {
      if (e.candidate && callId) {
        socket?.emit('call:ice', { callId, candidate: e.candidate });
      }
    };
    conn.ontrack = (e) => {
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0];
    };
    pc.current = conn;
    return conn;
  }, [socket, callId]);

  const startCall = useCallback(async (calleeId: string, type: 'audio'|'video', chatId?: string) => {
    setCallType(type);
    setPeerId(calleeId);
    setCallState('calling');
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true, video: type === 'video',
    });
    localStream.current = stream;
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;
    const conn = createPC();
    stream.getTracks().forEach((t) => conn.addTrack(t, stream));
    const offer = await conn.createOffer();
    await conn.setLocalDescription(offer);
    socket?.emit('call:offer', { calleeId, type, chatId, offer });
    socket?.once('call:created', ({ callId: cid }: { callId: string }) => {
      setCallId(cid);
      conn.onicecandidate = (e) => {
        if (e.candidate) socket?.emit('call:ice', { callId: cid, candidate: e.candidate });
      };
    });
    socket?.once('call:answered', async ({ callId: cid, answer }: any) => {
      setCallId(cid);
      await conn.setRemoteDescription(new RTCSessionDescription(answer));
      setCallState('active');
    });
  }, [socket, createPC]);

  const answerCall = useCallback(async (incCallId: string, offer: RTCSessionDescriptionInit, type: 'audio'|'video') => {
    setCallId(incCallId);
    setCallType(type);
    setCallState('active');
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: type === 'video' });
    localStream.current = stream;
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;
    const conn = createPC();
    conn.onicecandidate = (e) => {
      if (e.candidate) socket?.emit('call:ice', { callId: incCallId, candidate: e.candidate });
    };
    stream.getTracks().forEach((t) => conn.addTrack(t, stream));
    await conn.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await conn.createAnswer();
    await conn.setLocalDescription(answer);
    socket?.emit('call:answer', { callId: incCallId, answer });
  }, [socket, createPC]);

  const endCall = useCallback(() => {
    socket?.emit('call:end', { callId });
    pc.current?.close(); pc.current = null;
    localStream.current?.getTracks().forEach((t) => t.stop());
    localStream.current = null;
    setCallState('idle'); setCallId(null); setPeerId(null);
  }, [socket, callId]);

  const toggleMute = useCallback(() => {
    if (!localStream.current) return;
    const audio = localStream.current.getAudioTracks()[0];
    if (audio) audio.enabled = !audio.enabled;
  }, []);

  const toggleVideo = useCallback(() => {
    if (!localStream.current) return;
    const video = localStream.current.getVideoTracks()[0];
    if (video) video.enabled = !video.enabled;
  }, []);

  const startScreenShare = useCallback(async () => {
    const screen = await (navigator.mediaDevices as any).getDisplayMedia({ video: true });
    const videoTrack = screen.getVideoTracks()[0];
    const sender = pc.current?.getSenders().find((s) => s.track?.kind === 'video');
    if (sender) await sender.replaceTrack(videoTrack);
    setScreenSharing(true);
    socket?.emit('screen:start', { callId });
    videoTrack.onended = () => { stopScreenShare(); };
  }, [socket, callId]);

  const stopScreenShare = useCallback(async () => {
    const videoTrack = localStream.current?.getVideoTracks()[0];
    const sender = pc.current?.getSenders().find((s) => s.track?.kind === 'video');
    if (sender && videoTrack) await sender.replaceTrack(videoTrack);
    setScreenSharing(false);
    socket?.emit('screen:stop', { callId });
  }, [socket, callId]);

  // Подписка на входящий звонок
  const handleIncoming = useCallback((data: { callId: string; caller: any; type: 'audio'|'video'; offer: any }) => {
    setCallState('incoming');
    setCallId(data.callId);
    setPeerId(data.caller.id);
    setPeerInfo({ name: data.caller.name, avatar_url: data.caller.avatar_url });
    setCallType(data.type);
  }, []);

  return {
    callState, callId, peerId, peerInfo, callType, screenSharing,
    localVideoRef, remoteVideoRef,
    startCall, answerCall, endCall, toggleMute, toggleVideo,
    startScreenShare, stopScreenShare, handleIncoming,
  };
}
