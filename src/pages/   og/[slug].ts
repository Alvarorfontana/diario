import { ImageResponse } from '@vercel/og';
import { getCollection } from 'astro:content';

export const prerender = true;

export async function getStaticPaths() {
	const articulos = await getCollection('articulos');
	return articulos.map((articulo) => ({
		params: { slug: articulo.id },
		props: { articulo },
	}));
}

export async function GET({ props, site }: { props: { articulo: any }; site: URL }) {
	const articulo = props.articulo;
	const { title, heroImage } = articulo.data;

	let imageUrl: string | null = null;
	if (typeof heroImage === 'object' && heroImage?.src) {
		imageUrl = new URL(heroImage.src, site).toString();
	} else if (typeof heroImage === 'string' && heroImage.length > 0) {
		imageUrl = heroImage.startsWith('http') ? heroImage : new URL(heroImage, site).toString();
	}

	const tituloCorto = title.length > 85 ? title.slice(0, 82) + '…' : title;

	return new ImageResponse(
		(
			<div
				style={{
					width: '100%',
					height: '100%',
					display: 'flex',
					flexDirection: 'column',
					backgroundColor: '#f6efdf',
					fontFamily: 'serif',
				}}
			>
				{imageUrl && (
					<div style={{ width: '100%', height: '390px', display: 'flex' }}>
						<img
							src={imageUrl}
							style={{ width: '100%', height: '100%', objectFit: 'cover' }}
						/>
					</div>
				)}
				<div
					style={{
						flex: 1,
						display: 'flex',
						flexDirection: 'column',
						justifyContent: 'center',
						gap: '14px',
						padding: '32px 64px',
					}}
				>
					<div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
						<div
							style={{
								width: '14px',
								height: '14px',
								borderRadius: '50%',
								backgroundColor: '#e93323',
							}}
						/>
						<span
							style={{
								color: '#e93323',
								fontSize: '22px',
								fontWeight: 700,
								letterSpacing: '2px',
								textTransform: 'uppercase',
								fontFamily: 'sans-serif',
							}}
						>
							Nota
						</span>
					</div>
					<div
						style={{
							fontWeight: 700,
							fontSize: '46px',
							lineHeight: 1.2,
							color: '#1a1712',
						}}
					>
						{tituloCorto}
					</div>
					<div
						style={{
							fontWeight: 700,
							fontSize: '22px',
							color: '#6b6255',
						}}
					>
						EL DIARIO.
					</div>
				</div>
			</div>
		),
		{
			width: 1200,
			height: 630,
		}
	);
}
