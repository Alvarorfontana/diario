// Placa de una noticia del flash (diseño OpenFilm). Todo depende solo de t.
import { clamp, ease, easeIO, entra } from './anim.js';
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const cap = s => (s = String(s ?? '').trim()) ? s[0].toUpperCase() + s.slice(1) : s;
export function placa(d) {
  d.titulo = cap(d.titulo); d.bajada = cap(d.bajada); d.temas = d.temas.map(cap);
  const n = d.n, total = d.temas.length;
  document.body.innerHTML = `
  <div id="cortina" style="position:absolute;inset:0;background:var(--rojo);z-index:9"></div>
  <div id="cortina2" style="position:absolute;inset:0;background:var(--tinta);z-index:8"></div>
  <header style="position:absolute;left:96px;right:96px;top:48px;height:60px;display:flex;align-items:center;justify-content:space-between">
    <div class="marca" style="font-size:38px"><span class="cuadro"></span>Diario Federal <span class="pill" style="margin-left:10px">${esc(d.pill)}</span></div>
    <div style="font-size:22px;font-weight:600;opacity:.8">${esc(d.fecha)}</div>
  </header>
  <div style="position:absolute;left:96px;right:96px;top:122px;display:flex;gap:14px">
    ${d.temas.map((x, i) => `<div style="flex:1;min-width:0"><div style="height:6px;border-radius:3px;background:rgba(255,255,255,.22);overflow:hidden"><div class="lleno" style="height:100%;width:0;background:${i === n - 1 ? 'var(--rojo)' : '#fff'}"></div></div>
      <div style="margin-top:10px;font-size:19px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:${i === n - 1 ? 800 : 600};opacity:${i === n - 1 ? 1 : .55}">${String(i + 1).padStart(2, '0')} · ${esc(x)}</div></div>`).join('')}
  </div>
  <aside style="position:absolute;left:1262px;top:236px;width:566px">
    <div id="num" style="font-size:150px;font-weight:800;line-height:.85;letter-spacing:-.05em;color:var(--rojo)">${String(n).padStart(2, '0')}</div>
    ${d.kicker ? `<div id="kicker" style="margin-top:26px;font-size:22px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#ff5a6a">${esc(d.kicker)}</div>` : ''}
    <h1 style="margin-top:16px;font-size:${d.titulo.length > 60 ? 48 : 58}px;line-height:1.04;font-weight:800;letter-spacing:-.025em">${d.titulo.split(/\s+/).map(w => `<span class="pal" style="display:inline-block">${esc(w)}&nbsp;</span>`).join('')}</h1>
    ${d.dato ? `<div id="dato" style="margin-top:30px;display:inline-block;background:var(--rojo);font-size:34px;font-weight:800;padding:10px 18px;border-radius:8px">${esc(d.dato)}</div>` : ''}
    ${d.bajada ? `<p id="bajada" style="margin-top:26px;font-size:27px;line-height:1.38;font-weight:600;color:rgba(255,255,255,.86)">${esc(d.bajada)}</p>` : ''}
  </aside>
  ${(d.epigrafe || d.fuente) ? `<footer id="pie" style="position:absolute;left:96px;top:842px;width:1110px;display:flex;justify-content:space-between;gap:20px;font-size:21px;font-weight:600">
    <span style="opacity:.92">${esc(d.epigrafe)}</span><span style="opacity:.7;white-space:nowrap">${d.fuente ? 'Fuente: ' + esc(d.fuente) : ''}</span></footer>` : ''}
  <div id="subs" class="subs"></div>
  <div style="position:absolute;right:96px;bottom:40px;font-size:22px;font-weight:700;opacity:.6">diariofederal.com.ar</div>`;
  const $ = s => document.querySelector(s), pals = [...document.querySelectorAll('.pal')], llenos = [...document.querySelectorAll('.lleno')];
  const trozos = d.trozos || [];
  window.film = {
    duration: d.dur,
    frame(t) {
      $('#cortina').style.clipPath = `inset(0 0 0 ${easeIO(t / .7) * 100}%)`;
      $('#cortina2').style.clipPath = `inset(0 0 0 ${easeIO((t - .12) / .7) * 100}%)`;
      $('#cortina2').style.display = t > .9 ? 'none' : 'block';
      llenos.forEach((el, i) => { el.style.width = i < n - 1 ? '100%' : i === n - 1 ? `${clamp(t / d.dur) * 100}%` : '0'; });
      entra($('#num'), t, .45, .7, 60);
      if ($('#kicker')) entra($('#kicker'), t, .6);
      pals.forEach((el, i) => entra(el, t, .7 + i * .06, .55, 50));
      if ($('#dato')) entra($('#dato'), t, 1.1 + pals.length * .06, .6);
      if ($('#bajada')) entra($('#bajada'), t, 1.4 + pals.length * .06, .7);
      if ($('#pie')) entra($('#pie'), t, 1.0, .6, 20);
      // subtítulos palabra por palabra, con los tiempos reales de la voz
      const tv = t - d.offVoz, sub = $('#subs');
      const tr = trozos.find(z => z.length && tv >= z[0][1] - .05 && tv <= z[z.length - 1][2] + .35);
      sub.innerHTML = tr ? tr.map(([w, a, b]) => `<span class="w ${tv >= a && tv < b ? 'ahora' : tv >= a ? 'dicha' : ''}">${esc(w)}</span>`).join(' ') : '';
    }
  };
}
