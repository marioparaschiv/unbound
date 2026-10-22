import { paintRoleTextTree } from '@role-color-everywhere/role-text';
import { getRoleColorAppearance, type RoleColorAppearance } from '@shared/role-colors';
import { metro, patcher } from '@unbound-app/api';

const TYPING_INDICATOR_PATH = 'modules/chat/native/TypingIndicator.tsx';

interface Member {
	nick?: string | null;
	colorString?: string | null;
	colorStrings?: { primaryColor: string; secondaryColor?: string; tertiaryColor?: string } | null;
}

interface MemberStore {
	getMember(guildId: string, userId: string): Member | null | undefined;
}

interface TypingItemProps {
	original: (props: unknown) => any;
	properties: unknown;
	appearances: Map<string, RoleColorAppearance>;
}

function TypingNameRenderer({ original, properties, appearances }: TypingItemProps) {
	const result = original(properties);
	return paintRoleTextTree(result, appearances, {
		React: metro.common.React,
		Text: metro.common.ReactNative.Text,
	});
}

export function installTypingNameColors(members: MemberStore, enabled: () => boolean): () => void {
	const module = metro.findByFilePath(TYPING_INDICATOR_PATH, { interop: false }) as {
		default?: { type?: (props: unknown) => unknown };
	} | null;
	const typing = metro.findStore('Typing') as {
		getTypingUsers(channelId: string): Record<string, number>;
	} | null;
	const users = metro.findStore('User') as {
		getUser(userId: string): { globalName?: string | null; username?: string } | null;
	} | null;
	const channels = metro.findStore('Channel') as {
		getChannel(channelId: string): { guild_id?: string } | null;
	} | null;
	const relationships = metro.findStore('Relationship') as {
		getNickname(userId: string): string | null;
	} | null;
	const selected = metro.findByProps('getChannelId', 'getLastSelectedChannelId') as {
		getChannelId(): string | undefined;
	} | null;
	if (typeof module?.default?.type !== 'function' || !typing || !users || !channels || !selected)
		return () => {};

	let stopped = false;

	function appearancesForTypingUsers(): Map<string, RoleColorAppearance> {
		const appearances = new Map<string, RoleColorAppearance>();
		if (stopped || !enabled()) return appearances;
		const channelId = selected!.getChannelId();
		const guildId = channelId ? channels!.getChannel(channelId)?.guild_id : undefined;
		if (!guildId || !channelId) return appearances;
		const ambiguous = new Set<string>();
		for (const userId of Object.keys(typing!.getTypingUsers(channelId) ?? {}).slice(0, 8)) {
			const member = members.getMember(guildId, userId);
			const appearance = getRoleColorAppearance(member?.colorStrings, member?.colorString);
			if (!appearance.colors.length) continue;
			const user = users!.getUser(userId);
			const names = new Set(
				[
					member?.nick,
					relationships?.getNickname(userId),
					user?.globalName,
					user?.username,
				].filter((value): value is string => typeof value === 'string' && value.length > 0),
			);
			for (const name of names) {
				if (ambiguous.has(name)) continue;
				if (appearances.has(name)) {
					appearances.delete(name);
					ambiguous.add(name);
				} else appearances.set(name, appearance);
			}
		}
		return appearances;
	}

	const holder = module.default as { type: (props: unknown) => unknown };
	const unpatch = patcher.after(holder, 'type', ({ result }) => {
		const renderItem = (result as any)?.props?.renderItem;
		if (typeof renderItem !== 'function') return;
		const React = metro.common.React;
		return React.cloneElement(result as any, {
			renderItem: (...args: unknown[]) => {
				const item = renderItem(...args);
				if (typeof item?.type !== 'function') return item;
				return React.createElement(TypingNameRenderer, {
					appearances: appearancesForTypingUsers(),
					key: item.key,
					original: item.type,
					properties: item.props,
				});
			},
		});
	});

	return () => {
		stopped = true;
		unpatch();
	};
}
