import {
	getRoleColorAppearance,
	type RoleColorAppearance,
} from '@unbound-plugins/shared/colors/role-colors';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import { cloneElement } from 'react';

import {
	ChannelStore,
	GuildMemberStore,
	Patcher,
	RelationshipStore,
	SelectedChannelStore,
	TypingIndicator,
	TypingStore,
	UserStore,
} from '~/modules';
import RoleColoredRender from '~/components/role-colored-render';
import { presentNames, uniqueNames, type NameOwner } from '~/names';
import { guildIdOf } from '~/channel-guild';
import { PLUGIN_NAME } from '~/constants';
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

/**
 * @description Paints the names in the channel typing indicator with their role colors.
 * @returns A function that removes the patch.
 */
export function patchTypingIndicator(): () => void {
	const feature = `${PLUGIN_NAME}: typing`;
	const modules = { TypingIndicator, TypingStore, UserStore, ChannelStore, SelectedChannelStore };

	if (!ensureModules(feature, modules)) return () => {};

	if (typeof TypingIndicator.default?.type !== 'function') {
		console.error(`[${feature}] Skipped, TypingIndicator is not a memo component.`);

		return () => {};
	}

	// A list rendered while patched keeps calling this `renderItem` after the patch is removed.
	let active = true;

	const unpatch = Patcher.after(TypingIndicator.default, 'type', ({ result }) => {
		const renderItem = result?.props?.renderItem;

		if (typeof renderItem !== 'function') return;

		return cloneElement(result, {
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

export default patchTypingIndicator;
