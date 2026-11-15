import type { Messages } from '@unbound-app/i18n';

export type SoundEvent = { name: string; label: keyof Messages };

export const EVENTS: readonly SoundEvent[] = [
	{ name: 'message1', label: 'EVENT_MESSAGE' },
	{ name: 'call_ringing', label: 'EVENT_CALL_RINGING' },
	{ name: 'user_join', label: 'EVENT_USER_JOIN' },
	{ name: 'user_leave', label: 'EVENT_USER_LEAVE' },
	{ name: 'user_moved', label: 'EVENT_USER_MOVED' },
	{ name: 'mute', label: 'EVENT_MUTE' },
	{ name: 'unmute', label: 'EVENT_UNMUTE' },
	{ name: 'deafen', label: 'EVENT_DEAFEN' },
	{ name: 'undeafen', label: 'EVENT_UNDEAFEN' },
	{ name: 'disconnect', label: 'EVENT_DISCONNECT' },
	{ name: 'ptt_start', label: 'EVENT_PTT_START' },
	{ name: 'ptt_stop', label: 'EVENT_PTT_STOP' },
	{ name: 'stream_started', label: 'EVENT_STREAM_STARTED' },
	{ name: 'stream_ended', label: 'EVENT_STREAM_ENDED' },
	{ name: 'stream_user_joined', label: 'EVENT_STREAM_USER_JOINED' },
	{ name: 'stream_user_left', label: 'EVENT_STREAM_USER_LEFT' },
	{ name: 'camera_on', label: 'EVENT_CAMERA_ON' },
	{ name: 'camera_off', label: 'EVENT_CAMERA_OFF' },
	{ name: 'activity_launch', label: 'EVENT_ACTIVITY_LAUNCH' },
	{ name: 'activity_end', label: 'EVENT_ACTIVITY_END' },
];

export const EXTRA_SOUNDS: readonly SoundEvent[] = [
	{ name: 'activity_user_join', label: 'SOUND_ACTIVITY_JOIN' },
	{ name: 'mention1', label: 'SOUND_MENTION' },
	{ name: 'bit_message1', label: 'SOUND_BIT' },
];

export const DEFAULT = 'default';
export const LINK = 'link';

export type SoundChoice = typeof DEFAULT | typeof LINK | `sound:${string}`;

export type Override = { kind: 'sound'; name: string } | { kind: 'link'; url: string };

const KNOWN = new Set([...EVENTS, ...EXTRA_SOUNDS].map(({ name }) => name));
const HTTP_URL = /^https?:\/\/\S+$/i;

// UNKNOWN: a hand-editable settings value read back from storage.
function isStringMap(value: unknown): value is Record<string, string> {
	return (
		typeof value === 'object' &&
		value !== null &&
		!Array.isArray(value) &&
		Object.values(value).every((entry) => typeof entry === 'string')
	);
}

/**
 * @description Reads a stored map of sound name to text, dropping anything malformed.
 * @param text The stored JSON.
 * @returns The map, empty when the text is not one.
 */
export function readMap(text: string): Record<string, string> {
	try {
		const value: unknown = JSON.parse(text || '{}');

		return isStringMap(value) ? value : {};
	} catch {
		return {};
	}
}

/**
 * @description Works out what plays in place of one of Discord's sounds.
 * @param name The sound Discord is about to play.
 * @param choices Each sound's choice: `default`, `link` or `sound:<name>`.
 * @param links Each sound's link, for the `link` choice.
 * @returns The replacement, or `undefined` to play Discord's own sound.
 */
export function overrideFor(
	name: string,
	choices: Record<string, string>,
	links: Record<string, string>,
): Override | undefined {
	const choice = choices[name];

	if (choice === LINK) {
		const url = links[name]?.trim();

		return url && HTTP_URL.test(url) ? { kind: 'link', url } : undefined;
	}

	if (choice?.startsWith('sound:')) {
		const replacement = choice.slice('sound:'.length);

		return KNOWN.has(replacement) && replacement !== name
			? { kind: 'sound', name: replacement }
			: undefined;
	}

	return undefined;
}

export default { EVENTS, EXTRA_SOUNDS, readMap, overrideFor };
