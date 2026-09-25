from pathlib import Path
from typing import List, Optional
from threading import Lock

import gc
import io
import os
import shutil
import subprocess
import tempfile
import uuid

from fastapi import (
    FastAPI,
    UploadFile,
    File,
    Form,
    HTTPException,
    BackgroundTasks,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from PIL import Image


# ============================================================
# SERIALIZE MEMORY-HEAVY OPERATIONS
# ============================================================

HEAVY_OPERATION_LOCK = Lock()


# ============================================================
# OPTIONAL PDF LIBRARY
# ============================================================

try:
    from PyPDF2 import PdfReader, PdfWriter
except ImportError:
    PdfReader = None
    PdfWriter = None


# ============================================================
# OPTIONAL WORD LIBRARY
# ============================================================

try:
    from docx import Document
except ImportError:
    Document = None


# ============================================================
# ENVIRONMENT / CORS
# ============================================================

FRONTEND_URL = os.getenv(
    "FRONTEND_URL",
    "",
).strip().rstrip("/")


ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]


if FRONTEND_URL:
    ALLOWED_ORIGINS.append(FRONTEND_URL)


# ============================================================
# DIRECTORIES
# ============================================================

BASE_DIR = Path(__file__).resolve().parent

TEMP_DIR = BASE_DIR / "temp"

TEMP_DIR.mkdir(
    parents=True,
    exist_ok=True,
)


# ============================================================
# LIMITS
# ============================================================

MAX_IMAGE_SIZE = 25 * 1024 * 1024
MAX_PDF_SIZE = 25 * 1024 * 1024

MAX_MERGE_FILES = 20
MAX_TOTAL_MERGE_SIZE = 100 * 1024 * 1024

# Protect against extremely large decompressed images.
Image.MAX_IMAGE_PIXELS = 40_000_000


# ============================================================
# HELPERS
# ============================================================

def get_unique_output_path(
    extension: str,
    prefix: str = "filevixo-output",
) -> Path:
    """
    Generate a unique temporary output filename.
    """

    filename = (
        f"{prefix}-{uuid.uuid4().hex}.{extension}"
    )

    return TEMP_DIR / filename


def delete_file(
    path: str,
) -> None:
    """
    Safely delete a temporary file.
    """

    try:
        file_path = Path(path)

        if file_path.exists():
            file_path.unlink()

    except Exception as error:
        print(
            "[Filevixo] Could not delete file: "
            f"{error}"
        )


def delete_directory(
    path: str | Path,
) -> None:
    """
    Safely delete a temporary directory.
    """

    try:
        directory = Path(path)

        if directory.exists():
            shutil.rmtree(
                directory,
                ignore_errors=True,
            )

    except Exception as error:
        print(
            "[Filevixo] Could not delete directory: "
            f"{error}"
        )


def cleanup_old_temp_files() -> None:
    """
    Remove leftover temporary files/directories.

    This is useful after a server restart or crashed request.
    """

    try:

        if not TEMP_DIR.exists():
            return

        for item in TEMP_DIR.iterdir():

            try:

                if item.is_file():
                    item.unlink()

                elif item.is_dir():
                    shutil.rmtree(
                        item,
                        ignore_errors=True,
                    )

            except Exception as error:

                print(
                    "[Filevixo] Could not clean "
                    f"{item}: {error}"
                )

    except Exception as error:

        print(
            "[Filevixo] Temporary cleanup failed: "
            f"{error}"
        )


async def read_uploaded_bytes(
    file: UploadFile,
    max_size: int,
) -> bytes:
    """
    Read an uploaded file and enforce a maximum size.
    """

    data = await file.read()

    if not data:
        raise HTTPException(
            status_code=400,
            detail="Uploaded file is empty.",
        )

    if len(data) > max_size:
        raise HTTPException(
            status_code=413,
            detail=(
                f"File is too large. "
                f"Maximum allowed size is "
                f"{max_size // (1024 * 1024)} MB."
            ),
        )

    return data


def open_image_from_bytes(
    data: bytes,
) -> Image.Image:
    """
    Safely open an image from uploaded bytes.
    """

    try:

        image = Image.open(
            io.BytesIO(data)
        )

        image.load()

        return image

    except Image.DecompressionBombError:

        raise HTTPException(
            status_code=400,
            detail="Image dimensions are too large.",
        )

    except Image.DecompressionBombWarning:

        raise HTTPException(
            status_code=400,
            detail="Image dimensions are too large.",
        )

    except Exception:

        raise HTTPException(
            status_code=400,
            detail="Invalid or unsupported image file.",
        )


def normalize_image(
    image: Image.Image,
) -> Image.Image:
    """
    Convert an image to RGB while preserving transparency
    correctly against a white background when needed.
    """

    if image.mode in (
        "RGBA",
        "LA",
    ):

        rgba_image = (
            image.convert("RGBA")
            if image.mode != "RGBA"
            else image
        )

        background = Image.new(
            "RGB",
            rgba_image.size,
            "white",
        )

        background.paste(
            rgba_image,
            mask=rgba_image.getchannel("A"),
        )

        if rgba_image is not image:
            rgba_image.close()

        return background

    if image.mode == "P":
        return image.convert("RGB")

    if image.mode != "RGB":
        return image.convert("RGB")

    return image


def compress_image_to_target_size(
    image: Image.Image,
    output_path: Path,
    target_bytes: int,
    output_format: str,
    dpi: int = 96,
) -> int:
    """
    Encode an image until the output is at or below target_bytes.

    JPEG/WebP:
        Lower quality first, then progressively reduce dimensions.

    PNG:
        Maximum PNG compression, then progressively reduce dimensions.

    The returned file is always checked from disk before it is returned.
    """

    if target_bytes <= 0:
        raise ValueError(
            "Target size must be greater than zero."
        )

    output_format = output_format.lower()

    if output_format == "jpeg":
        output_format = "jpg"

    if output_format not in {
        "jpg",
        "png",
        "webp",
    }:
        raise ValueError(
            "Unsupported output format."
        )

    working = (
        normalize_image(image)
        if output_format == "jpg"
        else image
    )

    owns_working = working is not image

    current = working
    owns_current = owns_working

    try:

        for _ in range(15):

            if output_format in {
                "jpg",
                "webp",
            }:

                for quality in range(
                    90,
                    4,
                    -5,
                ):

                    delete_file(
                        str(output_path)
                    )

                    save_format = (
                        "JPEG"
                        if output_format == "jpg"
                        else "WEBP"
                    )

                    save_kwargs = {
                        "format": save_format,
                        "quality": quality,
                        "optimize": True,
                    }

                    if output_format == "jpg":
                        save_kwargs["dpi"] = (
                            dpi,
                            dpi,
                        )

                    current.save(
                        output_path,
                        **save_kwargs,
                    )

                    actual_size = (
                        output_path.stat().st_size
                    )

                    if actual_size <= target_bytes:
                        return actual_size

            else:

                delete_file(
                    str(output_path)
                )

                current.save(
                    output_path,
                    format="PNG",
                    optimize=True,
                    compress_level=9,
                )

                actual_size = (
                    output_path.stat().st_size
                )

                if actual_size <= target_bytes:
                    return actual_size

            if (
                current.width <= 16
                or current.height <= 16
            ):
                break

            new_size = (
                max(
                    1,
                    int(
                        current.width * 0.80
                    ),
                ),
                max(
                    1,
                    int(
                        current.height * 0.80
                    ),
                ),
            )

            resized = current.resize(
                new_size,
                Image.Resampling.LANCZOS,
            )

            if owns_current:

                try:
                    current.close()

                except Exception:
                    pass

            current = resized
            owns_current = True

            gc.collect()

        delete_file(
            str(output_path)
        )

        raise ValueError(
            "The requested maximum size is too small to produce "
            "a valid image. Please choose a larger target size."
        )

    finally:

        if owns_current:

            try:
                current.close()

            except Exception:
                pass

        gc.collect()


def find_libreoffice() -> Optional[str]:
    """
    Find LibreOffice on Windows or Linux/Render.
    """

    candidates = [
        # Linux / Render
        "/usr/bin/soffice",
        "/usr/local/bin/soffice",

        # Windows
        r"C:\Program Files\LibreOffice\program\soffice.exe",
        r"C:\Program Files (x86)\LibreOffice\program\soffice.exe",
    ]

    for candidate in candidates:

        if os.path.exists(candidate):
            return candidate

    system_path = shutil.which(
        "soffice"
    )

    if system_path:
        return system_path

    return None


def validate_image_upload(
    file: UploadFile,
) -> None:
    """
    Basic upload validation.
    """

    content_type = (
        file.content_type or ""
    ).lower()

    filename = (
        file.filename or ""
    ).lower()

    supported_extensions = (
        ".jpg",
        ".jpeg",
        ".png",
        ".webp",
    )

    if (
        not content_type.startswith("image/")
        and not filename.endswith(
            supported_extensions
        )
    ):

        raise HTTPException(
            status_code=400,
            detail=(
                "Please upload a JPG, PNG, "
                "or WebP image."
            ),
        )


def validate_pdf_upload(
    file: UploadFile,
) -> None:
    """
    Basic PDF upload validation.
    """

    content_type = (
        file.content_type or ""
    ).lower()

    filename = (
        file.filename or ""
    ).lower()

    if (
        content_type != "application/pdf"
        and not filename.endswith(".pdf")
    ):

        raise HTTPException(
            status_code=400,
            detail="Please upload a PDF file.",
        )