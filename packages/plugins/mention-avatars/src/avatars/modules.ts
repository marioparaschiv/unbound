import type { FluxMessage, FluxStore } from '@unbound-app/api/flux';
import { metro, flux } from '@unbound-app/api';

type MessageList = {
	_array?: FluxMessage[];
};

type MessageStoreType = FluxStore & {
	getMessage(channelId: string | undefined, id: string): FluxMessage | undefined;
	getMessages(channelId: string | undefined): MessageList | undefined;
};

export const UserStore = flux.getStore('User');
export const ChannelStore = flux.getStore('Channel');
export const MessageStore = flux.getStore('Message') as MessageStoreType;
export const GuildMemberStore = flux.getStore('GuildMember');
export const SelectedChannelStore = flux.getStore('SelectedChannel');
export const RoleStore = metro.findByProps('getRole', 'getSortedRoles');
export const RowGenerator = metro.findByProps('generateMessageRowData');
