import type { MeasuredMedia, MediaKind } from '@unbound-app/contracts/addon-page';
import { getMediaKind } from '@unbound-app/contracts/addon-page';
import { execFile } from 'node:child_process';
import { rgbaToThumbHash } from 'thumbhash';
import { stat } from 'node:fs/promises';
import { promisify } from 'node:util';
import { join } from 'node:path';
import sharp from 'sharp';
import { z } from 'zod';

/** One media file measured, or why it could not be. */
export type Measurement = { media: MeasuredMedia } | { error: string };

type Probe = {
	format: string;
	codec?: string;
	width: number;
	height: number;
	duration?: number;
};

type Pixels = {
	data: Uint8Array;
	width: number;
	height: number;
};

// ThumbHash encodes images of at most 100x100 pixels.
const THUMBHASH_SIZE = 100;

// The container format and codecs each extension must hold for a browser to show it.
const FORMATS: Record<string, string> = {
	png: 'png',
	jpg: 'jpeg',
	jpeg: 'jpeg',
	webp: 'webp',
	gif: 'gif',
	mp4: 'mp4',
	webm: 'webm',
};

const VIDEO_CODECS: Record<string, string[]> = {
	mp4: ['h264', 'hevc', 'av1'],
	webm: ['vp8', 'vp9', 'av1'],
};

const execFileAsync = promisify(execFile);

const ffprobeSchema = z.object({
	streams: z
		.array(
			z.object({
				codec_name: z.string(),
				width: z.number(),
				height: z.number(),
				side_data_list: z.optional(z.array(z.object({ rotation: z.optional(z.number()) }))),
			}),
		)
		.min(1),
	format: z.object({ format_name: z.string(), duration: z.coerce.number() }),
});

/**
 * @description Measures one media file: its size, its displayed width and height, a video's
 * length, and its ThumbHash. Images are read with sharp; videos need `ffprobe` and `ffmpeg`.
 * @param dir The addon's directory.
 * @param path The file's path relative to the addon's directory, as ADDON.md writes it.
 * @param maxBytes The largest size the file may have.
 * @returns The measured media, or a message naming the file and what is wrong with it.
 */
export async function measureMedia(
	dir: string,
	path: string,
	maxBytes: number,
): Promise<Measurement> {
	const file = join(dir, path);
	const kind = getMediaKind(path);

	if (!kind) {
		return { error: `${path} is not an image or a video.` };
	}

	const bytes = await stat(file).then(
		(stats) => (stats.isFile() ? stats.size : void 0),
		() => void 0,
	);

	if (bytes === void 0) {
		return { error: `${path} does not exist.` };
	}

	if (bytes > maxBytes) {
		return {
			error: `${path} is ${bytes} bytes; a media file may be at most ${maxBytes} bytes.`,
		};
	}

	try {
		const probe = kind === 'image' ? await probeImage(file) : await probeVideo(file);
		const extension = path.slice(path.lastIndexOf('.') + 1).toLowerCase();
		const mismatch = checkFormat(kind, extension, probe);

		if (mismatch) {
			return { error: `${path} ${mismatch}` };
		}

		const pixels =
			kind === 'image'
				? await readImagePixels(file)
				: await readVideoPixels(file, probe.width, probe.height);
		const thumbhash = Buffer.from(
			rgbaToThumbHash(pixels.width, pixels.height, pixels.data),
		).toString('base64');

		return {
			media: {
				path,
				kind,
				width: probe.width,
				height: probe.height,
				...(kind === 'video' ? { duration: probe.duration } : {}),
				thumbhash,
				bytes,
			},
		};
	} catch (error) {
		return { error: `${path} could not be measured: ${describeError(error)}` };
	}
}

function checkFormat(kind: MediaKind, extension: string, probe: Probe): string | undefined {
	const expected = FORMATS[extension];

	if (!expected || !probe.format.split(',').includes(expected)) {
		return `is not a ${extension} file; its contents are ${probe.format}.`;
	}

	const codecs = VIDEO_CODECS[extension];

	if (kind === 'video' && codecs && !codecs.includes(probe.codec ?? '')) {
		return `uses the ${probe.codec} codec; a .${extension} video must use ${codecs.join(', ')}.`;
	}

	if (kind === 'video' && !(probe.duration && probe.duration > 0)) {
		return 'has no length; a video must play for longer than zero seconds.';
	}

	return void 0;
}

async function probeImage(file: string): Promise<Probe> {
	const metadata = await sharp(file).metadata();
	const height = metadata.pageHeight ?? metadata.height;
	const rotated = (metadata.orientation ?? 1) >= 5;

	return {
		format: metadata.format,
		width: rotated ? height : metadata.width,
		height: rotated ? metadata.width : height,
	};
}

async function readImagePixels(file: string): Promise<Pixels> {
	const { data, info } = await sharp(file)
		.rotate()
		.resize(THUMBHASH_SIZE, THUMBHASH_SIZE, { fit: 'inside', withoutEnlargement: true })
		.ensureAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true });

	return { data, width: info.width, height: info.height };
}

async function probeVideo(file: string): Promise<Probe> {
	const { stdout } = await runVideoTool('ffprobe', [
		'-v',
		'error',
		'-print_format',
		'json',
		'-select_streams',
		'v:0',
		'-show_entries',
		'format=format_name,duration:stream=codec_name,width,height:stream_side_data=rotation',
		file,
	]);
	const parsed = ffprobeSchema.safeParse(JSON.parse(stdout.toString()));

	if (!parsed.success) {
		throw new Error('it has no video stream');
	}

	const [stream] = parsed.data.streams;

	if (!stream) {
		throw new Error('it has no video stream');
	}

	const rotation = stream.side_data_list?.find((data) => data.rotation !== void 0)?.rotation;
	const rotated = Math.abs(rotation ?? 0) % 180 === 90;

	return {
		format: parsed.data.format.format_name,
		codec: stream.codec_name,
		width: rotated ? stream.height : stream.width,
		height: rotated ? stream.width : stream.height,
		duration: parsed.data.format.duration,
	};
}

async function readVideoPixels(file: string, width: number, height: number): Promise<Pixels> {
	const scale = Math.min(1, THUMBHASH_SIZE / Math.max(width, height));
	const target = {
		width: Math.max(1, Math.round(width * scale)),
		height: Math.max(1, Math.round(height * scale)),
	};
	const { stdout } = await runVideoTool('ffmpeg', [
		'-v',
		'error',
		'-i',
		file,
		'-frames:v',
		'1',
		'-vf',
		`scale=${target.width}:${target.height}`,
		'-f',
		'rawvideo',
		'-pix_fmt',
		'rgba',
		'-',
	]);

	if (stdout.length !== target.width * target.height * 4) {
		throw new Error('ffmpeg could not read its first frame');
	}

	return { data: stdout, ...target };
}

async function runVideoTool(tool: 'ffmpeg' | 'ffprobe', args: string[]) {
	try {
		return await execFileAsync(tool, args, {
			encoding: 'buffer',
			maxBuffer: 64 * 1024 * 1024,
		});
	} catch (error) {
		if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
			throw new Error(`measuring a video needs ${tool}; install FFmpeg and add it to PATH`, {
				cause: error,
			});
		}

		throw error;
	}
}

// UNKNOWN: sharp and execFile reject with whatever their failure carries.
function describeError(error: unknown): string {
	if (!(error instanceof Error)) {
		return String(error);
	}

	const stderr =
		'stderr' in error && Buffer.isBuffer(error.stderr) ? error.stderr.toString() : '';

	return stderr.trim() || error.message;
}

export default { measureMedia };
