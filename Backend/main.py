import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import utils.core as core

from routers.compress import router as compress_router
from routers.convert import router as convert_router
from routers.resize import router as resize_router
from routers.crop import router as crop_router
from routers.images_to_pdf import router as images_to_pdf_router
from routers.word_to_pdf import router as word_to_pdf_router
from routers.pdf_to_word import router as pdf_to_word_router
from routers.remove_background import router as remove_background_router
from routers.merge_pdf import router as merge_pdf_router


app = FastAPI(title="Filevixo API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=core.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(compress_router)
app.include_router(convert_router)
app.include_router(resize_router)
app.include_router(crop_router)
app.include_router(images_to_pdf_router)
app.include_router(word_to_pdf_router)
app.include_router(pdf_to_word_router)
app.include_router(remove_background_router)
app.include_router(merge_pdf_router)


@app.get("/")
async def root():
    return {"name": "Filevixo API", "status": "running", "version": "1.0.0"}


@app.get("/health")
async def health():
    if not core.REMBG_AVAILABLE:
        background_status = "unavailable"
    elif core.remove_bg_session is not None:
        background_status = "ready"
    else:
        background_status = "available"
    return {
        "status": "ok",
        "background_removal": background_status,
        "background_model": core.REMOVE_BG_MODEL if core.REMBG_AVAILABLE else None,
    }


@app.on_event("startup")
async def startup_event():
    core.cleanup_old_temp_files()
    print("\n" + "=" * 60)
    print("Filevixo API")
    print("=" * 60)
    print("Environment:", "Render" if os.getenv("RENDER") else "Local")
    print("Frontend URL:", core.FRONTEND_URL or "localhost development")
    print("Background model:", core.REMOVE_BG_MODEL)
    print("Background model loading: lazy")
    print("Background max dimension:", core.REMOVE_BG_MAX_DIMENSION)
    print("\nAvailable routes:")
    for route in [
        "POST /api/compress-image", "POST /api/convert-image",
        "POST /api/resize-image", "POST /api/crop-image",
        "POST /api/images-to-pdf", "POST /api/word-to-pdf",
        "POST /api/pdf-to-word", "POST /api/remove-background",
        "POST /api/merge-pdf",
    ]:
        print(route)
    print("\nHealth: /health")
    print("Docs: /docs")
    print("=" * 60 + "\n")
