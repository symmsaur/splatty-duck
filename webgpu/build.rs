// For reading and opening files
use std::env;
use std::fs::File;
use std::io::BufWriter;
use std::path::Path;

pub fn generate_gauss_texture() {
    // let out_dir = env::var("OUT_DIR").expect("No OUT_DIR");
    // let path = Path::new(&out_dir).join(Path::new(r"gauss.png"));
    let path = Path::new(r"gauss.png");
    let file = File::create(path).unwrap();
    let ref mut w = BufWriter::new(file);

    const SIZE: u32 = 256;
    const SIGMA: f32 = 1.0 / 3.0;

    let mut encoder = png::Encoder::new(w, SIZE, SIZE);
    encoder.set_color(png::ColorType::Rgba);
    encoder.set_depth(png::BitDepth::Eight);
    let mut writer = encoder.write_header().unwrap();

    let mut data = [0u8; (4 * SIZE * SIZE) as usize];
    for x in 0..SIZE as i32 {
        for y in 0..SIZE as i32 {
            let fx = (x - SIZE as i32 / 2) as f32 / ((SIZE / 2) as f32);
            let fy = (y - SIZE as i32 / 2) as f32 / ((SIZE / 2) as f32);
            let gauss = f32::exp((-fx * fx - fy * fy) / (2.0 * SIGMA * SIGMA));
            data[(y * (4 * SIZE as i32) + x * 4) as usize] = 255;
            data[(y * (4 * SIZE as i32) + x * 4) as usize + 1] = 255;
            data[(y * (4 * SIZE as i32) + x * 4) as usize + 2] = 255;
            data[(y * (4 * SIZE as i32) + x * 4) as usize + 3] = (gauss * 255.0) as u8;
        }
    }
    writer.write_image_data(&data).unwrap();
}

fn main() {
    generate_gauss_texture();
}
