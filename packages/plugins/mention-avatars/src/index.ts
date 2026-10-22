import { metro, patcher, storage } from '@unbound-app/api';
import type {
	NativeHookToken,
	NativeObjCBridge,
	NativeObjectHandle,
	PluginContext,
} from '@unbound-app/api/native';

export type MentionType = 'role' | 'user';

export type Mention = {
	avatarURL?: string;
	labels: string[];
	roleColor?: number;
	type: MentionType;
};

type MentionToken = {
	id: string;
	type: MentionType;
};

export type ImageCacheEntry = {
	image: unknown | null;
	pending?: Promise<unknown | null>;
	retryAt?: number;
};

type ImageCacheAction = 'cached' | 'pending' | 'retry' | 'load';

type CellRenderDecision = 'idle' | 'render' | 'retry';

type MentionImageMetrics = {
	leading: number;
	size: number;
	trailing: number;
};

type RoleImageSource = {
	avatarURL?: string;
	roleColor?: number;
};

export function extractMentionTokens(content: string): MentionToken[] {
	return [...content.matchAll(/<@!?([0-9]+)>|<@&([0-9]+)>/g)].map((match) => ({
		id: match[1] ?? match[2],
		type: match[1] ? 'user' : 'role',
	}));
}

export function selectMentionLabel(text: string, labels: string[]): string | undefined {
	const atOffset = text.indexOf('@');
	if (atOffset === -1) return undefined;

	const mentionText = text.slice(atOffset);
	return [...labels]
		.sort((left, right) => right.length - left.length)
		.find((label) => {
			const prefix = `@${label}`;
			if (!mentionText.startsWith(prefix)) return false;
			const next = mentionText[prefix.length];
			return !next || next === '\u2068' || next === '\u2069' || /\s/u.test(next);
		});
}

export function mentionImageMetrics(type: MentionType): MentionImageMetrics {
	return {
		size: 16,
		leading: type === 'role' ? 4 : 2,
		trailing: type === 'role' ? 2 : 4,
	};
}

export function imageCacheAction(
	entry: ImageCacheEntry | undefined,
	now: number = Date.now(),
): ImageCacheAction {
	if (entry?.image) return 'cached';
	if (entry?.pending) return 'pending';
	if (entry?.retryAt && entry.retryAt > now) return 'retry';
	return 'load';
}

export function shouldHandleChannelChange(
	previousChannelId: string | undefined,
	nextChannelId: string | undefined,
): boolean {
	return Boolean(nextChannelId) && previousChannelId !== nextChannelId;
}

export function mentionCellLifecycleAction(
	attached: boolean,
	reused: boolean,
): 'preserve' | 'render' | 'reset' {
	if (reused) return 'reset';
	return attached ? 'render' : 'preserve';
}

export function roleImageSource(role: {
	color?: number;
	icon?: string | null;
	id: string;
}): RoleImageSource {
	return {
		avatarURL: role.icon
			? `https://cdn.discordapp.com/role-icons/${role.id}/${role.icon}.png?size=32&quality=lossless`
			: undefined,
		roleColor: typeof role.color === 'number' && role.color > 0 ? role.color : undefined,
	};
}

export function cellRenderDecision(
	messageID: string | undefined,
	messageHydrated: boolean,
	unresolved: boolean,
	mentions: Mention[],
): CellRenderDecision {
	if (!messageID) return 'idle';
	if (!messageHydrated || unresolved) return 'retry';
	return mentions.length > 0 ? 'render' : 'idle';
}

export function containsMentionText(value: string, mentions: Mention[]): boolean {
	return mentions.every((metadata) =>
		metadata.labels.some((label) => {
			const prefix = `@${label}`;
			let searchIndex = 0;
			while (searchIndex < value.length) {
				const index = value.indexOf(prefix, searchIndex);
				if (index === -1) return false;
				const next = value[index + prefix.length];
				if (!next || next === '\u2068' || next === '\u2069' || /\s/u.test(next))
					return true;
				searchIndex = index + 1;
			}
			return false;
		}),
	);
}

const ADDON_ID = 'unbound.mention-avatars';
const STORE = storage.getStore(ADDON_ID);
const MENTION_PLACEHOLDER = '\uFFFC';
const ROLE_IMAGE_NAME = 'person.2.fill';
export const ROLE_SYMBOL_METRICS = { pointSize: 14 } as const;
const MAX_VISIBLE_CELL_SCAN_DEPTH = 40;
const MAX_VISIBLE_CELL_SCAN_NODES = 1_600;

type NativeValue = any;

type User = {
	avatar?: string | null;
	getAvatarURL?: (guildId?: string | null, size?: number, animated?: boolean) => unknown;
	globalName?: string | null;
	id: string;
	username?: string;
};

type HighlightedRange = {
	index: number;
	length: number;
	text: string;
};

type CollectedMentions = {
	complete: boolean;
	mentions: Mention[];
};

type SelectedChannel = {
	addChangeListener?: (listener: () => void) => void;
	getChannelId?: () => string | undefined;
	getLastSelectedChannelId?: () => string | undefined;
	removeChangeListener?: (listener: () => void) => void;
};

type TextViewState = {
	avatarRevision: number;
	expiresAt: number;
	messageID: string;
	original: NativeValue;
	originalString: string;
	rendered: NativeValue;
	signature: string;
};

type CellTextViews = {
	expiresAt: number;
	messageID: string | undefined;
	views: NativeValue[];
};

let unpatch: (() => void) | null = null;
let users: { getUser?: (id: string) => User | undefined } | null = null;
let members: {
	getMember?: (guildId: string, userId: string) => { nick?: string } | undefined;
} | null = null;
let channels: {
	getChannel?: (channelId: string) => { guild_id?: string; guildId?: string } | undefined;
} | null = null;
let selectedChannel: SelectedChannel | null = null;
let roles: {
	getRole?: (
		guildId: string,
		roleId: string,
	) => { color?: number; icon?: string | null; id: string; name?: string } | undefined;
	getSortedRoles?: (guildId: string) => unknown[];
} | null = null;
let objc: NativeObjCBridge | null = null;
let hookTokens: NativeHookToken[] = [];
const activeCells = new Map<string, NativeValue>();
const pendingCells = new Set<string>();
const pendingCellRefs = new Map<string, NativeValue>();
const imageCache = new Map<string, ImageCacheEntry>();
const roleImageCache = new Map<number, NativeValue>();
const messageMentionIndex = new Map<string, Mention[]>();
const unresolvedMessageIDs = new Set<string>();
const textViewStates = new Map<string, TextViewState>();
const cellTextViews = new Map<string, CellTextViews>();
let hydratedMessageKey: string | null = null;
let lifecycleToken = 0;
let channelScanTimeouts: ReturnType<typeof setTimeout>[] = [];
let currentChannelId: string | undefined;
let visibleScanRevision = 0;
let avatarRevision = 0;

function nativeCall(handle: NativeValue, selector: string, ...args: NativeValue[]): NativeValue {
	if (!objc) return null;
	try {
		return objc.invoke(handle, selector, args, { thread: 'main' });
	} catch {
		return null;
	}
}

function pngURL(url: string): string {
	const png = url.replace(/\.webp(?=\?|$)/, '.png');
	if (/[?&]size=\d+/.test(png))
		return png.replace(/([?&]size=)\d+/, (_, prefix: string) => `${prefix}32`);
	return `${png}${png.includes('?') ? '&' : '?'}size=32`;
}

export function userAvatarURL(user: User, guildId?: string): string | undefined {
	const resolved = user.getAvatarURL?.(guildId ?? null, 32, false);
	if (typeof resolved === 'string' && resolved) return pngURL(resolved);
	if (typeof user.avatar === 'string' && user.avatar)
		return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=32`;
	if (typeof resolved === 'number') {
		const asset = metro.common?.ReactNative?.Image?.resolveAssetSource?.(resolved);
		if (typeof asset?.uri === 'string' && asset.uri.startsWith('file:///')) return asset.uri;
	}
	return undefined;
}

export async function loadMentionImageBytes(
	url: string,
	bridge: NativeObjCBridge,
	fetchImage: typeof fetch = fetch,
): Promise<ArrayBuffer | Uint8Array | null> {
	if (url.startsWith('file:///')) {
		const dataClass = bridge.getClass('NSData');
		if (!dataClass) return null;
		const path = decodeURIComponent(url.slice('file://'.length));
		const bytes = await bridge.invokeAsync(dataClass, 'dataWithContentsOfFile:', [path]);
		return bytes instanceof Uint8Array ? bytes : null;
	}
	if (!url.startsWith('https://')) return null;
	const response = await fetchImage(url);
	return response.ok ? response.arrayBuffer() : null;
}

function userMention(userId: string, guildId?: string): Mention | undefined {
	const user = users?.getUser?.(userId);
	if (!user) return;

	const labels = [
		members?.getMember?.(guildId ?? '', userId)?.nick,
		user.globalName,
		user.username,
	].filter((label): label is string => Boolean(label));
	if (labels.length === 0) return;
	return { avatarURL: userAvatarURL(user, guildId), labels: [...new Set(labels)], type: 'user' };
}

function roleMention(roleId: string, guildId?: string): Mention | undefined {
	if (!guildId) return;
	const role =
		roles?.getRole?.(guildId, roleId) ??
		(roles?.getSortedRoles?.(guildId)?.find((candidate: any) => candidate?.id === roleId) as
			| { color?: number; icon?: string | null; id: string; name?: string }
			| undefined);
	if (!role?.name) return;

	const image = roleImageSource(role);
	return {
		avatarURL: image.avatarURL,
		labels: [role.name],
		roleColor: image.roleColor,
		type: 'role',
	};
}

function guildIdForMessage(message: any): string | undefined {
	const directGuildId = message?.guild_id ?? message?.guildId;
	if (directGuildId) return directGuildId;
	const channelId = message?.channel_id ?? message?.channelId;
	const channel = channelId ? channels?.getChannel?.(channelId) : undefined;
	return channel?.guild_id ?? channel?.guildId;
}

function collectMentions(message: any): CollectedMentions {
	const mentions: Mention[] = [];
	let complete = true;
	const guildId = guildIdForMessage(message);
	const content = message?.content;
	if (typeof content !== 'string') return { complete, mentions };

	for (const token of extractMentionTokens(content)) {
		const mention =
			token.type === 'user' ? userMention(token.id, guildId) : roleMention(token.id, guildId);
		if (mention) mentions.push(mention);
		else complete = false;
	}

	return { complete, mentions };
}

function addMentions(message: any): boolean {
	const id = message?.id;
	if (typeof id !== 'string') return false;
	const { complete, mentions } = collectMentions(message);
	if (!complete) {
		unresolvedMessageIDs.add(id);
		if (JSON.stringify(messageMentionIndex.get(id)) === JSON.stringify(mentions)) return false;
		messageMentionIndex.set(id, mentions);
		return true;
	}
	unresolvedMessageIDs.delete(id);
	if (JSON.stringify(messageMentionIndex.get(id)) === JSON.stringify(mentions)) return false;
	messageMentionIndex.set(id, mentions);
	return true;
}

function hydrateMentions(): void {
	const channelId = metro.findByProps('getChannelId')?.getChannelId?.();
	const messages = metro.findStore('Message')?.getMessages?.(channelId)?._array;
	if (!Array.isArray(messages)) return;
	const messageKey = `${channelId}:${messages.length}:${messages[messages.length - 1]?.id ?? ''}`;
	if (messageKey === hydratedMessageKey && unresolvedMessageIDs.size === 0) return;
	hydratedMessageKey = messageKey;
	for (const message of messages) addMentions(message);
}

function hydrateMessage(messageID: string | undefined): boolean {
	if (!messageID) return false;
	const channelId = metro.findByProps('getChannelId')?.getChannelId?.();
	const message = metro.findStore('Message')?.getMessage?.(channelId, messageID);
	if (!message) return false;
	addMentions(message);
	return true;
}

function asNumber(value: NativeValue): number {
	if (typeof value === 'bigint') return Number(value);
	return typeof value === 'number' ? value : Number(value) || 0;
}

function roleColor(value: number | undefined): NativeValue | null {
	if (!objc || value === undefined || value <= 0) return null;
	const colorClass = objc.getClass('UIColor');
	if (!colorClass) return null;
	return nativeCall(
		colorClass,
		'colorWithRed:green:blue:alpha:',
		((value >> 16) & 0xff) / 255,
		((value >> 8) & 0xff) / 255,
		(value & 0xff) / 255,
		1,
	);
}

export function tintRoleSymbol(image: NativeValue, tint: NativeValue): NativeValue {
	if (!objc || !tint) return image;
	if (objc.respondsTo(image, 'imageWithTintColor:renderingMode:')) {
		return nativeCall(image, 'imageWithTintColor:renderingMode:', tint, 1) ?? image;
	}
	if (objc.respondsTo(image, 'imageWithTintColor:')) {
		return nativeCall(image, 'imageWithTintColor:', tint) ?? image;
	}
	return image;
}

function rasterizeRoleSymbol(image: NativeValue, tint: NativeValue): NativeValue {
	if (!objc || !tint) return image;
	const imageClass = objc.getClass('UIImage');
	const ciImageClass = objc.getClass('CIImage');
	const ciColorClass = objc.getClass('CIColor');
	const filterClass = objc.getClass('CIFilter');
	const contextClass = objc.getClass('CIContext');
	if (!imageClass || !ciImageClass || !ciColorClass || !filterClass || !contextClass)
		return image;

	const sourceCGImage = nativeCall(image, 'CGImage');
	const tintCGColor = nativeCall(tint, 'CGColor');
	if (!sourceCGImage || !tintCGColor) return image;
	const source = nativeCall(ciImageClass, 'imageWithCGImage:', sourceCGImage);
	const color = nativeCall(ciColorClass, 'colorWithCGColor:', tintCGColor);
	const filter = nativeCall(filterClass, 'filterWithName:', 'CIFalseColor');
	if (!source || !color || !filter) return image;
	nativeCall(filter, 'setValue:forKey:', source, 'inputImage');
	nativeCall(filter, 'setValue:forKey:', color, 'inputColor0');
	nativeCall(filter, 'setValue:forKey:', color, 'inputColor1');
	const output = nativeCall(filter, 'outputImage');
	if (!output) return image;
	const imageSize = nativeCall(image, 'size')?.value;
	const outputExtent = nativeCall(output, 'extent')?.value;
	const scale = asNumber(nativeCall(image, 'scale'));
	const dimensions = [
		imageSize?.width,
		imageSize?.height,
		outputExtent?.size?.width,
		outputExtent?.size?.height,
		scale,
	];
	const sizedOutput = dimensions.every((value) => Number.isFinite(value) && value > 0)
		? (nativeCall(
				output,
				'imageByApplyingTransform:',
				objc.struct('CGAffineTransform', {
					a: (imageSize.width * scale) / outputExtent.size.width,
					b: 0,
					c: 0,
					d: (imageSize.height * scale) / outputExtent.size.height,
					tx: 0,
					ty: 0,
				}),
			) ?? output)
		: output;
	const extent = nativeCall(sizedOutput, 'extent');
	const context = nativeCall(contextClass, 'contextWithOptions:', null);
	const bitmap =
		extent && context
			? nativeCall(context, 'createCGImage:fromRect:', sizedOutput, extent)
			: null;
	if (!bitmap) return image;
	return (
		nativeCall(
			imageClass,
			'imageWithCGImage:scale:orientation:',
			bitmap,
			scale || 1,
			nativeCall(image, 'imageOrientation') ?? 0,
		) ?? image
	);
}

function roleImage(metadata: Mention): NativeValue | null {
	if (!objc) return null;
	const cached = metadata.roleColor ? roleImageCache.get(metadata.roleColor) : null;
	if (cached) return cached;
	const imageClass = objc.getClass('UIImage');
	const configurationClass = objc.getClass('UIImageSymbolConfiguration');
	const configuration = configurationClass
		? nativeCall(
				configurationClass,
				'configurationWithPointSize:weight:scale:',
				ROLE_SYMBOL_METRICS.pointSize,
				0,
				1,
			)
		: null;
	const image = imageClass
		? configuration && objc.respondsTo(imageClass, 'systemImageNamed:withConfiguration:')
			? nativeCall(
					imageClass,
					'systemImageNamed:withConfiguration:',
					ROLE_IMAGE_NAME,
					configuration,
				)
			: nativeCall(imageClass, 'systemImageNamed:', ROLE_IMAGE_NAME)
		: null;
	if (!image) return null;
	const colorClass = objc.getClass('UIColor');
	const tint = metadata.roleColor
		? roleColor(metadata.roleColor)
		: colorClass
			? nativeCall(colorClass, 'labelColor')
			: null;
	const result = rasterizeRoleSymbol(tintRoleSymbol(image, tint), tint);
	if (metadata.roleColor && result !== image) {
		if (roleImageCache.size >= 64) roleImageCache.delete(roleImageCache.keys().next().value!);
		roleImageCache.set(metadata.roleColor, result);
	}
	return result;
}

function roundedImage(image: NativeValue): NativeValue | null {
	if (!objc || !image) return image;
	const imageClass = objc.getClass('UIImage');
	const ciImageClass = objc.getClass('CIImage');
	const contextClass = objc.getClass('CIContext');
	const filterClass = objc.getClass('CIFilter');
	const colorClass = objc.getClass('CIColor');
	const vectorClass = objc.getClass('CIVector');
	if (
		!imageClass ||
		!ciImageClass ||
		!contextClass ||
		!filterClass ||
		!colorClass ||
		!vectorClass
	)
		return image;
	const sourceCGImage = nativeCall(image, 'CGImage');
	if (!sourceCGImage) return image;
	const source = nativeCall(ciImageClass, 'imageWithCGImage:', sourceCGImage);
	const mask = nativeCall(filterClass, 'filterWithName:', 'CIRadialGradient');
	if (!source || !mask) return image;
	const white = nativeCall(colorClass, 'colorWithRed:green:blue:alpha:', 1, 1, 1, 1);
	const clear = nativeCall(colorClass, 'colorWithRed:green:blue:alpha:', 0, 0, 0, 0);
	const center = nativeCall(vectorClass, 'vectorWithX:Y:', 16, 16);
	if (!white || !clear || !center) return image;
	nativeCall(mask, 'setValue:forKey:', center, 'inputCenter');
	nativeCall(mask, 'setValue:forKey:', 15.5, 'inputRadius0');
	nativeCall(mask, 'setValue:forKey:', 16, 'inputRadius1');
	nativeCall(mask, 'setValue:forKey:', white, 'inputColor0');
	nativeCall(mask, 'setValue:forKey:', clear, 'inputColor1');
	const maskImage = nativeCall(mask, 'outputImage');
	const blend = nativeCall(filterClass, 'filterWithName:', 'CIBlendWithMask');
	if (!maskImage || !blend) return image;
	nativeCall(blend, 'setValue:forKey:', source, 'inputImage');
	nativeCall(blend, 'setValue:forKey:', maskImage, 'inputMaskImage');
	const output = nativeCall(blend, 'outputImage');
	if (!output) return image;
	const rect = objc.struct('CGRect', {
		origin: { x: 0, y: 0 },
		size: { width: 32, height: 32 },
	});
	const context = nativeCall(contextClass, 'contextWithOptions:', null);
	const cgImage = context && nativeCall(context, 'createCGImage:fromRect:', output, rect);
	if (!cgImage) return image;
	return (
		nativeCall(
			imageClass,
			'imageWithCGImage:scale:orientation:',
			cgImage,
			2,
			nativeCall(image, 'imageOrientation') ?? 0,
		) ?? image
	);
}

function messageIDForCell(cell: NativeValue): string | undefined {
	if (!objc) return;
	const viewModel = objc.getIvar(cell, 'viewModel');
	if (!viewModel || !objc.respondsTo(viewModel, 'message')) return;
	const message = nativeCall(viewModel, 'message');
	if (!message || !objc.respondsTo(message, 'id')) return;
	const id = nativeCall(message, 'id');
	if (typeof id === 'string') return id;
	if (id && objc.respondsTo(id, 'description')) return String(nativeCall(id, 'description'));
}

function cellKey(cell: NativeValue): string | undefined {
	if (!objc) return;
	const className = objc.className(cell) ?? '';
	if (objc.respondsTo(cell, 'hash')) {
		let hash: NativeValue;
		try {
			hash = objc.call(cell, 'hash');
		} catch {
			hash = null;
		}
		if (hash !== null && hash !== undefined) return `${className}:${String(hash)}`;
	}
	if (!objc.respondsTo(cell, 'description')) return;
	const description = nativeCall(cell, 'description');
	return typeof description === 'string' ? `${className}:${description}` : undefined;
}

function range(location: number, length: number): NativeValue {
	return objc?.struct('NSRange', { location, length });
}

function attributes(original: NativeValue, index: number): NativeValue {
	return objc ? nativeCall(original, 'attributesAtIndex:effectiveRange:', index, null) : null;
}

function attributedStringText(value: NativeValue): string | undefined {
	if (!objc || !value) return;
	const string = nativeCall(value, 'string');
	return typeof string === 'string' ? string : undefined;
}

function nextMentionRange(
	value: NativeValue,
	string: string,
	start: number,
	labels: string[],
): HighlightedRange | null {
	let mentionIndex = string.indexOf('@', start);
	while (mentionIndex !== -1) {
		const matchedLabel = selectMentionLabel(string.slice(mentionIndex), labels);
		if (!matchedLabel || !attributes(value, mentionIndex)?.YYTextHighlight) {
			mentionIndex = string.indexOf('@', mentionIndex + 1);
			continue;
		}
		const mentionEnd = mentionIndex + matchedLabel.length + 1;
		let highlighted = true;
		for (let index = mentionIndex + 1; index < mentionEnd; index++) {
			if (attributes(value, index)?.YYTextHighlight) continue;
			highlighted = false;
			break;
		}
		if (!highlighted) {
			mentionIndex = string.indexOf('@', mentionIndex + 1);
			continue;
		}
		let begin = mentionIndex;
		while (
			begin > start &&
			string[begin - 1] === MENTION_PLACEHOLDER &&
			attributes(value, begin - 1)?.YYTextHighlight
		)
			begin--;
		return {
			index: begin,
			length: mentionEnd - begin,
			text: string.slice(begin, mentionEnd),
		};
	}
	return null;
}

function imageForMention(metadata: Mention): NativeValue | null {
	if (!objc) return null;
	if (!metadata.avatarURL) {
		if (metadata.type !== 'role') return null;
		return roleImage(metadata);
	}

	const cached = imageCache.get(metadata.avatarURL);
	const action = imageCacheAction(cached);
	if (action === 'cached') return cached?.image ?? null;
	if (action === 'pending' || action === 'retry') return null;
	if (action === 'load') {
		const token = lifecycleToken;
		const pending = loadMentionImageBytes(metadata.avatarURL, objc)
			.then((bytes) => {
				if (!bytes || !objc) return null;
				const data = objc.data(bytes);
				const imageClass = objc.getClass('UIImage');
				const image = imageClass ? nativeCall(imageClass, 'imageWithData:', data) : null;
				return image ? (metadata.type === 'user' ? roundedImage(image) : image) : null;
			})
			.catch(() => null);
		imageCache.set(metadata.avatarURL, { image: null, pending });
		pending.then((image) => {
			if (token !== lifecycleToken || !objc) return;
			imageCache.set(
				metadata.avatarURL!,
				image ? { image } : { image: null, retryAt: Date.now() + 5000 },
			);
			avatarRevision++;
			for (const cell of activeCells.values()) scheduleCellRender(cell);
		});
	}
	return null;
}

function imageAttachment(
	image: NativeValue,
	metadata: Mention,
	attributes: NativeValue,
): NativeValue | null {
	if (!objc) return null;
	const attachmentClass = objc.getClass('YYTextAttachment');
	if (!attachmentClass) return null;
	const attachment = objc.alloc(attachmentClass);
	const { leading, size, trailing } = mentionImageMetrics(metadata.type);
	const insets = objc.struct('UIEdgeInsets', {
		top: 0,
		left: leading,
		bottom: 0,
		right: trailing,
	});
	nativeCall(attachment, 'setValue:forKey:', image, 'content');
	nativeCall(attachment, 'setValue:forKey:', 1, 'contentMode');
	nativeCall(attachment, 'setValue:forKey:', insets, 'contentInsets');

	const result = objc.alloc('NSMutableAttributedString');
	nativeCall(result, 'initWithString:attributes:', MENTION_PLACEHOLDER, attributes);
	nativeCall(result, 'addAttribute:value:range:', 'YYTextAttachment', attachment, range(0, 1));
	const runDelegateClass = objc.getClass('YYTextRunDelegate');
	const font = attributes?.NSFont;
	if (runDelegateClass && font) {
		const runDelegate = objc.alloc(runDelegateClass);
		const ascent = asNumber(nativeCall(font, 'ascender'));
		const descent = asNumber(nativeCall(font, 'descender'));
		nativeCall(runDelegate, 'setValue:forKey:', ascent, 'ascent');
		nativeCall(runDelegate, 'setValue:forKey:', -descent, 'descent');
		nativeCall(runDelegate, 'setValue:forKey:', leading + size + trailing, 'width');
		if (objc.respondsTo(runDelegate, 'CTRunDelegate')) {
			const coreTextRunDelegate = nativeCall(runDelegate, 'CTRunDelegate');
			if (coreTextRunDelegate) {
				nativeCall(
					result,
					'addAttribute:value:range:',
					'CTRunDelegate',
					coreTextRunDelegate,
					range(0, 1),
				);
			}
		}
	}
	return result;
}

function attributedMention(
	text: string,
	metadata: Mention,
	attributes: NativeValue,
	image: NativeValue,
): NativeValue {
	if (!objc) return null;
	const mentionClass = objc.alloc('NSAttributedString');
	nativeCall(mentionClass, 'initWithString:attributes:', text, attributes);
	const avatar = imageAttachment(image, metadata, attributes);
	if (!avatar) return mentionClass;
	const replacement = objc.alloc('NSMutableAttributedString');
	nativeCall(replacement, 'init');
	if (metadata.type === 'role') {
		nativeCall(replacement, 'appendAttributedString:', mentionClass);
		nativeCall(replacement, 'appendAttributedString:', avatar);
	} else {
		nativeCall(replacement, 'appendAttributedString:', avatar);
		nativeCall(replacement, 'appendAttributedString:', mentionClass);
	}
	return replacement;
}

function mentionAvatarText(original: NativeValue, mentions: Mention[]): NativeValue {
	if (!objc || mentions.length === 0) return original;
	const result = nativeCall(original, 'mutableCopy');
	if (!result) return original;
	let searchIndex = 0;
	for (const metadata of mentions) {
		const string = nativeCall(result, 'string');
		if (typeof string !== 'string' || searchIndex >= string.length) break;
		const highlighted = nextMentionRange(result, string, searchIndex, metadata.labels);
		if (!highlighted) break;
		const atOffset = highlighted.text.indexOf('@');
		if (atOffset === -1) continue;
		const matchedLabel = selectMentionLabel(highlighted.text, metadata.labels);
		const fallbackText = highlighted.text.slice(atOffset);
		const boundary = fallbackText.search(/[\u2068\u2069]/u);
		const mentionText = matchedLabel
			? `@${matchedLabel}`
			: boundary === -1
				? fallbackText
				: fallbackText.slice(0, boundary);
		const mentionIndex = highlighted.index + atOffset;
		const values = attributes(result, mentionIndex);
		if (!values?.YYTextHighlight) {
			searchIndex = mentionIndex + mentionText.length;
			continue;
		}
		const image = imageForMention(metadata);
		if (!image) {
			searchIndex = mentionIndex + mentionText.length;
			continue;
		}
		const label = matchedLabel ?? metadata.labels[0] ?? mentionText.slice(1);
		const text = STORE.get('showAtSymbol', true) ? `@${label}` : label;
		let replacementIndex = mentionIndex;
		let replacementLength = mentionText.length;
		while (
			replacementIndex > highlighted.index &&
			string[replacementIndex - 1] === MENTION_PLACEHOLDER &&
			attributes(result, replacementIndex - 1)?.YYTextAttachment
		) {
			replacementIndex--;
			replacementLength++;
		}
		let replacementEnd = mentionIndex + mentionText.length;
		while (
			string[replacementEnd] === MENTION_PLACEHOLDER &&
			attributes(result, replacementEnd)?.YYTextAttachment
		) {
			replacementEnd++;
			replacementLength++;
		}
		const replacement = attributedMention(text, metadata, values, image);
		nativeCall(
			result as NativeObjectHandle,
			'replaceCharactersInRange:withAttributedString:',
			range(replacementIndex, replacementLength),
			replacement,
		);
		searchIndex = replacementIndex + asNumber(nativeCall(replacement, 'length'));
	}

	return result;
}

function textViewsInView(root: NativeValue): NativeValue[] {
	if (!objc) return [];
	const views: NativeValue[] = [];
	const pending: [NativeValue, number][] = [[root, 0]];
	let visited = 0;
	while (pending.length > 0 && visited < MAX_VISIBLE_CELL_SCAN_NODES) {
		const [view, depth] = pending.pop()!;
		visited++;
		if (objc.respondsTo(view, 'setAttributedText:') && objc.respondsTo(view, 'attributedText'))
			views.push(view);
		if (
			depth >= MAX_VISIBLE_CELL_SCAN_DEPTH ||
			!objc.respondsTo(view, 'subviews') ||
			objc.className(view) === 'DCDReactionListView'
		)
			continue;
		const children = nativeCall(view, 'subviews');
		if (!Array.isArray(children)) continue;
		const remaining = MAX_VISIBLE_CELL_SCAN_NODES - visited - pending.length;
		for (let index = Math.min(children.length, remaining) - 1; index >= 0; index--)
			pending.push([children[index], depth + 1]);
	}
	return views;
}

function textViewsForCell(
	cell: NativeValue,
	key: string | undefined,
	messageID: string | undefined,
): NativeValue[] {
	if (!key) return textViewsInView(cell);
	const cached = cellTextViews.get(key);
	if (
		cached &&
		cached.messageID === messageID &&
		cached.expiresAt > Date.now() &&
		cached.views.every((view) => Boolean(nativeCall(view, 'window')))
	)
		return cached.views;
	const views = textViewsInView(cell);
	cellTextViews.set(key, {
		expiresAt: Date.now() + (views.length > 0 ? 1_000 : 50),
		messageID,
		views,
	});
	return views;
}

function viewKey(view: NativeValue): string | undefined {
	return cellKey(view);
}

function restoreTextView(view: NativeValue): void {
	if (!objc) return;
	const key = viewKey(view);
	if (!key) return;
	const state = textViewStates.get(key);
	if (!state) return;
	const current = nativeCall(view, 'attributedText');
	const currentString = attributedStringText(current);
	if (currentString?.includes(MENTION_PLACEHOLDER))
		nativeCall(view, 'setAttributedText:', state.original);
	textViewStates.delete(key);
}

function updateTextView(
	view: NativeValue,
	messageID: string | undefined,
	mentions: Mention[],
): boolean {
	if (!objc || !messageID) {
		restoreTextView(view);
		return false;
	}
	const key = viewKey(view);
	if (!key) return false;
	const current = nativeCall(view, 'attributedText');
	const currentString = attributedStringText(current);
	if (!current || !currentString) return false;
	const storedState = textViewStates.get(key);
	if (storedState?.messageID && storedState.messageID !== messageID) {
		textViewStates.delete(key);
	}
	if (mentions.length === 0) {
		restoreTextView(view);
		return false;
	}
	const currentState = textViewStates.get(key);
	if (
		!currentString.includes('@') &&
		(!currentState || !currentString.includes(MENTION_PLACEHOLDER))
	) {
		textViewStates.delete(key);
		return false;
	}
	const signature = JSON.stringify(mentions);
	if (
		currentState?.messageID === messageID &&
		currentState.signature === signature &&
		currentState.avatarRevision === avatarRevision &&
		currentState.expiresAt > Date.now() &&
		nativeCall(current, 'isEqual:', currentState.rendered)
	)
		return false;
	let original = currentState?.original;
	let originalString = currentState?.originalString;
	if (
		currentState &&
		!currentString.includes(MENTION_PLACEHOLDER) &&
		(currentString !== currentState.originalString ||
			!containsMentionText(currentState.originalString, mentions)) &&
		containsMentionText(currentString, mentions)
	) {
		original = current;
		originalString = currentString;
	}
	if (!original) {
		original = current;
		originalString = currentString;
	}
	const updated = mentionAvatarText(original, mentions);
	if (!updated) return false;
	textViewStates.set(key, {
		avatarRevision,
		expiresAt: Date.now() + 5_000,
		messageID,
		original,
		originalString: originalString ?? currentString,
		rendered: updated,
		signature,
	});
	if (current && nativeCall(updated, 'isEqual:', current)) return false;
	nativeCall(view, 'setAttributedText:', updated);
	return true;
}

function clearCell(cell: NativeValue): void {
	for (const view of textViewsInView(cell)) restoreTextView(view);
	resetCell(cell);
}

function resetCell(cell: NativeValue): void {
	for (const view of textViewsInView(cell)) {
		const key = viewKey(view);
		if (key) textViewStates.delete(key);
	}
	const key = cellKey(cell);
	if (key) {
		activeCells.delete(key);
		cellTextViews.delete(key);
		pendingCells.delete(key);
		pendingCellRefs.delete(key);
	}
}

function renderCell(cell: NativeValue): boolean {
	if (!objc) return false;
	hydrateMentions();
	const key = cellKey(cell);
	const id = messageIDForCell(cell);
	const messageHydrated = hydrateMessage(id);
	const mentions = id ? (messageMentionIndex.get(id) ?? []) : [];
	const decision = cellRenderDecision(
		id,
		messageHydrated,
		unresolvedMessageIDs.has(id),
		mentions,
	);
	if (mentions.length === 0 && (!key || !cellTextViews.has(key))) {
		if (key) activeCells.delete(key);
		return decision === 'retry';
	}
	if (key) activeCells.set(key, cell);
	const views = textViewsForCell(cell, key, id);
	let changed = false;
	for (const view of views) {
		const viewChanged = updateTextView(view, id, mentions);
		changed ||= viewChanged;
	}
	if (changed) nativeCall(cell, 'setNeedsLayout');
	if (mentions.length === 0 && key) {
		cellTextViews.delete(key);
		activeCells.delete(key);
	}
	return decision === 'retry';
}

function scheduleCellRender(cell: NativeValue, attempt: number = 0): void {
	if (!objc) return;
	const key = cellKey(cell);
	if (!key || pendingCells.has(key)) return;
	const bridge = objc;
	const token = lifecycleToken;
	pendingCells.add(key);
	pendingCellRefs.set(key, cell);
	setTimeout(() => {
		pendingCells.delete(key);
		const retainedCell = pendingCellRefs.get(key);
		pendingCellRefs.delete(key);
		if (token !== lifecycleToken || objc !== bridge) return;
		if (!retainedCell) return;
		const retry = renderCell(retainedCell);
		if (retry && attempt < 12) {
			setTimeout(() => scheduleCellRender(retainedCell, attempt + 1), 100);
		}
	}, 0);
}

async function scanVisibleMessageCells(): Promise<void> {
	if (!objc) return;
	const bridge = objc;
	const applicationClass = bridge.getClass('UIApplication');
	if (!applicationClass) return;
	const token = lifecycleToken;
	const revision = ++visibleScanRevision;
	const channelId = currentChannelId;
	try {
		const values = await bridge.batch([
			{ target: applicationClass, selector: 'sharedApplication', args: [] },
			{ target: { $nativeBatchResult: 0 }, selector: 'windows', args: [] },
		]);
		if (
			token !== lifecycleToken ||
			revision !== visibleScanRevision ||
			channelId !== currentChannelId
		)
			return;
		const windows = Array.isArray(values[1]) ? values[1] : bridge.array(values[1]);
		for (const window of windows) {
			const cells = await bridge.findViews(window, 'DCDMessageTableViewCell', {
				maxDepth: MAX_VISIBLE_CELL_SCAN_DEPTH,
				maxVisited: MAX_VISIBLE_CELL_SCAN_NODES,
				maxResults: 256,
				attachedOnly: true,
				stopAtMatch: true,
			});
			if (
				token !== lifecycleToken ||
				revision !== visibleScanRevision ||
				channelId !== currentChannelId
			)
				return;
			for (const cell of cells) scheduleCellRender(cell);
		}
	} catch {
		return;
	}
}

function scheduleVisibleCellScans(): void {
	for (const timeout of channelScanTimeouts) clearTimeout(timeout);
	channelScanTimeouts = [];
	const token = lifecycleToken;
	for (const delay of [0, 100, 500, 1_500, 3_000]) {
		const timeout = setTimeout(() => {
			channelScanTimeouts = channelScanTimeouts.filter((candidate) => candidate !== timeout);
			if (token !== lifecycleToken || !objc) return;
			void scanVisibleMessageCells();
		}, delay);
		channelScanTimeouts.push(timeout);
	}
}

function onSelectedChannelChange(): void {
	const nextChannelId =
		selectedChannel?.getChannelId?.() ?? selectedChannel?.getLastSelectedChannelId?.();
	if (!shouldHandleChannelChange(currentChannelId, nextChannelId)) return;
	currentChannelId = nextChannelId;
	visibleScanRevision++;
	for (const cell of [...activeCells.values()]) clearCell(cell);
	activeCells.clear();
	pendingCells.clear();
	pendingCellRefs.clear();
	textViewStates.clear();
	cellTextViews.clear();
	messageMentionIndex.clear();
	unresolvedMessageIDs.clear();
	hydratedMessageKey = null;
	scheduleVisibleCellScans();
}

function installNativeHooks(): void {
	if (!objc) return;
	const lifecycle = objc.hook('DCDMessageTableViewCell', 'didMoveToWindow', {
		after: ({ self }) => {
			const bridge = objc;
			const token = lifecycleToken;
			if (!bridge) return;
			void bridge
				.invokeAsync(self, 'window', [])
				.then((window) => {
					if (token !== lifecycleToken || objc !== bridge) return;
					const action = mentionCellLifecycleAction(Boolean(window), false);
					if (action === 'render') scheduleCellRender(self);
				})
				.catch(() => undefined);
		},
	});
	const layout = objc.hook('DCDMessageTableViewCell', 'layoutSubviews', {
		after: ({ self }) => scheduleCellRender(self),
	});
	const reuse = objc.hook('DCDMessageTableViewCell', 'prepareForReuse', {
		after: ({ self }) => {
			const action = mentionCellLifecycleAction(false, true);
			if (action === 'reset') resetCell(self);
			scheduleCellRender(self);
		},
	});
	hookTokens = [lifecycle, layout, reuse];
}

function start(context?: PluginContext): void {
	lifecycleToken++;
	objc = context?.native.objc ?? null;
	if (!objc) return;
	users = metro.findByProps('getCurrentUser', 'getUser');
	members = metro.findStore('GuildMember');
	channels = metro.findByProps('getChannel');
	selectedChannel = metro.findByProps('getChannelId', 'getLastSelectedChannelId');
	currentChannelId =
		selectedChannel?.getChannelId?.() ?? selectedChannel?.getLastSelectedChannelId?.();
	roles = metro.find(
		(module) =>
			typeof module?.getRole === 'function' && typeof module?.getSortedRoles === 'function',
	);

	const target = metro.findByProps('generateMessageRowData');
	if (typeof target?.generateMessageRowData !== 'function') return;
	unpatch = patcher.after(target, 'generateMessageRowData', (ctx) => {
		addMentions(ctx.args[0]?.message);
	});
	selectedChannel?.addChangeListener?.(onSelectedChannelChange);
	hydrateMentions();
	installNativeHooks();
	scheduleVisibleCellScans();
}

function stop(): void {
	lifecycleToken++;
	visibleScanRevision++;
	unpatch?.();
	unpatch = null;
	for (const token of hookTokens) token.remove();
	hookTokens = [];
	selectedChannel?.removeChangeListener?.(onSelectedChannelChange);
	selectedChannel = null;
	currentChannelId = undefined;
	for (const timeout of channelScanTimeouts) clearTimeout(timeout);
	channelScanTimeouts = [];
	for (const cell of activeCells.values()) clearCell(cell);
	activeCells.clear();
	pendingCellRefs.clear();
	textViewStates.clear();
	cellTextViews.clear();
	users = null;
	members = null;
	channels = null;
	roles = null;
	objc = null;
	pendingCells.clear();
	imageCache.clear();
	roleImageCache.clear();
	messageMentionIndex.clear();
	unresolvedMessageIDs.clear();
	hydratedMessageKey = null;
	avatarRevision = 0;
}

export default { start, stop };
