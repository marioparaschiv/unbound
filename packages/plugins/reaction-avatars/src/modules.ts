import type { ComponentType } from 'react';
import { metro } from '@unbound-app/api';

import type { UserSummaryItemProps } from '~/components/reaction-avatar-surface';

export const ReactionActions = metro.findByFilePath(
	'modules/reactions/ReactionActionCreators.tsx',
	{
		lazy: true,
	},
);
const UserSummaryItemModule = metro.findByFilePath('components_native/common/UserSummaryItem.tsx', {
	lazy: true,
});

export const SelectedChannelStore = metro.findStore('SelectedChannel', { lazy: true });
export const MessageStore = metro.findStore('Message', { lazy: true });
export const ChannelStore = metro.findStore('Channel', { lazy: true });
export const UserStore = metro.stores.Users;

type SummaryComponent = ComponentType<UserSummaryItemProps>;

/**
 * @description Finds Discord's `UserSummaryItem`, by its file and else by its name.
 * @returns The component, or `undefined` when neither lookup finds it.
 */
export function findUserSummaryItem(): SummaryComponent | undefined {
	const exported = UserSummaryItemModule.default ?? UserSummaryItemModule.module;
	const component =
		typeof exported === 'function' ? exported : metro.findByName('UserSummaryItem');

	return typeof component === 'function' ? (component as SummaryComponent) : undefined;
}
