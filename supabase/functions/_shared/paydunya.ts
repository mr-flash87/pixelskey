type PaymentMode = "test" | "live";
type PayDunyaCredentials = { master_key: string; private_key: string; token: string };

export function payDunyaBase(mode: PaymentMode) {
  return mode === "live" ? "https://app.paydunya.com/api/v1" : "https://app.paydunya.com/sandbox-api/v1";
}
export function payDunyaHeaders(credentials: PayDunyaCredentials) {
  return { "Content-Type": "application/json", "PAYDUNYA-MASTER-KEY": credentials.master_key, "PAYDUNYA-PRIVATE-KEY": credentials.private_key, "PAYDUNYA-TOKEN": credentials.token };
}
export async function verifyPayDunyaHash(hash: string, masterKey: string) {
  const digest = await crypto.subtle.digest("SHA-512", new TextEncoder().encode(masterKey));
  const expected = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
  const actual = hash.toLowerCase();
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ actual.charCodeAt(i);
  return diff === 0;
}
export async function confirmPayDunya(token: string, mode: PaymentMode, credentials: PayDunyaCredentials) {
  const response = await fetch(`${payDunyaBase(mode)}/checkout-invoice/confirm/${encodeURIComponent(token)}`, { headers: payDunyaHeaders(credentials), signal: AbortSignal.timeout(20000) });
  const data = await response.json();
  if (!response.ok || data.response_code !== "00") throw new Error("Confirmation PayDunya indisponible");
  if (typeof data.hash !== "string" || !await verifyPayDunyaHash(data.hash, credentials.master_key)) throw new Error("Confirmation PayDunya invalide");
  return data;
}

// PayDunya sends PHP-style nested form fields, not a JSON body.
export function parsePayDunyaNotification(raw: string, contentType: string) {
  if (contentType.includes("application/json")) {
    const body = JSON.parse(raw);
    return { hash: body?.data?.hash ?? body?.hash, token: body?.data?.invoice?.token ?? body?.invoice?.token };
  }
  const params = new URLSearchParams(raw);
  if (params.has("data")) {
    const body = JSON.parse(params.get("data") ?? "{}");
    return { hash: body.hash, token: body.invoice?.token };
  }
  return { hash: params.get("data[hash]"), token: params.get("data[invoice][token]") };
}
