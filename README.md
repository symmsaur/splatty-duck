# Rosetta images of 67P
The available datasets consists of PDS3 packed data.

This is split into different phases with for example the series of prelanding images
named `ro-c-navcam-2-prl-[xxxxx]`.

`https://pds-smallbodies.astro.umd.edu/holdings/ro-c-navcam-2-prl-mtp003-v1.0/aareadme.txt`
```
This data set contains instrument raw data from the Navigation Camera         
(NavCam) onboard the ROSETTA spacecraft (S/C) from the Prelanding Phase.      
The time interval starts on May, 7th 2014 and ends on June, 4th 2014.         
In May 2014 the Navigation Images started. This data set contains 140 images, 
28 days of 5 images per day.
```

The full res images are located at

```
  |../DATA/                                                                  
   |     |                                                                    
   |     |../CAM1/                                                            
   |     |    |                                                               
   |     |    |--- *.IMG Files  (Data products in IMAGE format)               
   |     |    |--- *.LBL Files  (Detached label files for each data product)
```

where the `.LBL` files contain the metadata with e.g. pointing information as well as
the metadata to needed to read the `.IMG` files.

## Conversion

We want to convert the `.IMG` files to `.png` and store the metadata in `.json` files instead.

## Download and convert Rosetta images
*Requirements* Python 3 with astropy, numpy, ply
If you have `nix` available, start with `nix develop`.

The following outputs `.png` and `.json` for each file to `splatty_duck_images/`
```
  scripts/download_rosetta_images.sh
  scripts/convert_rosetta_images.sh
```
