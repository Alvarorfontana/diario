// Conversor mínimo Markdown → HTML, solo para abrir en el editor visual las notas viejas.
const inline = (s: string) =>
	s
		.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
		.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
		.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');

export function looksLikeHtml(text: string): boolean {
	return /<(p|h2|h3|ul|ol|blockquote|figure|div)[\s>]/i.test(text);
}

export function mdToHtml(md: string): string {
	if (looksLikeHtml(md)) return md;
	return md
		.replace(/\r\n/g, '\n')
		.split(/\n{2,}/)
		.map((b) => b.trim())
		.filter(Boolean)
		.map((b) => {
			const h = b.match(/^(#{1,6})\s+(.*)$/s);
			if (h) return `<h${h[1].length === 3 ? 3 : 2}>${inline(h[2])}</h${h[1].length === 3 ? 3 : 2}>`;
			if (/^(-{3,}|\*{3,})$/.test(b)) return '<hr>';
			if (b.split('\n').every((l) => /^>\s?/.test(l))) return `<blockquote><p>${inline(b.replace(/^>\s?/gm, '').replace(/\n/g, ' '))}</p></blockquote>`;
			if (b.split('\n').every((l) => /^[-*]\s+/.test(l)))
				return `<ul>${b.split('\n').map((l) => `<li>${inline(l.replace(/^[-*]\s+/, ''))}</li>`).join('')}</ul>`;
			if (b.split('\n').every((l) => /^\d+[.)]\s+/.test(l)))
				return `<ol>${b.split('\n').map((l) => `<li>${inline(l.replace(/^\d+[.)]\s+/, ''))}</li>`).join('')}</ol>`;
			return `<p>${inline(b.replace(/\n/g, ' '))}</p>`;
		})
		.join('\n');
}

// Prepara el HTML del editor para guardarlo dentro de un .md sin líneas en blanco
// (así el Markdown lo trata como un único bloque HTML y no lo rompe).
export function htmlParaArchivo(html: string): string {
	return html
		.replace(/<script[\s\S]*?<\/script>/gi, '')
		.replace(/\son\w+="[^"]*"/gi, '')
		.replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, (m) =>
			/src="https:\/\/www\.youtube(-nocookie)?\.com\/embed\/[\w-]{11}"/.test(m) ? m : ''
		)
		.replace(/(<\/(?:p|h2|h3|ul|ol|li|blockquote|figure|figcaption)>|<hr\s*\/?>)\s*/gi, '$1\n')
		.replace(/\n{2,}/g, '\n')
		.trim();
}
