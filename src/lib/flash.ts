// Videos "Flash" del diario (los arma /admin/flash y GitHub Actions).
// Se leen de data/flash/*.json al publicar el sitio; sólo se muestran los publicados.
export interface FlashBloque { kicker?: string; titulo?: string; dato?: string; bajada?: string; texto?: string; epigrafe?: string; fuente?: string }
export interface Flash {
	id: string;
	tipo: 'semanal' | 'ultimo';
	titulo: string;
	fecha: string;
	bloques: FlashBloque[];
	publicado?: boolean;
	video?: string;
	miniatura?: string;
	version?: string;
	duracion?: number;
}

const archivos = import.meta.glob('../../data/flash/*.json', { eager: true, import: 'default' }) as Record<string, any>;

export const FLASHES: Flash[] = Object.entries(archivos)
	.filter(([ruta]) => !/\/(pronunciacion|calibracion)\.json$/.test(ruta))
	.map(([, d]) => d as Flash)
	.filter((f) => f && f.publicado === true && f.video)
	.sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)) || String(b.version ?? '').localeCompare(String(a.version ?? '')));

export const ultimoFlash = (): Flash | undefined => FLASHES[0];

export const videoUrl = (f: Flash) => `${f.video}${f.version ? `?v=${f.version}` : ''}`;
export const miniUrl = (f: Flash) => (f.miniatura ? `${f.miniatura}${f.version ? `?v=${f.version}` : ''}` : undefined);

export function mmss(s?: number) {
	if (!s) return '';
	const t = Math.round(s);
	return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

export function fechaLarga(iso: string) {
	const d = new Date(`${iso}T12:00:00-03:00`);
	return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' });
}

export const etiqueta = (f: Flash) => (f.tipo === 'ultimo' ? 'Último momento' : 'Flash semanal');
