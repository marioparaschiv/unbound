import { openFrameReader } from '@unbound-plugins/shared/media/frames/frame-reader';
import { toBase64 } from '@unbound-plugins/shared/media/gif/base64';
import type { NativeBridge } from '@unbound-app/api/native';
import { fs } from '@unbound-app/api';

import type { TimedFrame } from '~/lib/flashes';
import { decodeGif } from '~/lib/gif-decoder';

const FRAME_WIDTH = 160;
const VIDEO_FPS = 15;
const MAX_SECONDS = 15;
const MAX_BYTES = 50 * 1024 * 1024;

export type Media = { url: string; kind: 'gif' | 'video'; name: string };

async function download(url: string): Promise<Uint8Array> {
	const response = await fetch(url);

	if (!response.ok) throw new Error(`HTTP ${response.status}`);

	const bytes = new Uint8Array(await response.arrayBuffer());

	if (bytes.byteLength > MAX_BYTES) throw new Error('the file is over 50 MB');

	return bytes;
}

function gifFrames(bytes: Uint8Array): TimedFrame[] {
	const { width, height, frames } = decodeGif(bytes, { maxWidth: FRAME_WIDTH });
	let atMs = 0;

	return frames.map(({ rgba, delayMs }) => {
		const frame = { rgba, width, height, atMs };

		atMs += delayMs;

		return frame;
	});
}

async function videoFrames(
	bridge: NativeBridge,
	bytes: Uint8Array,
	folder: string,
): Promise<TimedFrame[]> {
	const path = `${folder}/${Date.now()}/media.mp4`;

	await fs.writeFile(path, toBase64(bytes), 'base64');

	const reader = openFrameReader(bridge, `${fs.documentsPath}/${path}`);

	if (!reader) throw new Error('this device cannot read the video');

	try {
		const seconds = Math.min(MAX_SECONDS, reader.duration());
		const frames: TimedFrame[] = [];

		for (let step = 0; step < seconds * VIDEO_FPS; step++) {
			const frame = reader.frame(step / VIDEO_FPS, {
				width: FRAME_WIDTH,
				crop: 'original',
				caption: '',
			});

			if (frame) frames.push({ ...frame, atMs: Math.round((step * 1000) / VIDEO_FPS) });
		}

		return frames;
	} finally {
		reader.close();
	}
}

/**
 * @description Reads the frames of a GIF or a video, small enough to analyse: GIFs are decoded here with their own
 * timing, videos are sampled 15 times a second through the platform's decoder, for up to 15 seconds.
 * @param bridge The plugin's native bridge.
 * @param media The media to read.
 * @param folder The plugin's temporary folder, relative to the documents directory.
 * @returns The frames, in time order.
 */
export async function readFrames(
	bridge: NativeBridge,
	media: Media,
	folder: string,
): Promise<TimedFrame[]> {
	const bytes = await download(media.url);

	return media.kind === 'gif' ? gifFrames(bytes) : videoFrames(bridge, bytes, folder);
}
