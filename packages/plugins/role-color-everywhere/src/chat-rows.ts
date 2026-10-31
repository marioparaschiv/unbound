import { getRoleColorAppearance } from '@unbound-plugins/shared/colors/role-colors';

import type { Member, MemberStore } from '~/types';
import { blendArgb, hexToArgb } from '~/argb';

type Members = Pick<MemberStore, 'getMember'>;

export type ChatColorOptions = {
	chatMentions: boolean;
	roleMentionColors?: boolean;
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
	roleId?: string;
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

type MentionContext = {
	members: Members;
	defaultGuildId: string | undefined;
	asRoleMention: boolean;
	visited: Set<object>;
};

type Tint = {
	base: number;
	applied: number;
	role: number;
	saturation: number;
};

// Discord reuses message objects across row generations, so remember the untinted color to avoid compounding.
const tints = new WeakMap<ChatMessage, Tint>();

function memberRgbColors(member: Member | null | undefined): number[] {
	return memberArgbColors(member).map((color) => color & 0xffffff);
}

function memberArgbColors(member: Member | null | undefined): number[] {
	if (!member) return [];

	return getRoleColorAppearance(member.colorStrings, member.colorString)
		.colors.map(hexToArgb)
		.filter((value) => value !== null);
}

function mentionColors(node: MentionNode, context: MentionContext): MentionNode | undefined {
	const guildId = node.guildId ?? context.defaultGuildId;

	if (node.type !== 'mention' || !node.userId || !guildId) return;

	const member = context.members.getMember(guildId, node.userId);
	const [primary, secondary, tertiary] = memberRgbColors(member);
	const roleId = member?.colorRoleId ?? member?.hoistRoleId;

	if (primary === undefined) return;

	return {
		...(context.asRoleMention && roleId && !node.roleId ? { roleId } : {}),
		roleColor: primary,
		color: primary,
		colorString: `#${primary.toString(16).padStart(6, '0')}`,
		roleColors: {
			primaryColor: primary,
			...(secondary === undefined ? {} : { secondaryColor: secondary }),
			...(tertiary === undefined ? {} : { tertiaryColor: tertiary }),
		},
	};
}

function colorNode(value: unknown, context: MentionContext): unknown {
	if (!value || typeof value !== 'object' || context.visited.has(value)) return value;

	if (context.visited.size >= 400) return value;

	context.visited.add(value);

	const node: MentionNode = value;
	const content = colorNodes(node.content, context);
	const items = colorNodes(node.items, context);
	const colors = mentionColors(node, context);

	if (!colors && content === node.content && items === node.items) return node;

	const copy: MentionNode = { ...node, ...colors };

	if (content !== node.content) {
		copy.content = content;
	}

	if (items !== node.items) {
		copy.items = items;
	}

	return copy;
}

// Discord caches parsed content and builds every row from it, so colored nodes are copies and the cache stays as parsed.
function colorNodes(nodes: unknown, context: MentionContext): unknown {
	if (!Array.isArray(nodes)) return nodes;

	let copy: unknown[] | undefined;

	for (let i = 0, len = nodes.length; i < len; i++) {
		const colored = colorNode(nodes[i], context);

		if (colored === nodes[i]) {
			continue;
		}

		copy ??= [...nodes];
		copy[i] = colored;
	}

	return copy ?? nodes;
}

function colorMentions(
	content: unknown,
	members: Members,
	defaultGuildId: string | undefined,
	asRoleMention: boolean,
): unknown {
	return colorNodes(content, { members, defaultGuildId, asRoleMention, visited: new Set() });
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
 * @description Colors a generated chat row: mentions take the member's role colors and the text can be tinted with the author's.
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
		const asRoleMention = options.roleMentionColors ?? false;

		message.content = colorMentions(message.content, members, message.guildId, asRoleMention);
		message.embeds &&= message.embeds.map((embed) => {
			const description = colorMentions(
				embed.description,
				members,
				message.guildId,
				asRoleMention,
			);

			return description === embed.description ? embed : { ...embed, description };
		});

		const reference = message.referencedMessage;
		const referenced = reference?.message;

		if (referenced) {
			const content = colorMentions(
				referenced.content,
				members,
				referenced.guildId,
				asRoleMention,
			);

			if (content !== referenced.content) {
				message.referencedMessage = { ...reference, message: { ...referenced, content } };
			}
		}
	}

	tintMessage(message, members, options);
}

export default applyChatRoleColors;
