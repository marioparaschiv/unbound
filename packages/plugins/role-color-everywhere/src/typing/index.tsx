import {
	getRoleColorAppearance,
	type RoleColorAppearance,
} from '@unbound-plugins/shared/colors/role-colors';
import whileEnabled from '@unbound-plugins/shared/settings/while-enabled';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import { settings } from '@unbound-app/settings';
import { patcher } from '@unbound-app/api';
import { cloneElement } from 'react';

import {
	ChannelStore,
	GuildMemberStore,
	RelationshipStore,
	SelectedChannelStore,
	TypingIndicator,
	TypingStore,
	UserStore,
} from '~/typing/modules';
import RoleColoredRender from '~/components/role-colored-render';
import { presentNames, uniqueNames, type NameOwner } from '~/shared/names';
import { guildIdOf } from '~/shared/channel-guild';
import type { Rendered } from '~/types';

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

function patchTypingIndicator(): () => void {
	// A list rendered while patched keeps calling this `renderItem` after the patch is removed.
	let active = true;

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
		active = false;
		unpatch();
	};
}

/**
 * @description Paints the names in the channel typing indicator with their role colors while `typingUsers` is on.
 * Patches the render of `TypingIndicator` (`modules/chat/native/TypingIndicator.tsx`, which Android loads only when someone
 * first types) and reads `TypingStore`, `UserStore`, `GuildMemberStore`, `RelationshipStore` and `SelectedChannelStore`.
 * The returned function removes the patch and plains the lists already drawn, which keep calling the `renderItem` the patch gave them.
 * @returns The function that ends the feature.
 */
export function startTyping(): () => void {
	const modules = {
		GuildMemberStore,
		TypingStore,
		UserStore,
		ChannelStore,
		SelectedChannelStore,
	};

	if (!ensureModules(modules, 'typing')) return () => {};

	return whileEnabled(settings, 'typingUsers', true, patchTypingIndicator);
}
