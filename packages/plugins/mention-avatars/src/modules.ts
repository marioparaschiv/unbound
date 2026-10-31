import type { FluxMessage, FluxStore } from '@unbound-app/api/flux';
import { metro, storage, flux } from '@unbound-app/api';

type MessageList = {
	_array?: FluxMessage[];
};

type MessageStoreType = FluxStore & {
	getMessage(channelId: string | undefined, id: string): FluxMessage | undefined;
	getMessages(channelId: string | undefined): MessageList | undefined;
};

export const UserStore = flux.getStore('User', { lazy: true });
export const ChannelStore = flux.getStore('Channel', { lazy: true });
export const MessageStore = flux.getStore('Message', { lazy: true }) as MessageStoreType;
export const GuildMemberStore = flux.getStore('GuildMember', { lazy: true });
export const SelectedChannelStore = flux.getStore('SelectedChannel', { lazy: true });
export const RoleStore = metro.findByProps('getRole', 'getSortedRoles', { lazy: true });
export const RowGenerator = metro.findByProps('generateMessageRowData', { lazy: true });

export const settings = storage.getBucket();
