export const prerender = false;

import { put } from '@vercel/blob';

export const POST = async ({ request }: { request: Request }) => {
	try {
		const formData = await request.formData();
		const file = formData.get('file') as File;
		
		if (!file) {
			return new Response(JSON.stringify({ ok: false, error: 'No file' }), { status: 400 });
		}

		// Usar IMAGES_READ_WRITE_TOKEN (el nuevo store) o BLOB_READ_WRITE_TOKEN (fallback)
		const token = process.env.IMAGES_READ_WRITE_TOKEN || process.env.BLOB_READ_WRITE_TOKEN;

		const blob = await put(`ads/${Date.now()}-${file.name}`, file, {
			access: 'public',
			token: token,
		});

		return new Response(JSON.stringify({ ok: true, url: blob.url }), {
			headers: { 'content-type': 'application/json' }
		});
	} catch (error) {
		console.error('Upload error:', error);
		return new Response(JSON.stringify({ ok: false, error: 'Upload failed' }), { status: 500 });
	}
};
