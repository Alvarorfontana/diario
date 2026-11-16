// Apertura y cierre del flash (diseño OpenFilm).
import { clamp, ease, easeIO, entra } from './anim.js';
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const cap = s => (s = String(s ?? '').trim()) ? s[0].toUpperCase() + s.slice(1) : s;
export function apertura(d) {
  d.temas = d.temas.map(cap);
  document.body.style.background = 'var(--tinta)';
  document.body.innerHTML = `
  <div id="franja" style="position:absolute;left:0;top:0;bottom:0;width:22px;background:var(--rojo);transform-origin:top"></div>
  <div style="position:absolute;left:150px;top:300px">
    <div id="pill" class="pill">${esc(d.pill)}</div>
    <div class="marca" style="margin-top:28px;font-size:120px;line-height:1"><span id="cuadro" class="cuadro" style="width:64px;height:64px;border-radius:12px"></span><span id="nombre">Diario Federal</span></div>
    <div id="fecha" style="margin-top:26px;font-size:32px;font-weight:600;opacity:.75">${esc(d.fecha)}</div>
  </div>
  <div style="position:absolute;left:1180px;top:${Math.max(200, 420 - d.temas.length * 34)}px;width:660px">
    <div style="font-size:22px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;opacity:.6;margin-bottom:28px">En este flash</div>
    ${d.temas.map((x, i) => `<div class="tema" style="display:flex;gap:22px;align-items:baseline;font-size:32px;font-weight:700;margin-bottom:20px"><b style="color:var(--rojo);font-size:27px;font-weight:800">${String(i + 1).padStart(2, '0')}</b>${esc(x)}</div>`).join('')}
  </div>`;
  const $ = s => document.querySelector(s), temas = [...document.querySelectorAll('.tema')];
  window.film = { duration: d.dur, frame(t) {
    $('#franja').style.scale = `1 ${easeIO(t / .8)}`;
    const c = ease((t - .2) / .6); $('#cuadro').style.scale = String(c); $('#cuadro').style.rotate = `${(1 - c) * -90}deg`;
    $('#nombre').style.clipPath = `inset(0 ${(1 - ease((t - .45) / .7)) * 100}% 0 0)`;
    entra($('#pill'), t, .2, .5, 20); entra($('#fecha'), t, 1.0, .6, 20);
    const paso = Math.min(.35, Math.max(.12, (d.dur - 2.6) / Math.max(1, temas.length)));
    temas.forEach((el, i) => entra(el, t, 1.6 + i * paso, .55, 30));
    document.body.style.opacity = String(1 - clamp((t - (d.dur - .45)) / .45));
  } };
}
export function cierre(d) {
  document.body.style.background = 'var(--tinta)';
  document.body.innerHTML = `
  <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center">
    <div id="marca" class="marca" style="font-size:110px;line-height:1"><span class="cuadro" style="width:58px;height:58px;border-radius:11px"></span>Diario Federal</div>
    <div id="lema" style="margin-top:30px;font-size:34px;font-weight:600;opacity:.8;max-width:1100px;line-height:1.35">Periodistas, escritores y pensadores de todo el país</div>
    <div id="url" style="margin-top:46px;display:flex;gap:16px;align-items:center"><span class="pill">Más noticias en</span><span style="font-size:40px;font-weight:800;background:#fff;color:var(--tinta);padding:6px 18px;border-radius:8px">diariofederal.com.ar</span></div>
  </div>`;
  const $ = s => document.querySelector(s);
  window.film = { duration: d.dur, frame(t) {
    const c = ease(t / .7); $('#marca').style.opacity = String(c); $('#marca').style.scale = String(.92 + .08 * c);
    entra($('#lema'), t, .7, .7, 24); entra($('#url'), t, 1.3, .7, 24);
    document.body.style.opacity = String(1 - clamp((t - (d.dur - .8)) / .8));
  } };
}
