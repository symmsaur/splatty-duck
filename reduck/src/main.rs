use std::{fs, path::Path};

use anyhow::anyhow;
use image::GenericImageView;
use rerun::{demo_util::grid, external::glam, ImageFormat, Loggable, RecordingStream, Transform3D};

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

    let declination = data_sample.get_meta_float("DECLINATION")?;
    let declination = declination / 360.0 * 2.0 * core::f32::consts::PI;
    let right_ascension = data_sample.get_meta_float("RIGHT_ASCENSION")?;
    let right_ascension = right_ascension / 360.0 * 2.0 * core::f32::consts::PI;

    let north_clock_angle = data_sample.get_meta_float("CELESTIAL_NORTH_CLOCK_ANGLE")?;
    let north_clock_angle = -north_clock_angle / 360.0 * 2.0 * core::f32::consts::PI;

    let v = glam::Vec3::new(
        f32::cos(declination) * f32::cos(right_ascension),
        f32::cos(declination) * f32::sin(right_ascension),
        f32::sin(declination),
    );

    let celestial_north = glam::Vec3::new(0.0, 0.0, 1.0);
    let perp = celestial_north.project_onto(v);
    let celestial_north_in_cam_plane = celestial_north - perp;
    let right_in_cam_plane = v.cross(celestial_north_in_cam_plane);

    let Rz = glam::Affine3A::from_rotation_x(lat);
    let Ry = glam::Affine3A::from_rotation_z(long);
    let R = (Ry * Rz).inverse();
    // let t3 = rerun::Transform3D::from_mat3x3(R.inverse().matrix3.to_cols_array());
    let transformed_ray = -0.1 * glam::Vec3::from_array(target_vector);

    // Up and right from celestial north projection and
    // celestial north clock angle
    let dir = v.normalize();
    let cel_clock_rot = glam::Mat3::from_axis_angle(dir, north_clock_angle);
    let up = cel_clock_rot * celestial_north_in_cam_plane;
    let right = cel_clock_rot * right_in_cam_plane;
    // let (up, right) = dir.any_orthonormal_pair();

    let right = R.matrix3 * right;
    let up = R.matrix3 * up;
    let dir = R.matrix3 * dir;
    let transformed_ray = R.matrix3 * transformed_ray;
    let v = R.matrix3 * v;
    let celestial_north_in_cam_plane = R.matrix3 * celestial_north_in_cam_plane;

    let Rtovec = rerun::Transform3D::from_mat3x3(glam::mat3(right, up, dir).to_cols_array())
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
            "images/plane/{}",
            data_sample.meta.get("PRODUCT_ID").unwrap().to_string()
        ),
        &rerun::TextDocument::new(format!(
            "{}",
            north_clock_angle / 2.0 / core::f32::consts::PI * 360.0
        )),
    )?;

    rec.log(
        format!(
            "images/lines/{}",
            data_sample.meta.get("PRODUCT_ID").unwrap().to_string()
        ),
        &rerun::LineStrips3D::new([[[0.0, 0.0, 0.0], transformed_ray.to_array()]])
            .with_radii([0.025]), // .with_labels(std::iter::once("dir_to_67p")),
    )?;
    rec.log(
        format!(
            "images/lines/{}",
            data_sample.meta.get("PRODUCT_ID").unwrap().to_string() + "2"
        ),
        &rerun::LineStrips3D::new([[transformed_ray.to_array(), (transformed_ray + v).to_array()]]), // .with_labels(std::iter::once("boresight")),
    )?;
    rec.log(
        format!(
            "images/lines/{}",
            data_sample.meta.get("PRODUCT_ID").unwrap().to_string() + "_north"
        ),
        &rerun::LineStrips3D::new([[
            transformed_ray.to_array(),
            (transformed_ray + celestial_north_in_cam_plane).to_array(),
        ]])
        .with_colors([rerun::Color::from_rgb(255, 0, 0)]), // .with_labels(std::iter::once("boresight")),
    )?;
    rec.log(
        format!(
            "images/lines/{}",
            data_sample.meta.get("PRODUCT_ID").unwrap().to_string() + "_north_rot"
        ),
        &rerun::LineStrips3D::new([[
            transformed_ray.to_array(),
            (transformed_ray + up).to_array(),
        ]])
        .with_colors([rerun::Color::from_rgb(0, 255, 0)]), // .with_labels(std::iter::once("boresight")),
    )?;
    // panic!();

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

    rec.log(
        format!("celestial_north",),
        &rerun::LineStrips3D::new([[[0.0, 0.0, 0.0], [0.0, 0.0, 50.0]]]), // .with_labels(std::iter::once("dir_to_67p")),
    )?;
    let dataset = load_dataset()?;
    for data_sample in dataset.iter().take(300) {
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
