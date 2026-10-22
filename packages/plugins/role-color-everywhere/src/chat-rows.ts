import { getRoleColorAppearance, type RoleColorStops } from '@shared/role-colors';

export interface Member {
	colorString?: string | null;
	colorStrings?: RoleColorStops | null;
	hoistRoleId?: string | null;
}

export interface MemberStore {
	getMember(guildId: string, userId: string): Member | null | undefined;
}

export interface ChatColorOptions {
	chatMentions: boolean;
	colorChatMessages: boolean;
	messageSaturation: number;
}

export interface ContentNode {
	type?: string;
	userId?: string;
	guildId?: string;
	content?: unknown;
	items?: unknown;
	color?: number;
	roleColor?: number;
	roleColors?: Record<string, number>;
	colorString?: string;
}

export interface ChatMessage {
	authorId?: string;
	content?: unknown;
	embeds?: { description?: unknown }[];
	guildId?: string;
	referencedMessage?: { message?: ChatMessage };
	state?: string;
	textColor?: number;
}

export interface ChatRow {
	message?: ChatMessage;
}

interface MessageColorState {
	base: number;
	applied: number;
	role: number;
	saturation: number;
}

const messageColors = new WeakMap<ChatMessage, MessageColorState>();

type Oklab = [number, number, number];

export function hexToArgb(hex: string): number | null {
	if (!/^#[\da-f]{6}$/i.test(hex)) return null;
	return (0xff000000 | Number.parseInt(hex.slice(1), 16)) >>> 0;
}

function toLinear(channel: number): number {
	const value = channel / 255;
	return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function fromLinear(value: number): number {
	const clamped = Math.min(1, Math.max(0, value));
	const encoded = clamped <= 0.0031308 ? clamped * 12.92 : 1.055 * clamped ** (1 / 2.4) - 0.055;
	return Math.round(encoded * 255);
}

function toOklab(color: number): Oklab {
	const red = toLinear((color >>> 16) & 0xff);
	const green = toLinear((color >>> 8) & 0xff);
	const blue = toLinear(color & 0xff);
	const light = Math.cbrt(0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue);
	const medium = Math.cbrt(0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue);
	const short = Math.cbrt(0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue);
	return [
		0.2104542553 * light + 0.793617785 * medium - 0.0040720468 * short,
		1.9779984951 * light - 2.428592205 * medium + 0.4505937099 * short,
		0.0259040371 * light + 0.7827717662 * medium - 0.808675766 * short,
	];
}

function fromOklab(color: Oklab, alpha: number): number {
	const light = (color[0] + 0.3963377774 * color[1] + 0.2158037573 * color[2]) ** 3;
	const medium = (color[0] - 0.1055613458 * color[1] - 0.0638541728 * color[2]) ** 3;
	const short = (color[0] - 0.0894841775 * color[1] - 1.291485548 * color[2]) ** 3;
	const red = fromLinear(4.0767416621 * light - 3.3077115913 * medium + 0.2309699292 * short);
	const green = fromLinear(-1.2684380046 * light + 2.6097574011 * medium - 0.3413193965 * short);
	const blue = fromLinear(-0.0041960863 * light - 0.7034186147 * medium + 1.707614701 * short);
	return ((alpha & 0xff000000) | (red << 16) | (green << 8) | blue) >>> 0;
}

export function blendArgb(base: number, role: number, saturation: number): number {
	const ratio = Math.min(100, Math.max(0, saturation)) / 100;
	if (ratio === 0) return base >>> 0;
	if (ratio === 1) return ((base & 0xff000000) | (role & 0x00ffffff)) >>> 0;
	const original = toOklab(base);
	const tint = toOklab(role);
	return fromOklab(
		original.map((value, index) => value * (1 - ratio) + tint[index] * ratio) as Oklab,
		base,
	);
}

export function memberColorNumbers(member: Member | null | undefined): number[] {
	if (!member) return [];
	return getRoleColorAppearance(member.colorStrings, member.colorString)
		.colors.map(hexToArgb)
		.filter((value): value is number => value !== null);
}

function applyMentionColors(
	content: unknown,
	members: MemberStore,
	defaultGuildId: string | undefined,
): void {
	if (!Array.isArray(content)) return;
	const pending: unknown[] = [...content];
	const visited = new Set<object>();
	let count = 0;

	while (pending.length > 0 && count < 400) {
		const value = pending.pop();
		if (!value || typeof value !== 'object' || visited.has(value)) continue;
		visited.add(value);
		count++;
		const node = value as ContentNode;
		if (node.type === 'mention' && typeof node.userId === 'string') {
			const guildId = node.guildId ?? defaultGuildId;
			const colors = guildId
				? memberColorNumbers(members.getMember(guildId, node.userId))
				: [];
			if (colors.length > 0) {
				node.roleColor = colors[0];
				node.color = colors[0];
				node.colorString = `#${(colors[0] & 0xffffff).toString(16).padStart(6, '0')}`;
				node.roleColors = {
					primaryColor: colors[0],
					...(colors[1] != null ? { secondaryColor: colors[1] } : {}),
					...(colors[2] != null ? { tertiaryColor: colors[2] } : {}),
				};
			}
		}
		if (Array.isArray(node.content)) pending.push(...node.content);
		if (Array.isArray(node.items)) pending.push(...node.items);
	}
}

function applyMessageColors(
	message: ChatMessage,
	members: MemberStore,
	options: ChatColorOptions,
): void {
	if (typeof message.textColor !== 'number') return;
	const previous = messageColors.get(message);
	const base = previous?.applied === message.textColor ? previous.base : message.textColor;
	const color =
		options.colorChatMessages &&
		options.messageSaturation > 0 &&
		message.guildId &&
		message.authorId &&
		message.state !== 'SEND_FAILED'
			? memberColorNumbers(members.getMember(message.guildId, message.authorId))[0]
			: undefined;
	if (color === undefined) {
		message.textColor = base;
		messageColors.delete(message);
		return;
	}
	if (
		previous?.applied === message.textColor &&
		previous.role === color &&
		previous.saturation === options.messageSaturation
	)
		return;
	const applied = blendArgb(base, color, options.messageSaturation);
	message.textColor = applied;
	messageColors.set(message, {
		base,
		applied,
		role: color,
		saturation: options.messageSaturation,
	});
}

export function applyChatRoleColors(
	row: ChatRow,
	members: MemberStore,
	options: ChatColorOptions,
): void {
	const message = row.message;
	if (!message) return;
	if (options.chatMentions) {
		applyMentionColors(message.content, members, message.guildId);
		for (const embed of message.embeds ?? []) {
			applyMentionColors(embed.description, members, message.guildId);
		}
		const referenced = message.referencedMessage?.message;
		if (referenced) applyMentionColors(referenced.content, members, referenced.guildId);
	}
	applyMessageColors(message, members, options);
}
