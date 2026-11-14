const COLORS: Partial<Record<string, string>> = {
	online: '#23a55a',
	idle: '#f0b232',
	dnd: '#f23f43',
	streaming: '#593695',
};

const OFFLINE_COLOR = '#80848e';
const OFFLINE = new Set(['offline', 'invisible']);

/**
 * @description Picks the ring colour for an avatar's status.
 * @param status The status Discord passes the avatar.
 * @param offline Whether offline and invisible users get a ring.
 * @returns The colour, or `undefined` when the avatar gets no ring.
 */
export function ringColor(status: unknown, offline: boolean): string | undefined {
	if (typeof status !== 'string') return undefined;

	if (OFFLINE.has(status)) return offline ? OFFLINE_COLOR : undefined;

	return COLORS[status];
}

export default ringColor;
