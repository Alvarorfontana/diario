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
			fonts: [
				{ name: 'Lora', data: loraBold, weight: 700, style: 'normal' },
				{ name: 'Inter', data: interBold, weight: 700, style: 'normal' },
			],
		}
	);
}
