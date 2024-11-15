#!/usr/bin/env bash
DATA_FOLDER=rosetta_data
find $DATA_FOLDER -iname "*.lbl" | xargs -I{} -P10 python python/convert_rosetta_img.py {}

