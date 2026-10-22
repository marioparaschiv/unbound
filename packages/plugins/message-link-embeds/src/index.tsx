import {
	enableAnimatedEmojiSources,
	installEmbeddedAnimationSupport,
} from '@message-link-embeds/animated-media';
import {
	contentText,
	findRenderedLinkRange,
	type LinkTarget,
	linkedTargets,
	nativeUsernameColor,
} from '@message-link-embeds/link-targets';
import { reactionSnapshot, stripMessageReactions } from '@message-link-embeds/reaction-state';
import { isMessageStoreCandidate } from '@shared/message-store-candidate';
import { readNativeMessageInfo, type NativeMessageInfo } from '@shared/native-message-info';
import {
	BottomAnchorTracker,
	availableMessageWidthFromNative,
	layoutMetricsFromNative,
	readSurfaceAnchor,
	SurfaceHeightCache,
	type SurfaceLayoutMetrics,
	shouldRefreshSurfaceRow,
	surfaceHeightCacheKey,
} from '@message-link-embeds/surface-layout';
import { metro } from '@unbound-app/api';
import type {
	NativeFabricBridge,
	NativeFabricSurface,
	NativeHookToken,
	NativeObjCBridge,
	NativeObjectHandle,
	PluginContext,
} from '@unbound-app/api/native';
import type { ReactNode } from 'react';

const CHAT_ITEM_PATH = 'components_native/chat/ChatItem.tsx';
const SURFACE_MODULE_PREFIX = 'MessageLinkEmbedSurface';
const MIN_SURFACE_HEIGHT = 72;
const INITIAL_SURFACE_HEIGHT = MIN_SURFACE_HEIGHT;
const MAX_SURFACE_HEIGHT = 520;
const SURFACE_LAYOUT_SETTLE_DELAY = 80;
const SURFACE_BOTTOM_TRIM = 5;
const SURFACE_SPACER_FONT_SIZE = 8;
const EMBED_BACKGROUND = '#2b2d31';
const MAX_NATIVE_VIEW_DEPTH = 10;

type AnyRecord = Record<string, unknown>;
type NativeInvoker = (handle: NativeObjectHandle, selector: string, ...args: unknown[]) => unknown;
type NativeLabelText = { attributedText: NativeObjectHandle; text: string };
type MetroModule = {
	isInitialized?: boolean;
	publicModule?: { exports?: unknown };
};
type Message = AnyRecord & {
	author?: AnyRecord;
	channel_id?: string;
	channelId?: string;
	content?: unknown;
	guild_id?: string;
	guildId?: string;
	id?: string;
	timestamp?: Date | string;
};
type MessageStore = {
	addChangeListener?: (listener: () => void) => void;
	getMessage?: (channelId: string, messageId: string) => Message | null;
	getMessages?: (channelId: string) => { _array?: Message[] } | null;
	getLastMessage?: (channelId: string) => Message | null;
	removeChangeListener?: (listener: () => void) => void;
};
type MessageActions = {
	fetchMessage?: (target: LinkTarget) => Promise<Message | null>;
};
type ChannelStore = {
	getChannel?: (channelId: string) => AnyRecord | undefined;
};
type SelectedChannel = {
	getChannelId?: () => string | undefined;
	getLastSelectedChannelId?: () => string | undefined;
};
type MessageRecordConstructor = (...args: never[]) => unknown;
type RowInput = {
	message: Message;
	rowType: number;
	changeType?: number;
	isFirst?: boolean;
	canAddNewReactions?: boolean;
	canShowImages?: boolean;
	renderContentOnly?: boolean;
};
type RowGenerator = {
	generate: (input: RowInput) => AnyRecord | undefined;
	setOptions?: (options: AnyRecord) => void;
};
type RowManagerConstructor = (...args: never[]) => unknown;
type ChatItemProps = {
	message: Message;
	renderRevision: number;
	rowGenerator: RowGenerator;
};
type ChatItemComponent = (props: ChatItemProps) => ReactNode;
type EmbeddedContent = {
	generator: RowGenerator;
	record: Message;
};
type EmbeddedSurfaceState = {
	cell: NativeObjectHandle;
	cellKey: string;
	table: NativeObjectHandle | null;
	channelName: string;
	baseGenerator: RowGenerator;
	font: NativeObjectHandle | null;
	generator: RowGenerator;
	host: NativeObjectHandle;
	label: NativeObjectHandle;
	labelHook: NativeHookToken | null;
	messageId: string;
	sourceReactionSnapshot: string;
	original: NativeObjectHandle;
	range: { location: number; length: number };
	record: Message;
	rendered: NativeObjectHandle | null;
	renderedText: string | null;
	selectedTarget: LinkTarget;
	surface: NativeFabricSurface | null;
	surfaceId: string;
	width: number;
	height: number;
	heightCacheKey: string;
	lastInvalidatedHeight: number;
	applying: boolean;
	layoutTimer: ReturnType<typeof setTimeout> | null;
	reactionLayoutTimer: ReturnType<typeof setTimeout> | null;
	bottomScrollTimer: ReturnType<typeof setTimeout> | null;
	bottomScrollPending: boolean;
	rowRefreshGeneration: number;
	pendingHeight: number | null;
	renderRevision: number;
	bottomAnchor: BottomAnchorTracker;
};
type SurfaceProps = {
	surfaceId: string;
	renderRevision: number;
};
type CellUpdateStatus = 'done' | 'retry' | 'waiting';

let objc: NativeObjCBridge | null = null;
let fabric: NativeFabricBridge | null = null;
let messages: MessageStore | null = null;
let messageActions: MessageActions | null = null;
let channelStore: ChannelStore | null = null;
let selectedChannel: SelectedChannel | null = null;
let messageRecord: MessageRecordConstructor | null = null;
let rowManager: RowManagerConstructor | null = null;
let chatItem: ChatItemComponent | null = null;
let embeddedAnimationSupport: ReturnType<typeof installEmbeddedAnimationSupport> | null = null;
let moduleListenerCleanup: (() => boolean) | null = null;
let messageStoreListener: (() => void) | null = null;
let messageSyncTimer: ReturnType<typeof setTimeout> | null = null;
let messageWindowScanTimer: ReturnType<typeof setTimeout> | null = null;
let messageWindowSignature = '';
let initialScanTimers: ReturnType<typeof setTimeout>[] = [];
let hooks: NativeHookToken[] = [];
let lifecycle = 0;
let surfaceModuleName = '';

const cachedMessages = new Map<string, Message>();
const pendingMessages = new Set<string>();
const activeCells = new Map<string, NativeObjectHandle>();
const visibleCellIds = new Map<string, string>();
const pendingCells = new Set<string>();
const cellLookupVersions = new Map<string, number>();
const completedCells = new Set<string>();
const retryCounts = new Map<string, number>();
const retryTimers = new Map<string, ReturnType<typeof setTimeout>>();
const waitingCells = new Map<string, string>();
const cellStates = new Map<string, EmbeddedSurfaceState>();
const surfaces = new Map<string, EmbeddedSurfaceState>();
const reconcilingSurfaces = new WeakSet<EmbeddedSurfaceState>();
const queuedSurfaceReconciliations = new WeakSet<EmbeddedSurfaceState>();
const surfaceHeights = new SurfaceHeightCache();
const cellLabelHooks = new Map<string, NativeHookToken[]>();
let nextCellLookupVersion = 0;

function nativeCall(handle: NativeObjectHandle, selector: string, ...args: unknown[]): unknown {
	if (!objc) return null;
	try {
		return objc.invoke(handle, selector, args, { thread: 'main' });
	} catch {
		return null;
	}
}

function syncMessageReactions(): void {
	messageSyncTimer = null;
	if (!messages || !fabric) return;

	for (const state of cellStates.values()) {
		const source = messages.getMessage?.(state.selectedTarget.channelId, state.messageId);
		const sourceReactionSnapshot = source
			? reactionSnapshot(source.reactions)
			: state.sourceReactionSnapshot;
		const sourceChanged = sourceReactionSnapshot !== state.sourceReactionSnapshot;
		if (!sourceChanged) {
			void reconcileSurfaceText(state);
			continue;
		}
		const table = state.table;
		if (table) captureSurfaceBottomAnchor(state, table);
		void reconcileSurfaceText(state);
		if (cellStates.get(state.cellKey) !== state) continue;

		state.sourceReactionSnapshot = sourceReactionSnapshot;
		scheduleReactionScrollCorrection(state, SURFACE_LAYOUT_SETTLE_DELAY);
	}
}

async function reconcileSurfaceText(state: EmbeddedSurfaceState): Promise<void> {
	if (!messages || !objc) return;
	if (reconcilingSurfaces.has(state)) {
		queuedSurfaceReconciliations.add(state);
		return;
	}
	const bridge = objc;
	const token = lifecycle;
	reconcilingSurfaces.add(state);
	try {
		const labelText = await readLabelTextAsync(state.label, bridge);
		if (token !== lifecycle || bridge !== objc || cellStates.get(state.cellKey) !== state)
			return;
		if (!labelText || labelText.text === state.renderedText) return;
		const range = findRenderedLinkRange(labelText.text, state.channelName);
		if (range) updateExistingSurface(state, labelText.attributedText, range);
	} catch {
		return;
	} finally {
		reconcilingSurfaces.delete(state);
		if (queuedSurfaceReconciliations.delete(state)) void reconcileSurfaceText(state);
	}
}

function scheduleMessageSync(): void {
	if (messageSyncTimer) return;
	const token = lifecycle;
	messageSyncTimer = setTimeout(() => {
		messageSyncTimer = null;
		if (token === lifecycle) syncMessageReactions();
	}, 0);
}

function handleMessageStoreChange(): void {
	if (messages) {
		for (const state of cellStates.values()) {
			const source = messages.getMessage?.(state.selectedTarget.channelId, state.messageId);
			const sourceChanged =
				source && reactionSnapshot(source.reactions) !== state.sourceReactionSnapshot;
			if (!sourceChanged) continue;
			const table = state.table;
			if (table) captureSurfaceBottomAnchor(state, table);
		}
	}
	scheduleMessageSync();
	scheduleMessageWindowScan();
}

function scheduleMessageWindowScan(): void {
	const channelId = currentChannelId();
	const window = channelId ? messages?.getMessages?.(channelId)?._array : undefined;
	if (!channelId || !window) return;
	const signature = `${channelId}:${window.length}:${window[0]?.id}:${window[window.length - 1]?.id}`;
	if (signature === messageWindowSignature) return;
	messageWindowSignature = signature;
	if (messageWindowScanTimer) clearTimeout(messageWindowScanTimer);
	const token = lifecycle;
	messageWindowScanTimer = setTimeout(() => {
		messageWindowScanTimer = null;
		if (token === lifecycle) void scanVisibleMessageCells();
	}, 150);
}

function installMessageStoreListener(): void {
	if (messageStoreListener || !messages?.addChangeListener) return;
	messageStoreListener = handleMessageStoreChange;
	messages.addChangeListener(messageStoreListener);
}

function removeMessageStoreListener(): void {
	if (messageStoreListener) messages?.removeChangeListener?.(messageStoreListener);
	messageStoreListener = null;
	if (messageSyncTimer) clearTimeout(messageSyncTimer);
	messageSyncTimer = null;
}

function nativeRange(location: number, length: number): unknown {
	return objc?.struct('NSRange', { location, length }) ?? null;
}

function messageKey(channelId: string, messageId: string): string {
	return `${channelId}:${messageId}`;
}

function currentChannelId(): string | undefined {
	return selectedChannel?.getChannelId?.() ?? selectedChannel?.getLastSelectedChannelId?.();
}

function stringFromNative(value: unknown): string | undefined {
	if (typeof value === 'string') return value;
	if (!objc || !value || typeof value !== 'object') return;
	const handle = value as NativeObjectHandle;
	if (!objc.respondsTo(handle, 'description')) return;
	const description = nativeCall(handle, 'description');
	return typeof description === 'string' ? description : undefined;
}

function cellKey(cell: NativeObjectHandle): string | undefined {
	let hash: unknown;
	try {
		hash = objc?.call(cell, 'hash');
	} catch {
		hash = null;
	}
	if (hash !== null && hash !== undefined) return String(hash);
	const description = nativeCall(cell, 'description');
	return typeof description === 'string' ? description : undefined;
}

async function scanVisibleMessageCells(): Promise<void> {
	if (!objc || hooks.length === 0) return;
	const bridge = objc;
	const token = lifecycle;
	const application = bridge.getClass('UIApplication');
	if (!application) return;
	try {
		const values = await bridge.batch([
			{ target: application, selector: 'sharedApplication', args: [] },
			{ target: { $nativeBatchResult: 0 }, selector: 'windows', args: [] },
			{ target: { $nativeBatchResult: 0 }, selector: 'keyWindow', args: [] },
		]);
		if (token !== lifecycle || bridge !== objc || hooks.length === 0) return;
		const keyWindow = values[2] as NativeObjectHandle | null;
		const windows = keyWindow
			? [keyWindow]
			: Array.isArray(values[1])
				? values[1]
				: bridge.array(values[1]);
		for (const window of windows) {
			const cells = await bridge.findViews(window, 'DCDMessageTableViewCell', {
				maxDepth: 40,
				maxVisited: 800,
				maxResults: 256,
				attachedOnly: true,
				stopAtMatch: true,
			});
			if (token !== lifecycle || bridge !== objc || hooks.length === 0) return;
			for (const cell of cells) {
				const key = cellKey(cell);
				const info = await readNativeMessageInfo(cell, bridge);
				if (token !== lifecycle || bridge !== objc || hooks.length === 0) return;
				if (!key || !info) continue;
				const previousId = visibleCellIds.get(key) ?? cellStates.get(key)?.messageId;
				if (previousId && previousId !== info.messageId) clearCell(key);
				else if (!previousId) completedCells.delete(key);
				visibleCellIds.set(key, info.messageId);
				scheduleCell(cell);
			}
		}
	} catch {
		return;
	}
}

function channelNameFor(target: LinkTarget, targetMessage: Message): string | undefined {
	const channel = channelStore?.getChannel?.(target.channelId);
	const fromStore = channel?.name;
	if (typeof fromStore === 'string' && fromStore.length > 0) return fromStore;
	const fromMessage = targetMessage.channelName ?? targetMessage.channel_name;
	return typeof fromMessage === 'string' && fromMessage.length > 0 ? fromMessage : undefined;
}

function linkFont(
	attributedText: NativeObjectHandle,
	range: { location: number; length: number },
	invoke: NativeInvoker = nativeCall,
): NativeObjectHandle | null {
	if (!objc) return null;
	const text = stringFromNative(invoke(attributedText, 'string')) ?? '';
	const end = range.location + range.length;
	for (let index = range.location; index < end; index++) {
		if (text[index] !== '\uFFFC') continue;
		const values = invoke(attributedText, 'attributesAtIndex:effectiveRange:', index, null);
		if (!values || typeof values !== 'object') continue;
		const attributes = values as AnyRecord;
		if (!attributes.YYTextAttachment) continue;
		return (attributes.NSFont as NativeObjectHandle | undefined) ?? null;
	}
	return null;
}

function messagePayload(message: Message): Message {
	for (const key of ['message', 'message_snapshot', 'messageSnapshot']) {
		const nested = message[key] as Message | undefined;
		if (nested && typeof nested.id === 'string' && nested.id !== message.id) return nested;
	}
	for (const key of ['message_snapshots', 'messageSnapshots']) {
		const snapshots = message[key];
		if (!Array.isArray(snapshots)) continue;
		for (const snapshot of snapshots) {
			if (snapshot && typeof snapshot.id === 'string' && snapshot.id !== message.id) {
				return snapshot as Message;
			}
		}
	}
	return message;
}

function buildRecord(target: Message, channelId: string): Message {
	if (!messageRecord) throw new Error('MessageRecord is unavailable');
	const payload = messagePayload(target);
	const timestamp =
		payload.timestamp instanceof Date
			? payload.timestamp
			: new Date(payload.timestamp ?? Date.now());
	return Reflect.construct(messageRecord, [
		{
			...payload,
			id: payload.id,
			type: 0,
			channel_id: channelId,
			channelId,
			guild_id: payload.guild_id ?? payload.guildId ?? null,
			guildId: payload.guildId ?? payload.guild_id ?? null,
			content: contentText(payload.content),
			author: payload.author,
			attachments: payload.attachments ?? [],
			embeds: payload.embeds ?? [],
			mentions: payload.mentions ?? [],
			mention_roles: payload.mention_roles ?? [],
			mentionRoles: payload.mentionRoles ?? payload.mention_roles ?? [],
			timestamp,
			edited_timestamp: payload.edited_timestamp ?? null,
			editedTimestamp: payload.editedTimestamp ?? payload.edited_timestamp ?? null,
			pinned: Boolean(payload.pinned),
			mention_everyone: Boolean(payload.mention_everyone),
			mentionEveryone: Boolean(payload.mentionEveryone ?? payload.mention_everyone),
			tts: Boolean(payload.tts),
			flags: payload.flags ?? 0,
			components: payload.components ?? [],
			reactions: payload.reactions ?? [],
			sticker_items: payload.sticker_items ?? payload.stickerItems ?? [],
			stickers: payload.stickers ?? payload.sticker_items ?? [],
			message_reference: payload.message_reference ?? payload.messageReference ?? null,
			messageReference: payload.messageReference ?? payload.message_reference ?? null,
			message_snapshots: payload.message_snapshots ?? payload.messageSnapshots ?? [],
			messageSnapshots: payload.messageSnapshots ?? payload.message_snapshots ?? [],
			state: payload.state ?? 'SENT',
			nonce: payload.nonce ?? null,
		},
	]) as Message;
}

function buildSurfaceRecord(target: Message, channelId: string): Message {
	const record = buildRecord(target, channelId);
	stripMessageReactions(record);
	record.animateEmoji = true;
	const usernameColor = nativeUsernameColor(record.colorString);
	if (usernameColor !== undefined) record.usernameColor = usernameColor;
	return record;
}

function buildEmbeddedContent(target: Message, channelId: string): EmbeddedContent | undefined {
	if (!messageRecord || !rowManager) return;
	try {
		const record = buildSurfaceRecord(target, channelId);
		const usernameColor = nativeUsernameColor(record.colorString);
		const generator = Reflect.construct(rowManager, []) as RowGenerator;
		generator.setOptions?.({
			animateEmoji: true,
			animatingStickerMessageId: record.id,
			gifAutoPlay: true,
		});
		const generate = generator.generate.bind(generator);
		generator.generate = (input) => {
			const row = generate(input);
			const renderedMessage = row?.message as AnyRecord | undefined;
			if (renderedMessage) {
				renderedMessage.type = 0;
				renderedMessage.renderContentOnly = false;
				renderedMessage.animateEmoji = true;
				renderedMessage.gifAutoPlay = true;
				enableAnimatedEmojiSources(renderedMessage.content);
				if (usernameColor !== undefined) {
					renderedMessage.colorString = usernameColor;
					renderedMessage.usernameColor = usernameColor;
				}
			}
			return row;
		};
		const row = generator.generate({
			rowType: 1,
			changeType: 0,
			isFirst: false,
			canAddNewReactions: false,
			canShowImages: true,
			message: record,
		});
		if (!row) return;
		row.renderContentOnly = false;
		row.separatorBefore = false;
		return { generator, record };
	} catch {
		return;
	}
}

function linkedMessage(target: LinkTarget): Message | null {
	const key = messageKey(target.channelId, target.messageId);
	const cached = cachedMessages.get(key);
	if (cached) return cached;
	const message = messages?.getMessage?.(target.channelId, target.messageId) ?? null;
	if (message) cachedMessages.set(key, message);
	return message;
}

function wakeTargetCells(targetKey: string): void {
	for (const [key, waitingTarget] of waitingCells) {
		if (waitingTarget !== targetKey) continue;
		waitingCells.delete(key);
		completedCells.delete(key);
		retryCounts.delete(key);
		const cell = activeCells.get(key);
		if (cell) scheduleCell(cell);
	}
}

function fetchLinkedMessage(target: LinkTarget): void {
	const key = messageKey(target.channelId, target.messageId);
	if (pendingMessages.has(key) || linkedMessage(target)) return;
	pendingMessages.add(key);
	const token = lifecycle;
	let request: Promise<Message | null> | undefined;
	try {
		request = messageActions?.fetchMessage?.(target);
	} catch {
		pendingMessages.delete(key);
		return;
	}
	if (!request?.then) {
		pendingMessages.delete(key);
		return;
	}
	void request
		.then((result) => {
			if (token !== lifecycle) return;
			const resolved = messages?.getMessage?.(target.channelId, target.messageId) ?? result;
			if (resolved) cachedMessages.set(key, resolved);
		})
		.catch(() => undefined)
		.finally(() => {
			pendingMessages.delete(key);
			if (token === lifecycle) wakeTargetCells(key);
		});
}

function nativeFrame(width: number, height: number): unknown {
	return objc?.struct('CGRect', { origin: { x: 0, y: 0 }, size: { width, height } }) ?? null;
}

async function availableMessageWidth(
	cell: NativeObjectHandle,
	label: NativeObjectHandle,
	bridge: NativeObjCBridge,
): Promise<number> {
	const values = await bridge.batch([
		{ target: label, selector: 'bounds', args: [] },
		{
			target: label,
			selector: 'convertRect:toView:',
			args: [{ $nativeBatchResult: 0 }, cell],
		},
		{ target: cell, selector: 'bounds', args: [] },
	]);
	return availableMessageWidthFromNative(values[1], values[2]);
}

async function createHost(
	width: number,
	height: number,
	bridge: NativeObjCBridge,
): Promise<NativeObjectHandle | null> {
	try {
		const view = bridge.alloc('UIView');
		await bridge.invokeAsync(view, 'setFrame:', [nativeFrame(width, height)]);
		return view;
	} catch {
		return null;
	}
}

function attributedSurfaceInsertion(
	state: EmbeddedSurfaceState,
	invoke: NativeInvoker = nativeCall,
): NativeObjectHandle | null {
	if (!objc) return null;
	const attachmentClass = objc.getClass('YYTextAttachment');
	if (!attachmentClass) return null;
	const attachment = objc.alloc(attachmentClass);
	invoke(attachment, 'setValue:forKey:', state.host, 'content');
	invoke(attachment, 'setValue:forKey:', 1, 'contentMode');
	const sourceText = stringFromNative(invoke(state.original, 'string')) ?? '';
	const insertionLocation = state.range.location + state.range.length;
	const trailingText = sourceText.slice(insertionLocation);
	const leadingNewline = sourceText[insertionLocation - 1] === '\n' ? '' : '\n';
	const trailingNewline = trailingText.trim().length > 0 ? '\n' : '';
	const spacerText = '\u200B\n';
	const spacerLocation = leadingNewline.length;
	const attachmentLocation = spacerLocation + spacerText.length;
	const insertionText = `${leadingNewline}${spacerText}\uFFFC${trailingNewline}`;
	const attributes: AnyRecord = state.font ? { NSFont: state.font } : {};
	const insertion = objc.alloc('NSMutableAttributedString');
	invoke(insertion, 'initWithString:attributes:', insertionText, attributes);
	const spacerFont = state.font
		? (invoke(
				state.font,
				'fontWithSize:',
				SURFACE_SPACER_FONT_SIZE,
			) as NativeObjectHandle | null)
		: null;
	if (spacerFont) {
		invoke(
			insertion,
			'addAttribute:value:range:',
			'NSFont',
			spacerFont,
			nativeRange(spacerLocation, spacerText.length),
		);
	}
	invoke(
		insertion,
		'addAttribute:value:range:',
		'YYTextAttachment',
		attachment,
		nativeRange(attachmentLocation, 1),
	);
	const delegateClass = objc.getClass('YYTextRunDelegate');
	if (delegateClass) {
		const delegate = objc.alloc(delegateClass);
		invoke(delegate, 'setValue:forKey:', state.height, 'ascent');
		invoke(delegate, 'setValue:forKey:', 0, 'descent');
		invoke(delegate, 'setValue:forKey:', state.width, 'width');
		const coreDelegate = invoke(delegate, 'CTRunDelegate');
		if (coreDelegate) {
			invoke(
				insertion,
				'addAttribute:value:range:',
				'CTRunDelegate',
				coreDelegate,
				nativeRange(attachmentLocation, 1),
			);
		}
	}
	return insertion;
}

async function findTableForCellAsync(
	cell: NativeObjectHandle,
	bridge: NativeObjCBridge,
): Promise<NativeObjectHandle | null> {
	const tables = await bridge.findViews(cell, 'UITableView', {
		direction: 'ancestors',
		maxDepth: 14,
		maxResults: 1,
		stopAtMatch: true,
	});
	return (
		tables.find(
			(view) =>
				bridge.respondsTo(view, 'beginUpdates') && bridge.respondsTo(view, 'endUpdates'),
		) ?? null
	);
}

function tableLayoutMetrics(table: NativeObjectHandle): SurfaceLayoutMetrics {
	return layoutMetricsFromNative([
		nativeCall(table, 'contentSize'),
		nativeCall(table, 'contentOffset'),
		nativeCall(table, 'bounds'),
		nativeCall(table, 'transform'),
		nativeCall(table, 'adjustedContentInset'),
	]);
}

function captureSurfaceBottomAnchor(state: EmbeddedSurfaceState, table: NativeObjectHandle): void {
	const latestMessage = messages?.getLastMessage?.(state.selectedTarget.channelId);
	const anchor = readSurfaceAnchor(
		tableLayoutMetrics(table),
		latestMessage?.id === state.messageId,
	);
	state.bottomAnchor.capture(anchor);
}

function scheduleBottomScrollCorrection(
	state: EmbeddedSurfaceState,
	table: NativeObjectHandle,
): void {
	if (!state.bottomAnchor.pending) return;
	if (state.bottomScrollTimer || state.bottomScrollPending) return;
	let attempts = 0;
	const correct = async () => {
		state.bottomScrollTimer = null;
		const bridge = objc;
		const token = lifecycle;
		if (cellStates.get(state.cellKey) !== state || !bridge) {
			state.bottomAnchor.clear();
			return;
		}
		state.bottomScrollPending = true;
		try {
			const values = await bridge.batch([
				{ target: state.label, selector: 'layoutIfNeeded', args: [] },
				{ target: state.cell, selector: 'layoutIfNeeded', args: [] },
				{ target: table, selector: 'layoutIfNeeded', args: [] },
				{ target: table, selector: 'contentSize', args: [] },
				{ target: table, selector: 'contentOffset', args: [] },
				{ target: table, selector: 'bounds', args: [] },
				{ target: table, selector: 'transform', args: [] },
				{ target: table, selector: 'adjustedContentInset', args: [] },
				{ target: table, selector: 'isTracking', args: [] },
				{ target: table, selector: 'isDragging', args: [] },
				{ target: table, selector: 'isDecelerating', args: [] },
			]);
			if (token !== lifecycle || objc !== bridge || cellStates.get(state.cellKey) !== state) {
				state.bottomAnchor.clear();
				return;
			}
			const metrics = layoutMetricsFromNative(values.slice(3, 8));
			const userIsScrolling = values.slice(8).some(Boolean);
			const correction = state.bottomAnchor.correction(metrics, userIsScrolling);
			if (correction) {
				const scrolling = await bridge.batch([
					{ target: table, selector: 'isTracking', args: [] },
					{ target: table, selector: 'isDragging', args: [] },
					{ target: table, selector: 'isDecelerating', args: [] },
				]);
				if (
					token !== lifecycle ||
					objc !== bridge ||
					cellStates.get(state.cellKey) !== state
				) {
					state.bottomAnchor.clear();
					return;
				}
				if (!scrolling.some(Boolean)) {
					await bridge.invokeAsync(table, 'setContentOffset:animated:', [
						bridge.struct('CGPoint', { x: correction.x, y: correction.y }),
						false,
					]);
				}
				return;
			}
			if (state.bottomAnchor.pending && attempts < 12) {
				attempts++;
				state.bottomScrollTimer = setTimeout(() => void correct(), 16);
				return;
			}
			state.bottomAnchor.clear();
		} catch {
			state.bottomAnchor.clear();
		} finally {
			state.bottomScrollPending = false;
		}
	};
	state.bottomScrollTimer = setTimeout(() => void correct(), 16);
}

function scheduleReactionScrollCorrection(state: EmbeddedSurfaceState, delay: number): void {
	if (state.reactionLayoutTimer) clearTimeout(state.reactionLayoutTimer);
	const token = lifecycle;
	state.reactionLayoutTimer = setTimeout(() => {
		state.reactionLayoutTimer = null;
		const bridge = objc;
		if (token !== lifecycle || cellStates.get(state.cellKey) !== state || !bridge) return;
		void findTableForCellAsync(state.cell, bridge)
			.then((table) => {
				if (
					token !== lifecycle ||
					objc !== bridge ||
					cellStates.get(state.cellKey) !== state
				)
					return;
				state.table = table;
				if (table) scheduleBottomScrollCorrection(state, table);
			})
			.catch(() => undefined);
	}, delay);
}

function refreshRowSize(state: EmbeddedSurfaceState, force: boolean = false): void {
	const bridge = objc;
	if (!bridge || !shouldRefreshSurfaceRow(force, state.lastInvalidatedHeight, state.height))
		return;
	state.lastInvalidatedHeight = state.height;
	const generation = ++state.rowRefreshGeneration;
	const token = lifecycle;
	async function applyRowRefresh() {
		try {
			const table = await findTableForCellAsync(state.cell, bridge);
			if (
				token !== lifecycle ||
				objc !== bridge ||
				cellStates.get(state.cellKey) !== state ||
				state.rowRefreshGeneration !== generation
			)
				return;
			if (!table) {
				state.table = null;
				state.lastInvalidatedHeight = -1;
				state.bottomAnchor.clear();
				return;
			}
			state.table = table;
			const values = await bridge.batch([
				{ target: table, selector: 'contentSize', args: [] },
				{ target: table, selector: 'contentOffset', args: [] },
				{ target: table, selector: 'bounds', args: [] },
				{ target: table, selector: 'transform', args: [] },
				{ target: table, selector: 'adjustedContentInset', args: [] },
				{ target: state.label, selector: 'invalidateIntrinsicContentSize', args: [] },
				{ target: state.label, selector: 'setNeedsLayout', args: [] },
				{ target: state.cell, selector: 'setNeedsUpdateConstraints', args: [] },
				{ target: state.cell, selector: 'setNeedsLayout', args: [] },
				{ target: table, selector: 'beginUpdates', args: [] },
				{ target: table, selector: 'endUpdates', args: [] },
			]);
			if (
				token !== lifecycle ||
				objc !== bridge ||
				cellStates.get(state.cellKey) !== state ||
				state.rowRefreshGeneration !== generation
			)
				return;
			const latestMessage = messages?.getLastMessage?.(state.selectedTarget.channelId);
			state.bottomAnchor.capture(
				readSurfaceAnchor(
					layoutMetricsFromNative(values.slice(0, 5)),
					latestMessage?.id === state.messageId,
				),
			);
			scheduleBottomScrollCorrection(state, table);
		} catch {
			if (state.rowRefreshGeneration !== generation) return;
			state.lastInvalidatedHeight = -1;
			state.bottomAnchor.clear();
		}
	}
	void applyRowRefresh();
}

function applyAttachment(state: EmbeddedSurfaceState, forceRefresh: boolean = false): boolean {
	if (!objc) return false;
	if (state.applying) return false;
	state.applying = true;
	try {
		const attachment = attributedSurfaceInsertion(state);
		if (!attachment) return false;
		const updated = nativeCall(state.original, 'mutableCopy') as NativeObjectHandle | null;
		if (!updated) return false;
		nativeCall(
			updated,
			'insertAttributedString:atIndex:',
			attachment,
			state.range.location + state.range.length,
		);
		const text = stringFromNative(nativeCall(updated, 'string'));
		if (typeof text !== 'string') return false;
		state.rendered = updated;
		state.renderedText = text;
		nativeCall(state.label, 'setAttributedText:', updated);
		nativeCall(state.label, 'setNeedsLayout');
		refreshRowSize(state, forceRefresh);
		return true;
	} finally {
		state.applying = false;
	}
}

function clearSurfaceTimers(state: EmbeddedSurfaceState): void {
	if (state.layoutTimer) clearTimeout(state.layoutTimer);
	if (state.reactionLayoutTimer) clearTimeout(state.reactionLayoutTimer);
	if (state.bottomScrollTimer) clearTimeout(state.bottomScrollTimer);
	state.layoutTimer = null;
	state.reactionLayoutTimer = null;
	state.bottomScrollTimer = null;
	state.pendingHeight = null;
	state.bottomAnchor.clear();
}

function reportSurfaceLayout(surfaceId: string, height: number): void {
	const state = surfaces.get(surfaceId);
	if (!state || !Number.isFinite(height) || height <= 0 || height > MAX_SURFACE_HEIGHT) return;
	const fittedHeight = Math.max(MIN_SURFACE_HEIGHT, height - SURFACE_BOTTOM_TRIM);
	const currentHeight = state.pendingHeight ?? state.height;
	if (Math.abs(currentHeight - fittedHeight) < 2) return;
	state.pendingHeight = fittedHeight;
	if (state.layoutTimer) clearTimeout(state.layoutTimer);
	state.layoutTimer = setTimeout(() => {
		state.layoutTimer = null;
		const settledHeight = state.pendingHeight;
		state.pendingHeight = null;
		if (
			settledHeight === null ||
			surfaces.get(state.surfaceId) !== state ||
			Math.abs(state.height - settledHeight) < 2
		)
			return;
		const table = state.table;
		if (table) captureSurfaceBottomAnchor(state, table);
		state.height = settledHeight;
		surfaceHeights.set(state.heightCacheKey, settledHeight);
		if (state.reactionLayoutTimer) clearTimeout(state.reactionLayoutTimer);
		state.reactionLayoutTimer = null;
		nativeCall(state.host, 'setFrame:', nativeFrame(state.width, settledHeight));
		applyAttachment(state, true);
	}, SURFACE_LAYOUT_SETTLE_DELAY);
}

function MessageSurface({ renderRevision, surfaceId }: SurfaceProps): ReactNode {
	const state = surfaces.get(surfaceId);
	const { React, ReactNative } = metro.common;
	if (!state || !chatItem) return React.createElement(ReactNative.View, { style: { height: 1 } });
	const embeddedMessage = React.createElement(chatItem, {
		key: surfaceId,
		message: state.record,
		renderRevision,
		rowGenerator: state.generator,
	});
	const onLayout = (event: AnyRecord) => {
		const height = Number(event?.nativeEvent?.layout?.height);
		if (height > 0) reportSurfaceLayout(surfaceId, height);
	};
	const content = React.createElement(
		ReactNative.View,
		{
			onLayout,
			style: {
				backgroundColor: EMBED_BACKGROUND,
				borderRadius: 8,
				overflow: 'hidden',
				minHeight: MIN_SURFACE_HEIGHT,
				paddingBottom: 0,
				paddingTop: 6,
				width: state.width,
			},
		},
		embeddedMessage,
	);
	if (!embeddedAnimationSupport) return content;
	return React.createElement(embeddedAnimationSupport.context.Provider, { value: true }, content);
}

function resolveChatItem(value: unknown, depth: number = 0): ChatItemComponent | null {
	if (typeof value === 'function') return value as ChatItemComponent;
	if (!value || typeof value !== 'object' || depth >= 5) return null;
	const wrapped = value as AnyRecord;
	return resolveChatItem(wrapped.type ?? wrapped.render ?? wrapped.default, depth + 1);
}

function modulePath(id: number | string): string | undefined {
	const window = (globalThis as AnyRecord).window as AnyRecord | undefined;
	const modules = window?.modules as { get?: (id: number) => AnyRecord | undefined } | undefined;
	return modules?.get?.(Number(id))?.__filePath as string | undefined;
}

function registerSurface(): boolean {
	if (surfaceModuleName) return true;
	const window = (globalThis as AnyRecord).window as AnyRecord | undefined;
	const registry =
		(metro.common.ReactNative as AnyRecord).AppRegistry ??
		window?.RN$AppRegistry ??
		metro.findByProps('registerComponent', 'runApplication');
	if (!registry || typeof registry.registerComponent !== 'function') return false;
	const registered =
		typeof registry.getAppKeys === 'function' ? (registry.getAppKeys() as string[]) : [];
	let surfaceIndex = lifecycle;
	while (registered.includes(`${SURFACE_MODULE_PREFIX}${surfaceIndex}`)) surfaceIndex++;
	surfaceModuleName = `${SURFACE_MODULE_PREFIX}${surfaceIndex}`;
	try {
		registry.registerComponent(surfaceModuleName, () => MessageSurface);
		return true;
	} catch {
		surfaceModuleName = '';
		return false;
	}
}

async function createSurfaceState(
	cell: NativeObjectHandle,
	key: string,
	info: NativeMessageInfo,
	target: LinkTarget,
	channelName: string,
	label: NativeObjectHandle,
	attributedText: NativeObjectHandle,
	range: { location: number; length: number },
	source: Message,
	content: EmbeddedContent,
): Promise<EmbeddedSurfaceState | null> {
	if (!objc || !fabric) return null;
	const bridge = objc;
	const fabricBridge = fabric;
	const token = lifecycle;
	const lookupVersion = cellLookupVersions.get(key);
	let width: number;
	try {
		width = await availableMessageWidth(cell, label, bridge);
	} catch {
		return null;
	}
	if (
		bridge !== objc ||
		fabricBridge !== fabric ||
		token !== lifecycle ||
		lookupVersion !== cellLookupVersions.get(key)
	)
		return null;
	if (!Number.isFinite(width) || width < 80) return null;
	const font = linkFont(attributedText, range);
	const heightCacheKey = surfaceHeightCacheKey(target.channelId, target.messageId, width);
	const initialHeight = surfaceHeights.get(heightCacheKey, INITIAL_SURFACE_HEIGHT);
	const [host, table] = await Promise.all([
		createHost(width, initialHeight, bridge),
		findTableForCellAsync(cell, bridge).catch(() => null),
	]);
	if (
		bridge !== objc ||
		fabricBridge !== fabric ||
		token !== lifecycle ||
		lookupVersion !== cellLookupVersions.get(key)
	)
		return null;
	if (!host) return null;
	const bottomAnchor = new BottomAnchorTracker();
	const surfaceId = `message-link-${key}-${info.messageId}-${target.messageId}`;
	const state: EmbeddedSurfaceState = {
		cell,
		cellKey: key,
		table,
		channelName,
		baseGenerator: content.generator,
		font,
		generator: content.generator,
		host,
		label,
		labelHook: null,
		messageId: info.messageId,
		sourceReactionSnapshot: reactionSnapshot(source.reactions),
		original: attributedText,
		range,
		record: content.record,
		rendered: null,
		renderedText: null,
		selectedTarget: target,
		surface: null,
		surfaceId,
		width,
		height: initialHeight,
		heightCacheKey,
		lastInvalidatedHeight: -1,
		applying: false,
		layoutTimer: null,
		reactionLayoutTimer: null,
		bottomScrollTimer: null,
		bottomScrollPending: false,
		rowRefreshGeneration: 0,
		pendingHeight: null,
		renderRevision: 0,
		bottomAnchor,
	};
	if (table) captureSurfaceBottomAnchor(state, table);
	surfaces.set(surfaceId, state);
	try {
		state.labelHook = objc.hook(
			'DCDReusableYYLabel',
			'setAttributedText:',
			{
				after: () => {
					if (state.applying) return;
					setTimeout(() => void reconcileSurfaceText(state), 0);
				},
			},
			{ instance: label },
		);
		state.surface = fabric.mount(host, surfaceModuleName, {
			renderRevision: state.renderRevision,
			surfaceId,
		});
		fabric.setSize(
			state.surface,
			{ width, height: MIN_SURFACE_HEIGHT },
			{ width, height: MAX_SURFACE_HEIGHT },
		);
		removeCellLabelHooks(key);
		cellStates.set(key, state);
		if (!applyAttachment(state)) throw new Error('Could not attach the Fabric message surface');
		return state;
	} catch {
		cellStates.delete(key);
		clearSurfaceTimers(state);
		state.labelHook?.remove();
		try {
			if (state.surface) fabric.unmount(state.surface);
		} catch {
			void 0;
		}
		nativeCall(state.host, 'removeFromSuperview');
		surfaces.delete(surfaceId);
		return null;
	}
}

function teardownSurface(key: string, restore: boolean): void {
	const state = cellStates.get(key);
	if (!state) return;
	clearSurfaceTimers(state);
	state.labelHook?.remove();
	if (restore && objc && state.rendered && state.renderedText !== null) {
		const current = nativeCall(state.label, 'attributedText') as NativeObjectHandle | null;
		const currentText = current ? stringFromNative(nativeCall(current, 'string')) : undefined;
		if (current && (currentText === state.renderedText || current === state.rendered)) {
			nativeCall(state.label, 'setAttributedText:', state.original);
			nativeCall(state.label, 'setNeedsLayout');
		}
	}
	if (state.surface) {
		try {
			fabric?.unmount(state.surface);
		} catch {
			void 0;
		}
	}
	nativeCall(state.host, 'removeFromSuperview');
	surfaces.delete(state.surfaceId);
	cellStates.delete(key);
}

function cachedContentFor(target: LinkTarget, message: Message): EmbeddedContent | undefined {
	return buildEmbeddedContent(message, target.channelId);
}

async function readLabelTextAsync(
	view: NativeObjectHandle,
	bridge: NativeObjCBridge,
): Promise<NativeLabelText | undefined> {
	try {
		const values = await bridge.batch([
			{ target: view, selector: 'attributedText', args: [] },
			{ target: { $nativeBatchResult: 0 }, selector: 'string', args: [] },
		]);
		if (!values[0] || typeof values[1] !== 'string') return;
		return { attributedText: values[0] as NativeObjectHandle, text: values[1] };
	} catch {
		return;
	}
}

function updateExistingSurface(
	state: EmbeddedSurfaceState,
	attributedText: NativeObjectHandle,
	range: { location: number; length: number },
	forceRefresh: boolean = true,
): void {
	state.original = attributedText;
	state.range = range;
	state.font = linkFont(attributedText, range);
	applyAttachment(state, forceRefresh);
}

async function updateCell(
	cell: NativeObjectHandle,
	info: NativeMessageInfo | undefined,
	labels: NativeObjectHandle[],
): Promise<CellUpdateStatus> {
	if (!objc || !fabric) return 'done';
	const bridge = objc;
	const key = cellKey(cell);
	if (!key || !info) return 'retry';
	const token = lifecycle;
	const lookupVersion = cellLookupVersions.get(key);
	const channelId = info.channelId ?? currentChannelId();
	if (!channelId) return 'retry';
	const source = messages?.getMessage?.(channelId, info.messageId);
	const targets = source ? linkedTargets(source) : [];
	if (!source || targets.length === 0) {
		const state = cellStates.get(key);
		if (state && state.messageId !== info.messageId) teardownSurface(key, true);
		return source ? 'done' : 'retry';
	}
	const target = targets[0];
	const targetMessage = linkedMessage(target);
	if (!targetMessage) {
		waitingCells.set(key, messageKey(target.channelId, target.messageId));
		fetchLinkedMessage(target);
		return 'waiting';
	}
	const channelName = channelNameFor(target, targetMessage);
	if (!channelName) return 'retry';
	const existing = cellStates.get(key);
	if (
		existing &&
		existing.messageId === info.messageId &&
		existing.selectedTarget.messageId === target.messageId
	) {
		const labelText = await readLabelTextAsync(existing.label, bridge);
		if (token !== lifecycle || bridge !== objc || lookupVersion !== cellLookupVersions.get(key))
			return 'done';
		if (!labelText) return 'retry';
		const { attributedText, text } = labelText;
		if (text === existing.renderedText) return 'done';
		const range = findRenderedLinkRange(text, channelName);
		if (!range) return 'retry';
		updateExistingSurface(existing, attributedText, range);
		return 'done';
	}
	if (existing) teardownSurface(key, false);
	for (const label of labels) {
		const labelText = await readLabelTextAsync(label, bridge);
		if (token !== lifecycle || bridge !== objc || lookupVersion !== cellLookupVersions.get(key))
			return 'done';
		if (!labelText) continue;
		const { attributedText, text } = labelText;
		const range = findRenderedLinkRange(text, channelName);
		if (!range) continue;
		const built = cachedContentFor(target, targetMessage);
		if (!built) return 'retry';
		const state = await createSurfaceState(
			cell,
			key,
			info,
			target,
			channelName,
			label,
			attributedText,
			range,
			source,
			built,
		);
		return state ? 'done' : 'retry';
	}
	return 'retry';
}

function scheduleCell(cell: NativeObjectHandle): void {
	const key = cellKey(cell);
	if (!key) return;
	activeCells.set(key, cell);
	if (
		cellStates.has(key) ||
		pendingCells.has(key) ||
		completedCells.has(key) ||
		waitingCells.has(key) ||
		retryTimers.has(key)
	)
		return;
	pendingCells.add(key);
	const token = lifecycle;
	const lookupVersion = ++nextCellLookupVersion;
	cellLookupVersions.set(key, lookupVersion);
	setTimeout(() => {
		const bridge = objc;
		if (token !== lifecycle || !bridge || cellLookupVersions.get(key) !== lookupVersion) return;
		void (async () => {
			const info = await readNativeMessageInfo(cell, bridge);
			const channelId = info?.channelId ?? currentChannelId();
			const source =
				info && channelId ? messages?.getMessage?.(channelId, info.messageId) : null;
			const labels =
				source && linkedTargets(source).length > 0
					? await bridge.findViews(cell, 'DCDReusableYYLabel', {
							maxDepth: MAX_NATIVE_VIEW_DEPTH,
							maxVisited: 100,
							maxResults: 32,
							stopAtMatch: false,
						})
					: [];
			if (
				token !== lifecycle ||
				objc !== bridge ||
				cellLookupVersions.get(key) !== lookupVersion
			)
				return;
			try {
				const status = await updateCell(cell, info, labels);
				if (token !== lifecycle || cellLookupVersions.get(key) !== lookupVersion) return;
				pendingCells.delete(key);
				if (status === 'done') {
					completedCells.add(key);
					retryCounts.delete(key);
					return;
				}
				if (status === 'waiting') return;
				observeCellLabels(cell, labels);
				const attempts = (retryCounts.get(key) ?? 0) + 1;
				retryCounts.set(key, attempts);
				if (attempts > 8) {
					completedCells.add(key);
					return;
				}
				const timer = setTimeout(() => {
					retryTimers.delete(key);
					if (token === lifecycle) scheduleCell(cell);
				}, 120);
				retryTimers.set(key, timer);
			} catch {
				if (token !== lifecycle || cellLookupVersions.get(key) !== lookupVersion) return;
				pendingCells.delete(key);
				completedCells.add(key);
			}
		})().catch(() => {
			if (token !== lifecycle || cellLookupVersions.get(key) !== lookupVersion) return;
			pendingCells.delete(key);
			completedCells.add(key);
		});
	}, 0);
}

function clearCell(key: string): void {
	activeCells.delete(key);
	visibleCellIds.delete(key);
	pendingCells.delete(key);
	cellLookupVersions.delete(key);
	completedCells.delete(key);
	retryCounts.delete(key);
	waitingCells.delete(key);
	const retryTimer = retryTimers.get(key);
	if (retryTimer) clearTimeout(retryTimer);
	retryTimers.delete(key);
	removeCellLabelHooks(key);
	teardownSurface(key, true);
}

function removeCellLabelHooks(key: string): void {
	for (const token of cellLabelHooks.get(key) ?? []) token.remove();
	cellLabelHooks.delete(key);
}

function refreshCell(cell: NativeObjectHandle): void {
	const key = cellKey(cell);
	if (!key || cellStates.has(key)) return;
	completedCells.delete(key);
	retryCounts.delete(key);
	waitingCells.delete(key);
	scheduleCell(cell);
}

function observeCellLabels(cell: NativeObjectHandle, labels: NativeObjectHandle[]): void {
	if (!objc) return;
	const key = cellKey(cell);
	if (!key || cellLabelHooks.has(key)) return;
	const tokens: NativeHookToken[] = [];
	for (const label of labels) {
		if (!(objc.className(label) ?? '').includes('DCDReusableYYLabel')) continue;
		try {
			tokens.push(
				objc.hook(
					'DCDReusableYYLabel',
					'setAttributedText:',
					{ after: () => refreshCell(cell) },
					{ instance: label },
				),
			);
		} catch {
			void 0;
		}
	}
	if (tokens.length > 0) cellLabelHooks.set(key, tokens);
}

function installNativeHooks(): void {
	if (!objc || hooks.length > 0) return;
	const visibility = objc.hook('DCDMessageTableViewCell', 'didMoveToWindow', {
		after: ({ self }) => {
			const bridge = objc;
			const token = lifecycle;
			if (!bridge) return;
			void bridge
				.invokeAsync(self, 'window', [])
				.then((window) => {
					if (token !== lifecycle || objc !== bridge) return;
					const key = cellKey(self);
					if (!key) return;
					if (!window) {
						clearCell(key);
						return;
					}
					scheduleCell(self);
				})
				.catch(() => undefined);
		},
	});
	const reuse = objc.hook('DCDMessageTableViewCell', 'prepareForReuse', {
		after: ({ self }) => {
			const key = cellKey(self);
			if (!key) return;
			clearCell(key);
			setTimeout(() => scheduleCell(self), 0);
		},
	});
	hooks = [visibility, reuse];
	for (const delay of [0, 300, 1_500]) {
		const timer = setTimeout(() => {
			initialScanTimers = initialScanTimers.filter((candidate) => candidate !== timer);
			void scanVisibleMessageCells();
		}, delay);
		initialScanTimers.push(timer);
	}
}

function dependenciesReady(): boolean {
	return Boolean(
		messages?.getMessage &&
		messageActions?.fetchMessage &&
		messageRecord &&
		rowManager &&
		chatItem,
	);
}

function captureDependency(candidate: unknown): void {
	if (!candidate || (typeof candidate !== 'object' && typeof candidate !== 'function')) return;
	const value = candidate as AnyRecord;
	if (!messages && isMessageStoreCandidate(candidate)) {
		messages = value as MessageStore;
	}
	if (!messageRecord && typeof candidate === 'function' && value.name === 'MessageRecord') {
		messageRecord = candidate as MessageRecordConstructor;
	}
	if (!rowManager && typeof candidate === 'function' && value.name === 'RowManager') {
		rowManager = candidate as RowManagerConstructor;
	}
}

function activate(): void {
	if (!dependenciesReady() || !registerSurface()) return;
	clearModuleListener();
	installMessageStoreListener();
	installNativeHooks();
}

function captureLoadedModule(module: unknown, id: number | string): void {
	if (!module || (typeof module !== 'object' && typeof module !== 'function')) return;
	const exports = module as AnyRecord;
	const isChatItemModule =
		typeof exports.DCDMessageView === 'function' &&
		typeof exports.DCDSystemMessageView === 'function' &&
		typeof exports.DCDAutoModerationSystemMessageView === 'function';
	if (!chatItem && (modulePath(id) === CHAT_ITEM_PATH || isChatItemModule)) {
		chatItem = resolveChatItem(exports.default) ?? resolveChatItem(exports);
	}
	captureDependency(exports);
	captureDependency(exports.default);
	if (dependenciesReady()) activate();
}

function captureInitializedModules(): void {
	const window = (globalThis as AnyRecord).window as AnyRecord | undefined;
	const modules = window?.modules as Map<number, MetroModule> | undefined;
	if (!modules) return;
	for (const [id, module] of modules) {
		if (!module.isInitialized) continue;
		captureLoadedModule(module.publicModule?.exports, id);
		if (dependenciesReady()) break;
	}
}

function clearModuleListener(): void {
	moduleListenerCleanup?.();
	moduleListenerCleanup = null;
}

function initialize(): void {
	if (!moduleListenerCleanup) {
		moduleListenerCleanup = metro.addListener((module, id) => captureLoadedModule(module, id));
	}
	captureInitializedModules();
	if (!messageActions) {
		messageActions =
			(metro.findByProps('fetchMessage', 'sendMessage', '_sendMessage') as
				| MessageActions
				| undefined) ?? null;
	}
	if (!chatItem) {
		const module = metro.findByFilePath(CHAT_ITEM_PATH, { cacheOnly: false, interop: false });
		if (module) {
			chatItem = resolveChatItem((module as AnyRecord).default) ?? resolveChatItem(module);
		}
	}
	if (dependenciesReady()) activate();
}

function start(context?: PluginContext): void {
	lifecycle++;
	objc = context?.native.objc ?? null;
	fabric = context?.native.fabric ?? null;
	embeddedAnimationSupport?.dispose();
	embeddedAnimationSupport = installEmbeddedAnimationSupport(
		metro.common.React,
		metro,
		modulePath,
	);
	selectedChannel = metro.findByProps('getLastSelectedChannelId', 'getChannelId');
	channelStore = metro.findByProps('getChannel');
	initialize();
}

function stop(): void {
	lifecycle++;
	if (messageWindowScanTimer) clearTimeout(messageWindowScanTimer);
	messageWindowScanTimer = null;
	messageWindowSignature = '';
	for (const timer of initialScanTimers) clearTimeout(timer);
	initialScanTimers = [];
	removeMessageStoreListener();
	for (const token of hooks) token.remove();
	hooks = [];
	clearModuleListener();
	for (const key of [...cellLabelHooks.keys()]) removeCellLabelHooks(key);
	for (const key of [...cellStates.keys()]) teardownSurface(key, true);
	embeddedAnimationSupport?.dispose();
	embeddedAnimationSupport = null;
	activeCells.clear();
	visibleCellIds.clear();
	pendingCells.clear();
	cellLookupVersions.clear();
	completedCells.clear();
	retryCounts.clear();
	for (const timer of retryTimers.values()) clearTimeout(timer);
	retryTimers.clear();
	waitingCells.clear();
	cachedMessages.clear();
	pendingMessages.clear();
	surfaceHeights.clear();
	messages = null;
	messageActions = null;
	channelStore = null;
	selectedChannel = null;
	messageRecord = null;
	rowManager = null;
	chatItem = null;
	objc = null;
	fabric = null;
	surfaceModuleName = '';
}

export default { start, stop };
