"""Servicio privado de síntesis Qwen3-TTS para Diario Federal.

Ejecutar en un servidor GPU privado. La referencia y su transcripción se configuran
mediante variables de entorno; nunca se guardan en el repositorio.
"""
import io
import os
import re
import secrets
from pathlib import Path

import numpy as np
import soundfile as sf
import torch
from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field
from qwen_tts import Qwen3TTSModel

MODEL_ID = os.getenv("QWEN_MODEL", "Qwen/Qwen3-TTS-12Hz-1.7B-Base")
TOKEN = os.environ["TTS_API_TOKEN"]
REF_AUDIO = os.environ["VOICE_REFERENCE_PATH"]
REF_TEXT = os.environ["VOICE_REFERENCE_TEXT"]
DEVICE = os.getenv("QWEN_DEVICE", "cuda:0")
MAX_CHARS = int(os.getenv("TTS_MAX_CHARS", "280"))

app = FastAPI(title="Diario Federal TTS", docs_url=None, redoc_url=None)
model = None
clone_prompt = None


class SynthesisRequest(BaseModel):
    text: str = Field(min_length=1, max_length=30000)
    language: str = "Spanish"


def split_text(text: str, limit: int = MAX_CHARS):
    sentences = re.split(r"(?<=[.!?;:])\\s+", re.sub(r"\\s+", " ", text.strip()))
    chunks, current = [], ""
    for sentence in sentences:
        while len(sentence) > limit:
            cut = sentence.rfind(" ", 0, limit)
            cut = cut if cut > 0 else limit
            part, sentence = sentence[:cut].strip(), sentence[cut:].strip()
            if current:
                chunks.append(current)
                current = ""
            chunks.append(part)
        if current and len(current) + 1 + len(sentence) > limit:
            chunks.append(current)
            current = sentence
        else:
            current = (current + " " + sentence).strip()
    if current:
        chunks.append(current)
    return chunks


@app.on_event("startup")
def load_model():
    global model, clone_prompt
    if not torch.cuda.is_available():
        raise RuntimeError("Este servicio requiere una GPU CUDA disponible")
    model = Qwen3TTSModel.from_pretrained(
        MODEL_ID,
        device_map=DEVICE,
        dtype=torch.bfloat16,
        attn_implementation="flash_attention_2",
    )
    clone_prompt = model.create_voice_clone_prompt(
        ref_audio=REF_AUDIO,
        ref_text=REF_TEXT,
        x_vector_only_mode=False,
    )


@app.get("/health")
def health():
    return {"status": "ok", "model": MODEL_ID, "voice_loaded": clone_prompt is not None}


@app.post("/v1/synthesize")
def synthesize(payload: SynthesisRequest, authorization: str | None = Header(default=None)):
    expected = f"Bearer {TOKEN}"
    if not authorization or not secrets.compare_digest(authorization, expected):
        raise HTTPException(status_code=401, detail="Unauthorized")
    if model is None or clone_prompt is None:
        raise HTTPException(status_code=503, detail="Model not ready")

    pieces, sample_rate = [], None
    for chunk in split_text(payload.text):
        wavs, sample_rate = model.generate_voice_clone(
            text=chunk,
            language="Spanish",
            voice_clone_prompt=clone_prompt,
        )
        pieces.append(np.asarray(wavs[0], dtype=np.float32).reshape(-1))
        pieces.append(np.zeros(int(sample_rate * 0.20), dtype=np.float32))

    audio = np.concatenate(pieces) if pieces else np.zeros(1, dtype=np.float32)
    buffer = io.BytesIO()
    sf.write(buffer, audio, sample_rate, format="WAV", subtype="PCM_16")
    return Response(
        content=buffer.getvalue(),
        media_type="audio/wav",
        headers={"X-TTS-Model": MODEL_ID},
    )
