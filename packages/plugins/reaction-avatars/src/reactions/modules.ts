import type { ComponentType } from 'react';
import { metro, flux } from '@unbound-app/api';

import type { UserSummaryItemProps } from '~/reactions/components/reaction-avatar-surface';

export const ReactionActions = metro.findByFilePath('modules/reactions/ReactionActionCreators.tsx');
const UserSummaryItemModule = metro.findByFilePath('components_native/common/UserSummaryItem.tsx');

export const SelectedChannelStore = flux.getStore('SelectedChannel');
export const MessageStore = flux.getStore('Message');
export const ChannelStore = flux.getStore('Channel');
export const UserStore = flux.getStore('User');

type SummaryComponent = ComponentType<UserSummaryItemProps>;

/**
 * @description Finds Discord's `UserSummaryItem`, by its file and else by its name.
 * @returns The component, or `undefined` when neither lookup finds it.
 */
export function findUserSummaryItem(): SummaryComponent | undefined {
	const exported = UserSummaryItemModule.default ?? UserSummaryItemModule.module;
	const component =
		typeof exported === 'function'
			? exported
			: metro.findByName('UserSummaryItem', { lazy: false });

	return typeof component === 'function' ? (component as SummaryComponent) : undefined;
}
