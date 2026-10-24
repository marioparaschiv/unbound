import { getRoleColorAppearance } from '@unbound-plugins/shared/colors/role-colors';

import type { Member, MemberStore } from '~/types';
import { blendArgb, hexToArgb } from '~/argb';

type Members = Pick<MemberStore, 'getMember'>;

export type ChatColorOptions = {
	chatMentions: boolean;
	colorChatMessages: boolean;
	messageSaturation: number;
};

export type MentionNode = {
	type?: string;
	userId?: string;
	guildId?: string;
	content?: unknown;
	items?: unknown;
	color?: number;
	roleColor?: number;
	roleColors?: Record<string, number>;
	colorString?: string;
};

export type ChatMessage = {
	authorId?: string;
	content?: unknown;
	embeds?: { description?: unknown }[];
	guildId?: string;
	referencedMessage?: { message?: ChatMessage };
	state?: string;
	textColor?: number;
};

export type ChatRow = {
	message?: ChatMessage;
};

type Tint = {
	base: number;
	applied: number;
	role: number;
	saturation: number;
};

// Discord reuses message objects across row generations, so remember the untinted color to avoid compounding.
const tints = new WeakMap<ChatMessage, Tint>();

function memberArgbColors(member: Member | null | undefined): number[] {
	if (!member) return [];

	return getRoleColorAppearance(member.colorStrings, member.colorString)
		.colors.map(hexToArgb)
		.filter((value) => value !== null);
}

function colorMentions(content: unknown, members: Members, defaultGuildId?: string): void {
	if (!Array.isArray(content)) return;

	const pending: unknown[] = [...content];
	const visited = new Set<object>();

	while (pending.length && visited.size < 400) {
		const value = pending.pop();

		if (!value || typeof value !== 'object' || visited.has(value)) {
			continue;
		}

		visited.add(value);

		const node: MentionNode = value;
		const guildId = node.guildId ?? defaultGuildId;

		if (node.type === 'mention' && node.userId && guildId) {
			const [primary, secondary, tertiary] = memberArgbColors(
				members.getMember(guildId, node.userId),
			);

			if (primary !== undefined) {
				node.roleColor = primary;
				node.color = primary;
				node.colorString = `#${(primary & 0xffffff).toString(16).padStart(6, '0')}`;
				node.roleColors = {
					primaryColor: primary,
					...(secondary === undefined ? {} : { secondaryColor: secondary }),
					...(tertiary === undefined ? {} : { tertiaryColor: tertiary }),
				};
			}
		}

		if (Array.isArray(node.content)) pending.push(...node.content);

		if (Array.isArray(node.items)) pending.push(...node.items);
	}
}

function roleTextColor(message: ChatMessage, members: Members, options: ChatColorOptions) {
	const { guildId, authorId } = message;

	if (!options.colorChatMessages || options.messageSaturation <= 0) return;

	if (!guildId || !authorId || message.state === 'SEND_FAILED') return;

	return memberArgbColors(members.getMember(guildId, authorId))[0];
}

function tintMessage(message: ChatMessage, members: Members, options: ChatColorOptions): void {
	if (typeof message.textColor !== 'number') return;

	const previous = tints.get(message);
	const unchanged = previous?.applied === message.textColor;
	const base = unchanged ? previous.base : message.textColor;
	const role = roleTextColor(message, members, options);

	if (role === undefined) {
		message.textColor = base;
		tints.delete(message);

		return;
	}

	if (unchanged && previous.role === role && previous.saturation === options.messageSaturation) {
		return;
	}

	const applied = blendArgb(base, role, options.messageSaturation);

	message.textColor = applied;
	tints.set(message, { base, applied, role, saturation: options.messageSaturation });
}

/**
 * @description Colors a generated chat row in place: mentions take the member's role colors and the text can be tinted with the author's.
 * @param row The row Discord's `RowManager` generated.
 * @param members Looks up the guild members whose colors to use.
 * @param options The user's chat settings.
 */
export function applyChatRoleColors(
	row: ChatRow,
	members: Members,
	options: ChatColorOptions,
): void {
	const { message } = row;

	if (!message) return;

	if (options.chatMentions) {
		colorMentions(message.content, members, message.guildId);

		for (const embed of message.embeds ?? []) {
			colorMentions(embed.description, members, message.guildId);
		}

		const referenced = message.referencedMessage?.message;

		if (referenced) colorMentions(referenced.content, members, referenced.guildId);
	}

	tintMessage(message, members, options);
}

export default applyChatRoleColors;
