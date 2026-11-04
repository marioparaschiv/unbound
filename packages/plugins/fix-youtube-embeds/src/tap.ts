export type TouchPoint = {
	x: number;
	y: number;
	time: number;
};

const MAX_TAP_DISTANCE = 10;
const MAX_TAP_DURATION = 300;

/**
 * @description Decides whether a touch was a tap rather than a scroll, drag or long press, so the player can show or hide the media viewer's controls like Discord's own player does.
 * @param start Where and when the touch began, or nothing when it began with more than one finger.
 * @param end Where and when it ended.
 * @returns `true` for a short touch that barely moved.
 */
export function isTap(start: TouchPoint | undefined, end: TouchPoint): boolean {
	if (!start) return false;

	const distance = Math.hypot(end.x - start.x, end.y - start.y);
	const duration = end.time - start.time;

	return distance <= MAX_TAP_DISTANCE && duration >= 0 && duration <= MAX_TAP_DURATION;
}
