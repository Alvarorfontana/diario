import { ImageResponse } from '@vercel/og';
import { getCollection } from 'astro:content';

export const prerender = true;

export async function getStaticPaths() {
	const articulos = await getCollection('articulos');
	return articulos.map((articulo) => ({
		params: { slug: articulo.id },
		props: articulo,
	}));
}

export async function GET({ props, site }: { props: any; site: URL }) {
	const { data } = props;
	const { title, heroImage } = data;

	let imageUrl: string | null = null;
	if (typeof heroImage === 'object' && heroImage?.src) {
		imageUrl = new URL(heroImage.src, site).toString();
	} else if (typeof heroImage === 'string' && heroImage.length > 0) {
		imageUrl = heroImage.startsWith('http') ? heroImage : new URL(heroImage, site).toString();
	}

	const tituloCorto = title.length > 85 ? title.slice(0, 82) + '…' : title;

	const panelTexto = {
		type: 'div',
		props: {
			style: {
				flex: 1,
				display: 'flex',
				flexDirection: 'column',
				justifyContent: 'center',
				gap: '14px',
				padding: '32px 64px',
			},
			children: [
				{
					type: 'div',
					props: {
						style: { display: 'flex', alignItems: 'center', gap: '10px' },
						children: [
							{
								type: 'div',
								props: {
									style: {
										width: '14px',
										height: '14px',
										borderRadius: '50%',
										background: '#e93323',
										display: 'flex',
									},
								},
							},
							{
								type: 'span',
								props: {
									style: {
										color: '#e93323',
										fontSize: '22px',
										fontWeight: 700,
										letterSpacing: '2px',
										textTransform: 'uppercase',
										fontFamily: 'sans-serif',
									},
									children: 'Nota',
								},
							},
						],
					},
				},
				{
					type: 'div',
					props: {
						style: {
							fontFamily: 'serif',
							fontWeight: 700,
							fontSize: '46px',
							lineHeight: 1.2,
							color: '#1a1712',
							display: 'flex',
						},
						children: tituloCorto,
					},
				},
				{
					type: 'div',
					props: {
						style: {
							fontFamily: 'serif',
							fontWeight: 700,
							fontSize: '22px',
							color: '#6b6255',
							display: 'flex',
						},
						children: 'EL DIARIO.',
					},
				},
			],
		},
	};

	const children = [];
	if (imageUrl) {
		children.push({
			type: 'div',
			props: {
				style: { width: '1200px', height: '390px', display: 'flex' },
				children: {
					type: 'img',
					props: {
						src: imageUrl,
						width: 1200,
						height: 390,
						style: { width: '1200px', height: '390px', objectFit: 'cover' },
					},
				},
			},
		});
	}
	children.push(panelTexto);

	return new ImageResponse(
		{
			type: 'div',
			props: {
				style: {
					width: '1200px',
					height: '630px',
					display: 'flex',
					flexDirection: 'column',
					background: '#f6efdf',
				},
				children,
			},
		},
		{
			width: 1200,
			height: 630,
		}
	);
}
