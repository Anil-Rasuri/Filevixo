import os

from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))

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


# ============================================================
# APPLICATION
# ============================================================

app = FastAPI(
    title="Filevixo API",
    version="1.0.0",
)


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=core.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# ROUTES
# ============================================================

app.include_router(compress_router)
app.include_router(convert_router)
app.include_router(resize_router)
app.include_router(crop_router)
app.include_router(images_to_pdf_router)
app.include_router(word_to_pdf_router)
app.include_router(pdf_to_word_router)
app.include_router(remove_background_router)
app.include_router(merge_pdf_router)


# ============================================================
# ROOT
# ============================================================

@app.get("/")
async def root():
    return {
        "name": "Filevixo API",
        "status": "running",
        "version": "1.0.0",
    }


# ============================================================
# HEALTH CHECK
# ============================================================

@app.get("/health")
async def health():
    knockout_configured = bool(
        os.getenv("KNOCKOUT_TOKEN")
    )

    return {
        "status": "ok",
        "background_removal": (
            "configured"
            if knockout_configured
            else "not_configured"
        ),
        "background_provider": "knockout",
    }


# ============================================================
# STARTUP
# ============================================================

@app.on_event("startup")
async def startup_event():

    core.cleanup_old_temp_files()

    print("\n" + "=" * 60)
    print("Filevixo API")
    print("=" * 60)

    print(
        "Environment:",
        "Render" if os.getenv("RENDER") else "Local",
    )

    print(
        "Frontend URL:",
        core.FRONTEND_URL
        or "localhost development",
    )

    print(
        "Background removal provider:",
        "Knockout",
    )

    print(
        "Knockout configured:",
        "yes" if os.getenv("KNOCKOUT_TOKEN") else "no",
    )

    print("\nAvailable routes:")

    for route in [
        "POST /api/compress-image",
        "POST /api/convert-image",
        "POST /api/resize-image",
        "POST /api/crop-image",
        "POST /api/images-to-pdf",
        "POST /api/word-to-pdf",
        "POST /api/pdf-to-word",
        "POST /api/remove-background",
        "POST /api/merge-pdf",
    ]:
        print(route)

    print("\nHealth: /health")
    print("Docs: /docs")
    print("=" * 60 + "\n")