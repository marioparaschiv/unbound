export const FRAME_SIZE = 128;
export const FRAME_COUNT = 10;
export const FRAME_DELAY_CENTISECONDS = 5;

const AVATAR_SIZE = 100;
const OUTLINE = 2.2;
const SKIN: [number, number, number] = [255, 214, 170];
const SHADE: [number, number, number] = [240, 186, 140];
const LINE: [number, number, number] = [58, 38, 30];

type Shape = (x: number, y: number) => number;

function ellipse(cx: number, cy: number, rx: number, ry: number): Shape {
	return (x, y) => (Math.hypot((x - cx) / rx, (y - cy) / ry) - 1) * Math.min(rx, ry);
}

function capsule(ax: number, ay: number, bx: number, by: number, radius: number): Shape {
	return (x, y) => {
		const dx = bx - ax;
		const dy = by - ay;
		const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));

		return Math.hypot(x - (ax + t * dx), y - (ay + t * dy)) - radius;
	};
}

function handShapes(cx: number, tipY: number): Shape[] {
	return [
		ellipse(cx + 8, tipY - 36, 31, 21),
		capsule(cx - 22, tipY - 36, cx - 25, tipY - 6, 6.5),
		capsule(cx - 8, tipY - 40, cx - 9, tipY - 1, 7),
		capsule(cx + 7, tipY - 40, cx + 7, tipY - 2, 7),
		capsule(cx + 21, tipY - 36, cx + 22, tipY - 8, 6.5),
		capsule(cx + 34, tipY - 32, cx + 44, tipY - 14, 7),
	];
}

function sampleAvatar(
	avatar: Uint8Array,
	size: number,
	u: number,
	v: number,
): [number, number, number] {
	const x = Math.min(size - 1, Math.max(0, Math.floor(u * size)));
	const y = Math.min(size - 1, Math.max(0, Math.floor(v * size)));
	const offset = (y * size + x) * 4;

	return [avatar[offset]!, avatar[offset + 1]!, avatar[offset + 2]!];
}

function drawAvatar(frame: Uint8Array, avatar: Uint8Array, size: number, squish: number) {
	const width = AVATAR_SIZE * (1 + 0.14 * squish);
	const height = AVATAR_SIZE * (1 - 0.24 * squish);
	const left = (FRAME_SIZE - width) / 2;
	const top = FRAME_SIZE - height - 2;

	for (let y = Math.floor(top); y < FRAME_SIZE; y++) {
		for (let x = Math.floor(left); x < Math.ceil(left + width); x++) {
			const u = (x + 0.5 - left) / width;
			const v = (y + 0.5 - top) / height;

			if (Math.hypot(u - 0.5, v - 0.5) > 0.5) continue;

			frame.set([...sampleAvatar(avatar, size, u, v), 255], (y * FRAME_SIZE + x) * 4);
		}
	}

	return top;
}

function drawHand(frame: Uint8Array, cx: number, tipY: number) {
	const shapes = handShapes(cx, tipY);

	for (let y = 0; y < Math.min(FRAME_SIZE, tipY + OUTLINE + 2); y++) {
		for (let x = 0; x < FRAME_SIZE; x++) {
			const distance = Math.min(...shapes.map((shape) => shape(x + 0.5, y + 0.5)));

			if (distance > OUTLINE) continue;

			const color = distance > 0 ? LINE : y > tipY - 12 ? SHADE : SKIN;

			frame.set([...color, 255], (y * FRAME_SIZE + x) * 4);
		}
	}
}

/**
 * @description Draws a head pat: the avatar, cut to a circle, squishes under a cartoon hand that presses down and
 * bounces back over one loop.
 * @param avatar The picture's RGBA bytes, square.
 * @param size The picture's width and height.
 * @returns The frames' RGBA bytes, `FRAME_SIZE` square, with a transparent background.
 */
export function petpetFrames(avatar: Uint8Array, size: number): Uint8Array[] {
	return Array.from({ length: FRAME_COUNT }, (_, index) => {
		const squish = (1 - Math.cos((2 * Math.PI * index) / FRAME_COUNT)) / 2;
		const frame = new Uint8Array(FRAME_SIZE * FRAME_SIZE * 4);
		const avatarTop = drawAvatar(frame, avatar, size, squish);

		drawHand(
			frame,
			FRAME_SIZE / 2 - 6 + 3 * Math.sin((2 * Math.PI * index) / FRAME_COUNT),
			avatarTop + 16,
		);

		return frame;
	});
}

export default { petpetFrames, FRAME_SIZE, FRAME_COUNT, FRAME_DELAY_CENTISECONDS };
