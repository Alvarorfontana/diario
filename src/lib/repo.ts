// Repo y rama de GitHub donde el sitio guarda notas, fotos, comentarios, etc.
// Orden: 1) variables GITHUB_REPO / GITHUB_BRANCH  2) el repo y la rama de Vercel
// (Vercel los informa solo: cada proyecto escribe en SU propio repo)  3) el repo original (solo para desarrollo local).
const ie: any = import.meta.env;
const pe: any = typeof process !== 'undefined' ? process.env : {};
const pick = (...keys: string[]): string | undefined => {
	for (const k of keys) {
		const v = ie[k] || pe[k];
		if (v) return String(v);
	}
	return undefined;
};

export function getRepo(): { repo: string; branch: string } {
	const owner = pick('VERCEL_GIT_REPO_OWNER');
	const slug = pick('VERCEL_GIT_REPO_SLUG');
	return {
		repo: pick('GITHUB_REPO') || (owner && slug ? `${owner}/${slug}` : 'Alvarorfontana/diario'),
		branch: pick('GITHUB_BRANCH', 'VERCEL_GIT_COMMIT_REF') || 'main',
	};
}
