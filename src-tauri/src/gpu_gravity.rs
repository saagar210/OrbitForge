use crate::physics::Vec3;
use std::sync::Arc;
use wgpu::util::DeviceExt;

const SHADER_SOURCE: &str = r#"
struct Body {
    px: f32, py: f32, pz: f32, mass: f32,
};

struct Params {
    count: u32,
    g: f32,
    softening_sq: f32,
    _pad: u32,
};

@group(0) @binding(0) var<storage, read> bodies: array<Body>;
@group(0) @binding(1) var<storage, read_write> accels: array<vec4<f32>>;
@group(0) @binding(2) var<uniform> params: Params;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
    let i = gid.x;
    if (i >= params.count) { return; }

    var ax: f32 = 0.0;
    var ay: f32 = 0.0;
    var az: f32 = 0.0;

    let pi = bodies[i];

    for (var j: u32 = 0u; j < params.count; j++) {
        if (j == i) { continue; }
        let pj = bodies[j];
        let dx = pj.px - pi.px;
        let dy = pj.py - pi.py;
        let dz = pj.pz - pi.pz;
        let dist_sq = dx * dx + dy * dy + dz * dz + params.softening_sq;
        let inv_dist = inverseSqrt(dist_sq);
        let inv_dist3 = inv_dist * inv_dist * inv_dist;
        let f = params.g * pj.mass * inv_dist3;
        ax += dx * f;
        ay += dy * f;
        az += dz * f;
    }

    accels[i] = vec4<f32>(ax, ay, az, 0.0);
}
"#;

pub struct GpuGravity {
    device: Arc<wgpu::Device>,
    queue: Arc<wgpu::Queue>,
    pipeline: wgpu::ComputePipeline,
    bind_group_layout: wgpu::BindGroupLayout,
}

impl GpuGravity {
    pub fn new() -> Option<Self> {
        let instance = wgpu::Instance::default();
        let adapter = pollster::block_on(instance.request_adapter(&wgpu::RequestAdapterOptions {
            power_preference: wgpu::PowerPreference::HighPerformance,
            ..Default::default()
        }))?;

        let (device, queue) = pollster::block_on(adapter.request_device(
            &wgpu::DeviceDescriptor {
                label: Some("gravity_device"),
                required_features: wgpu::Features::empty(),
                required_limits: wgpu::Limits::default(),
                ..Default::default()
            },
            None,
        )).ok()?;

        let device = Arc::new(device);
        let queue = Arc::new(queue);

        let shader = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("gravity_shader"),
            source: wgpu::ShaderSource::Wgsl(SHADER_SOURCE.into()),
        });

        let bind_group_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("gravity_bgl"),
            entries: &[
                wgpu::BindGroupLayoutEntry {
                    binding: 0,
                    visibility: wgpu::ShaderStages::COMPUTE,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Storage { read_only: true },
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
                wgpu::BindGroupLayoutEntry {
                    binding: 1,
                    visibility: wgpu::ShaderStages::COMPUTE,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Storage { read_only: false },
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
                wgpu::BindGroupLayoutEntry {
                    binding: 2,
                    visibility: wgpu::ShaderStages::COMPUTE,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Uniform,
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
            ],
        });

        let pipeline_layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
            label: Some("gravity_pl"),
            bind_group_layouts: &[&bind_group_layout],
            push_constant_ranges: &[],
        });

        let pipeline = device.create_compute_pipeline(&wgpu::ComputePipelineDescriptor {
            label: Some("gravity_pipeline"),
            layout: Some(&pipeline_layout),
            module: &shader,
            entry_point: Some("main"),
            compilation_options: Default::default(),
            cache: None,
        });

        Some(Self {
            device,
            queue,
            pipeline,
            bind_group_layout,
        })
    }

    pub fn compute_accelerations(
        &self,
        positions: &[Vec3],
        masses: &[f64],
        g: f64,
        softening_sq: f64,
    ) -> Vec<Vec3> {
        let n = positions.len();
        if n == 0 {
            return Vec::new();
        }

        // Pack body data: [px, py, pz, mass] as f32
        let mut body_data: Vec<f32> = Vec::with_capacity(n * 4);
        for i in 0..n {
            body_data.push(positions[i].x as f32);
            body_data.push(positions[i].y as f32);
            body_data.push(positions[i].z as f32);
            body_data.push(masses[i] as f32);
        }

        let body_buf = self.device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("body_buf"),
            contents: bytemuck::cast_slice(&body_data),
            usage: wgpu::BufferUsages::STORAGE,
        });

        let accel_size = (n * 4 * std::mem::size_of::<f32>()) as u64;
        let accel_buf = self.device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("accel_buf"),
            size: accel_size,
            usage: wgpu::BufferUsages::STORAGE | wgpu::BufferUsages::COPY_SRC,
            mapped_at_creation: false,
        });

        let readback_buf = self.device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("readback_buf"),
            size: accel_size,
            usage: wgpu::BufferUsages::MAP_READ | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });

        // Params: count (u32), g (f32), softening_sq (f32), pad (u32)
        // Pack as raw bytes to handle mixed u32/f32
        let mut params_bytes = Vec::with_capacity(16);
        params_bytes.extend_from_slice(&(n as u32).to_le_bytes());
        params_bytes.extend_from_slice(&(g as f32).to_le_bytes());
        params_bytes.extend_from_slice(&(softening_sq as f32).to_le_bytes());
        params_bytes.extend_from_slice(&0u32.to_le_bytes());
        let params_data = params_bytes;
        let params_buf = self.device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("params_buf"),
            contents: &params_data,
            usage: wgpu::BufferUsages::UNIFORM,
        });

        let bind_group = self.device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("gravity_bg"),
            layout: &self.bind_group_layout,
            entries: &[
                wgpu::BindGroupEntry { binding: 0, resource: body_buf.as_entire_binding() },
                wgpu::BindGroupEntry { binding: 1, resource: accel_buf.as_entire_binding() },
                wgpu::BindGroupEntry { binding: 2, resource: params_buf.as_entire_binding() },
            ],
        });

        let mut encoder = self.device.create_command_encoder(&Default::default());
        {
            let mut pass = encoder.begin_compute_pass(&Default::default());
            pass.set_pipeline(&self.pipeline);
            pass.set_bind_group(0, &bind_group, &[]);
            let workgroups = ((n as u32) + 63) / 64;
            pass.dispatch_workgroups(workgroups, 1, 1);
        }
        encoder.copy_buffer_to_buffer(&accel_buf, 0, &readback_buf, 0, accel_size);
        self.queue.submit(std::iter::once(encoder.finish()));

        // Read back
        let slice = readback_buf.slice(..);
        let (tx, rx) = std::sync::mpsc::channel();
        slice.map_async(wgpu::MapMode::Read, move |r| { let _ = tx.send(r); });
        self.device.poll(wgpu::Maintain::Wait);
        rx.recv().unwrap().unwrap();

        let data = slice.get_mapped_range();
        let floats: &[f32] = bytemuck::cast_slice(&data);

        let mut result = Vec::with_capacity(n);
        for i in 0..n {
            result.push(Vec3::new(
                floats[i * 4] as f64,
                floats[i * 4 + 1] as f64,
                floats[i * 4 + 2] as f64,
            ));
        }
        drop(data);
        readback_buf.unmap();

        result
    }
}

