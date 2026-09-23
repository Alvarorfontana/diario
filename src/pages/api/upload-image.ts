export const prerender = false;

import { put } from '@vercel/blob';

export const POST = async ({ request }: { request: Request }) => {
	try {
		const formData = await request.formData();
		const file = formData.get('file') as File;
		
		if (!file) {
			return new Response(JSON.stringify({ ok: false, error: 'No file' }), { status: 400 });
		}

		// Subir a Vercel Blob con el token correcto
		const blob = await put(`ads/${Date.now()}-${file.name}`, file, {
			access: 'public',
			token: process.env.BLOB_READ_WRITE_TOKEN,
		});

		return new Response(JSON.stringify({ ok: true, url: blob.url }), {
			headers: { 'content-type': 'application/json' }
		});
	} catch (error) {
		console.error('Upload error:', error);
		return new Response(JSON.stringify({ ok: false, error: 'Upload failed: ' + error.message }), { status: 500 });
	}
};
