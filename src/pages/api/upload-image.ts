export const prerender = false;

const REPO = 'Alvarorfontana/diario';
const BRANCH = 'main';
const UPLOAD_DIR = 'public/uploads';
const MAX_BYTES = 3_000_000;

type RuntimeEnv = Record<string, string | undefined>;
interface ApiContext {
	request: Request;
	locals?: { runtime?: { env?: RuntimeEnv } };
}

function json(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json' },
	});
}

function toBase64(bytes: Uint8Array): string {
	let binary = '';
	const chunk = 0x8000;
	for (let i = 0; i < bytes.length; i += chunk) {
		binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
	}
	return btoa(binary);
}

export const POST = async ({ request, locals }: ApiContext) => {
	const cookie = request.headers.get('cookie') ?? '';
	if (!cookie.includes('admin_auth=1')) {
		return json({ ok: false, error: 'No autorizado' }, 401);
	}

	const env = locals?.runtime?.env ?? (import.meta.env as unknown as RuntimeEnv);
	const token = env.GITHUB_PAT;
	if (!token) return json({ ok: false, error: 'GITHUB_PAT no configurado' }, 500);

	try {
		const formData = await request.formData();
		const file = formData.get('file');
		if (!(file instanceof File)) return json({ ok: false, error: 'No llegó ningún archivo' }, 400);
		if (!file.type.startsWith('image/')) return json({ ok: false, error: 'El archivo no es una imagen' }, 400);
		if (file.size > MAX_BYTES) return json({ ok: false, error: 'La imagen pesa demasiado (máx. 3 MB)' }, 400);

		const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
		const base =
			file.name
				.replace(/\.[^.]+$/, '')
				.toLowerCase()
				.normalize('NFD')
				.replace(/[\u0300-\u036f]/g, '')
				.replace(/[^a-z0-9]+/g, '-')
				.replace(/^-+|-+$/g, '')
				.slice(0, 50) || 'imagen';
		const fileName = `${Date.now()}-${base}.${ext}`;
		const path = `${UPLOAD_DIR}/${fileName}`;

		const bytes = new Uint8Array(await file.arrayBuffer());
		const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${path}`, {
			method: 'PUT',
			headers: {
				Authorization: `token ${token}`,
				Accept: 'application/vnd.github+json',
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				message: `Subir imagen: ${fileName}`,
				content: toBase64(bytes),
				branch: BRANCH,
			}),
		});
		const result = await res.json();
		if (!res.ok) {
			return json({ ok: false, error: 'GitHub API error', detail: result.message }, 500);
		}
		return json({ ok: true, url: `/uploads/${fileName}` });
	} catch (e) {
		return json({ ok: false, error: 'No se pudo subir la imagen' }, 500);
	}
};
