// VAPID public key is safe to ship to the browser (the private key stays on the server).
export const VAPID_PUBLIC_KEY =
  "BLZd50uh_34GB2bHBg_QmlJLE_VBF33jxLokTBlcHwik4OAnnlPpUhhaX6e69i0bXj7rTjbXKMoahXN27S2wsw4";

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
