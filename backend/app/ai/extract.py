"""
Building-footprint extraction with a pretrained semantic-segmentation model.

Model: nvidia/segformer-b0-finetuned-ade-512-512 (Hugging Face). It is trained
on ADE20K, whose label set includes "building", "house" and "skyscraper".
We run it once per request on CPU, keep only those classes, and vectorise the
resulting mask into polygons. No training happens here; the point of the demo
is to show that the surface footprint that anchors a 3D ULPIN can be derived
from imagery automatically rather than digitised by hand.
"""
from __future__ import annotations

import base64
import io
import json
import os
import threading
import time
import urllib.error
import urllib.request

import numpy as np
from PIL import Image
from shapely.geometry import box, mapping
from shapely.ops import unary_union

from ..config import AI_MODEL_ID, SAMPLE_DIR

_lock = threading.Lock()
_model = None
_processor = None
_building_ids: list[int] = []
_load_error: str | None = None

# Esri World Imagery zoom 18 at latitude 28.57 N (Noida) -> ~0.52 m per pixel
SAMPLE_M_PER_PX = 0.524


def clean_secret(value: str | None) -> str:
    """A key pasted into a hosting dashboard often arrives with a trailing newline, spaces or quotes; any of those makes the provider reject it."""
    return (value or "").strip().strip("\"'").strip()


# HF_TOKEN is the documented name; the others are what Hugging Face's own tools use, so accept them too.
HF_TOKEN = next((t for t in (clean_secret(os.getenv(k)) for k in ("HF_TOKEN", "HUGGINGFACEHUB_API_TOKEN", "HUGGING_FACE_HUB_TOKEN", "HF_API_TOKEN")) if t), "")
# Google Gemini (free key from https://aistudio.google.com/apikey). No PyTorch needed, so it fits a 512 MB host.
GEMINI_API_KEY = next((t for t in (clean_secret(os.getenv(k)) for k in ("GEMINI_API_KEY", "GOOGLE_API_KEY")) if t), "")
GEMINI_MODEL = clean_secret(os.getenv("GEMINI_MODEL")) or "gemini-3.8-flash"
GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/interactions"
GEMINI_PROMPT = (
    "This is an aerial / satellite photo. Give the segmentation masks for every building roof (houses, apartment blocks, "
    "towers, sheds). Ignore roads, trees, vehicles, fields and water.\n"
    "Output a JSON list of segmentation masks where each entry contains the 2D bounding box in the key \"box_2d\", "
    "the segmentation mask in key \"mask\", and the text label in the key \"label\". Use the label \"building\"."
)
BUILDING_LABELS = ("building", "house", "skyscraper")


def _local_available() -> bool:
    try:
        import torch  # noqa: F401
        import transformers  # noqa: F401
        return True
    except Exception:
        return False


def mode() -> str:
    """local = torch installed here; gemini = Google Gemini API via GEMINI_API_KEY; remote = Hugging Face via HF_TOKEN; off = none."""
    if _local_available():
        return "local"
    if GEMINI_API_KEY:
        return "gemini"
    if HF_TOKEN:
        return "remote"
    return "off"


def status() -> dict:
    m = mode()
    explain = {
        "local": "Model runs on this server (PyTorch installed).",
        "gemini": f"This server has no PyTorch; the image is sent to Google Gemini ({GEMINI_MODEL}), which returns building outlines.",
        "remote": "This server has no PyTorch; inference is sent to the Hugging Face Inference API with your token.",
        "off": "This server has no PyTorch and no AI key, so the AI demo is disabled here. It runs locally with ./dev.sh, "
               "or set GEMINI_API_KEY (or HF_TOKEN) on the host to use remote inference.",
    }[m]
    return {"model_id": GEMINI_MODEL if m == "gemini" else AI_MODEL_ID, "mode": m, "loaded": _model is not None, "error": _load_error,
            "building_classes": _building_ids, "explanation": explain}


def _load():
    global _model, _processor, _building_ids, _load_error
    if _model is not None or _load_error:
        return
    with _lock:
        if _model is not None:
            return
        try:
            import torch  # noqa: F401
            from transformers import AutoImageProcessor, SegformerForSemanticSegmentation

            _processor = AutoImageProcessor.from_pretrained(AI_MODEL_ID)
            _model = SegformerForSemanticSegmentation.from_pretrained(AI_MODEL_ID).eval()
            wanted = ("building", "house", "skyscraper")
            _building_ids = [int(i) for i, name in _model.config.id2label.items()
                             if any(w in name.lower() for w in wanted)]
        except Exception as e:  # pragma: no cover - depends on environment
            _load_error = f"{type(e).__name__}: {e}"


def sample_image_path():
    return SAMPLE_DIR / "aerial.jpg"


def remote_mask(image: Image.Image) -> tuple[np.ndarray, int]:
    """
    Hugging Face Inference API: image-segmentation returns one PNG mask per label.
    We union the building-like labels. Needs HF_TOKEN; the model may need ~20 s to warm up.
    """
    buf = io.BytesIO(); image.convert("RGB").save(buf, format="JPEG", quality=92)
    req = urllib.request.Request(f"https://api-inference.huggingface.co/models/{AI_MODEL_ID}", data=buf.getvalue(),
                                 headers={"Authorization": f"Bearer {HF_TOKEN}", "Content-Type": "image/jpeg", "x-wait-for-model": "true"})
    t0 = time.perf_counter()
    with urllib.request.urlopen(req, timeout=120) as r:
        payload = json.loads(r.read().decode())
    if isinstance(payload, dict) and "error" in payload:
        raise RuntimeError(f"Hugging Face API: {payload['error']}")
    return masks_to_building_mask(payload, image.size), round((time.perf_counter() - t0) * 1000)


def gemini_mask(image: Image.Image) -> tuple[np.ndarray, int]:
    """Ask Gemini for building outlines (polygons, 0-1000 normalised) and rasterise them into a mask."""
    small = image.convert("RGB"); small.thumbnail((1024, 1024))   # outlines are normalised, so a smaller upload loses nothing
    buf = io.BytesIO(); small.save(buf, format="JPEG", quality=90)
    item = {"type": "object", "required": ["box_2d", "mask", "label"], "properties": {
        "box_2d": {"type": "array", "items": {"type": "integer"}},
        "mask": {"type": "array", "items": {"type": "array", "items": {"type": "integer"}}},
        "label": {"type": "string"}}}
    body = {"model": GEMINI_MODEL, "store": False, "generation_config": {"thinking_level": "minimal"},
            "input": [{"type": "text", "text": GEMINI_PROMPT}, {"type": "image", "data": base64.b64encode(buf.getvalue()).decode(), "mime_type": "image/jpeg"}],
            "response_format": {"type": "text", "mime_type": "application/json",
                                "schema": {"type": "object", "required": ["boxes"], "properties": {"boxes": {"type": "array", "items": item}}}}}
    req = urllib.request.Request(GEMINI_URL, data=json.dumps(body).encode(), headers={"x-goog-api-key": GEMINI_API_KEY, "Content-Type": "application/json"})
    t0 = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            payload = json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        raise RuntimeError(gemini_error(e.code, e.read().decode(errors="replace"))) from None
    items = gemini_items(payload)
    return gemini_polygons_to_mask(items, image.size), round((time.perf_counter() - t0) * 1000)


def gemini_error(code: int, body: str) -> str:
    """Turn Google's error JSON into one sentence that says what to do. Pure; unit-tested."""
    try:
        msg = json.loads(body).get("error", {}).get("message", "")
    except Exception:
        msg = body[:160]
    hint = {400: "Check GEMINI_API_KEY and GEMINI_MODEL.", 401: "GEMINI_API_KEY was rejected.", 403: "GEMINI_API_KEY was rejected or is not allowed to use this model.",
            404: f"Model '{GEMINI_MODEL}' was not found; set GEMINI_MODEL to a current Gemini model.", 429: "The free Gemini quota is used up for now; try again in a minute."}.get(code, "")
    return f"Gemini API error {code}. {hint} {msg}".strip()


def gemini_items(payload: dict) -> list:
    """Find the model's JSON answer inside an Interactions response and return its list of objects. Pure; unit-tested."""
    if payload.get("status") not in (None, "completed"):
        raise RuntimeError(f"Gemini did not finish the request (status: {payload.get('status')}).")
    texts = [c.get("text", "") for st in payload.get("steps", []) if st.get("type") == "model_output" for c in st.get("content", []) if c.get("type") == "text"]
    for text in reversed(texts):
        text = text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        try:
            data = json.loads(text)
        except ValueError:
            continue
        if isinstance(data, dict):
            data = data.get("boxes", [])
        if isinstance(data, list):
            return [d for d in data if isinstance(d, dict)]
    raise RuntimeError("Gemini answered, but not with the outline list that was asked for. Try again.")


def gemini_polygons_to_mask(items: list, size: tuple[int, int]) -> np.ndarray:
    """Rasterise outlines given as [x, y] points normalised to 0-1000 (box_2d = [ymin, xmin, ymax, xmax] as a fallback). Pure; unit-tested."""
    from PIL import ImageDraw
    w, h = size
    canvas = Image.new("L", (w, h), 0)
    draw = ImageDraw.Draw(canvas)
    for it in items:
        pts = [(p[0] / 1000 * w, p[1] / 1000 * h) for p in it.get("mask") or [] if isinstance(p, (list, tuple)) and len(p) >= 2]
        box = it.get("box_2d") or []
        if len(pts) >= 3:
            draw.polygon(pts, fill=255)
        elif len(box) == 4:   # no usable outline: the bounding box is still a fair footprint for a roof seen from above
            y0, x0, y1, x1 = box
            draw.rectangle([x0 / 1000 * w, y0 / 1000 * h, x1 / 1000 * w, y1 / 1000 * h], fill=255)
    return np.array(canvas) > 127


def masks_to_building_mask(segments: list, size: tuple[int, int]) -> np.ndarray:
    """Union the base64 PNG masks whose label looks like a building. Pure; unit-tested."""
    w, h = size
    out = np.zeros((h, w), dtype=bool)
    for seg in segments:
        label = str(seg.get("label", "")).lower()
        if not any(b in label for b in BUILDING_LABELS):
            continue
        m = Image.open(io.BytesIO(base64.b64decode(seg["mask"]))).convert("L").resize((w, h))
        out |= np.array(m) > 127
    return out


def run_extraction(image: Image.Image, m_per_px: float = SAMPLE_M_PER_PX) -> dict:
    image = image.convert("RGB")
    if mode() == "gemini":
        mask, infer_ms = gemini_mask(image)
        return _package(image, mask, infer_ms, m_per_px, source=f"Google Gemini ({GEMINI_MODEL})")
    if mode() == "remote":
        mask, infer_ms = remote_mask(image)
        return _package(image, mask, infer_ms, m_per_px, source="Hugging Face Inference API (remote)")
    _load()
    if _model is None:
        raise RuntimeError(_load_error or status()["explanation"])
    import torch

    t0 = time.perf_counter()
    inputs = _processor(images=image, return_tensors="pt")
    with torch.no_grad():
        logits = _model(**inputs).logits  # (1, classes, h/4, w/4)
    up = torch.nn.functional.interpolate(logits, size=image.size[::-1], mode="bilinear", align_corners=False)
    pred = up.argmax(dim=1)[0].cpu().numpy()
    infer_ms = round((time.perf_counter() - t0) * 1000)
    mask = np.isin(pred, _building_ids)
    return _package(image, mask, infer_ms, m_per_px, source="local PyTorch")


def _package(image: Image.Image, mask: np.ndarray, infer_ms: int, m_per_px: float, source: str) -> dict:
    coverage = float(mask.mean())

    polygons = vectorise(mask, cell=8)
    features = []
    for i, poly in enumerate(polygons, 1):
        area_px = poly.area
        features.append({
            "type": "Feature",
            "id": i,
            "geometry": mapping(poly),
            "properties": {"area_px": round(area_px), "area_sqm": round(area_px * m_per_px ** 2),
                           "candidate_parcel_no": i},
        })

    return {
        "model_id": GEMINI_MODEL if source.startswith("Google Gemini") else AI_MODEL_ID,
        "source": source,
        "inference_ms": infer_ms,
        "image_size": list(image.size),
        "building_pixel_share": round(coverage, 4),
        "footprints_found": len(features),
        "mask_png_base64": mask_to_png_base64(mask),
        "overlay_png_base64": overlay_png_base64(image, mask),
        "footprints": {"type": "FeatureCollection", "features": features},
    }


def vectorise(mask: np.ndarray, cell: int = 8, min_area_px: float = 600):
    """
    Cheap raster->vector: chop the mask into cell x cell squares, keep squares that are
    mostly building, union them, simplify. Good enough for a demo; a production pipeline
    would use proper contour tracing (e.g. rasterio.features.shapes).
    """
    h, w = mask.shape
    squares = []
    for y in range(0, h, cell):
        for x in range(0, w, cell):
            block = mask[y:y + cell, x:x + cell]
            if block.mean() >= 0.5:
                squares.append(box(x, y, x + block.shape[1], y + block.shape[0]))
    if not squares:
        return []
    merged = unary_union(squares)
    polys = list(merged.geoms) if merged.geom_type == "MultiPolygon" else [merged]
    polys = [p.simplify(cell * 0.6, preserve_topology=True) for p in polys if p.area >= min_area_px]
    polys.sort(key=lambda p: -p.area)
    return polys[:40]


def mask_to_png_base64(mask: np.ndarray) -> str:
    img = Image.fromarray((mask * 255).astype(np.uint8), mode="L")
    return _b64(img)


def overlay_png_base64(image: Image.Image, mask: np.ndarray) -> str:
    base = np.array(image).astype(np.float32)
    colour = np.array([255, 80, 40], dtype=np.float32)
    out = base.copy()
    out[mask] = base[mask] * 0.45 + colour * 0.55
    return _b64(Image.fromarray(out.astype(np.uint8)))


def _b64(img: Image.Image) -> str:
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode()
