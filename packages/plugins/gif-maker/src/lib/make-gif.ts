import type { Crop, FrameReader } from '~/native/frames';
import { encodeGif } from '~/lib/gif-encoder';
import { buildPalette } from '~/lib/palette';
import { fromBase64 } from '~/lib/base64';

export type GifRequest = {
	start: number;
	length: number;
	fps: number;
	width: number;
	crop: Crop;
	caption: string;
};

export type MadeGif = {
	bytes: Uint8Array;
	width: number;
	height: number;
	frames: number;
};

const yieldToUi = () => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * @description Lists the times to take frames at: from the start, every 1/fps seconds, within the clip and the video.
 * @param request The clip's start, length and frame rate.
 * @param duration The video's length in seconds.
 * @returns The frame times in seconds.
 */
export function frameTimes(
	{ start, length, fps }: Pick<GifRequest, 'start' | 'length' | 'fps'>,
	duration: number,
): number[] {
	const from = Math.min(Math.max(0, start), Math.max(0, duration - 0.05));
	const to = Math.min(duration, from + Math.max(0.1, length));
	const times: number[] = [];

	for (let time = from; time < to - 1e-6; time += 1 / fps) times.push(Number(time.toFixed(3)));

	return times;
}

/**
 * @description Takes the clip's frames from the reader and encodes them as a looping GIF, yielding between frames so
 * Discord stays responsive.
 * @param reader The opened video.
 * @param request The clip and how to shape it.
 * @param onProgress Called after each frame with how many are done and how many there are.
 * @returns The GIF, or `undefined` when no frame could be read.
 */
export async function makeGif(
	reader: FrameReader,
	request: GifRequest,
	onProgress: (done: number, total: number) => void,
): Promise<MadeGif | undefined> {
	const times = frameTimes(request, reader.duration());
	const frames: Uint8Array[] = [];
	let size: { width: number; height: number } | undefined;

	for (const [index, time] of times.entries()) {
		const frame = reader.frame(time, request);

		if (frame && (!size || (frame.width === size.width && frame.height === size.height))) {
			size ??= { width: frame.width, height: frame.height };
			frames.push(fromBase64(frame.rgba));
		}

		onProgress(index + 1, times.length);
		await yieldToUi();
	}

	if (!size || frames.length === 0) return undefined;

	const bytes = encodeGif(frames, {
		...size,
		delayCentiseconds: Math.round(100 / request.fps),
		palette: buildPalette(frames),
	});

	return { bytes, ...size, frames: frames.length };
}

export default { frameTimes, makeGif };
