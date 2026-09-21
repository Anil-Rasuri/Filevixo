from pathlib import Path
from typing import List, Optional
from threading import Lock

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
# OPTIONAL BACKGROUND REMOVAL
# ============================================================

try:
    from rembg import new_session, remove as rembg_remove

    REMBG_AVAILABLE = True
except ImportError:
    new_session = None
    rembg_remove = None
    REMBG_AVAILABLE = False


# ============================================================
# APP
# ============================================================

app = FastAPI(
    title="Filevixo API",
    version="1.0.0",
)


# ============================================================
# CORS
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
# BACKGROUND REMOVAL
# ============================================================

# Render Free has limited RAM.
#
# The lighter model is used by default.
#
# You can later change this through an environment variable:
#
# REMOVE_BG_MODEL=birefnet-general
#
# when using a larger server.

REMOVE_BG_MODEL = os.getenv(
    "REMOVE_BG_MODEL",
    "birefnet-general-lite",
).strip()

try:
    REMOVE_BG_MAX_DIMENSION = int(
        os.getenv(
            "REMOVE_BG_MAX_DIMENSION",
            "2500",
        )
    )
except ValueError:
    REMOVE_BG_MAX_DIMENSION = 2500

REMOVE_BG_MAX_DIMENSION = max(
    500,
    min(
        REMOVE_BG_MAX_DIMENSION,
        5000,
    ),
)

remove_bg_session = None
remove_bg_lock = Lock()


def get_remove_bg_session():
    """
    Load the rembg model only when the background-removal
    endpoint is actually used.

    This avoids loading a large AI model during normal
    application startup.
    """

    global remove_bg_session

    if not REMBG_AVAILABLE:
        return None

    if remove_bg_session is not None:
        return remove_bg_session

    with remove_bg_lock:
        if remove_bg_session is None:
            print(
                "[Filevixo] Loading background removal model: "
                f"{REMOVE_BG_MODEL}"
            )

            try:
                remove_bg_session = new_session(
                    REMOVE_BG_MODEL
                )
            except Exception as error:
                print(
                    "[Filevixo] Background removal model "
                    f"could not be loaded: {error}"
                )
                raise

            print(
                "[Filevixo] Background removal model ready: "
                f"{REMOVE_BG_MODEL}"
            )

    return remove_bg_session


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


def resize_for_background_removal(
    image: Image.Image,
) -> Image.Image:
    """
    Reduce very large images before AI processing
    to reduce memory usage.
    """

    max_dimension = max(
        image.width,
        image.height,
    )

    if max_dimension <= REMOVE_BG_MAX_DIMENSION:
        return image

    ratio = (
        REMOVE_BG_MAX_DIMENSION
        / max_dimension
    )

    new_size = (
        max(
            1,
            int(image.width * ratio),
        ),
        max(
            1,
            int(image.height * ratio),
        ),
    )

    print(
        "[Filevixo] Resizing background-removal input "
        f"from {image.size} to {new_size}"
    )

    return image.resize(
        new_size,
        Image.Resampling.LANCZOS,
    )


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
# HEALTH
# ============================================================

@app.get("/health")
async def health():
    """
    Render health-check endpoint.

    The background model is intentionally lazy-loaded,
    so "available" is a healthy state.
    """

    if not REMBG_AVAILABLE:
        background_status = "unavailable"

    elif remove_bg_session is not None:
        background_status = "ready"

    else:
        background_status = "available"

    return {
        "status": "ok",
        "background_removal": background_status,
        "background_model": (
            REMOVE_BG_MODEL
            if REMBG_AVAILABLE
            else None
        ),
    }


# ============================================================
# COMPRESS IMAGE
# ============================================================

@app.post("/api/compress-image")
async def compress_image(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    quality: int = Form(80),
):
    validate_image_upload(file)

    data = await read_uploaded_bytes(
        file,
        MAX_IMAGE_SIZE,
    )

    image = open_image_from_bytes(
        data
    )

    normalized = None
    output_path = get_unique_output_path(
        "jpg",
        "filevixo-compressed",
    )

    try:
        normalized = normalize_image(
            image
        )

        quality = max(
            1,
            min(
                95,
                quality,
            ),
        )

        normalized.save(
            output_path,
            format="JPEG",
            quality=quality,
            optimize=True,
        )

    except Exception as error:
        delete_file(
            str(output_path)
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "Image compression failed: "
                f"{error}"
            ),
        )

    finally:
        try:
            image.close()
        except Exception:
            pass

        if normalized is not None:
            try:
                normalized.close()
            except Exception:
                pass

    background_tasks.add_task(
        delete_file,
        str(output_path),
    )

    return FileResponse(
        path=output_path,
        media_type="image/jpeg",
        filename="filevixo-compressed.jpg",
    )


# ============================================================
# CONVERT IMAGE
# ============================================================

@app.post("/api/convert-image")
async def convert_image(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    output_format: str = Form("png"),
):
    validate_image_upload(file)

    allowed_formats = {
        "jpg": "JPEG",
        "jpeg": "JPEG",
        "png": "PNG",
        "webp": "WEBP",
    }

    output_format = output_format.lower()

    if output_format not in allowed_formats:
        raise HTTPException(
            status_code=400,
            detail="Unsupported output format.",
        )

    data = await read_uploaded_bytes(
        file,
        MAX_IMAGE_SIZE,
    )

    image = open_image_from_bytes(
        data
    )

    processed_image = image

    output_format_name = output_format

    if output_format in (
        "jpg",
        "jpeg",
    ):
        processed_image = normalize_image(
            image
        )

    elif image.mode not in (
        "RGB",
        "RGBA",
    ):
        processed_image = image.convert(
            "RGBA"
        )

    extension = (
        "jpg"
        if output_format in (
            "jpg",
            "jpeg",
        )
        else output_format
    )

    output_path = get_unique_output_path(
        extension,
        "filevixo-converted",
    )

    try:
        save_kwargs = {
            "format": allowed_formats[
                output_format_name
            ],
        }

        if output_format in (
            "jpg",
            "jpeg",
        ):
            save_kwargs["quality"] = 90
            save_kwargs["optimize"] = True

        processed_image.save(
            output_path,
            **save_kwargs,
        )

    except Exception as error:
        delete_file(
            str(output_path)
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "Image conversion failed: "
                f"{error}"
            ),
        )

    finally:
        try:
            processed_image.close()
        except Exception:
            pass

        if processed_image is not image:
            try:
                image.close()
            except Exception:
                pass

    background_tasks.add_task(
        delete_file,
        str(output_path),
    )

    return FileResponse(
        path=output_path,
        media_type=(
            "image/jpeg"
            if extension == "jpg"
            else f"image/{extension}"
        ),
        filename=(
            f"filevixo-converted.{extension}"
        ),
    )


# ============================================================
# RESIZE IMAGE
# ============================================================

@app.post("/api/resize-image")
async def resize_image(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    width: int = Form(...),
    height: int = Form(...),
    maintain_aspect: bool = Form(True),
    unit: str = Form("px"),
    output_format: str = Form("jpg"),
    dpi: int = Form(96),
):
    validate_image_upload(file)

    if width <= 0 or height <= 0:
        raise HTTPException(
            status_code=400,
            detail=(
                "Width and height must be "
                "greater than zero."
            ),
        )

    if width > 10000 or height > 10000:
        raise HTTPException(
            status_code=400,
            detail=(
                "Maximum image dimensions "
                "are 10000 × 10000 pixels."
            ),
        )

    dpi = max(
        1,
        min(
            1200,
            dpi,
        ),
    )

    data = await read_uploaded_bytes(
        file,
        MAX_IMAGE_SIZE,
    )

    image = open_image_from_bytes(
        data
    )

    resized = None

    try:
        original_width = image.width
        original_height = image.height

        if maintain_aspect:
            ratio = min(
                width / original_width,
                height / original_height,
            )

            width = max(
                1,
                int(
                    original_width * ratio
                ),
            )

            height = max(
                1,
                int(
                    original_height * ratio
                ),
            )

        resized = image.resize(
            (
                width,
                height,
            ),
            Image.Resampling.LANCZOS,
        )

        output_format = output_format.lower()

        if output_format not in {
            "jpg",
            "jpeg",
            "png",
            "webp",
        }:
            output_format = "jpg"

        if output_format in (
            "jpg",
            "jpeg",
        ):
            processed = normalize_image(
                resized
            )
            resized.close()
            resized = processed

        extension = (
            "jpg"
            if output_format in (
                "jpg",
                "jpeg",
            )
            else output_format
        )

        output_path = get_unique_output_path(
            extension,
            "filevixo-resized",
        )

        if extension == "jpg":
            resized.save(
                output_path,
                format="JPEG",
                quality=90,
                optimize=True,
                dpi=(
                    dpi,
                    dpi,
                ),
            )

        elif extension == "png":
            resized.save(
                output_path,
                format="PNG",
                optimize=True,
                dpi=(
                    dpi,
                    dpi,
                ),
            )

        else:
            resized.save(
                output_path,
                format="WEBP",
                quality=90,
            )

    except Exception as error:
        if "output_path" in locals():
            delete_file(
                str(output_path)
            )

        raise HTTPException(
            status_code=500,
            detail=(
                "Image resize failed: "
                f"{error}"
            ),
        )

    finally:
        try:
            image.close()
        except Exception:
            pass

        if resized is not None:
            try:
                resized.close()
            except Exception:
                pass

    background_tasks.add_task(
        delete_file,
        str(output_path),
    )

    return FileResponse(
        path=output_path,
        media_type=(
            "image/jpeg"
            if extension == "jpg"
            else f"image/{extension}"
        ),
        filename=(
            f"filevixo-resized.{extension}"
        ),
    )


# ============================================================
# CROP IMAGE
# ============================================================

@app.post("/api/crop-image")
async def crop_image(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    x: int = Form(...),
    y: int = Form(...),
    width: int = Form(...),
    height: int = Form(...),
    output_format: str = Form("png"),
):
    validate_image_upload(file)

    if width <= 0 or height <= 0:
        raise HTTPException(
            status_code=400,
            detail=(
                "Crop dimensions must "
                "be greater than zero."
            ),
        )

    data = await read_uploaded_bytes(
        file,
        MAX_IMAGE_SIZE,
    )

    image = open_image_from_bytes(
        data
    )

    if (
        x < 0
        or y < 0
        or x + width > image.width
        or y + height > image.height
    ):
        image.close()

        raise HTTPException(
            status_code=400,
            detail=(
                "Crop area is outside "
                "the image."
            ),
        )

    cropped = None

    try:
        cropped = image.crop(
            (
                x,
                y,
                x + width,
                y + height,
            )
        )

        output_format = output_format.lower()

        if output_format not in {
            "jpg",
            "jpeg",
            "png",
            "webp",
        }:
            output_format = "png"

        if output_format in (
            "jpg",
            "jpeg",
        ):
            processed = normalize_image(
                cropped
            )
            cropped.close()
            cropped = processed

        extension = (
            "jpg"
            if output_format in (
                "jpg",
                "jpeg",
            )
            else output_format
        )

        output_path = get_unique_output_path(
            extension,
            "filevixo-cropped",
        )

        if extension == "jpg":
            cropped.save(
                output_path,
                format="JPEG",
                quality=90,
                optimize=True,
            )

        elif extension == "png":
            cropped.save(
                output_path,
                format="PNG",
                optimize=True,
            )

        else:
            cropped.save(
                output_path,
                format="WEBP",
                quality=90,
            )

    except Exception as error:
        if "output_path" in locals():
            delete_file(
                str(output_path)
            )

        raise HTTPException(
            status_code=500,
            detail=(
                "Image crop failed: "
                f"{error}"
            ),
        )

    finally:
        try:
            image.close()
        except Exception:
            pass

        if cropped is not None:
            try:
                cropped.close()
            except Exception:
                pass

    background_tasks.add_task(
        delete_file,
        str(output_path),
    )

    return FileResponse(
        path=output_path,
        media_type=(
            "image/jpeg"
            if extension == "jpg"
            else f"image/{extension}"
        ),
        filename=(
            f"filevixo-cropped.{extension}"
        ),
    )


# ============================================================
# IMAGES TO PDF
# ============================================================

@app.post("/api/images-to-pdf")
async def images_to_pdf(
    background_tasks: BackgroundTasks,
    files: Optional[List[UploadFile]] = File(
        default=None
    ),
    images: Optional[List[UploadFile]] = File(
        default=None
    ),
    images_per_page: int = Form(1),
    page_size: str = Form("A4"),
    orientation: str = Form("portrait"),
    margin: str = Form("medium"),
):
    uploaded_files = (
        files
        if files
        else images
    )

    if not uploaded_files:
        raise HTTPException(
            status_code=400,
            detail=(
                "Please upload at least "
                "one image."
            ),
        )

    if images_per_page not in {
        1,
        2,
        3,
        4,
        6,
        9,
    }:
        raise HTTPException(
            status_code=400,
            detail=(
                "Images per page must be "
                "1, 2, 3, 4, 6, or 9."
            ),
        )

    if page_size not in {
        "A4",
        "Letter",
    }:
        page_size = "A4"

    if orientation not in {
        "portrait",
        "landscape",
    }:
        orientation = "portrait"

    if margin not in {
        "small",
        "medium",
        "large",
    }:
        margin = "medium"

    try:
        from reportlab.pdfgen import canvas
        from reportlab.lib.pagesizes import (
            A4,
            LETTER,
        )
        from reportlab.lib.utils import (
            ImageReader,
        )
    except ImportError:
        raise HTTPException(
            status_code=500,
            detail=(
                "reportlab is not installed."
            ),
        )

    page_size_map = {
        "A4": A4,
        "Letter": LETTER,
    }

    page_width, page_height = (
        page_size_map[page_size]
    )

    if orientation == "landscape":
        page_width, page_height = (
            page_height,
            page_width,
        )

    margin_map = {
        "small": 24,
        "medium": 42,
        "large": 64,
    }

    margin_value = margin_map[
        margin
    ]

    usable_width = (
        page_width
        - margin_value * 2
    )

    usable_height = (
        page_height
        - margin_value * 2
    )

    if images_per_page == 1:
        rows, columns = 1, 1

    elif images_per_page == 2:
        rows, columns = 2, 1

    elif images_per_page == 3:
        rows, columns = 3, 1

    elif images_per_page == 4:
        rows, columns = 2, 2

    elif images_per_page == 6:
        rows, columns = 2, 3

    else:
        rows, columns = 3, 3

    cell_width = (
        usable_width / columns
    )

    cell_height = (
        usable_height / rows
    )

    image_objects = []
    output_path = None

    try:
        for uploaded_file in uploaded_files:
            content_type = (
                uploaded_file.content_type
                or ""
            ).lower()

            filename = (
                uploaded_file.filename
                or ""
            ).lower()

            if (
                not content_type.startswith(
                    "image/"
                )
                and not filename.endswith(
                    (
                        ".jpg",
                        ".jpeg",
                        ".png",
                        ".webp",
                    )
                )
            ):
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"{uploaded_file.filename} "
                        "is not a supported image."
                    ),
                )

            data = await read_uploaded_bytes(
                uploaded_file,
                MAX_IMAGE_SIZE,
            )

            image_objects.append(
                open_image_from_bytes(
                    data
                )
            )

        output_path = get_unique_output_path(
            "pdf",
            "filevixo-images",
        )

        pdf = canvas.Canvas(
            str(output_path),
            pagesize=(
                page_width,
                page_height,
            ),
        )

        pdf.setTitle(
            "Filevixo Images PDF"
        )

        for index, image in enumerate(
            image_objects
        ):
            position_on_page = (
                index
                % images_per_page
            )

            if (
                position_on_page == 0
                and index > 0
            ):
                pdf.showPage()

            row = (
                position_on_page
                // columns
            )

            column = (
                position_on_page
                % columns
            )

            cell_x = (
                margin_value
                + column * cell_width
            )

            cell_y = (
                page_height
                - margin_value
                - (row + 1)
                * cell_height
            )

            scale = min(
                (
                    cell_width - 16
                )
                / image.width,
                (
                    cell_height - 16
                )
                / image.height,
            )

            draw_width = (
                image.width
                * scale
            )

            draw_height = (
                image.height
                * scale
            )

            draw_x = (
                cell_x
                + (
                    cell_width
                    - draw_width
                )
                / 2
            )

            draw_y = (
                cell_y
                + (
                    cell_height
                    - draw_height
                )
                / 2
            )

            image_buffer = io.BytesIO()

            rgb_image = normalize_image(
                image
            )

            rgb_image.save(
                image_buffer,
                format="JPEG",
                quality=90,
            )

            image_buffer.seek(0)

            pdf.drawImage(
                ImageReader(
                    image_buffer
                ),
                draw_x,
                draw_y,
                width=draw_width,
                height=draw_height,
                preserveAspectRatio=True,
                mask="auto",
            )

            rgb_image.close()
            image_buffer.close()

        pdf.showPage()
        pdf.save()

    except HTTPException:
        if output_path:
            delete_file(
                str(output_path)
            )

        raise

    except Exception as error:
        if output_path:
            delete_file(
                str(output_path)
            )

        raise HTTPException(
            status_code=500,
            detail=(
                "Images to PDF failed: "
                f"{error}"
            ),
        )

    finally:
        for image in image_objects:
            try:
                image.close()
            except Exception:
                pass

    background_tasks.add_task(
        delete_file,
        str(output_path),
    )

    return FileResponse(
        path=output_path,
        media_type="application/pdf",
        filename="filevixo-images.pdf",
    )


# ============================================================
# WORD TO PDF
# ============================================================

@app.post("/api/word-to-pdf")
async def word_to_pdf(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
):
    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="No file selected.",
        )

    extension = Path(
        file.filename
    ).suffix.lower()

    if extension not in {
        ".doc",
        ".docx",
    }:
        raise HTTPException(
            status_code=400,
            detail=(
                "Only DOC and DOCX files "
                "are supported."
            ),
        )

    data = await read_uploaded_bytes(
        file,
        MAX_PDF_SIZE,
    )

    temp_dir = Path(
        tempfile.mkdtemp(
            prefix="filevixo-word-pdf-",
            dir=TEMP_DIR,
        )
    )

    safe_filename = Path(
        file.filename
    ).name

    input_path = (
        temp_dir
        / safe_filename
    )

    output_path = (
        temp_dir
        / f"{input_path.stem}.pdf"
    )

    input_path.write_bytes(
        data
    )

    try:
        soffice_path = find_libreoffice()

        if not soffice_path:
            raise HTTPException(
                status_code=500,
                detail=(
                    "LibreOffice is not installed "
                    "on the server."
                ),
            )

        result = subprocess.run(
            [
                soffice_path,
                "--headless",
                "--convert-to",
                "pdf",
                "--outdir",
                str(temp_dir),
                str(input_path),
            ],
            capture_output=True,
            text=True,
            timeout=120,
        )

        if result.returncode != 0:
            error_message = (
                result.stderr.strip()
                or result.stdout.strip()
                or "Unknown LibreOffice error."
            )

            raise HTTPException(
                status_code=500,
                detail=(
                    "Word to PDF conversion failed: "
                    f"{error_message}"
                ),
            )

        if not output_path.exists():
            raise HTTPException(
                status_code=500,
                detail=(
                    "LibreOffice did not create "
                    "the PDF output."
                ),
            )

        background_tasks.add_task(
            delete_directory,
            temp_dir,
        )

        return FileResponse(
            path=output_path,
            media_type="application/pdf",
            filename=(
                f"{input_path.stem}.pdf"
            ),
        )

    except subprocess.TimeoutExpired:
        delete_directory(
            temp_dir
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "Word to PDF conversion "
                "timed out."
            ),
        )

    except HTTPException:
        delete_directory(
            temp_dir
        )

        raise

    except Exception as error:
        delete_directory(
            temp_dir
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "Word to PDF conversion failed: "
                f"{error}"
            ),
        )


# ============================================================
# PDF TO WORD
# ============================================================

@app.post("/api/pdf-to-word")
async def pdf_to_word(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
):
    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="No file selected.",
        )

    extension = Path(
        file.filename
    ).suffix.lower()

    if extension != ".pdf":
        raise HTTPException(
            status_code=400,
            detail=(
                "Only PDF files are supported."
            ),
        )

    if PdfReader is None:
        raise HTTPException(
            status_code=500,
            detail=(
                "PyPDF2 is not installed."
            ),
        )

    if Document is None:
        raise HTTPException(
            status_code=500,
            detail=(
                "python-docx is not installed."
            ),
        )

    data = await read_uploaded_bytes(
        file,
        MAX_PDF_SIZE,
    )

    temp_dir = Path(
        tempfile.mkdtemp(
            prefix="filevixo-pdf-word-",
            dir=TEMP_DIR,
        )
    )

    input_path = (
        temp_dir
        / "input.pdf"
    )

    output_path = (
        temp_dir
        / "converted.docx"
    )

    input_path.write_bytes(
        data
    )

    try:
        reader = PdfReader(
            str(input_path)
        )

        if reader.is_encrypted:
            try:
                decrypted = reader.decrypt(
                    ""
                )

                if not decrypted:
                    raise HTTPException(
                        status_code=400,
                        detail=(
                            "Password-protected "
                            "PDFs are not supported."
                        ),
                    )

            except HTTPException:
                raise

            except Exception:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Password-protected "
                        "PDFs are not supported."
                    ),
                )

        document = Document()

        for page_number, page in enumerate(
            reader.pages
        ):
            try:
                text = (
                    page.extract_text()
                    or ""
                )
            except Exception:
                text = ""

            text = text.strip()

            if text:
                for line in text.splitlines():
                    line = line.strip()

                    if line:
                        document.add_paragraph(
                            line
                        )

            if (
                page_number
                < len(reader.pages) - 1
            ):
                document.add_page_break()

        document.save(
            str(output_path)
        )

        if not output_path.exists():
            raise HTTPException(
                status_code=500,
                detail=(
                    "Word document could "
                    "not be created."
                ),
            )

        original_name = Path(
            file.filename
        ).stem

        background_tasks.add_task(
            delete_directory,
            temp_dir,
        )

        return FileResponse(
            path=output_path,
            media_type=(
                "application/vnd.openxmlformats-"
                "officedocument.wordprocessingml.document"
            ),
            filename=(
                f"{original_name}.docx"
            ),
        )

    except HTTPException:
        delete_directory(
            temp_dir
        )

        raise

    except Exception as error:
        delete_directory(
            temp_dir
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "PDF to Word conversion failed: "
                f"{error}"
            ),
        )


# ============================================================
# REMOVE BACKGROUND
# ============================================================

@app.post("/api/remove-background")
async def remove_background(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
):
    if not REMBG_AVAILABLE:
        raise HTTPException(
            status_code=500,
            detail=(
                "Background removal engine "
                "is not installed."
            ),
        )

    validate_image_upload(file)

    data = await read_uploaded_bytes(
        file,
        MAX_IMAGE_SIZE,
    )

    image = open_image_from_bytes(
        data
    )

    working_image = image
    output_image = None

    try:
        if working_image.mode not in (
            "RGB",
            "RGBA",
        ):
            converted = working_image.convert(
                "RGBA"
            )

            working_image.close()

            working_image = converted

        resized_image = (
            resize_for_background_removal(
                working_image
            )
        )

        if resized_image is not working_image:
            working_image.close()
            working_image = resized_image

        session = get_remove_bg_session()

        if session is None:
            raise HTTPException(
                status_code=500,
                detail=(
                    "Background removal AI model "
                    "could not be loaded."
                ),
            )

        output_image = rembg_remove(
            working_image,
            session=session,
            post_process_mask=True,
            decontaminate=True,
        )

    except HTTPException:
        raise

    except Exception as error:
        print(
            "[Filevixo] Background removal error: "
            f"{error}"
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "AI background removal failed: "
                f"{error}"
            ),
        )

    finally:
        try:
            working_image.close()
        except Exception:
            pass

    if output_image is None:
        raise HTTPException(
            status_code=500,
            detail=(
                "Background removal did not "
                "produce an output image."
            ),
        )

    if output_image.mode != "RGBA":
        converted = output_image.convert(
            "RGBA"
        )

        output_image.close()

        output_image = converted

    output_path = get_unique_output_path(
        "png",
        "filevixo-background-removed",
    )

    try:
        output_image.save(
            output_path,
            format="PNG",
            optimize=True,
        )

    except Exception as error:
        delete_file(
            str(output_path)
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "Could not save background "
                f"removed image: {error}"
            ),
        )

    finally:
        try:
            output_image.close()
        except Exception:
            pass

    background_tasks.add_task(
        delete_file,
        str(output_path),
    )

    return FileResponse(
        path=output_path,
        media_type="image/png",
        filename=(
            "filevixo-background-removed.png"
        ),
    )


# ============================================================
# MERGE PDF
# ============================================================

@app.post("/api/merge-pdf")
async def merge_pdf(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
):
    if (
        PdfReader is None
        or PdfWriter is None
    ):
        raise HTTPException(
            status_code=500,
            detail=(
                "PyPDF2 is not installed."
            ),
        )

    if len(files) < 2:
        raise HTTPException(
            status_code=400,
            detail=(
                "Please select at least "
                "two PDF files."
            ),
        )

    if len(files) > MAX_MERGE_FILES:
        raise HTTPException(
            status_code=400,
            detail=(
                f"You can merge a maximum "
                f"of {MAX_MERGE_FILES} PDF files."
            ),
        )

    writer = PdfWriter()
    pdf_streams = []

    total_size = 0
    output_path = None

    try:
        for uploaded_file in files:
            validate_pdf_upload(
                uploaded_file
            )

            data = await uploaded_file.read()

            if not data:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"{uploaded_file.filename} "
                        "is empty."
                    ),
                )

            if len(data) > MAX_PDF_SIZE:
                raise HTTPException(
                    status_code=413,
                    detail=(
                        f"{uploaded_file.filename} "
                        "exceeds the 25 MB limit."
                    ),
                )

            total_size += len(data)

            if (
                total_size
                > MAX_TOTAL_MERGE_SIZE
            ):
                raise HTTPException(
                    status_code=413,
                    detail=(
                        "The combined PDF size "
                        "cannot exceed 100 MB."
                    ),
                )

            pdf_stream = io.BytesIO(
                data
            )

            pdf_streams.append(
                pdf_stream
            )

            try:
                reader = PdfReader(
                    pdf_stream
                )

            except Exception as error:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Could not read "
                        f"{uploaded_file.filename}: "
                        f"{error}"
                    ),
                )

            if reader.is_encrypted:
                try:
                    decrypted = reader.decrypt(
                        ""
                    )

                    if not decrypted:
                        raise HTTPException(
                            status_code=400,
                            detail=(
                                f"{uploaded_file.filename} "
                                "is password protected."
                            ),
                        )

                except HTTPException:
                    raise

                except Exception:
                    raise HTTPException(
                        status_code=400,
                        detail=(
                            f"{uploaded_file.filename} "
                            "is password protected."
                        ),
                    )

            for page in reader.pages:
                writer.add_page(
                    page
                )

        output_path = get_unique_output_path(
            "pdf",
            "filevixo-merged",
        )

        with open(
            output_path,
            "wb",
        ) as output_file:
            writer.write(
                output_file
            )

    except HTTPException:
        if output_path:
            delete_file(
                str(output_path)
            )

        raise

    except Exception as error:
        if output_path:
            delete_file(
                str(output_path)
            )

        raise HTTPException(
            status_code=500,
            detail=(
                "PDF merge failed: "
                f"{error}"
            ),
        )

    finally:
        try:
            writer.close()
        except Exception:
            pass

        for stream in pdf_streams:
            try:
                stream.close()
            except Exception:
                pass

    background_tasks.add_task(
        delete_file,
        str(output_path),
    )

    return FileResponse(
        path=output_path,
        media_type="application/pdf",
        filename="filevixo-merged.pdf",
    )


# ============================================================
# STARTUP
# ============================================================

@app.on_event("startup")
async def startup_event():
    cleanup_old_temp_files()

    print("")
    print("=" * 60)
    print("Filevixo API")
    print("=" * 60)

    print(
        "Environment:",
        (
            "Render"
            if os.getenv("RENDER")
            else "Local"
        ),
    )

    print(
        "Frontend URL:",
        FRONTEND_URL
        or "localhost development",
    )

    print(
        "Background model:",
        REMOVE_BG_MODEL,
    )

    print(
        "Background model loading:",
        "lazy",
    )

    print(
        "Background max dimension:",
        REMOVE_BG_MAX_DIMENSION,
    )

    print("")

    print("Available routes:")

    print("POST /api/compress-image")
    print("POST /api/convert-image")
    print("POST /api/resize-image")
    print("POST /api/crop-image")
    print("POST /api/images-to-pdf")
    print("POST /api/word-to-pdf")
    print("POST /api/pdf-to-word")
    print("POST /api/remove-background")
    print("POST /api/merge-pdf")

    print("")

    print("Health: /health")
    print("Docs: /docs")

    print("=" * 60)
    print("")