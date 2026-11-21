import json
import sys
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageCms, ImageOps


def create_preview(source, destination, size, quality):
    with Image.open(source) as original:
        image = ImageOps.exif_transpose(original)
        mode = "RGBA" if "A" in image.getbands() or "transparency" in image.info else "RGB"
        profile = image.info.get("icc_profile")
        if profile:
            try:
                image = ImageCms.profileToProfile(
                    image, BytesIO(profile), ImageCms.createProfile("sRGB"), outputMode=mode
                )
            except (ImageCms.PyCMSError, OSError, ValueError):
                image = image.convert(mode)
        else:
            image = image.convert(mode)
        image.thumbnail((size, size), Image.Resampling.LANCZOS)
        image.save(destination, format="WEBP", quality=quality, method=4, exif=b"", icc_profile=None)


def main():
    output = Path(sys.argv[1])
    (output / "media").mkdir()
    for item in json.loads(Path(sys.argv[2]).read_text()):
        create_preview(item["path"], output / item["url"], item["size"], item["quality"])


if __name__ == "__main__":
    main()
