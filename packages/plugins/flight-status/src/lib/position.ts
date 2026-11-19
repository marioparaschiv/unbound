export type Aircraft = {
	alt_baro?: number | 'ground';
	gs?: number;
	track?: number;
	baro_rate?: number;
	t?: string;
	r?: string;
};

export type Status =
	| {
			state: 'airborne';
			altitude: number;
			speed: number;
			heading: string;
			vertical: 'climbing' | 'descending' | 'level';
			type?: string;
			registration?: string;
	  }
	| { state: 'ground'; type?: string; registration?: string }
	| { state: 'unseen' };

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const LEVEL_FPM = 300;

function compass(track: number | undefined): string {
	return typeof track === 'number' ? COMPASS[Math.round(track / 45) % 8]! : '?';
}

/**
 * @description Reads the first aircraft adsb.lol reports for a callsign.
 * @param aircraft The `ac` list of adsb.lol's answer.
 * @returns Whether it is in the air, on the ground, or not seen, with what it reports.
 */
export function readStatus(aircraft: Aircraft[] | undefined): Status {
	const plane = aircraft?.[0];

	if (!plane) return { state: 'unseen' };

	const identity = { type: plane.t, registration: plane.r };

	if (plane.alt_baro === 'ground' || typeof plane.alt_baro !== 'number')
		return { state: 'ground', ...identity };

	const rate = plane.baro_rate ?? 0;

	return {
		state: 'airborne',
		altitude: Math.round(plane.alt_baro / 100) * 100,
		speed: Math.round(plane.gs ?? 0),
		heading: compass(plane.track),
		vertical: rate > LEVEL_FPM ? 'climbing' : rate < -LEVEL_FPM ? 'descending' : 'level',
		...identity,
	};
}

export default readStatus;
