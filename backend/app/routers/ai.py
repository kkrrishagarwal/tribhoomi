from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from PIL import Image

from ..ai import extract

router = APIRouter(prefix="/api/ai", tags=["ai"])


@router.get("/status")
def ai_status():
    return extract.status()


@router.get("/sample")
def sample_image():
    return FileResponse(extract.sample_image_path(), media_type="image/jpeg")


@router.post("/extract")
async def run_extract(file: UploadFile | None = File(default=None)):
    """Run the segmentation model. Uses the bundled aerial sample when no file is uploaded."""
    if file is not None:
        image = Image.open(file.file)
    else:
        image = Image.open(extract.sample_image_path())
    try:
        return extract.run_extraction(image)
    except Exception as e:  # keep the demo page readable: say what happened and what to do
        raise HTTPException(503, f"AI footprint extraction is not available on this server. {extract.status()['explanation']} ({type(e).__name__}: {str(e)[:120]})")
