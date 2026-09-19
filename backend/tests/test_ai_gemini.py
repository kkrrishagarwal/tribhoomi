"""Gemini mode: parsing the Interactions response and turning outline polygons into a building mask (no network)."""
import json

import numpy as np
import pytest

from app.ai import extract
from app.ai.extract import gemini_error, gemini_items, gemini_polygons_to_mask, vectorise


def _response(text: str, status: str = "completed") -> dict:
    return {"id": "x", "status": status, "steps": [{"type": "thought", "content": []}, {"type": "model_output", "content": [{"type": "text", "text": text}]}]}


SQUARE = {"box_2d": [100, 100, 400, 400], "label": "building", "mask": [[100, 100], [400, 100], [400, 400], [100, 400]]}


def test_items_are_read_from_the_model_output_step():
    assert gemini_items(_response(json.dumps({"boxes": [SQUARE]}))) == [SQUARE]
    assert gemini_items(_response(json.dumps([SQUARE]))) == [SQUARE]                       # bare list
    assert gemini_items(_response("```json\n" + json.dumps({"boxes": [SQUARE]}) + "\n```")) == [SQUARE]   # fenced
    assert gemini_items(_response(json.dumps({"boxes": []}))) == []                        # no buildings is a valid answer


def test_a_non_json_answer_or_unfinished_request_is_a_clear_error():
    with pytest.raises(RuntimeError, match="not with the outline list"):
        gemini_items(_response("I see several buildings."))
    with pytest.raises(RuntimeError, match="status: failed"):
        gemini_items(_response("", status="failed"))


def test_polygons_are_scaled_from_0_1000_to_the_image_and_vectorised():
    w, h = 200, 100   # not square, so an x/y mix-up would show
    tri = {"box_2d": [600, 600, 900, 900], "label": "building", "mask": [[600, 600], [900, 600], [900, 900]]}
    m = gemini_polygons_to_mask([SQUARE, tri], (w, h))
    assert m.shape == (h, w)
    assert m[25, 50] and not m[25, 120]            # inside the square (x 20-80, y 10-40); outside it
    assert m[70, 170] and not m[85, 130]           # inside the triangle; its empty corner
    assert abs(m[:50].sum() - 60 * 30) < 200       # square area ~ 60 x 30 px
    assert len(vectorise(m, cell=4, min_area_px=50)) == 2


def test_bounding_box_is_used_when_the_outline_is_missing():
    m = gemini_polygons_to_mask([{"box_2d": [0, 500, 500, 1000], "label": "building", "mask": []}], (100, 100))   # [ymin, xmin, ymax, xmax]
    assert m[10, 75] and not m[10, 25] and not m[75, 75]


def test_errors_say_what_to_do():
    assert "rejected" in gemini_error(403, '{"error": {"message": "API key not valid."}}') and "API key not valid." in gemini_error(403, '{"error": {"message": "API key not valid."}}')
    assert "quota" in gemini_error(429, "{}")
    assert "GEMINI_MODEL" in gemini_error(404, "not json at all")


def test_gemini_is_preferred_over_hugging_face_when_there_is_no_pytorch(monkeypatch):
    monkeypatch.setattr(extract, "_local_available", lambda: False)
    monkeypatch.setattr(extract, "HF_TOKEN", "hf_x"); monkeypatch.setattr(extract, "GEMINI_API_KEY", "g_x")
    assert extract.mode() == "gemini" and "Gemini" in extract.status()["explanation"]
    monkeypatch.setattr(extract, "GEMINI_API_KEY", "")
    assert extract.mode() == "remote"
    monkeypatch.setattr(extract, "HF_TOKEN", "")
    assert extract.mode() == "off" and "GEMINI_API_KEY" in extract.status()["explanation"]


def test_full_extraction_with_a_faked_gemini_reply(monkeypatch):
    """Request shape + the whole pipeline (mask -> footprints with areas), without the network."""
    import io
    from PIL import Image

    sent = {}

    class FakeReply(io.BytesIO):
        def __enter__(self): return self
        def __exit__(self, *a): return False

    def fake_urlopen(req, timeout=0):
        sent["url"], sent["key"], sent["body"] = req.full_url, req.get_header("X-goog-api-key"), json.loads(req.data)
        return FakeReply(json.dumps(_response(json.dumps({"boxes": [SQUARE]}))).encode())

    monkeypatch.setattr(extract, "_local_available", lambda: False)
    monkeypatch.setattr(extract, "GEMINI_API_KEY", "g_test")
    monkeypatch.setattr(extract.urllib.request, "urlopen", fake_urlopen)
    out = extract.run_extraction(Image.new("RGB", (400, 400), "gray"), m_per_px=0.5)

    assert sent["url"].endswith("/v1beta/interactions") and sent["key"] == "g_test"
    assert sent["body"]["store"] is False and sent["body"]["input"][1]["type"] == "image" and sent["body"]["input"][1]["mime_type"] == "image/jpeg"
    assert out["footprints_found"] == 1 and out["source"].startswith("Google Gemini") and out["model_id"] == extract.GEMINI_MODEL
    area = out["footprints"]["features"][0]["properties"]["area_sqm"]
    assert 3000 < area < 4200        # 120 px x 120 px at 0.5 m/px = 3600 m2 (vectorise works on an 8 px grid)
