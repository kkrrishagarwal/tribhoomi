"""Remote-inference parsing: union of building-like masks from a Hugging Face segmentation response."""
import base64
import io

import numpy as np
from PIL import Image

from app.ai.extract import masks_to_building_mask, vectorise


def _png(arr: np.ndarray) -> str:
    buf = io.BytesIO(); Image.fromarray((arr * 255).astype(np.uint8), mode="L").save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode()


def test_building_masks_are_unioned_and_other_labels_ignored():
    h, w = 64, 64
    a = np.zeros((h, w), bool); a[0:20, 0:20] = True          # building
    b = np.zeros((h, w), bool); b[40:64, 40:64] = True        # house
    c = np.zeros((h, w), bool); c[20:40, 20:40] = True        # road (must be ignored)
    segs = [{"label": "building", "mask": _png(a)}, {"label": "house", "mask": _png(b)}, {"label": "road", "mask": _png(c)}]
    m = masks_to_building_mask(segs, (w, h))
    assert m[5, 5] and m[50, 50] and not m[30, 30]
    assert m.sum() == a.sum() + b.sum()
    polys = vectorise(m, cell=4, min_area_px=50)
    assert len(polys) == 2


def test_pasted_keys_are_cleaned():
    """The live Cesium key was stored as 'token\\n' and rejected with 401; the same paste would break HF_TOKEN."""
    from app.ai.extract import clean_secret
    assert clean_secret("hf_abc123\n") == "hf_abc123"
    assert clean_secret('  "hf_abc123"  ') == "hf_abc123"
    assert clean_secret("'hf_abc123'\r\n") == "hf_abc123"
    assert clean_secret(None) == "" and clean_secret("   ") == ""
