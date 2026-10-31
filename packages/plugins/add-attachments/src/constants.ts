export const PLUGIN_NAME = 'Add Attachments';

export const MAX_ATTACHMENTS = 10;

export const MessageType = {
	DEFAULT: 0,
	REPLY: 19,
} as const;

export const IS_VOICE_MESSAGE_FLAG = 1 << 13;

export const COMPLETED_UPLOAD = 'COMPLETED';
