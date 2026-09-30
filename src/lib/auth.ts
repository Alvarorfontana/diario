// Autenticación simple del panel: la cookie guarda un hash de la contraseña
// (no el valor "1", que cualquiera podría falsificar).
async function sha256(text: string): Promise<string> {
	const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
	return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function authToken(password: string): Promise<string> {
	return sha256(`eldiario-admin:${password}`);
}

export async function isAdmin(request: Request, env: Record<string, string | undefined>): Promise<boolean> {
	const password = env.ADMIN_PASSWORD;
	if (!password) return false;
	const cookie = request.headers.get('cookie') ?? '';
	const match = cookie.match(/(?:^|;\s*)admin_auth=([a-f0-9]{64})/);
	if (!match) return false;
	return match[1] === (await authToken(password));
}

export async function loginCookie(password: string, secure: boolean): Promise<string> {
	return `admin_auth=${await authToken(password)}; Path=/; Max-Age=86400; SameSite=Lax; HttpOnly${secure ? '; Secure' : ''}`;
}
