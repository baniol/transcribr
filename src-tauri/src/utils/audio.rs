use std::fs::File;
use std::path::Path;
use symphonia::core::audio::SampleBuffer;
use symphonia::core::codecs::DecoderOptions;
use symphonia::core::formats::FormatOptions;
use symphonia::core::io::MediaSourceStream;
use symphonia::core::meta::MetadataOptions;
use symphonia::core::probe::Hint;

/// Convert any supported audio file to mono f32 samples at 16kHz
pub fn load_audio_file(path: &Path) -> Result<Vec<f32>, String> {
    let extension = path
        .extension()
        .and_then(|e| e.to_str())
        .map(|s| s.to_lowercase())
        .unwrap_or_default();

    match extension.as_str() {
        "wav" => load_wav(path),
        "mp3" | "m4a" | "aac" | "mp4" => load_with_symphonia(path),
        _ => Err(format!("Unsupported audio format: {}", extension)),
    }
}

fn load_wav(path: &Path) -> Result<Vec<f32>, String> {
    let reader = hound::WavReader::open(path).map_err(|e| format!("Failed to read WAV: {}", e))?;
    let spec = reader.spec();

    let samples: Vec<f32> = match spec.sample_format {
        hound::SampleFormat::Int => {
            if spec.channels == 1 {
                reader
                    .into_samples::<i16>()
                    .filter_map(Result::ok)
                    .map(|s| f32::from(s) / f32::from(i16::MAX))
                    .collect()
            } else {
                let all_samples: Vec<i16> = reader
                    .into_samples::<i16>()
                    .filter_map(Result::ok)
                    .collect();
                all_samples
                    .chunks(spec.channels as usize)
                    .map(|chunk| {
                        let sum: i32 = chunk.iter().map(|&s| i32::from(s)).sum();
                        let avg = sum / chunk.len() as i32;
                        avg as f32 / f32::from(i16::MAX)
                    })
                    .collect()
            }
        }
        hound::SampleFormat::Float => {
            if spec.channels == 1 {
                reader
                    .into_samples::<f32>()
                    .filter_map(Result::ok)
                    .collect()
            } else {
                let all_samples: Vec<f32> = reader
                    .into_samples::<f32>()
                    .filter_map(Result::ok)
                    .collect();
                all_samples
                    .chunks(spec.channels as usize)
                    .map(|chunk| chunk.iter().sum::<f32>() / chunk.len() as f32)
                    .collect()
            }
        }
    };

    resample_to_16khz(samples, spec.sample_rate)
}

fn load_with_symphonia(path: &Path) -> Result<Vec<f32>, String> {
    let file = File::open(path).map_err(|e| format!("Failed to open file: {}", e))?;
    let mss = MediaSourceStream::new(Box::new(file), Default::default());

    let mut hint = Hint::new();
    if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
        hint.with_extension(ext);
    }

    let format_opts = FormatOptions::default();
    let metadata_opts = MetadataOptions::default();

    let probed = symphonia::default::get_probe()
        .format(&hint, mss, &format_opts, &metadata_opts)
        .map_err(|e| format!("Failed to probe audio format: {}", e))?;

    let mut format = probed.format;
    let track = format.default_track().ok_or("No audio track found")?;

    let track_id = track.id;
    let sample_rate = track
        .codec_params
        .sample_rate
        .ok_or("Unknown sample rate")?;
    let channels = track.codec_params.channels.map(|c| c.count()).unwrap_or(1);

    let decoder_opts = DecoderOptions::default();
    let mut decoder = symphonia::default::get_codecs()
        .make(&track.codec_params, &decoder_opts)
        .map_err(|e| format!("Failed to create decoder: {}", e))?;

    let mut all_samples: Vec<f32> = Vec::new();

    loop {
        let packet = match format.next_packet() {
            Ok(p) => p,
            Err(symphonia::core::errors::Error::IoError(e))
                if e.kind() == std::io::ErrorKind::UnexpectedEof =>
            {
                break;
            }
            Err(e) => return Err(format!("Error reading packet: {}", e)),
        };

        if packet.track_id() != track_id {
            continue;
        }

        let decoded = match decoder.decode(&packet) {
            Ok(d) => d,
            Err(symphonia::core::errors::Error::DecodeError(_)) => continue,
            Err(e) => return Err(format!("Decode error: {}", e)),
        };

        let spec = *decoded.spec();
        let duration = decoded.capacity() as u64;

        let mut sample_buf = SampleBuffer::<f32>::new(duration, spec);
        sample_buf.copy_interleaved_ref(decoded);

        let samples = sample_buf.samples();

        // Convert to mono if stereo
        if channels > 1 {
            for chunk in samples.chunks(channels) {
                let avg: f32 = chunk.iter().sum::<f32>() / channels as f32;
                all_samples.push(avg);
            }
        } else {
            all_samples.extend_from_slice(samples);
        }
    }

    resample_to_16khz(all_samples, sample_rate)
}

fn resample_to_16khz(samples: Vec<f32>, sample_rate: u32) -> Result<Vec<f32>, String> {
    if sample_rate == 16000 {
        return Ok(samples);
    }

    let ratio = 16000.0 / sample_rate as f64;
    let new_len = (samples.len() as f64 * ratio) as usize;
    let mut resampled = Vec::with_capacity(new_len);

    for i in 0..new_len {
        let src_idx = i as f64 / ratio;
        let idx = src_idx as usize;
        let frac = src_idx - idx as f64;

        let sample = if idx + 1 < samples.len() {
            samples[idx] * (1.0 - frac as f32) + samples[idx + 1] * frac as f32
        } else {
            samples[idx.min(samples.len() - 1)]
        };
        resampled.push(sample);
    }

    Ok(resampled)
}

/// Calculate duration in seconds from samples at 16kHz
pub fn calculate_duration_seconds(samples_16khz: &[f32]) -> i64 {
    (samples_16khz.len() as f64 / 16000.0).ceil() as i64
}
