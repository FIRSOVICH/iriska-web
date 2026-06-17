import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64, encodeUTF8, decodeUTF8 } from 'tweetnacl-util';

const DEVICE_KEY = 'iriska:e2e:keypair';

// Генерация / загрузка ключевой пары устройства
export function getOrCreateKeyPair(): nacl.BoxKeyPair {
  const stored = localStorage.getItem(DEVICE_KEY);
  if (stored) {
    const { publicKey, secretKey } = JSON.parse(stored);
    return {
      publicKey: decodeBase64(publicKey),
      secretKey: decodeBase64(secretKey),
    };
  }
  const kp = nacl.box.keyPair();
  localStorage.setItem(DEVICE_KEY, JSON.stringify({
    publicKey: encodeBase64(kp.publicKey),
    secretKey: encodeBase64(kp.secretKey),
  }));
  return kp;
}

export function getPublicKeyBase64(): string {
  return encodeBase64(getOrCreateKeyPair().publicKey);
}

// Шифрование сообщения для получателя (DM)
// Возвращает base64-строку: nonce(24) + ciphertext
export function encryptMessage(text: string, recipientPublicKeyB64: string): string {
  const kp = getOrCreateKeyPair();
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const recipientPK = decodeBase64(recipientPublicKeyB64);
  const msgBytes = encodeUTF8(text);
  const box = nacl.box(msgBytes, nonce, recipientPK, kp.secretKey);
  // Объединяем nonce + ciphertext
  const result = new Uint8Array(nonce.length + box.length);
  result.set(nonce); result.set(box, nonce.length);
  return encodeBase64(result);
}

// Расшифровка сообщения
export function decryptMessage(ciphertextB64: string, senderPublicKeyB64: string): string | null {
  try {
    const kp = getOrCreateKeyPair();
    const data = decodeBase64(ciphertextB64);
    const nonce = data.slice(0, nacl.box.nonceLength);
    const box = data.slice(nacl.box.nonceLength);
    const senderPK = decodeBase64(senderPublicKeyB64);
    const opened = nacl.box.open(box, nonce, senderPK, kp.secretKey);
    if (!opened) return null;
    return decodeUTF8(opened);
  } catch {
    return null;
  }
}

// Групповое шифрование: генерируем сессионный ключ, шифруем текст им,
// потом шифруем ключ для каждого участника
export function encryptGroupMessage(text: string, sessionKey: Uint8Array): string {
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const msgBytes = encodeUTF8(text);
  const box = nacl.secretbox(msgBytes, nonce, sessionKey);
  const result = new Uint8Array(nonce.length + box.length);
  result.set(nonce); result.set(box, nonce.length);
  return encodeBase64(result);
}

export function decryptGroupMessage(ciphertextB64: string, sessionKey: Uint8Array): string | null {
  try {
    const data = decodeBase64(ciphertextB64);
    const nonce = data.slice(0, nacl.secretbox.nonceLength);
    const box = data.slice(nacl.secretbox.nonceLength);
    const opened = nacl.secretbox.open(box, nonce, sessionKey);
    if (!opened) return null;
    return decodeUTF8(opened);
  } catch { return null; }
}

export function generateSessionKey(): Uint8Array {
  return nacl.randomBytes(nacl.secretbox.keyLength);
}

// Шифрование сессионного ключа для конкретного участника
export function encryptSessionKey(sessionKey: Uint8Array, recipientPublicKeyB64: string): string {
  const kp = getOrCreateKeyPair();
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const recipientPK = decodeBase64(recipientPublicKeyB64);
  const box = nacl.box(sessionKey, nonce, recipientPK, kp.secretKey);
  const result = new Uint8Array(nonce.length + box.length);
  result.set(nonce); result.set(box, nonce.length);
  return encodeBase64(result);
}

export function decryptSessionKey(envelopeB64: string, senderPublicKeyB64: string): Uint8Array | null {
  try {
    const kp = getOrCreateKeyPair();
    const data = decodeBase64(envelopeB64);
    const nonce = data.slice(0, nacl.box.nonceLength);
    const box = data.slice(nacl.box.nonceLength);
    const senderPK = decodeBase64(senderPublicKeyB64);
    return nacl.box.open(box, nonce, senderPK, kp.secretKey);
  } catch { return null; }
}
