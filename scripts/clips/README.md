# Clips automáticos

El workflow \`.github/workflows/clips-automaticos.yml\` procesa trabajos JSON en \`data/clips/\`.
El motor usa faster-whisper para transcribir en español, selecciona hasta tres fragmentos no superpuestos,
genera locución neural argentina con Edge TTS, subtítulos y mezcla música instrumental.
Los MP4 finales quedan en \`public/clips/\` y el índice en \`data/clips/publicados.json\`.

Formato de trabajo:
\`\`\`json
{
  "id": "entrevista-ejemplo",
  "titulo": "Entrevista",
  "archivo": "entrevista-ejemplo.mp4",
  "cantidad": 3,
  "estado": "pendiente"
}
\`\`\`

El video fuente se deposita en \`data/clips/entrada/\` (se admiten partes .part000, .part001, etc.).
El procesamiento requiere que el workflow tenga acceso al video fuente. No subir material de terceros
sin autorización. La locución reproduce el contenido transcripto del fragmento; revisar nombres propios
y cifras antes de difundir.
