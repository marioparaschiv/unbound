const IS_VOICE_MESSAGE = 1 << 13;

/** A flat waveform, for audio sent or shown as a voice message without one of its own. */
export const FLAT_WAVEFORM = 'AEtWPyUaGA4OEAcA';

const FALLBACK_SECONDS = 60;

/** A file on its way up, as Discord's upload holds it. */
export type PendingUpload = { mimeType?: string; durationSecs?: number; waveform?: string };

/** An attachment as Discord receives it. */
export type ReceivedAttachment = {
	content_type?: string;
	duration_secs?: number;
	waveform?: string;
};

/** A message as Discord receives it. */
export type ReceivedMessage = { flags?: number; attachments?: ReceivedAttachment[] };

const isAudio = (type: string | undefined) => Boolean(type?.startsWith('audio/'));

/**
 * @description Turns a message that is only audio files into a voice message, the way Discord sends a recording.
 * @param content The message text; voice messages carry none.
 * @param uploads The files being sent, changed in place.
 * @returns The message flags to send with, or `undefined` to leave the message alone.
 */
export function voiceMessageFlags(content: string, uploads: PendingUpload[]): number | undefined {
	if (content.trim() || !uploads.length || !uploads.every((upload) => isAudio(upload.mimeType))) {
		return;
	}

	for (const upload of uploads) {
		upload.mimeType = 'audio/ogg';
		upload.durationSecs ??= FALLBACK_SECONDS;
		upload.waveform ??= FLAT_WAVEFORM;
	}

	return IS_VOICE_MESSAGE;
}

/**
 * @description Shows a received message whose first file is audio as a voice message.
 * @param message The message, changed in place.
 * @returns Whether it changed.
 */
export function showAsVoiceMessage(message: ReceivedMessage | undefined): boolean {
	const attachments = message?.attachments;

	if (!message || (message.flags ?? 0) & IS_VOICE_MESSAGE) return false;

	if (!attachments?.length || !isAudio(attachments[0]!.content_type)) return false;

	message.flags = (message.flags ?? 0) | IS_VOICE_MESSAGE;

	for (const attachment of attachments) {
		attachment.duration_secs ??= FALLBACK_SECONDS;
		attachment.waveform ??= FLAT_WAVEFORM;
	}

	return true;
}
