"""Voz clonada de Álvaro para el flash y el audio de las notas.

Usa Chatterbox Multilingual (Resemble AI, licencia MIT): copia la voz a partir de una grabación corta, sin
entrenamiento, y lee en castellano. Cada audio lleva una marca de agua invisible (PerTh) que permite detectar
que es voz sintética.

La grabación de referencia NO se publica en claro: el repositorio es público y con ella cualquiera podría
copiar la voz. Va cifrada en data/voz/referencia.enc y la clave queda en el secreto VOZ_CLAVE de GitHub.
(También acepta la grabación entera en base64 en el secreto VOZ_REFERENCIA_B64, si entra en 48 KB.)

Para cifrar una grabación nueva (en cualquier máquina con ffmpeg y openssl):
  ffmpeg -i grabacion.m4a -ac 1 -ar 24000 -t 25 ref.wav
  openssl enc -aes-256-cbc -pbkdf2 -salt -in ref.wav -out data/voz/referencia.enc -pass pass:LA_CLAVE

Si falta la clave, la grabación o el modelo falla, quien llama vuelve a la voz de siempre (Tomás).
"""
import base64
import os
import re
import subprocess
import wave
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
CIFRADA = RAIZ / "data" / "voz" / "referencia.enc"
NOMBRE = "clonada"
_modelo = None


def disponible():
    return bool(os.environ.get("VOZ_REFERENCIA_B64") or (CIFRADA.exists() and os.environ.get("VOZ_CLAVE")))


def referencia(tmp):
    """Deja la grabación de referencia en un WAV temporal y devuelve su ruta."""
    tmp = Path(tmp)
    crudo = tmp / "ref-crudo"
    if os.environ.get("VOZ_REFERENCIA_B64"):
        crudo.write_bytes(base64.b64decode(os.environ["VOZ_REFERENCIA_B64"]))
    elif CIFRADA.exists() and os.environ.get("VOZ_CLAVE"):
        subprocess.run(["openssl", "enc", "-d", "-aes-256-cbc", "-pbkdf2", "-in", str(CIFRADA), "-out", str(crudo),
                        "-pass", "env:VOZ_CLAVE"], check=True)
    else:
        raise RuntimeError("falta la grabación de referencia (data/voz/referencia.enc + secreto VOZ_CLAVE)")
    ref = tmp / "referencia.wav"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(crudo), "-ac", "1", "-ar", "24000", "-t", "30", str(ref)],
                   check=True)
    crudo.unlink(missing_ok=True)
    return ref


def trozos(texto, maximo=260):
    """Corta en oraciones de hasta ~260 caracteres: el modelo lee mejor de a pedazos."""
    oraciones = re.split(r"(?<=[.!?;:])\s+", re.sub(r"\s+", " ", texto.strip()))
    out, cur = [], ""
    for o in oraciones:
        if not o:
            continue
        if len(o) > maximo:
            partes = re.split(r"(?<=,)\s+", o)
        else:
            partes = [o]
        for p in partes:
            if cur and len(cur) + 1 + len(p) > maximo:
                out.append(cur)
                cur = p
            else:
                cur = (cur + " " + p).strip()
    if cur:
        out.append(cur)
    return out


def modelo():
    global _modelo
    if _modelo is None:
        from chatterbox.mtl_tts import ChatterboxMultilingualTTS
        _modelo = ChatterboxMultilingualTTS.from_pretrained(device="cpu")
    return _modelo


def generar(texto, destino_wav, tmp, velocidad=0, ref=None):
    """Lee el texto con la voz clonada y lo guarda como WAV mono. velocidad en % (como Edge TTS)."""
    import numpy as np
    ref = ref or referencia(tmp)
    m = modelo()
    pausa = np.zeros(int(m.sr * 0.22), dtype=np.float32)
    partes = []
    for tz in trozos(texto):
        wav = m.generate(tz, language_id="es", audio_prompt_path=str(ref))
        partes += [wav.squeeze().detach().cpu().numpy().astype(np.float32), pausa]
    audio = np.concatenate(partes) if partes else pausa
    crudo = Path(tmp) / (Path(destino_wav).stem + "-clon.wav")
    with wave.open(str(crudo), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(m.sr)
        w.writeframes((np.clip(audio, -1, 1) * 32767).astype(np.int16).tobytes())
    filtro = f"atempo={max(0.5, min(2.0, 1 + float(velocidad) / 100)):.3f}" if velocidad else "anull"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(crudo), "-af", filtro, "-ac", "1", "-ar", "24000",
                    str(destino_wav)], check=True)
    crudo.unlink(missing_ok=True)
    return destino_wav
