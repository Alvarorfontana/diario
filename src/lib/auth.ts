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

// Bloqueo de intentos: después de 5 contraseñas incorrectas desde la misma conexión,
// el ingreso queda bloqueado 15 minutos. Cada error además demora la respuesta.
// Vive en la memoria del servidor: alcanza para frenar a quien prueba contraseñas una tras otra.
const INTENTOS_MAX = 5;
const BLOQUEO_MS = 15 * 60 * 1000;
const intentos = new Map<string, { fallos: number; hasta: number }>();

export function ipDe(request: Request, clientAddress?: string): string {
	return (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || clientAddress || 'desconocida';
}

export function minutosBloqueado(ip: string): number {
	const r = intentos.get(ip);
	if (!r || r.hasta <= Date.now()) return 0;
	return Math.ceil((r.hasta - Date.now()) / 60000);
}

export async function registrarFallo(ip: string): Promise<void> {
	const ahora = Date.now();
	const r = intentos.get(ip) ?? { fallos: 0, hasta: 0 };
	if (r.hasta && r.hasta <= ahora) { r.fallos = 0; r.hasta = 0; }
	r.fallos += 1;
	if (r.fallos >= INTENTOS_MAX) r.hasta = ahora + BLOQUEO_MS;
	intentos.set(ip, r);
	if (intentos.size > 5000) intentos.clear();
	await new Promise((ok) => setTimeout(ok, 1000));
}

export function registrarExito(ip: string): void {
	intentos.delete(ip);
}
