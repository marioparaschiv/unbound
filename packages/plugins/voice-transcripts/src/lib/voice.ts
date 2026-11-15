const VOICE_MESSAGE = 1 << 13;
const AUDIO = /\.(ogg|opus|mp3|m4a|wav|aac)(\?|$)/i;

/** What the plugin reads from a message. */
export type VoiceMessage = {
	flags?: number;
	attachments?: { url?: string; content_type?: string; filename?: string }[];
};

/** Why a transcript failed, so the plugin can say what to do. */
export type TranscriptFailure =
	| 'needs-sideload'
	| 'not-allowed'
	| 'unavailable'
	| 'no-speech'
	| 'failed';

/** A transcript, or why there is none. */
export type TranscriptResult = { text: string } | { failure: TranscriptFailure; detail?: string };

/**
 * @description Finds the audio a message carries: a voice message's clip, or an audio attachment.
 * @param message The message.
 * @returns The audio's address, or `undefined` for a message without audio.
 */
export function audioOf(message: VoiceMessage | undefined): string | undefined {
	const attachments = message?.attachments ?? [];
	const audio = attachments.find(
		(attachment) =>
			attachment.content_type?.startsWith('audio/') ||
			AUDIO.test(attachment.filename ?? attachment.url ?? ''),
	);
	const voice = (message?.flags ?? 0) & VOICE_MESSAGE ? attachments[0] : undefined;

	return (audio ?? voice)?.url;
}
