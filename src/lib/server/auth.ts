const enc = new TextEncoder();

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export const SESSION_COOKIE = 'session';

const keyCache = new Map<string, Promise<CryptoKey>>();

function getKey(secret: string): Promise<CryptoKey> {
	let p = keyCache.get(secret);
	if (!p) {
		p = crypto.subtle.importKey(
			'raw',
			enc.encode(secret),
			{ name: 'HMAC', hash: 'SHA-256' },
			false,
			['sign']
		);
		keyCache.set(secret, p);
	}
	return p;
}

async function hmacB64(secret: string, data: string): Promise<string> {
	const sig = await crypto.subtle.sign('HMAC', await getKey(secret), enc.encode(data));
	return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

function constantTimeEq(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let r = 0;
	for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return r === 0;
}

export async function createSessionCookie(secret: string): Promise<{ value: string; maxAge: number }> {
	const expiry = Date.now() + SESSION_TTL_MS;
	const sig = await hmacB64(secret, String(expiry));
	return { value: `${expiry}.${sig}`, maxAge: SESSION_TTL_MS / 1000 };
}

export async function verifySessionCookie(secret: string, value: string | undefined): Promise<boolean> {
	if (!value) return false;
	const idx = value.indexOf('.');
	if (idx < 0) return false;
	const expiry = value.slice(0, idx);
	const sig = value.slice(idx + 1);
	const expected = await hmacB64(secret, expiry);
	if (!constantTimeEq(sig, expected)) return false;
	const ms = Number(expiry);
	return Number.isFinite(ms) && ms > Date.now();
}

export async function checkPassword(input: string, expected: string, secret: string): Promise<boolean> {
	const [a, b] = await Promise.all([hmacB64(secret, input), hmacB64(secret, expected)]);
	return constantTimeEq(a, b);
}
