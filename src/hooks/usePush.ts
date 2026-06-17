import { useEffect } from 'react';
import { pushApi } from '../api/client';

export function usePush(userId: string | null) {
  useEffect(() => {
    if (!userId || !('serviceWorker' in navigator) || !('PushManager' in window)) return;

    (async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js');
        const perm = await Notification.requestPermission();
        if (perm !== 'granted') return;

        const { data } = await pushApi.vapid();
        if (!data.publicKey) return;

        const existing = await reg.pushManager.getSubscription();
        if (existing) {
          // Уже подписаны
          await pushApi.subscribe(existing.endpoint, (existing.toJSON() as any).keys);
          return;
        }

        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(data.publicKey),
        });
        const json = sub.toJSON() as any;
        await pushApi.subscribe(json.endpoint, json.keys);
      } catch (e) {
        console.error('Push setup error:', e);
      }
    })();
  }, [userId]);
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}
