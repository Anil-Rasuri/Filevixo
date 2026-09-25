import os

import httpx
from fastapi import APIRouter, BackgroundTasks, File, HTTPException, UploadFile
from fastapi.responses import Response

from utils.core import (
    MAX_IMAGE_SIZE,
    delete_file,
    validate_image_upload,
)

router = APIRouter()

KNOCKOUT_URL = "https://useknockout--api.modal.run/remove"


@router.post("/api/remove-background")
async def remove_background(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
):
    token = os.getenv("KNOCKOUT_TOKEN")

    if not token:
        raise HTTPException(
            status_code=500,
            detail="Background removal service is not configured.",
        )

    validate_image_upload(file)

    data = await file.read()

    if not data:
        raise HTTPException(
            status_code=400,
            detail="The uploaded file is empty.",
        )

    if len(data) > MAX_IMAGE_SIZE:
        raise HTTPException(
            status_code=413,
            detail="Image file is too large.",
        )

    filename = file.filename or "image.jpg"
    content_type = file.content_type or "application/octet-stream"

    headers = {
        "Authorization": f"Bearer {token}",
    }

    files = {
        "file": (
            filename,
            data,
            content_type,
        )
    }

    form_data = {
        "format": "png",
        "matting": "closed-form",
        "edge": "soft",
    }

    try:
        # Knockout can have a cold GPU start, so allow enough time
        # for the first request after inactivity.
        timeout = httpx.Timeout(
            connect=30.0,
            read=180.0,
            write=60.0,
            pool=30.0,
        )

        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(
                KNOCKOUT_URL,
                headers=headers,
                files=files,
                data=form_data,
            )

    except httpx.TimeoutException:
        raise HTTPException(
            status_code=504,
            detail=(
                "Background removal service timed out. "
                "Please try again."
            ),
        )

    except httpx.RequestError as error:
        print(
            "[Filevixo] Knockout connection error: "
            f"{error}"
        )

        raise HTTPException(
            status_code=502,
            detail=(
                "Could not connect to the "
                "background removal service."
            ),
        )

    if response.status_code != 200:
        print(
            "[Filevixo] Knockout API error "
            f"{response.status_code}: "
            f"{response.text[:1000]}"
        )

        try:
            error_data = response.json()
            error_detail = error_data.get(
                "detail",
                "Background removal failed.",
            )
        except Exception:
            error_detail = (
                "Background removal service "
                f"returned HTTP {response.status_code}."
            )

        if response.status_code == 401:
            error_detail = (
                "Background removal service "
                "authentication failed."
            )

        elif response.status_code == 402:
            error_detail = (
                "Background removal free usage "
                "limit has been reached."
            )

        elif response.status_code == 413:
            error_detail = (
                "The image is too large for "
                "background removal."
            )

        elif response.status_code == 422:
            error_detail = (
                "No clear foreground subject "
                "could be detected."
            )

        elif response.status_code == 429:
            error_detail = (
                "Background removal service is "
                "temporarily rate limited. "
                "Please try again shortly."
            )

        raise HTTPException(
            status_code=502,
            detail=error_detail,
        )

    output = response.content

    if not output:
        raise HTTPException(
            status_code=502,
            detail=(
                "Background removal service "
                "returned an empty image."
            ),
        )

    return Response(
        content=output,
        media_type="image/png",
        headers={
            "Content-Disposition": (
                'attachment; '
                'filename="filevixo-background-removed.png"'
            )
        },
    )