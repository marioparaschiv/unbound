export const MAX_ATTACHMENTS = 10;
export const MAX_DESCRIPTION_LENGTH = 100;

export const ARGUMENT_PATTERN = /{{(.+?)}}/g;

export const ApplicationCommandType = { Chat: 1 } as const;
export const ApplicationCommandInputType = { BuiltInText: 1 } as const;
export const ApplicationCommandOptionType = { String: 3, Boolean: 5 } as const;

export const MIME_TYPES: Partial<Record<string, string>> = {
	gif: 'image/gif',
	heic: 'image/heic',
	jpeg: 'image/jpeg',
	jpg: 'image/jpeg',
	m4v: 'video/x-m4v',
	mov: 'video/quicktime',
	mp4: 'video/mp4',
	png: 'image/png',
	webm: 'video/webm',
	webp: 'image/webp',
};
