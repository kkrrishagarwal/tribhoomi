"""Gemini mode: parsing the Interactions response and turning outline polygons into a building mask (no network)."""
import json

import numpy as np
import pytest

from app.ai import extract
from app.ai.extract import footprints_to_mask, gemini_error, gemini_footprints, gemini_items


def _response(text: str, status: str = "completed") -> dict:
    return {"id": "x", "status": status, "steps": [{"type": "thought", "content": []}, {"type": "model_output", "content": [{"type": "text", "text": text}]}]}


SQUARE = {"box_2d": [100, 100, 400, 400], "label": "building", "outline": [{"x": 100, "y": 100}, {"x": 400, "y": 100}, {"x": 400, "y": 400}, {"x": 100, "y": 400}]}


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


def test_outlines_are_scaled_to_the_image_and_each_building_stays_separate():
    w, h = 200, 100   # not square, so an x/y mix-up would show
    tri = {"box_2d": [600, 600, 900, 900], "label": "building", "outline": [[600, 600], [900, 600], [900, 900]]}   # [x, y] pairs also accepted
    touching = {"box_2d": [100, 400, 400, 700], "label": "building", "outline": [{"x": 400, "y": 100}, {"x": 700, "y": 100}, {"x": 700, "y": 400}, {"x": 400, "y": 400}]}
    polys = gemini_footprints([SQUARE, tri, touching], (w, h), min_area_px=50)
    assert len(polys) == 3                                   # the square and its touching neighbour are NOT merged
    sq = next(p for p in polys if p.bounds == (20.0, 10.0, 80.0, 40.0))
    assert sq.area == 60 * 30
    m = footprints_to_mask(polys, (w, h))
    assert m.shape == (h, w) and m[25, 50] and m[70, 170] and not m[85, 130]


# What the live model actually sent on 2026-09-19 when asked for a "mask": lists of [ymin, xmin, ymax, xmax] sub-boxes,
# not the [x, y] points the documentation describes. Reading them as points drew garbage.
REAL_SUBBOX_REPLY = [{"box_2d": [170, 269, 501, 396], "mask": [[176, 287, 281, 391], [281, 284, 345, 388], [338, 279, 423, 384], [413, 273, 500, 375]], "label": "building"}, {"box_2d": [390, 448, 668, 696], "mask": [[411, 461, 663, 686], [370, 471, 452, 537], [547, 563, 668, 688]], "label": "building"}, {"box_2d": [599, 390, 779, 561], "mask": [[599, 390, 779, 561]], "label": "building"}]


def test_real_reply_with_sub_boxes_is_read_as_boxes_not_points():
    polys = gemini_footprints(REAL_SUBBOX_REPLY, (512, 512))
    assert len(polys) == 3
    first = gemini_footprints(REAL_SUBBOX_REPLY[:1], (512, 512))[0]
    ymin, xmin, ymax, xmax = REAL_SUBBOX_REPLY[0]["box_2d"]
    bx0, by0, bx1, by1 = first.bounds
    assert abs(bx0 - xmin * 0.512) < 12 and abs(by0 - ymin * 0.512) < 12 and abs(bx1 - xmax * 0.512) < 12 and abs(by1 - ymax * 0.512) < 12


def test_bounding_box_is_used_when_the_outline_is_missing_and_non_buildings_are_dropped():
    items = [{"box_2d": [0, 500, 500, 1000], "label": "building", "outline": []}, {"box_2d": [500, 0, 900, 400], "label": "road", "outline": []}]
    polys = gemini_footprints(items, (100, 100), min_area_px=10)
    assert len(polys) == 1 and polys[0].bounds == (50.0, 0.0, 100.0, 50.0)     # [ymin, xmin, ymax, xmax]


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
    assert area == 3600              # 120 px x 120 px at 0.5 m/px
    assert sent["body"]["generation_config"]["thinking_level"] == "low"   # "minimal" (from the docs) is rejected by the live model
