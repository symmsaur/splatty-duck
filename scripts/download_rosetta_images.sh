#!/usr/bin/env bash

set -e
set -x

DATA_FOLDER=rosetta_data
mkdir -p $DATA_FOLDER

ROCAM_1="$DATA_FOLDER/rocam_1016.tgz"
if [ -f $ROCAM_1 ]; then
  echo "Already downloaded..."
else
  wget "https://pds-smallbodies.astro.umd.edu/holdings/ro-c-navcam-2-prl-mtp006-v1.0/DOWNLOAD/rocam_1016.tgz" -O $ROCAM_1
fi
tar --skip-old-files -xzf $ROCAM_1 -C $DATA_FOLDER

