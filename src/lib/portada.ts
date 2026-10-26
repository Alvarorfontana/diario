interface NotaDePortada {
	slug: string;
	tapa?: boolean;
	breaking: boolean;
}

export function seleccionarTapa<T extends NotaDePortada>(articulos: T[]): T | null {
	return (
		articulos.find((articulo) => articulo.tapa) ??
		articulos.find((articulo) => articulo.slug === 'riesgo-pais-700-puntos-deuda-2027') ??
		articulos.find((articulo) => articulo.breaking) ??
		articulos[0] ??
		null
	);
}
