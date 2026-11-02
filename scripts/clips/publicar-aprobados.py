#!/usr/bin/env python3
"""Promueve únicamente clips con aprobación humana registrada."""
import json,shutil
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];DATA=ROOT/"data/clips";SRC=DATA/"revision";APP=DATA/"aprobaciones";OUT=ROOT/"public/clips"
OUT.mkdir(parents=True,exist_ok=True)
manifest=DATA/"revision.json";clips=json.loads(manifest.read_text()) if manifest.exists() else [];byid={c["id"]:c for c in clips}
published_path=DATA/"publicados.json";published=json.loads(published_path.read_text()) if published_path.exists() else [];pub={c["id"]:c for c in published}
for approval_file in APP.glob("*.json"):
 approval=json.loads(approval_file.read_text());cid=approval.get("id");clip=byid.get(cid)
 if not clip:continue
 source=ROOT/clip["archivo"]
 if not source.exists():raise FileNotFoundError(f"Falta el clip aprobado: {source}")
 target=OUT/(cid+".mp4");shutil.copy2(source,target)
 pub[cid]={**clip,"archivo":f"/clips/{cid}.mp4"}
published_path.write_text(json.dumps(list(pub.values()),ensure_ascii=False,indent=2)+"\n")
ts=["// Archivo generado por el workflow. Sólo contiene clips aprobados.","export const CLIPS_GENERADOS = "+json.dumps(list(pub.values()),ensure_ascii=False,indent=2)+" as const;",""]
(ROOT/"src/lib/clips-generados.ts").write_text("\n".join(ts),encoding="utf-8")
