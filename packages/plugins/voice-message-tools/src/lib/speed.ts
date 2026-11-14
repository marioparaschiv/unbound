const AUDIO_ATTACHMENT =
	/^https:\/\/(?:cdn|media)\.discordapp\.(?:com|net)\/attachments\/[^?]+\.(?:ogg|opus|mp3|m4a|aac|wav|flac)(?:\?|$)/i;

/**
 * @description Tells whether a player plays an audio attachment, a voice message or an audio file, rather than a video.
 * @param url The URL the player plays.
 * @returns Whether it is an audio attachment on Discord's CDN.
 */
export function isAudioAttachment(url: string): boolean {
	'worklet';

	return AUDIO_ATTACHMENT.test(url);
}

/**
 * @description Reads the speed setting.
 * @param value The stored speed.
 * @returns The speed, 1 for anything unknown.
 */
export function parseSpeed(value: string): number {
	const speed = Number(value);

	return Number.isFinite(speed) && speed >= 0.5 && speed <= 3 ? speed : 1;
}
