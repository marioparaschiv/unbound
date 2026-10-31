import type { FluxChannel, FluxStore } from '@unbound-app/api/flux';

export type MessageAttachment = {
	id: string;
	filename?: string;
};

export type EditableMessage = {
	id: string;
	channel_id: string;
	type?: number;
	flags?: number;
	author?: { id?: string };
	attachments?: MessageAttachment[];
};

export type UploadItem = {
	id: string;
	origin: number;
	uri: string;
	originalUri: string;
	mimeType: string;
	filename: string;
	width?: number;
	height?: number;
	playableDuration?: number | null;
	platform: number;
	createdUsingInAppCamera: boolean;
};

type Channel = FluxChannel & { isPrivate?: () => boolean };

type MessageStore = FluxStore & {
	getMessage(channelId: string, messageId: string): EditableMessage | undefined;
};

type ChannelStore = FluxStore & {
	getChannel(channelId: string): Channel | undefined;
};

type PermissionStore = FluxStore & {
	can(permission: bigint, channel: Channel): boolean;
};

type EditMessageStore = FluxStore & {
	getEditingMessage(channelId: string): EditableMessage | null | undefined;
};

declare module '@unbound-app/api/flux' {
	interface FluxStores {
		Message: MessageStore;
		Channel: ChannelStore;
		Permission: PermissionStore;
		EditMessage: EditMessageStore;
	}
}
