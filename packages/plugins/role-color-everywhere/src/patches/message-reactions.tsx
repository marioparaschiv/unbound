import { getRoleColorAppearance } from '@unbound-plugins/shared/colors/role-colors';
import whileEnabled from '@unbound-plugins/shared/settings/while-enabled';
import { metro, patcher } from '@unbound-app/api';
import { cloneElement } from 'react';

import RoleColoredRender from '~/components/role-colored-render';
import { guildIdOf } from '~/lib/channel-guild';
import { GuildMemberStore } from '~/lib/modules';
import { presentNames } from '~/lib/names';
import type { Rendered } from '~/lib/types';

// A list rendered while patched keeps calling the patched `renderItem` after the patch is removed.
let active = false;

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

function colorReactors(): () => void {
	const MessageReactionsContent = metro.findByFilePath(
		'modules/reactions/native/MessageReactionsContent.tsx',
	);

	if (!MessageReactionsContent) {
		logger.warn('Reactions skipped: Discord moved MessageReactionsContent.');

		return () => {};
	}

	active = true;

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
		plainMessageReactions();
		unpatch();
	};
}

/**
 * @description Paints the names in a message's reaction details list with their role colors while `reactorsList` is on.
 * Patches the render of `MessageReactionsContent` (`modules/reactions/native/MessageReactionsContent.tsx`) and reads
 * `GuildMemberStore` and `ChannelStore`.
 */
export function patchMessageReactions(): void {
	whileEnabled('reactorsList', colorReactors);
}

/**
 * @description Draws plain names in the reaction lists already on screen. Call it after `patcher.unpatchAll()`.
 */
export function plainMessageReactions(): void {
	active = false;
}
