import {
	getRoleColorAppearance,
	type RoleColorAppearance,
} from '@unbound-plugins/shared/colors/role-colors';
import whileEnabled from '@unbound-plugins/shared/settings/while-enabled';
import { metro, patcher } from '@unbound-app/api';
import { cloneElement } from 'react';

import {
	GuildMemberStore,
	RelationshipStore,
	SelectedChannelStore,
	TypingStore,
	UserStore,
} from '~/lib/modules';
import RoleColoredRender from '~/components/role-colored-render';
import { presentNames, uniqueNames, type NameOwner } from '~/lib/names';
import { guildIdOf } from '~/lib/channel-guild';
import type { Rendered } from '~/lib/types';

// A list rendered while patched keeps calling the patched `renderItem` after the patch is removed.
let active = false;

function typingAppearances(): Map<string, RoleColorAppearance> {
	const channelId = SelectedChannelStore.getChannelId();
	const guildId = guildIdOf(channelId);

	if (!channelId || !guildId) return new Map();

	const owners: NameOwner<RoleColorAppearance>[] = [];

	for (const userId of Object.keys(TypingStore.getTypingUsers(channelId) ?? {}).slice(0, 8)) {
		const member = GuildMemberStore.getMember(guildId, userId);
		const appearance = getRoleColorAppearance(member?.colorStrings, member?.colorString);

		if (!appearance.colors.length) {
			continue;
		}

		const user = UserStore.getUser(userId);
		const names = presentNames(
			member?.nick,
			// The relationship store is optional: without it friend nicknames are not matched.
			RelationshipStore.getNickname?.(userId),
			user?.globalName,
			user?.username,
		);

		owners.push([names, appearance]);
	}

	return uniqueNames(owners);
}

function colorTypingNames(): () => void {
	const TypingIndicator = metro.findByFilePath('modules/chat/native/TypingIndicator.tsx');

	if (!TypingIndicator) {
		logger.warn('Typing names skipped: Discord moved TypingIndicator.');

		return () => {};
	}

	active = true;

	const unpatch = patcher.react.after(TypingIndicator, 'default', ({ result }) => {
		const rendered: Rendered = result;
		const renderItem = rendered?.props?.renderItem;

		if (typeof renderItem !== 'function') return;

		return cloneElement(rendered, {
			renderItem: (...args: unknown[]) => {
				const item: Rendered = renderItem(...args);

				if (typeof item?.type !== 'function') return item;

				return (
					<RoleColoredRender
						key={item.key}
						render={item.type}
						props={item.props}
						appearances={active ? typingAppearances() : new Map()}
					/>
				);
			},
		});
	});

	return () => {
		plainTypingIndicator();
		unpatch();
	};
}

/**
 * @description Paints the names in the channel typing indicator with their role colors while `typingUsers` is on.
 * Patches the render of `TypingIndicator` (`modules/chat/native/TypingIndicator.tsx`, which Android loads only when someone
 * first types) and reads `TypingStore`, `UserStore`, `GuildMemberStore`, `RelationshipStore` and `SelectedChannelStore`.
 */
export function patchTypingIndicator(): void {
	whileEnabled('typingUsers', colorTypingNames);
}

/**
 * @description Draws plain names in the typing lists already on screen, which keep calling the `renderItem` the patch gave them.
 * Call it after `patcher.unpatchAll()`.
 */
export function plainTypingIndicator(): void {
	active = false;
}
