const AUDIO_ATTACHMENT =
	/^https:\/\/(?:cdn|media)\.discordapp\.(?:com|net)\/attachments\/[^?]+\.(?:ogg|opus|mp3|m4a|aac|wav|flac)(?:\?|$)/i;

/**
 * @description Tells whether a player plays an audio attachment, a voice message or an audio file, rather than a video. Runs on the JS and UI threads.
 * @param url The URL the player plays.
 * @returns Whether it is an audio attachment on Discord's CDN.
 */
export function isAudioAttachment(url: string): boolean {
	'worklet';

	return AUDIO_ATTACHMENT.test(url);
}

export default isAudioAttachment;
