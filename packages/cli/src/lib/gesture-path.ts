export type GestureSpec = {
	x: number;
	y: number;
	dx: number;
	dy: number;
	duration: number;
	hold: number;
	steps: number;
};

export type GestureStep = {
	dx: number;
	dy: number;
	vx: number;
	vy: number;
	delay: number;
};

export type GesturePath = {
	x: number;
	y: number;
	steps: GestureStep[];
	hold: number;
	release: { vx: number; vy: number };
};

const round = (value: number) => Math.round(value * 100) / 100;

/**
 * @description Splits a drag into evenly timed steps, each with its translation from the start and its velocity.
 * @param spec Where the drag starts, how far it moves, how long it takes, how long it holds and in how many steps.
 * @returns The steps to send; the release keeps the drag's velocity unless the finger held still first.
 */
export function gesturePath({ x, y, dx, dy, duration, hold, steps }: GestureSpec): GesturePath {
	const count = Math.max(1, Math.round(steps));
	const delay = Math.max(0, duration) / count;
	const seconds = Math.max(duration, 1) / 1000;
	const vx = round(dx / seconds);
	const vy = round(dy / seconds);
	const path = Array.from({ length: count }, (_, index) => ({
		dx: round((dx * (index + 1)) / count),
		dy: round((dy * (index + 1)) / count),
		vx,
		vy,
		delay: round(delay),
	}));

	return {
		x,
		y,
		steps: path,
		hold: Math.max(0, hold),
		release: hold > 0 ? { vx: 0, vy: 0 } : { vx, vy },
	};
}

export default { gesturePath };
