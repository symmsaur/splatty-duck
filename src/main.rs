use std::{fs, path::Path};

use anyhow::anyhow;
use rerun::{demo_util::grid, external::glam, ImageFormat, RecordingStream, Transform3D};

struct DataSample {
    img_path: String,
    meta: serde_json::Value,
}

fn load_dataset() -> std::io::Result<Vec<DataSample>> {
    let dir_path = "./splatty_duck_images/";
    let paths = fs::read_dir(dir_path)?;

    let mut pairs = Vec::new();

    for entry in paths {
        let entry = entry?;
        let path = entry.path();
        if path.extension().map_or(false, |ext| ext == "json") {
            let file_stem = path.file_stem().unwrap().to_str().unwrap();
            let json_data = fs::read_to_string(&path)?;
            let parsed_json: serde_json::Value = serde_json::from_str(&json_data).unwrap();

            // println!("Parsed JSON from {}: {:?}", path.display(), parsed_json);

            let png_path = Path::new(dir_path).join(format!("{}.png", file_stem));
            if png_path.exists() {
                pairs.push(DataSample {
                    img_path: png_path.to_str().unwrap().to_string(),
                    meta: parsed_json,
                })
            } else {
                // println!("No matching PNG for {}", file_stem);
            }
        }
    }

    Ok(pairs)
}

fn log_image(rec: &RecordingStream, data_sample: &DataSample) -> anyhow::Result<()> {
    // Load the PNG image
    let img = image::open(&data_sample.img_path)
        .expect("Failed to open PNG file")
        .to_rgb8();
    let (width, height) = img.dimensions();
    let data = img.into_raw();
    let image = rerun::Image::from_elements(&data, [width, height], rerun::ColorModel::RGB);
    // Create a plane and attach the texture
    // (-1, -1) -------- (1, -1)
    //     |                |
    // (-1, 1) --------- (1, 1)
    let mesh = rerun::Mesh3D::new([
        [-1.0, -1.0, 0.0],
        [1.0, -1.0, 0.0],
        [-1.0, 1.0, 0.0],
        [1.0, 1.0, 0.0],
    ])
    .with_triangle_indices([[0, 1, 2], [2, 1, 3]])
    .with_vertex_texcoords([[0.0, 0.0], [1.0, 0.0], [0.0, 1.0], [1.0, 1.0]])
    .with_albedo_texture_image(image);

    // rerun::Transform3D

    // Log the mesh to a 3D scene
    // rec.log("my_scene/plane", &mesh)?;

    let target_vector = data_sample.get_meta_vector("SC_TARGET_POSITION_VECTOR")?;
    let long = data_sample.get_meta_float("SUB_SPACECRAFT_LONGITUDE")?;
    let long = long / 360.0 * 2.0 * core::f32::consts::PI;
    let lat = data_sample.get_meta_float("SUB_SPACECRAFT_LATITUDE")?;
    let lat = lat / 360.0 * 2.0 * core::f32::consts::PI;
    // dbg!(long, lat);
    // panic!();
    let Rz = glam::Affine3A::from_rotation_z(lat);
    let Ry = glam::Affine3A::from_rotation_y(long);
    let R = Ry * Rz;
    // let t3 = rerun::Transform3D::from_mat3x3(R.inverse().matrix3.to_cols_array());
    let transformed_ray = 0.1 * R.transform_vector3(glam::Vec3::from_array(target_vector));
    let dir = transformed_ray.normalize();
    let (up, left) = dir.any_orthonormal_pair();
    let Rtovec = rerun::Transform3D::from_mat3x3(glam::mat3(left, up, dir).to_cols_array())
        .with_translation(transformed_ray);

    rec.log(
        format!(
            "images/plane/{}",
            data_sample.meta.get("PRODUCT_ID").unwrap().to_string()
        ),
        &Rtovec,
    )?;
    rec.log(
        format!(
            "images/plane/{}",
            data_sample.meta.get("PRODUCT_ID").unwrap().to_string()
        ),
        &mesh,
    )?;

    rec.log(
        format!(
            "images/lines/{}",
            data_sample.meta.get("PRODUCT_ID").unwrap().to_string()
        ),
        &rerun::LineStrips3D::new([[[0.0, 0.0, 0.0], transformed_ray.to_array()]]),
    )?;

    Ok(())
}

impl DataSample {
    fn get_meta_float(&self, key: &str) -> anyhow::Result<f32> {
        if let Some(value) = self.meta.get(key) {
            if let Some(f) = value.as_array().unwrap()[0].as_f64() {
                return Ok(f as f32);
            }
        }

        Err(anyhow!("failed!"))
    }
    fn get_meta_vector(&self, key: &str) -> anyhow::Result<[f32; 3]> {
        if let Some(target_vector) = self.meta.get(key) {
            if let Some(list) = target_vector.as_array() {
                if let [x, y, z] = list.as_slice() {
                    let x = x.as_array().unwrap()[0].as_f64().unwrap();
                    let y = y.as_array().unwrap()[0].as_f64().unwrap();
                    let z = z.as_array().unwrap()[0].as_f64().unwrap();
                    return Ok([x as f32, y as f32, z as f32]);
                }
            }
            // let [[x, _], [y, _], [z, _]] = target_vector;
            // println!("{}", target_vector);
        }
        Err(anyhow!("failed"))
    }
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let rec = rerun::RecordingStreamBuilder::new("rerun_example_minimal").spawn()?;

    let dataset = load_dataset()?;
    for data_sample in dataset.iter().take(10) {
        log_image(&rec, data_sample).unwrap();
    }
    // let points = grid(glam::Vec3::splat(-10.0), glam::Vec3::splat(10.0), 10);
    // let colors = grid(glam::Vec3::ZERO, glam::Vec3::splat(255.0), 10)
    //     .map(|v| rerun::Color::from_rgb(v.x as u8, v.y as u8, v.z as u8));

    // rec.log(
    //     "my_points",
    //     &rerun::Points3D::new(points)
    //         .with_colors(colors)
    //         .with_radii([0.5]),
    // )?;

    Ok(())
}

// fn main() {
//     println!("Hello, world!");
// }
