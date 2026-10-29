import { getRoleColorAppearance } from '@unbound-plugins/shared/colors/role-colors';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import { whenLoaded } from '@unbound-plugins/shared/metro/when-loaded';
import type { DiscordFunction } from '@unbound-app/api/metro';
import { cloneElement } from 'react';

import { ChannelStore, GuildMemberStore, MESSAGE_REACTIONS_CONTENT_PATH, Patcher } from '~/modules';
import RoleColoredRender from '~/components/role-colored-render';
import { guildIdOf } from '~/channel-guild';
import { PLUGIN_NAME } from '~/constants';
import { presentNames } from '~/names';
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

type MessageReactionsContentModule = {
	MessageReactionsContent: DiscordFunction;
};

function patchLoadedMessageReactionsContent(
	MessageReactionsContent: MessageReactionsContentModule,
) {
	const feature = `${PLUGIN_NAME}: reactions`;

	if (!ensureModules(feature, { ChannelStore })) return;

	if (typeof MessageReactionsContent.MessageReactionsContent !== 'function') {
		console.error(`[${feature}] Skipped, MessageReactionsContent is not a function.`);

		return;
	}

	return Patcher.after(
		MessageReactionsContent,
		'MessageReactionsContent',
		({ args: [props], result }) => {
			const guildId = guildIdOf(props?.channelId);
			const list = result?.props?.children;
			const renderItem = list?.props?.renderItem;

			if (!guildId || typeof renderItem !== 'function') return;

			return cloneElement(result, {
				children: cloneElement(list, {
					renderItem: (section: number, index: number) =>
						colorReactionRow(renderItem(section, index), guildId),
				}),
			});
		},
	);
}

/**
 * @description Paints the names in a message's reaction details list with their role colors, once the list's module loads.
 * @returns A function that stops waiting or removes the patch.
 */
export function patchMessageReactionsContent(): () => void {
	return whenLoaded(MESSAGE_REACTIONS_CONTENT_PATH, patchLoadedMessageReactionsContent);
}

export default patchMessageReactionsContent;
