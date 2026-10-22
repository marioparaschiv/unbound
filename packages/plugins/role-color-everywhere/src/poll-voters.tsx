import { paintRoleTextTree } from '@role-color-everywhere/role-text';
import type { MemberStore } from '@role-color-everywhere/chat-rows';
import { getRoleColorAppearance } from '@shared/role-colors';
import { metro, patcher } from '@unbound-app/api';
import type { ReactElement } from 'react';

const POLL_VOTES_PATH = 'modules/polls/native/PollVotesActionSheet.tsx';

interface VotersListProps {
	channelId: string;
}

interface VoterItem {
	id?: string;
}

interface RenderItemArgs {
	item?: VoterItem;
	index?: number;
}

interface ColoredVotersListProps {
	original: (props: VotersListProps) => any;
	properties: VotersListProps;
	guildId: string;
	members: MemberStore;
}

function ColoredVotersList({ original, properties, guildId, members }: ColoredVotersListProps) {
	const result = original(properties);
	const list = result?.props?.children;
	const renderItem = list?.props?.renderItem;
	if (typeof renderItem !== 'function') return result;
	const { React, ReactNative } = metro.common;
	return React.cloneElement(result, {
		children: React.cloneElement(list, {
			renderItem: (args: RenderItemArgs) => {
				const row = renderItem(args);
				const userId = args?.item?.id;
				const label = row?.props?.label;
				if (!userId || typeof label !== 'string') return row;
				const member = members.getMember(guildId, userId);
				const appearance = getRoleColorAppearance(
					member?.colorStrings,
					member?.colorString,
				);
				if (!appearance.colors.length) return row;
				const text = React.createElement(ReactNative.Text, null, label);
				const colored = paintRoleTextTree(text, new Map([[label, appearance]]), {
					React,
					Text: ReactNative.Text,
				});
				return React.cloneElement(row, { label: colored });
			},
		}),
	});
}

export function installPollVoterColors(members: MemberStore, enabled: () => boolean): () => void {
	const module = metro.findByFilePath(POLL_VOTES_PATH, { interop: false }) as {
		default?: (props: unknown) => unknown;
	} | null;
	const channels = metro.findStore('Channel') as {
		getChannel(channelId: string): { guild_id?: string } | null;
	} | null;
	if (typeof module?.default !== 'function' || !channels) return () => {};
	const sheetModule = module as { default: (props: unknown) => unknown };

	return patcher.after(sheetModule, 'default', ({ args, result }) => {
		if (!enabled()) return;
		const channelId = (args[0] as VotersListProps | undefined)?.channelId;
		const guildId = channelId ? channels.getChannel(channelId)?.guild_id : undefined;
		if (!guildId) return;
		const sheet = (result as any)?.props?.children;
		const children = sheet?.props?.children;
		if (!Array.isArray(children)) return;
		const voters = children.find(
			(child) => typeof child?.type === 'function' && child.type.name === 'VotersList',
		);
		if (!voters) return;
		const { React } = metro.common;
		const colored = React.createElement(ColoredVotersList, {
			original: voters.type,
			properties: voters.props,
			guildId,
			members,
		});
		return React.cloneElement(result as ReactElement<any>, {
			children: React.cloneElement(sheet, {
				children: children.map((child) => (child === voters ? colored : child)),
			}),
		});
	});
}
