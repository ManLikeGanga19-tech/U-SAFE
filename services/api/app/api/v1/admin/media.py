from __future__ import annotations

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.services import media

router = APIRouter()

MAX_BYTES = 8 * 1024 * 1024  # 8 MB


@router.post("/upload")
async def upload(file: UploadFile = File(...)) -> dict:
    if file.content_type not in media.ALLOWED_TYPES:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported type {file.content_type}. Allowed: {list(media.ALLOWED_TYPES)}",
        )
    data = await file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="File too large (max 8 MB)")

    import io

    try:
        url = media.upload_image(io.BytesIO(data), file.content_type)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Upload failed: {exc}")
    return {"url": url, "filename": file.filename, "size": len(data)}
