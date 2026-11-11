# Voz clonada

Acá va `referencia.enc`: la grabación de la voz de Álvaro, **cifrada**. El repositorio es público y con la
grabación en claro cualquiera podría copiar la voz, por eso nunca se sube sin cifrar.

- La clave está en el secreto `VOZ_CLAVE` de GitHub (Settings → Secrets and variables → Actions).
- La usan `scripts/voz_clonada.py`, el flash (voz «Mi voz (clonada)» en /admin/flash) y el audio de las notas
  (Actions → Audio de las notas → voz `clonada`).
- Modelo: Chatterbox Multilingual de Resemble AI, licencia MIT. Cada audio lleva una marca de agua invisible
  (PerTh) que permite detectar que es voz sintética.
- Si falta la clave o el archivo, el flash y las notas salen con Tomás, sin cortarse.
