import { paintRoleTextTree } from '@role-color-everywhere/role-text';
import type { MemberStore } from '@role-color-everywhere/chat-rows';
import { getRoleColorAppearance, type RoleColorAppearance } from '@shared/role-colors';
import { metro, patcher } from '@unbound-app/api';
import type { ReactElement } from 'react';

const REACTIONS_PATH = 'modules/reactions/native/MessageReactionsContent.tsx';

interface ReactionContentProps {
	channelId?: string;
}

interface ReactionLabelProps {
	user?: { id?: string; globalName?: string | null; username?: string };
	nick?: string | null;
}

interface ColoredReactionLabelProps {
	label: ReactElement<ReactionLabelProps>;
	appearance: RoleColorAppearance;
}

function ColoredReactionLabel({ label, appearance }: ColoredReactionLabelProps) {
	if (typeof label.type !== 'function') return label;
	const names = [
		label.props.nick,
		label.props.user?.globalName,
		label.props.user?.username,
	].filter((name): name is string => typeof name === 'string' && name.length > 0);
	const appearances = new Map(names.map((name) => [name, appearance]));
	const render = label.type as (props: ReactionLabelProps) => unknown;
	const result = render(label.props);
	return paintRoleTextTree(result, appearances, {
		React: metro.common.React,
		Text: metro.common.ReactNative.Text,
	});
}

export function installReactionUserColors(
	members: MemberStore,
	enabled: () => boolean,
): () => void {
	const module = metro.findByFilePath(REACTIONS_PATH, { interop: false }) as {
		MessageReactionsContent?: (props: ReactionContentProps) => unknown;
	} | null;
	const channels = metro.findStore('Channel') as {
		getChannel(channelId: string): { guild_id?: string } | null;
	} | null;
	if (typeof module?.MessageReactionsContent !== 'function' || !channels) return () => {};
	const content = module as { MessageReactionsContent: (props: ReactionContentProps) => unknown };

	return patcher.after(content, 'MessageReactionsContent', ({ args, result }) => {
		if (!enabled()) return;
		const channelId = (args[0] as ReactionContentProps | undefined)?.channelId;
		const guildId = channelId ? channels.getChannel(channelId)?.guild_id : undefined;
		if (!guildId) return;
		const list = (result as any)?.props?.children;
		const renderItem = list?.props?.renderItem;
		if (typeof renderItem !== 'function') return;
		const { React } = metro.common;
		return React.cloneElement(result as ReactElement<any>, {
			children: React.cloneElement(list, {
				renderItem: (section: number, index: number) => {
					const row = renderItem(section, index);
					const children = row?.props?.children;
					if (!Array.isArray(children)) return row;
					const item = children[0];
					const label = item?.props?.label as
						| ReactElement<ReactionLabelProps>
						| undefined;
					const userId = label?.props?.user?.id;
					if (!userId) return row;
					const member = members.getMember(guildId, userId);
					const appearance = getRoleColorAppearance(
						member?.colorStrings,
						member?.colorString,
					);
					if (!appearance.colors.length) return row;
					const coloredLabel = React.createElement(ColoredReactionLabel, {
						label,
						appearance,
					});
					return React.cloneElement(row, {
						children: [
							React.cloneElement(item, { label: coloredLabel }),
							...children.slice(1),
						],
					});
				},
			}),
		});
	});
}
