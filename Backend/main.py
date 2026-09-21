from pathlib import Path
from typing import List, Optional
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
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


# ============================================================
# BACKGROUND REMOVAL MODEL
# ============================================================

REMOVE_BG_MODEL = "birefnet-general"

remove_bg_session = None

if REMBG_AVAILABLE:

    try:

        remove_bg_session = new_session(
            REMOVE_BG_MODEL
        )

        print(
            f"[Filevixo] Background removal model loaded: "
            f"{REMOVE_BG_MODEL}"
        )

    except Exception as error:

        remove_bg_session = None

        print(
            "[Filevixo] Background removal model "
            f"could not be loaded: {error}"
        )


# ============================================================
# HELPERS
# ============================================================

def get_unique_output_path(
    extension: str,
    prefix: str = "filevixo-output",
) -> Path:

    filename = (
        f"{prefix}-{uuid.uuid4().hex}.{extension}"
    )

    return TEMP_DIR / filename


def delete_file(
    path: str,
) -> None:

    try:

        file_path = Path(path)

        if file_path.exists():

            file_path.unlink()

    except Exception as error:

        print(
            f"[Filevixo] Could not delete file: {error}"
        )


async def read_uploaded_bytes(
    file: UploadFile,
    max_size: int,
) -> bytes:

    data = await file.read()

    if not data:

        raise HTTPException(
            status_code=400,
            detail="Uploaded file is empty.",
        )

    if len(data) > max_size:

        raise HTTPException(
            status_code=413,
            detail="File is too large.",
        )

    return data


def open_image_from_bytes(
    data: bytes,
) -> Image.Image:

    try:

        image = Image.open(
            io.BytesIO(data)
        )

        image.load()

        return image

    except Exception:

        raise HTTPException(
            status_code=400,
            detail="Invalid or unsupported image file.",
        )


def normalize_image(
    image: Image.Image,
) -> Image.Image:

    if image.mode in (
        "RGBA",
        "LA",
    ):

        background = Image.new(
            "RGB",
            image.size,
            "white",
        )

        if image.mode == "LA":

            image = image.convert(
                "RGBA"
            )

        background.paste(
            image,
            mask=image.getchannel("A"),
        )

        return background

    if image.mode == "P":

        return image.convert(
            "RGB"
        )

    if image.mode != "RGB":

        return image.convert(
            "RGB"
        )

    return image


def find_libreoffice() -> Optional[str]:

    candidates = [

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


# ============================================================
# ROOT
# ============================================================

@app.get("/")
async def root():

    return {
        "name": "Filevixo API",
        "status": "running",
    }


# ============================================================
# HEALTH
# ============================================================

@app.get("/health")
async def health():

    return {
        "status": "ok",
        "background_removal": (
            "ready"
            if remove_bg_session is not None
            else "unavailable"
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

    if (
        not file.content_type
        or not file.content_type.startswith(
            "image/"
        )
    ):

        raise HTTPException(
            status_code=400,
            detail="Please upload an image.",
        )

    data = await read_uploaded_bytes(
        file,
        MAX_IMAGE_SIZE,
    )

    image = open_image_from_bytes(
        data
    )

    image = normalize_image(
        image
    )

    quality = max(
        1,
        min(
            95,
            quality,
        ),
    )

    output_path = get_unique_output_path(
        "jpg",
        "filevixo-compressed",
    )

    try:

        image.save(
            output_path,
            format="JPEG",
            quality=quality,
            optimize=True,
        )

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=(
                f"Image compression failed: {error}"
            ),
        )

    finally:

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

    if output_format in (
        "jpg",
        "jpeg",
    ):

        image = normalize_image(
            image
        )

    else:

        if image.mode not in (
            "RGB",
            "RGBA",
        ):

            image = image.convert(
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
                output_format
            ],
        }

        if output_format in (
            "jpg",
            "jpeg",
        ):

            save_kwargs[
                "quality"
            ] = 90

            save_kwargs[
                "optimize"
            ] = True

        image.save(
            output_path,
            **save_kwargs,
        )

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=(
                f"Image conversion failed: {error}"
            ),
        )

    finally:

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

    data = await read_uploaded_bytes(
        file,
        MAX_IMAGE_SIZE,
    )

    image = open_image_from_bytes(
        data
    )

    original_width, original_height = (
        image.size
    )

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

        resized = normalize_image(
            resized
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
        "filevixo-resized",
    )

    try:

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

        raise HTTPException(
            status_code=500,
            detail=(
                f"Image resize failed: {error}"
            ),
        )

    finally:

        try:

            image.close()

        except Exception:

            pass

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

    data = await read_uploaded_bytes(
        file,
        MAX_IMAGE_SIZE,
    )

    image = open_image_from_bytes(
        data
    )

    if width <= 0 or height <= 0:

        raise HTTPException(
            status_code=400,
            detail=(
                "Crop dimensions must "
                "be greater than zero."
            ),
        )

    if (
        x < 0
        or y < 0
        or x + width > image.width
        or y + height > image.height
    ):

        raise HTTPException(
            status_code=400,
            detail=(
                "Crop area is outside "
                "the image."
            ),
        )

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

        cropped = normalize_image(
            cropped
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
        "filevixo-cropped",
    )

    try:

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

        raise HTTPException(
            status_code=500,
            detail=(
                f"Image crop failed: {error}"
            ),
        )

    finally:

        try:

            image.close()

        except Exception:

            pass

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
#
# SUPPORTED:
#
# 1 image per page
# 2 images per page
# 3 images per page
# 4 images per page
# 6 images per page
# 9 images per page
#
# FRONTEND CAN SEND:
#
# files
#
# OR
#
# images
#
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

    # --------------------------------------------------------
    # Accept either "files" or "images"
    # --------------------------------------------------------

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

    # --------------------------------------------------------
    # Supported layouts
    # --------------------------------------------------------

    allowed_images_per_page = {
        1,
        2,
        3,
        4,
        6,
        9,
    }

    if (
        images_per_page
        not in allowed_images_per_page
    ):

        raise HTTPException(
            status_code=400,
            detail=(
                "Images per page must be "
                "1, 2, 3, 4, 6, or 9."
            ),
        )

    # --------------------------------------------------------
    # Page size
    # --------------------------------------------------------

    if page_size not in {
        "A4",
        "Letter",
    }:

        page_size = "A4"

    # --------------------------------------------------------
    # Orientation
    # --------------------------------------------------------

    if orientation not in {
        "portrait",
        "landscape",
    }:

        orientation = "portrait"

    # --------------------------------------------------------
    # Margin
    # --------------------------------------------------------

    if margin not in {
        "small",
        "medium",
        "large",
    }:

        margin = "medium"

    # --------------------------------------------------------
    # ReportLab
    # --------------------------------------------------------

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
                "reportlab is not installed. "
                "Run: pip install reportlab"
            ),
        )

    # --------------------------------------------------------
    # Page size
    # --------------------------------------------------------

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

    # --------------------------------------------------------
    # Margins
    # --------------------------------------------------------

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

    # --------------------------------------------------------
    # Grid layout
    # --------------------------------------------------------

    if images_per_page == 1:

        rows = 1
        columns = 1

    elif images_per_page == 2:

        rows = 2
        columns = 1

    elif images_per_page == 3:

        rows = 3
        columns = 1

    elif images_per_page == 4:

        rows = 2
        columns = 2

    elif images_per_page == 6:

        rows = 2
        columns = 3

    else:

        # 9 images
        rows = 3
        columns = 3

    cell_width = (
        usable_width
        / columns
    )

    cell_height = (
        usable_height
        / rows
    )

    # --------------------------------------------------------
    # Load images
    # --------------------------------------------------------

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

            # Basic validation
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

            image = open_image_from_bytes(
                data
            )

            image_objects.append(
                image
            )

        # ----------------------------------------------------
        # Create output
        # ----------------------------------------------------

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

        # ----------------------------------------------------
        # Draw images
        # ----------------------------------------------------

        for index, image in enumerate(
            image_objects
        ):

            position_on_page = (
                index
                % images_per_page
            )

            # Start a new page whenever
            # we reach the next group.
            if position_on_page == 0:

                if index > 0:

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
                - (
                    row + 1
                ) * cell_height
            )

            image_width = image.width

            image_height = image.height

            # ------------------------------------------------
            # Keep image aspect ratio
            # ------------------------------------------------

            scale = min(
                (
                    cell_width - 16
                )
                / image_width,

                (
                    cell_height - 16
                )
                / image_height,
            )

            draw_width = (
                image_width
                * scale
            )

            draw_height = (
                image_height
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

            # ------------------------------------------------
            # Convert to temporary JPEG
            # ------------------------------------------------

            image_buffer = (
                io.BytesIO()
            )

            rgb_image = normalize_image(
                image
            )

            rgb_image.save(
                image_buffer,
                format="JPEG",
                quality=90,
            )

            image_buffer.seek(0)

            # ------------------------------------------------
            # Draw
            # ------------------------------------------------

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

            # ------------------------------------------------
            # Cleanup memory
            # ------------------------------------------------

            try:

                rgb_image.close()

            except Exception:

                pass

            try:

                image_buffer.close()

            except Exception:

                pass

        # ----------------------------------------------------
        # Finish PDF
        # ----------------------------------------------------

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
                f"Images to PDF failed: {error}"
            ),
        )

    finally:

        for image in image_objects:

            try:

                image.close()

            except Exception:

                pass

    # --------------------------------------------------------
    # Cleanup after response
    # --------------------------------------------------------

    background_tasks.add_task(
        delete_file,
        str(output_path),
    )

    # --------------------------------------------------------
    # Return PDF
    # --------------------------------------------------------

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
            prefix="filevixo-word-pdf-"
        )
    )

    input_path = (
        temp_dir
        / Path(file.filename).name
    )

    input_path.write_bytes(
        data
    )

    output_path = (
        temp_dir
        / f"{input_path.stem}.pdf"
    )

    try:

        soffice_path = find_libreoffice()

        if not soffice_path:

            raise HTTPException(
                status_code=500,
                detail=(
                    "LibreOffice is not installed. "
                    "Install LibreOffice to use "
                    "Word to PDF conversion."
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

            raise HTTPException(
                status_code=500,
                detail=(
                    "Word to PDF conversion failed: "
                    f"{result.stderr.strip()}"
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
            shutil.rmtree,
            temp_dir,
            ignore_errors=True,
        )

        return FileResponse(
            path=output_path,
            media_type="application/pdf",
            filename=(
                f"{input_path.stem}.pdf"
            ),
        )

    except subprocess.TimeoutExpired:

        shutil.rmtree(
            temp_dir,
            ignore_errors=True,
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "Word to PDF conversion "
                "timed out."
            ),
        )

    except HTTPException:

        shutil.rmtree(
            temp_dir,
            ignore_errors=True,
        )

        raise

    except Exception as error:

        shutil.rmtree(
            temp_dir,
            ignore_errors=True,
        )

        raise HTTPException(
            status_code=500,
            detail=(
                f"Word to PDF conversion failed: "
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
                "PyPDF2 is not installed. "
                "Run: pip install PyPDF2"
            ),
        )

    if Document is None:

        raise HTTPException(
            status_code=500,
            detail=(
                "python-docx is not installed. "
                "Run: pip install python-docx"
            ),
        )

    data = await read_uploaded_bytes(
        file,
        MAX_PDF_SIZE,
    )

    temp_dir = Path(
        tempfile.mkdtemp(
            prefix="filevixo-pdf-word-"
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
            shutil.rmtree,
            temp_dir,
            ignore_errors=True,
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

        shutil.rmtree(
            temp_dir,
            ignore_errors=True,
        )

        raise

    except Exception as error:

        shutil.rmtree(
            temp_dir,
            ignore_errors=True,
        )

        raise HTTPException(
            status_code=500,
            detail=(
                f"PDF to Word conversion failed: "
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
                'Background removal engine is not installed. '
                'Run: pip install "rembg[cpu]"'
            ),
        )

    if remove_bg_session is None:

        raise HTTPException(
            status_code=500,
            detail=(
                "Background removal AI model "
                "could not be loaded. "
                "Restart the backend after installing rembg."
            ),
        )

    if (
        not file.content_type
        or not file.content_type.startswith(
            "image/"
        )
    ):

        raise HTTPException(
            status_code=400,
            detail="Please upload an image.",
        )

    data = await read_uploaded_bytes(
        file,
        MAX_IMAGE_SIZE,
    )

    image = open_image_from_bytes(
        data
    )

    if image.mode not in (
        "RGB",
        "RGBA",
    ):

        image = image.convert(
            "RGBA"
        )

    try:

        output_image = rembg_remove(
            image,
            session=remove_bg_session,
            post_process_mask=True,
            decontaminate=True,
        )

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=(
                "AI background removal failed: "
                f"{error}"
            ),
        )

    finally:

        try:

            image.close()

        except Exception:

            pass

    if output_image.mode != "RGBA":

        output_image = output_image.convert(
            "RGBA"
        )

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

    if PdfReader is None or PdfWriter is None:

        raise HTTPException(
            status_code=500,
            detail=(
                "PyPDF2 is not installed. "
                "Run: pip install PyPDF2"
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

    total_size = 0

    output_path = None

    try:

        for uploaded_file in files:

            content_type = (
                uploaded_file.content_type
                or ""
            ).lower()

            filename = (
                uploaded_file.filename
                or ""
            ).lower()

            if (
                content_type
                != "application/pdf"
                and not filename.endswith(
                    ".pdf"
                )
            ):

                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"{uploaded_file.filename} "
                        "is not a PDF file."
                    ),
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

            try:

                pdf_stream = io.BytesIO(
                    data
                )

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
                f"PDF merge failed: {error}"
            ),
        )

    finally:

        try:

            writer.close()

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
# STARTUP INFORMATION
# ============================================================

@app.on_event("startup")
async def startup_event():

    print("")

    print("=" * 60)

    print("Filevixo API")

    print("=" * 60)

    print(
        "Backend: http://127.0.0.1:8000"
    )

    print(
        "Docs:    http://127.0.0.1:8000/docs"
    )

    print("")

    print("Available routes:")

    print(
        "POST /api/compress-image"
    )

    print(
        "POST /api/convert-image"
    )

    print(
        "POST /api/resize-image"
    )

    print(
        "POST /api/crop-image"
    )

    print(
        "POST /api/images-to-pdf"
    )

    print(
        "POST /api/word-to-pdf"
    )

    print(
        "POST /api/pdf-to-word"
    )

    print(
        "POST /api/remove-background"
    )

    print(
        "POST /api/merge-pdf"
    )

    print("")

    print(
        "Background removal:",
        (
            "READY"
            if remove_bg_session is not None
            else "UNAVAILABLE"
        ),
    )

    print("=" * 60)

    print("")