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
import threading
import time

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


def status() -> dict:
    return {"model_id": AI_MODEL_ID, "loaded": _model is not None, "error": _load_error,
            "building_classes": _building_ids}


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


def run_extraction(image: Image.Image, m_per_px: float = SAMPLE_M_PER_PX) -> dict:
    _load()
    if _model is None:
        raise RuntimeError(_load_error or "model not loaded")
    import torch

    image = image.convert("RGB")
    t0 = time.perf_counter()
    inputs = _processor(images=image, return_tensors="pt")
    with torch.no_grad():
        logits = _model(**inputs).logits  # (1, classes, h/4, w/4)
    up = torch.nn.functional.interpolate(logits, size=image.size[::-1], mode="bilinear", align_corners=False)
    pred = up.argmax(dim=1)[0].cpu().numpy()
    infer_ms = round((time.perf_counter() - t0) * 1000)

    mask = np.isin(pred, _building_ids)
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
        "model_id": AI_MODEL_ID,
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
