const IS_VOICE_MESSAGE = 1 << 13;

/** A message as the long-press sheet passes it. */
export type SheetMessage = {
	id?: string;
	flags?: number;
	attachments?: { url?: string; filename?: string; content_type?: string }[];
};

/** The audio file of a voice message. */
export type VoiceFile = { url: string; filename: string };

/**
 * @description Reads the audio file of a voice message.
 * @param message The message.
 * @returns Its file, or `undefined` for any other message.
 */
export function voiceFile(message: SheetMessage | undefined): VoiceFile | undefined {
	if (!message?.flags || !(message.flags & IS_VOICE_MESSAGE)) return;

	const [attachment] = message.attachments ?? [];

	if (!attachment?.url) return;

	return {
		url: attachment.url,
		filename: savedName(message.id, attachment.filename),
	};
}

function savedName(id: string | undefined, filename: string | undefined): string {
	const extension = /\.([a-z0-9]{2,4})$/i.exec(filename ?? '')?.[1] ?? 'ogg';

	return `voice-message-${id ?? Date.now()}.${extension}`;
}

/**
 * @description Encodes bytes as base64, for writing a binary file.
 * @param bytes The bytes.
 * @returns The base64 text.
 */
export function toBase64(bytes: Uint8Array): string {
	const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
	let out = '';

	for (let index = 0; index < bytes.length; index += 3) {
		const [a = 0, b = 0, c = 0] = [bytes[index], bytes[index + 1], bytes[index + 2]];
		const triple = (a << 16) | (b << 8) | c;

		out += alphabet[(triple >> 18) & 63]! + alphabet[(triple >> 12) & 63]!;
		out += index + 1 < bytes.length ? alphabet[(triple >> 6) & 63] : '=';
		out += index + 2 < bytes.length ? alphabet[triple & 63] : '=';
	}

	return out;
}
