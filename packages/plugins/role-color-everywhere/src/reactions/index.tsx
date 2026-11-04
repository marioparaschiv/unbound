import { getRoleColorAppearance } from '@unbound-plugins/shared/colors/role-colors';
import whileEnabled from '@unbound-plugins/shared/settings/while-enabled';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import { settings } from '@unbound-app/settings';
import { patcher } from '@unbound-app/api';
import { cloneElement } from 'react';

import { ChannelStore, GuildMemberStore, MessageReactionsContent } from '~/reactions/modules';
import RoleColoredRender from '~/components/role-colored-render';
import { guildIdOf } from '~/shared/channel-guild';
import { PLUGIN_NAME } from '~/constants';
import { presentNames } from '~/shared/names';
import type { Rendered } from '~/types';

function colorReactionRow(row: Rendered, guildId: string): Rendered {
	const children = row?.props?.children;

	if (!Array.isArray(children)) return row;

	const [item, ...rest] = children;
	const label = item?.props?.label;
	const user = label?.props?.user;

	if (!user?.id || typeof label.type !== 'function') return row;

	const member = GuildMemberStore.getMember(guildId, user.id);
	const appearance = getRoleColorAppearance(member?.colorStrings, member?.colorString);

	if (!appearance.colors.length) return row;

	const names = presentNames(label.props.nick, user.globalName, user.username);
	const colored = (
		<RoleColoredRender
			render={label.type}
			props={label.props}
			appearances={new Map(names.map((name) => [name, appearance]))}
		/>
	);

	return cloneElement(row, { children: [cloneElement(item, { label: colored }), ...rest] });
}

function patchMessageReactionsContent(): () => void {
	// A list rendered while patched keeps calling this `renderItem` after the patch is removed.
	let active = true;

	const unpatch = patcher.react.after(
		MessageReactionsContent,
		'MessageReactionsContent',
		({ props, result: rendered }) => {
			const result: Rendered = rendered;
			const guildId = guildIdOf((props as { channelId?: string } | undefined)?.channelId);
			const list = result?.props?.children;
			const renderItem = list?.props?.renderItem;

			if (!guildId || typeof renderItem !== 'function') return;

			return cloneElement(result, {
				children: cloneElement(list, {
					renderItem: (section: number, index: number) =>
						active
							? colorReactionRow(renderItem(section, index), guildId)
							: renderItem(section, index),
				}),
			});
		},
	);

	return () => {
		active = false;
		unpatch();
	};
}

/**
 * @description Paints the names in a message's reaction details list with their role colors while `reactorsList` is on.
 * Patches the render of `MessageReactionsContent` (`modules/reactions/native/MessageReactionsContent.tsx`) and reads
 * `GuildMemberStore` and `ChannelStore`. The returned function removes the patch and plains the lists already drawn.
 * @returns The function that ends the feature.
 */
export function startReactions(): () => void {
	if (!ensureModules(`${PLUGIN_NAME}: reactions`, { GuildMemberStore, ChannelStore })) {
		return () => {};
	}

	return whileEnabled(settings, 'reactorsList', true, patchMessageReactionsContent);
}
