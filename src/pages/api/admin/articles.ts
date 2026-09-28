export const prerender = false;

import { supabase } from './supabase';

type RuntimeEnv = Record<string, string | undefined>;
interface ApiContext {
	request: Request;
	locals?: { runtime?: { env?: RuntimeEnv } };
}

export const GET = async ({ request, locals }: ApiContext) => {
	const url = new URL(request.url);
	const action = url.searchParams.get('action');

	if (action === 'list') {
		const { data: articles, error } = await supabase
			.from('articles')
			.select('*')
			.eq('status', 'published')
			.order('date', { ascending: false });

		if (error) {
			return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500, headers: { 'content-type': 'application/json' } });
		}

		const formattedArticles = articles.map(article => ({
			slug: article.slug,
			sha: article.id,
			title: article.title,
			date: article.date,
			author: article.author,
			excerpt: article.excerpt,
			heroImage: article.image_url,
			status: article.status
		}));

		return new Response(JSON.stringify(formattedArticles), { headers: { 'content-type': 'application/json' } });
	}

	if (action === 'get') {
		const slug = url.searchParams.get('slug');
		if (!slug) return new Response('Missing slug', { status: 400 });

		const { data: article, error } = await supabase
			.from('articles')
			.select('*')
			.eq('slug', slug)
			.single();

		if (error || !article) {
			return new Response(JSON.stringify({ ok: false, error: 'Not found' }), { status: 404, headers: { 'content-type': 'application/json' } });
		}

		return new Response(JSON.stringify({ 
			ok: true, 
			sha: article.id, 
			data: {
				title: article.title,
				date: article.date,
				author: article.author,
				excerpt: article.excerpt,
				heroImage: article.image_url,
				status: article.status
			}, 
			body: article.content 
		}), { headers: { 'content-type': 'application/json' } });
	}

	return new Response('Unknown action', { status: 400 });
};

export const POST = async ({ request, locals }: ApiContext) => {
	const body = await request.json();
	const { slug, data, content, sha } = body;

	if (!slug || !data) {
		return new Response(JSON.stringify({ ok: false, error: 'Missing fields' }), { status: 400 });
	}

	const articleData = {
		title: data.title || slug,
		slug: slug,
		content: content || '',
		excerpt: data.excerpt || '',
		date: data.date || new Date().toISOString().split('T')[0],
		author: data.author || 'Redacción',
		image_url: data.heroImage || '',
		status: data.status || 'published'
	};

	let result;
	if (sha) {
		result = await supabase.from('articles').update(articleData).eq('id', sha);
	} else {
		result = await supabase.from('articles').insert([articleData]);
	}

	if (result.error) {
		return new Response(JSON.stringify({ ok: false, error: 'Database error', detail: result.error.message }), { status: 500, headers: { 'content-type': 'application/json' } });
	}

	const newId = result.data?.[0]?.id || sha;
	return new Response(JSON.stringify({ ok: true, sha: newId }), { headers: { 'content-type': 'application/json' } });
};

export const DELETE = async ({ request, locals }: ApiContext) => {
	const url = new URL(request.url);
	const slug = url.searchParams.get('slug');
	const sha = url.searchParams.get('sha');
	
	if (!slug || !sha) {
		return new Response(JSON.stringify({ ok: false, error: 'Missing fields' }), { status: 400 });
	}

	const { error } = await supabase
		.from('articles')
		.delete()
		.eq('id', sha);

	if (error) {
		return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500, headers: { 'content-type': 'application/json' } });
	}

	return new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json' } });
};
