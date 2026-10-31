import type { FluxChannel, FluxStore, FluxUser } from '@unbound-app/api/flux';

import type { AttachmentLike } from '~/edits/attachments';

export type StoredMessage = {
	id: string;
	channel_id: string;
	content: string;
	author: FluxUser & { bot?: boolean };
	attachments?: AttachmentLike[];
	flags?: number;
	state?: string;
};

type ChannelMessages = {
	toArray(): StoredMessage[];
};

type MessageStore = FluxStore & {
	getMessage(channelId: string, messageId: string): StoredMessage | undefined;
	getMessages(channelId: string): ChannelMessages | undefined;
};

type ChannelStore = FluxStore & {
	getChannel(channelId: string): (FluxChannel & { parent_id?: string | null }) | undefined;
};

declare module '@unbound-app/api/flux' {
	interface FluxStores {
		Message: MessageStore;
		Channel: ChannelStore;
	}
}
