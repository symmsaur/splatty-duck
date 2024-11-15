from typing import Union
import astropy
import json
from pathlib import Path
import sys
import pds3
from PIL import Image
import numpy as np


def _pds3_load_raw(filename):
    raw_label = ""
    with open(filename, "rb") as inf:
        while True:
            line = inf.readline()
            raw_label += line.decode("ascii")
            if line.strip() == b"END" or line == b"":
                break

    return raw_label


def fix_degc(file_content: str):
    # Remove lines with quantities in degc (degree celcius)
    # as this is not supported by the pds3 python module
    new_lines = [
        line for line in file_content.split("\n") if "degc" not in line.lower()
    ]
    return "\n".join(new_lines)


def serialize_lbl(node: Union[dict, list, object]):
    if isinstance(node, list):
        return [serialize_lbl(x) for x in node]
    elif isinstance(node, dict):
        return {k: serialize_lbl(v) for k, v in node.items()}
    elif isinstance(node, astropy.units.quantity.Quantity):
        return (node.value, f"{node.unit}")
    else:
        return f"{node}"


def convert_pds3(lbl_file, target_folder):
    file_name_without_ext = Path(lbl_file).stem
    
    # Output artifact paths
    target = Path(target_folder)
    target.mkdir(parents=True, exist_ok=True)
    png_image_path = target / f"{file_name_without_ext}.png"
    json_data_path = target / f"{file_name_without_ext}.json"

    # Exit early if already converted
    if png_image_path.is_file() and json_data_path.is_file():
        print("Already converted...")
        return

    # Convert to png and extract metadata to json file
    fixed_lbl_content = fix_degc(open(lbl_file).read())

    parser = pds3.core.PDS3Parser()
    records = parser.parse(fixed_lbl_content)
    lbl = pds3.core._records2dict(records)

    if "^IMAGE" not in lbl:
        print("Skipping file with no image")
        return
        
    if ".IMG" not in lbl["^IMAGE"][0]:
        print("Skipping image not in .img format...")
        return

    img = pds3.read_image(lbl, "IMAGE", path=Path(lbl_file).parent.as_posix())

    if img.shape[0] != img.shape[1]:
        print("Non square image, probably want to skip this...")
        return

    # PDS3 return uint16 channels, but the actual max seems to be 4096
    # so divide by 16 to get down to uint8 range

    assert (img / 16).max() <= 256

    img = (img / 16).astype(np.uint8)


    Image.fromarray(img).save(png_image_path)

    # This contains a lot of AstroPY types, so lets do some custom serialization
    lbl_to_serialize = serialize_lbl(lbl)
    open(json_data_path, "w").write(
        json.dumps(lbl_to_serialize, indent=2)
    )


def main():
    if not sys.argv[-1].lower().endswith(".lbl"):
        print(f"{__file__} PDS3_LABEL_FILE.lbl")
        exit(0)

    convert_pds3(sys.argv[-1], "splatty_duck_images/")


if __name__ == "__main__":
    main()
