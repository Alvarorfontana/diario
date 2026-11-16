// Ayudas de animación: todo depende solo de t (mismo t, mismo cuadro).
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const ease = x => { x = clamp(x); return 1 - Math.pow(1 - x, 3); };           // salida suave
export const easeIO = x => { x = clamp(x); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
export const prog = (t, ini, dur) => ease((t - ini) / dur);
// Entrada de un elemento: sube y aparece; salida al final del clip.
export function entra(el, t, ini, dur = .6, dist = 40, fin = Infinity) {
  const p = prog(t, ini, dur), q = fin === Infinity ? 0 : clamp((t - fin) / .35);
  el.style.opacity = String(p * (1 - q));
  el.style.translate = `0 ${(1 - p) * dist - q * 20}px`;
}
