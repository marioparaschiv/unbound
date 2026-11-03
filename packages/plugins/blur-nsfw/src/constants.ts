export const PLUGIN_NAME = 'Blur NSFW';

export const SETTINGS = {
	attachments: true,
	embeds: true,
} as const;

export type BlurPart = keyof typeof SETTINGS;

export const EMBED_MEDIA_FIELDS = ['image', 'images', 'thumbnail', 'video'] as const;

export const SNAPSHOT_FIELDS = ['messageSnapshots', 'message_snapshots'] as const;
