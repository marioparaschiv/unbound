import {
	isCurrentReactionRequest,
	REACTION_AVATAR_LIMIT,
	type ReactionEmoji,
	type ReactionLayoutItem,
	type ReactionRecord,
	ReactionUserCache,
	type Reactor,
	reactionAncestorHeightDelta,
	reactionAvatarExtraWidth,
	reactionAvatarFrame,
	reactionAvatarKey,
	reactionAvatarReservedExtraWidth,
	reactionAvatarReservedSlotCount,
	reactionAvatarSelection,
	reactionAvatarStackWidth,
	reactionBaseViewWidth,
	reactionCellHeightFloor,
	reactionCellLifecycleAction,
	reactionLayoutFrameMatches,
	reactionLayoutIdentityChanged,
	reactionLayoutNeedsInvalidation,
	reflowReactionItems,
	shouldHandleChannelChange,
	shouldMeasureReactionAvatarWidth,
	shouldRenderReactionAvatars,
} from '@reaction-avatars/reaction-state';
import {
	clearReactionAvatarSurfaceState,
	clearReactionAvatarSurfaceStates,
	configureReactionAvatarSurface,
	ReactionAvatarSurface,
	type ReactionAvatarSurfaceState,
	setReactionAvatarSurfaceState,
} from '@reaction-avatars/reaction-surface';
import {
	readReactionCellViews,
	type ReactionCellViews,
} from '@reaction-avatars/reaction-cell-views';
import { isMessageStoreCandidate } from '@shared/message-store-candidate';
import { readNativeMessageInfo } from '@shared/native-message-info';
import { metro } from '@unbound-app/api';
import type {
	NativeFabricBridge,
	NativeFabricFrame,
	NativeFabricSurface,
	NativeHookToken,
	NativeObjCBridge,
	NativeObjectHandle,
	PluginContext,
} from '@unbound-app/api/native';

const REACTION_ACTIONS_PATH = 'modules/reactions/ReactionActionCreators.tsx';
const USER_SUMMARY_ITEM_PATH = 'components_native/common/UserSummaryItem.tsx';
const MAX_NATIVE_VIEW_DEPTH = 8;
const MAX_NATIVE_VIEW_NODES = 100;
const MAX_REACTION_CELL_NODES = 40;
const MAX_VISIBLE_CELL_SCAN_DEPTH = 40;
const MAX_VISIBLE_CELL_SCAN_NODES = 1600;
const CELL_SCAN_INTERVAL = 250;
const EMPTY_RESULT_RETRY_DELAY = 1_000;
const MAX_EMPTY_RESULT_RETRIES = 2;
const AVATAR_LEADING_INSET = 4;
const AVATAR_TRAILING_PADDING = 4;
const INITIAL_SURFACE_HEIGHT = 36;
const INITIAL_SURFACE_WIDTH = 120;
const REACTION_EVENTS = [
	'MESSAGE_REACTION_ADD',
	'MESSAGE_REACTION_REMOVE',
	'MESSAGE_REACTION_REMOVE_ALL',
	'MESSAGE_REACTION_REMOVE_EMOJI',
];

type AnyRecord = Record<string, unknown>;
type Reaction = ReactionRecord & {
	emoji?: unknown;
	type?: number;
};
type Message = AnyRecord & {
	channel?: AnyRecord;
	channel_id?: string;
	channelId?: string;
	id?: string;
	reactions?: Reaction[];
};
type ReactionRequest = {
	channelId: string;
	emoji: ReactionEmoji;
	limit: number;
	messageId: string;
	type: number;
};
type ReactionActions = {
	getReactors?: (request: ReactionRequest) => Promise<Reactor[]>;
};
type MessageStore = {
	_dispatcher?: unknown;
	getMessage?: (channelId: string, messageId: string) => Message | null;
	getName?: () => string;
};
type Dispatcher = {
	dispatch?: (event: AnyRecord) => void;
	subscribe?: (event: string, listener: (event: AnyRecord) => void) => void;
	unsubscribe?: (event: string, listener: (event: AnyRecord) => void) => void;
};
type UserStore = {
	getUser?: (id: string) => Reactor | null;
	getCurrentUser?: () => Reactor | null;
};
type ChannelStore = {
	getChannel?: (channelId: string) => { guild_id?: string } | null;
};
type SelectedChannel = {
	addChangeListener?: (listener: () => void) => void;
	getChannelId?: () => string | undefined;
	getLastSelectedChannelId?: () => string | undefined;
	removeChangeListener?: (listener: () => void) => void;
};
type RuntimeModule = {
	isInitialized?: boolean;
	publicModule?: { exports?: unknown };
	__filePath?: string;
};
type RuntimeWindow = Window & {
	RN$AppRegistry?: { registerComponent?: (name: string, provider: () => unknown) => void };
	modules?: Map<number | string, RuntimeModule>;
};
type MessageInfo = {
	channelId: string;
	messageId: string;
};
type ReactionContext = {
	channelId: string;
	emoji: ReactionEmoji;
	key: string;
	messageId: string;
	messageKey: string;
	reaction: Reaction;
	reactionType?: number;
};
type ReactionSurfaceState = {
	avatarWidth: number;
	baseFrame: NativeFabricFrame;
	cellKey: string;
	collectionCell: NativeObjectHandle;
	context: ReactionContext;
	extraWidth: number;
	emptyResultRetryCount: number;
	emptyResultRetryTimer: ReturnType<typeof setTimeout> | null;
	guildId?: string;
	itemIndex: number;
	layoutKey: string;
	loading: boolean;
	message: Message;
	totalCount: number;
	widthMeasured: boolean;
	revision: number;
	requestGeneration: number;
	surface: NativeFabricSurface | null;
	surfaceFrame: NativeFabricFrame | null;
	surfaceId: string;
	users: Reactor[];
	view: NativeObjectHandle;
};
type NativeNode = {
	depth: number;
	view: NativeObjectHandle;
};
type NativeStructFields = {
	height?: number;
	width?: number;
};
type NativePointFields = {
	x?: number;
	y?: number;
};
type NativeRectFields = {
	origin?: NativePointFields;
	size?: NativeStructFields;
};
type NativeFrame = {
	height: number;
	width: number;
	x: number;
	y: number;
};
type NativeViewFrame = {
	frame: NativeFrame;
	view: NativeObjectHandle;
};
type ReactionTableLayout = {
	layoutHookInstalled: boolean;
	layoutScheduled: boolean;
	dirty: boolean;
	pending: ReturnType<NativeObjCBridge['batch']> | null;
	table: NativeObjectHandle;
};
type ReactionLayoutFrame = {
	height: number;
	index: number;
	width: number;
	x: number;
	y: number;
};
type ReactionLayoutPlan = {
	baseHeight: number;
	frames: Map<number, ReactionLayoutFrame>;
	height: number;
	revision: number;
	width: number;
};
type ReactionLayoutEntry = {
	ancestorFrames: NativeViewFrame[];
	appliedCells: Map<string, { index: number; revision: number }>;
	appliedLayoutRevision: number;
	appliedLayoutWidth: number;
	baseItems: Map<number, ReactionLayoutItem>;
	collection: NativeObjectHandle;
	extraWidths: Map<number, number>;
	invalidationScheduled: boolean;
	layout: NativeObjectHandle;
	list: NativeObjectHandle;
	itemCount: number;
	ownerCell: NativeObjectHandle | null;
	ownerCellKey: string;
	ownerMessageKey: string;
	ownerTableKey: string;
	plan: ReactionLayoutPlan | null;
	revision: number;
};
type ReactionCellSizeEntry = {
	cell: NativeObjectHandle;
	contributions: Map<string, number>;
	floor: number;
	messageKey: string;
	width: number;
};

const userCache = new ReactionUserCache<Reactor>(400, 3, 60_000);
const reactionStates = new Map<string, ReactionSurfaceState>();
const reactionLayouts = new Map<string, ReactionLayoutEntry>();
const reactionCellSizes = new Map<string, ReactionCellSizeEntry>();
const reactionTableLayouts = new Map<string, ReactionTableLayout>();
const activeCells = new Map<string, NativeObjectHandle>();
const scheduledCells = new Set<string>();
const pendingForcedCells = new Set<string>();
const lastCellScans = new Map<string, number>();
const hooks: NativeHookToken[] = [];
const nativeIds = new WeakMap<object, number>();
const reactionLayoutRefreshes = new Map<string, ReturnType<typeof setTimeout>>();

let objc: NativeObjCBridge | null = null;
let reactionCellSizeHook: NativeHookToken | null = null;
let fabric: NativeFabricBridge | null = null;
let reactionActions: ReactionActions | null = null;
let messages: MessageStore | null = null;
let dispatcher: Dispatcher | null = null;
let users: UserStore | null = null;
let channels: ChannelStore | null = null;
let selectedChannel: SelectedChannel | null = null;
let userSummaryItem: unknown = null;
let moduleListenerCleanup: (() => boolean) | null = null;
let surfaceModuleName = '';
let lifecycle = 0;
let currentSelectedChannelId: string | undefined;
let channelScanTimeouts: ReturnType<typeof setTimeout>[] = [];
let nextNativeId = 0;
let visibleScanRevision = 0;
let activated = false;

function record(value: unknown): value is AnyRecord {
	return typeof value === 'object' && value !== null;
}

function property(value: unknown, key: string): unknown {
	return record(value) ? value[key] : undefined;
}

function stringValue(...values: unknown[]): string | null {
	for (const value of values) {
		if (typeof value === 'string' && value.length > 0) return value;
		if (typeof value === 'number' || typeof value === 'bigint') return String(value);
	}
	return null;
}

function numberValue(...values: unknown[]): number | undefined {
	for (const value of values) {
		if (value === null || value === undefined) continue;
		const number = typeof value === 'number' ? value : Number(value);
		if (Number.isFinite(number)) return number;
	}
	return undefined;
}

function messageKey(channelId: string, messageId: string): string {
	return `${channelId}:${messageId}`;
}

function selectedChannelId(): string | undefined {
	return (
		stringValue(
			selectedChannel?.getChannelId?.(),
			selectedChannel?.getLastSelectedChannelId?.(),
		) ?? undefined
	);
}

function nativeCall(handle: NativeObjectHandle, selector: string, ...args: unknown[]): unknown {
	if (!objc) return null;
	try {
		return objc.invoke(handle, selector, args, { thread: 'main' });
	} catch {
		return null;
	}
}

function nativeKey(handle: NativeObjectHandle): string {
	let hash: number | undefined;
	try {
		hash = numberValue(objc?.call(handle, 'hash'));
	} catch {
		hash = undefined;
	}
	if (hash !== undefined) return `${objc?.className(handle) ?? 'NSObject'}:${hash}`;
	const existing = nativeIds.get(handle);
	if (existing !== undefined) return `native:${existing}`;
	const id = ++nextNativeId;
	nativeIds.set(handle, id);
	return `native:${id}`;
}

function nativeChildren(view: NativeObjectHandle): NativeObjectHandle[] {
	if (!objc) return [];
	const children = nativeCall(view, 'subviews');
	if (Array.isArray(children)) return children as NativeObjectHandle[];
	if (!children || typeof children !== 'object') return [];
	try {
		return objc
			.array(children as NativeObjectHandle)
			.filter(
				(child: NativeObjectHandle): child is NativeObjectHandle =>
					typeof child === 'object' && child !== null,
			);
	} catch {
		return [];
	}
}

function firstNativeViewByClass(
	root: NativeObjectHandle,
	className: string,
	maximumNodes: number = MAX_NATIVE_VIEW_NODES,
	maximumDepth: number = MAX_NATIVE_VIEW_DEPTH,
): NativeObjectHandle | null {
	if (!objc) return null;
	const queue: NativeNode[] = [{ depth: 0, view: root }];
	let visited = 0;
	while (queue.length > 0 && visited < maximumNodes) {
		const node = queue.shift();
		if (!node) break;
		visited++;
		if ((objc.className(node.view) ?? '').includes(className)) return node.view;
		if (node.depth >= maximumDepth) continue;
		for (const child of nativeChildren(node.view)) {
			queue.push({ depth: node.depth + 1, view: child });
		}
	}
	return null;
}

function ancestorNativeViewByClass(
	view: NativeObjectHandle,
	className: string,
	maximumDepth: number,
): NativeObjectHandle | null {
	if (!objc) return null;
	let current: NativeObjectHandle | null = view;
	for (let depth = 0; current && depth < maximumDepth; depth++) {
		if ((objc.className(current) ?? '').includes(className)) return current;
		current = nativeCall(current, 'superview') as NativeObjectHandle | null;
	}
	return null;
}

function messageForCell(info: MessageInfo): Message | null {
	return messages?.getMessage?.(info.channelId, info.messageId) ?? null;
}

function reactionContextForMessage(
	message: Message,
	channelId: string,
	reaction: Reaction,
): ReactionContext | null {
	const messageId = stringValue(message.id);
	if (!messageId) return null;
	const rawEmoji = reaction.emoji;
	const emojiName =
		typeof rawEmoji === 'string'
			? rawEmoji
			: record(rawEmoji)
				? stringValue(rawEmoji.name, rawEmoji.animatedName)
				: null;
	if (!emojiName) return null;
	const emoji: ReactionEmoji = {
		id: record(rawEmoji) ? stringValue(rawEmoji.id) : null,
		name: emojiName,
	};
	const reactionType = numberValue(reaction.type);
	const selection = reactionAvatarSelection(reaction, reactionType);
	if (selection.count === 0 || selection.types.length === 0) return null;
	const key = reactionAvatarKey(channelId, messageId, emoji, selection.types);
	return {
		channelId,
		emoji,
		key,
		messageId,
		messageKey: messageKey(channelId, messageId),
		reaction,
		reactionType,
	};
}

function messageContextForCell(info: MessageInfo): {
	channelId: string;
	message: Message;
	messageId: string;
} | null {
	const message = messageForCell(info);
	if (!message) return null;
	return { channelId: info.channelId, message, messageId: info.messageId };
}

function itemForCollectionCell(
	collection: NativeObjectHandle,
	cell: NativeObjectHandle,
): number | undefined {
	const indexPath = nativeCall(
		collection,
		'indexPathForCell:',
		cell,
	) as NativeObjectHandle | null;
	if (!indexPath) return;
	const item = numberValue(nativeCall(indexPath, 'item'), nativeCall(indexPath, 'row'));
	return item === undefined ? undefined : Math.floor(item);
}

function userSummaryComponent(): unknown {
	const module = metro.findByFilePath(USER_SUMMARY_ITEM_PATH, { interop: false });
	const component = module?.default ?? module;
	return typeof component === 'function' ? component : metro.findByName('UserSummaryItem');
}

function surfaceRegistry(): {
	registerComponent?: (name: string, provider: () => unknown) => void;
} | null {
	const window = (globalThis as AnyRecord).window as RuntimeWindow;
	const reactNative = metro.common.ReactNative as AnyRecord;
	const registry =
		property(reactNative, 'AppRegistry') ??
		window.RN$AppRegistry ??
		metro.findByProps('registerComponent', 'runApplication');
	return record(registry)
		? (registry as { registerComponent?: (name: string, provider: () => unknown) => void })
		: null;
}

function registerSurface(): boolean {
	if (surfaceModuleName) return true;
	const registry = surfaceRegistry();
	if (!registry?.registerComponent) return false;
	surfaceModuleName = `ReactionAvatarSurface${lifecycle}`;
	try {
		registry.registerComponent(surfaceModuleName, () => ReactionAvatarSurface);
		return true;
	} catch {
		surfaceModuleName = '';
		return false;
	}
}

function renderStateForSurface(state: ReactionSurfaceState): ReactionAvatarSurfaceState {
	return {
		guildId: channels?.getChannel?.(state.context.channelId)?.guild_id,
		height: state.baseFrame.height || INITIAL_SURFACE_HEIGHT,
		measured: state.widthMeasured,
		onWidth: (width) => updateAvatarWidth(state, width),
		totalCount: state.totalCount,
		users: state.users,
		width: state.avatarWidth,
	};
}

function setSurfaceRenderState(state: ReactionSurfaceState): void {
	setReactionAvatarSurfaceState(state.surfaceId, renderStateForSurface(state));
}

function nativeStructFields(value: unknown): NativeStructFields {
	const fields = property(value, 'value');
	if (!record(fields)) return {};
	return {
		height: numberValue(fields.height),
		width: numberValue(fields.width),
	};
}

function nativeRectFields(value: unknown): NativeRectFields {
	const fields = property(value, 'value');
	if (!record(fields)) return {};
	const origin = record(fields.origin) ? fields.origin : {};
	const size = record(fields.size) ? fields.size : {};
	return {
		origin: { x: numberValue(origin.x), y: numberValue(origin.y) },
		size: { height: numberValue(size.height), width: numberValue(size.width) },
	};
}

function nativeFrameForView(view: NativeObjectHandle): NativeFrame | null {
	const frame = nativeRectFields(nativeCall(view, 'frame'));
	const x = frame.origin?.x;
	const y = frame.origin?.y;
	const width = frame.size?.width;
	const height = frame.size?.height;
	if (x === undefined || y === undefined || width === undefined || height === undefined)
		return null;
	return { height, width, x, y };
}

function captureReactionAncestorFrames(list: NativeObjectHandle): NativeViewFrame[] {
	if (!objc) return [];
	const frames: NativeViewFrame[] = [];
	let current: NativeObjectHandle | null = list;
	while (current && frames.length < 8) {
		const className = objc.className(current) ?? '';
		if (className.includes('DCDMessageTableViewCell') || className.includes('DCDTableView')) {
			break;
		}
		const frame = nativeFrameForView(current);
		if (frame) frames.push({ frame, view: current });
		if (className.includes('UITableViewCellContentView')) break;
		current = nativeCall(current, 'superview') as NativeObjectHandle | null;
	}
	return frames;
}

function nativeArray(value: unknown): NativeObjectHandle[] {
	if (Array.isArray(value)) return value as NativeObjectHandle[];
	if (!objc || !record(value)) return [];
	try {
		return objc.array(value as NativeObjectHandle) as NativeObjectHandle[];
	} catch {
		return [];
	}
}

function reactionCount(collection: NativeObjectHandle): number {
	const sections = numberValue(nativeCall(collection, 'numberOfSections')) ?? 1;
	let count = 0;
	for (let section = 0; section < sections; section++) {
		count += numberValue(nativeCall(collection, 'numberOfItemsInSection:', section)) ?? 0;
	}
	return count;
}

function reactionLayoutEntry(
	layout: NativeObjectHandle,
	collection: NativeObjectHandle,
	list: NativeObjectHandle,
	messageIdentity: string,
): ReactionLayoutEntry {
	const key = nativeKey(collection);
	const count = reactionCount(collection);
	const ownerCell = ancestorNativeViewByClass(list, 'DCDMessageTableViewCell', 12);
	const ownerTable = ancestorNativeViewByClass(list, 'DCDTableView', 12);
	const ownerCellKey = ownerCell ? nativeKey(ownerCell) : '';
	const existing = reactionLayouts.get(key);
	if (existing) {
		if (
			reactionLayoutIdentityChanged(
				{
					itemCount: existing.itemCount,
					messageKey: existing.ownerMessageKey,
					ownerCellKey: existing.ownerCellKey,
				},
				{ itemCount: count, messageKey: messageIdentity, ownerCellKey },
			)
		) {
			for (const [stateKey, state] of reactionStates) {
				if (state.layoutKey === key) disposeReactionState(stateKey, state, true);
			}
			restoreReactionLayoutEntry(existing);
			existing.baseItems.clear();
			existing.appliedCells.clear();
			existing.extraWidths.clear();
			existing.itemCount = count;
			existing.ancestorFrames = captureReactionAncestorFrames(list);
			existing.ownerCellKey = ownerCellKey;
			existing.ownerMessageKey = messageIdentity;
			existing.ownerTableKey = ownerTable ? nativeKey(ownerTable) : '';
			existing.ownerCell = ownerCell;
			existing.plan = null;
			existing.revision++;
		}
		existing.collection = collection;
		existing.layout = layout;
		existing.list = list;
		existing.ownerCell = ownerCell;
		existing.ownerCellKey = ownerCellKey;
		existing.ownerTableKey = ownerTable ? nativeKey(ownerTable) : '';
		return existing;
	}

	const entry: ReactionLayoutEntry = {
		ancestorFrames: captureReactionAncestorFrames(list),
		appliedCells: new Map(),
		appliedLayoutRevision: -1,
		appliedLayoutWidth: -1,
		baseItems: new Map(),
		collection,
		extraWidths: new Map(),
		invalidationScheduled: false,
		layout,
		list,
		itemCount: count,
		ownerCell,
		ownerCellKey,
		ownerMessageKey: messageIdentity,
		ownerTableKey: ownerTable ? nativeKey(ownerTable) : '',
		plan: null,
		revision: 0,
	};
	reactionLayouts.set(key, entry);
	return entry;
}

function captureReactionLayoutItem(
	entry: ReactionLayoutEntry,
	index: number,
	frame: NativeRectFields,
): void {
	const x = frame.origin?.x;
	const y = frame.origin?.y;
	const width = frame.size?.width;
	const height = frame.size?.height;
	if (x === undefined || y === undefined || width === undefined || height === undefined) return;
	const previous = entry.baseItems.get(index);
	if (
		previous &&
		previous.x === x &&
		previous.y === y &&
		previous.width === width &&
		previous.height === height
	)
		return;
	entry.baseItems.set(index, { height, index, width, x, y });
	entry.appliedCells.clear();
	entry.plan = null;
	entry.revision++;
	const tableLayout = reactionTableLayouts.get(entry.ownerTableKey);
	if (tableLayout) tableLayout.dirty = true;
}

function captureReactionLayoutItems(entry: ReactionLayoutEntry): void {
	if (!objc || entry.baseItems.size >= entry.itemCount) return;
	const indexPathClass = objc.getClass('NSIndexPath');
	if (!indexPathClass) return;
	const sections = numberValue(nativeCall(entry.collection, 'numberOfSections')) ?? 1;
	for (let section = 0; section < sections; section++) {
		const count =
			numberValue(nativeCall(entry.collection, 'numberOfItemsInSection:', section)) ?? 0;
		for (let item = 0; item < count; item++) {
			const indexPath = nativeCall(
				indexPathClass,
				'indexPathForItem:inSection:',
				item,
				section,
			) as NativeObjectHandle | null;
			if (!indexPath) continue;
			const attributes = nativeCall(
				entry.layout,
				'layoutAttributesForItemAtIndexPath:',
				indexPath,
			) as NativeObjectHandle | null;
			if (!attributes) continue;
			captureReactionLayoutItem(
				entry,
				item,
				nativeRectFields(nativeCall(attributes, 'frame')),
			);
		}
	}
}

function ensureReactionLayoutPlan(entry: ReactionLayoutEntry): boolean {
	if (!objc) return false;
	const bounds = nativeRectFields(nativeCall(entry.collection, 'bounds'));
	const width = bounds.size?.width;
	if (width === undefined || width <= 0 || entry.baseItems.size < entry.itemCount) return false;
	if (entry.plan?.revision === entry.revision && entry.plan.width === width) return true;
	const items = [...entry.baseItems.values()].map((item) => ({
		...item,
		extraWidth: entry.extraWidths.get(item.index) ?? 0,
	}));
	const frames = reflowReactionItems(items, width);
	if (frames.length === 0) return false;
	const baseHeight = Math.max(...items.map((item) => item.y + item.height));
	const height = Math.max(...frames.map((frame) => frame.y + frame.height));
	entry.plan = {
		baseHeight,
		frames: new Map(frames.map((frame) => [frame.index, frame])),
		height,
		revision: entry.revision,
		width,
	};
	return true;
}

function setReactionLayoutExtraWidth(state: ReactionSurfaceState, width: number): void {
	const entry = reactionLayouts.get(state.layoutKey);
	if (!entry) return;
	const current = entry.extraWidths.get(state.itemIndex) ?? 0;
	if (Math.abs(current - width) < 1) return;
	if (width > 0) entry.extraWidths.set(state.itemIndex, width);
	else entry.extraWidths.delete(state.itemIndex);
	entry.appliedCells.clear();
	entry.plan = null;
	entry.revision++;
	const tableLayout = reactionTableLayouts.get(entry.ownerTableKey);
	if (tableLayout) tableLayout.dirty = true;
}

function invalidateReactionLayout(entry: ReactionLayoutEntry): void {
	if (!objc || entry.invalidationScheduled) return;
	entry.invalidationScheduled = true;
	const token = lifecycle;
	const key = nativeKey(entry.collection);
	setTimeout(() => {
		if (token !== lifecycle || !objc || reactionLayouts.get(key) !== entry) {
			entry.invalidationScheduled = false;
			return;
		}
		try {
			void objc
				.batch([
					{ target: entry.layout, selector: 'invalidateLayout', args: [] },
					{ target: entry.collection, selector: 'setNeedsLayout', args: [] },
					{ target: entry.list, selector: 'invalidateIntrinsicContentSize', args: [] },
					{ target: entry.list, selector: 'setNeedsLayout', args: [] },
				])
				.then(
					() => {
						entry.invalidationScheduled = false;
						if (token !== lifecycle || reactionLayouts.get(key) !== entry) return;
						if (entry.ownerCell) scheduleCell(entry.ownerCell, true);
						const table = entry.ownerCell
							? ancestorNativeViewByClass(entry.ownerCell, 'DCDTableView', 12)
							: null;
						if (table) scheduleReactionTableLayout(reactionTableLayout(table));
					},
					() => {
						entry.invalidationScheduled = false;
					},
				);
		} catch {
			entry.invalidationScheduled = false;
		}
	}, 0);
}

function updateAvatarWidth(state: ReactionSurfaceState, width: number): void {
	if (!Number.isFinite(width) || width <= 0) return;
	if (!shouldMeasureReactionAvatarWidth(state.widthMeasured, state.avatarWidth, width)) return;
	const firstMeasurement = !state.widthMeasured;
	const widthChanged = Math.abs(width - state.avatarWidth) >= 1;
	const extraWidth = reactionAvatarExtraWidth(
		width,
		AVATAR_LEADING_INSET,
		AVATAR_TRAILING_PADDING,
		true,
	);
	const extraWidthChanged = Math.abs(extraWidth - state.extraWidth) >= 1;
	state.widthMeasured = true;
	state.avatarWidth = width;
	state.extraWidth = extraWidth;
	if (extraWidthChanged) setReactionLayoutExtraWidth(state, extraWidth);
	if (!firstMeasurement && !widthChanged && !extraWidthChanged) return;
	state.revision++;
	setSurfaceRenderState(state);
	if (state.surface) {
		try {
			fabric?.update(state.surface, { revision: state.revision, surfaceId: state.surfaceId });
		} catch {
			return;
		}
	}
	if (extraWidthChanged) {
		const entry = reactionLayouts.get(state.layoutKey);
		if (entry) invalidateReactionLayout(entry);
	}
}

function updateSurfaceFrame(state: ReactionSurfaceState): void {
	if (!fabric || !state.surface) return;
	try {
		const width = state.avatarWidth || INITIAL_SURFACE_WIDTH;
		const position = reactionAvatarFrame(state.baseFrame, width, AVATAR_LEADING_INSET);
		const surfaceFrame = {
			height: state.baseFrame.height || INITIAL_SURFACE_HEIGHT,
			width: position.width,
			x: position.x,
			y: state.baseFrame.y,
		};
		if (
			state.surfaceFrame &&
			Math.abs(state.surfaceFrame.x - surfaceFrame.x) < 0.5 &&
			Math.abs(state.surfaceFrame.y - surfaceFrame.y) < 0.5 &&
			Math.abs(state.surfaceFrame.width - surfaceFrame.width) < 0.5 &&
			Math.abs(state.surfaceFrame.height - surfaceFrame.height) < 0.5
		)
			return;
		fabric.setFrame(state.surface, surfaceFrame);
		state.surfaceFrame = surfaceFrame;
	} catch {
		return;
	}
}

function updateReactionViewFrame(state: ReactionSurfaceState): void {
	if (!objc || state.extraWidth === 0) return;
	const width = state.baseFrame.width + state.extraWidth;
	const current = nativeFrameForView(state.view);
	if (!current) return;
	if (Math.abs(current.width - width) < 1) return;
	setNativeFrame(state.view, { ...current, width });
}

function removeSurface(state: ReactionSurfaceState, resetWidth: boolean): void {
	clearReactionAvatarSurfaceState(state.surfaceId);
	if (state.surface) {
		try {
			fabric?.unmount(state.surface);
		} catch {
			void 0;
		}
	}
	state.surface = null;
	state.surfaceFrame = null;
	if (objc) setNativeFrame(state.view, state.baseFrame);
	if (!resetWidth) return;
	state.avatarWidth = 0;
	state.extraWidth = 0;
	state.widthMeasured = false;
	setReactionLayoutExtraWidth(state, 0);
	const entry = reactionLayouts.get(state.layoutKey);
	if (entry) invalidateReactionLayout(entry);
}

function createSurface(state: ReactionSurfaceState): void {
	if (!fabric || !surfaceModuleName || state.surface || state.users.length === 0) return;
	setSurfaceRenderState(state);
	try {
		state.surface = fabric.mount(state.collectionCell, surfaceModuleName, {
			revision: state.revision,
			surfaceId: state.surfaceId,
		});
		updateSurfaceFrame(state);
	} catch {
		state.surface = null;
		return;
	}
}

function updateSurface(state: ReactionSurfaceState): void {
	if (state.users.length === 0) {
		removeSurface(state, true);
		return;
	}
	state.revision++;
	setSurfaceRenderState(state);
	if (!state.surface) createSurface(state);
	else {
		try {
			fabric?.update(state.surface, { revision: state.revision, surfaceId: state.surfaceId });
		} catch {
			removeSurface(state, true);
			return;
		}
	}
	updateSurfaceFrame(state);
}

function createReactionState(
	cellKey: string,
	layoutKey: string,
	itemIndex: number,
	collectionCell: NativeObjectHandle,
	view: NativeObjectHandle,
	context: ReactionContext,
	message: Message,
): ReactionSurfaceState {
	const measuredFrame = fabric?.measure(view) ?? { height: 0, width: 0, x: 0, y: 0 };
	const layoutWidth = reactionLayouts.get(layoutKey)?.baseItems.get(itemIndex)?.width;
	const cellWidth = layoutWidth === undefined ? undefined : fabric?.measure(collectionCell).width;
	const baseFrame = {
		...measuredFrame,
		width:
			layoutWidth === undefined || cellWidth === undefined
				? measuredFrame.width
				: reactionBaseViewWidth(layoutWidth, cellWidth, measuredFrame.width),
	};
	const totalCount = reactionAvatarSelection(context.reaction, context.reactionType).count;
	const avatarWidth = reactionAvatarStackWidth(reactionAvatarReservedSlotCount(totalCount));
	const extraWidth = reactionAvatarReservedExtraWidth(
		totalCount,
		AVATAR_LEADING_INSET,
		AVATAR_TRAILING_PADDING,
	);
	return {
		avatarWidth,
		baseFrame,
		cellKey,
		collectionCell,
		context,
		emptyResultRetryCount: 0,
		emptyResultRetryTimer: null,
		extraWidth,
		guildId: channels?.getChannel?.(context.channelId)?.guild_id,
		itemIndex,
		layoutKey,
		loading: false,
		message,
		totalCount,
		widthMeasured: false,
		revision: 0,
		requestGeneration: 0,
		surface: null,
		surfaceFrame: null,
		surfaceId: `${cellKey}:${context.key}`,
		users: [],
		view,
	};
}

async function fetchReactionUsers(context: ReactionContext): Promise<Reactor[]> {
	if (!reactionActions?.getReactors) return [];
	const selection = reactionAvatarSelection(context.reaction, context.reactionType);
	const uniqueUsers = new Map<string, Reactor>();
	for (const reactionType of selection.types) {
		const remaining = REACTION_AVATAR_LIMIT - uniqueUsers.size;
		if (remaining <= 0) break;
		try {
			const result = (
				(await reactionActions.getReactors({
					channelId: context.channelId,
					emoji: context.emoji,
					limit: remaining,
					messageId: context.messageId,
					type: reactionType,
				})) ?? []
			).slice(0, remaining);
			dispatcher?.dispatch?.({
				channelId: context.channelId,
				emoji: context.emoji,
				messageId: context.messageId,
				reactionType,
				type: 'MESSAGE_REACTION_ADD_USERS',
				users: result ?? [],
			});
			for (const user of result ?? []) {
				if (!user?.id || uniqueUsers.has(user.id)) continue;
				uniqueUsers.set(user.id, user);
				dispatcher?.dispatch?.({ type: 'USER_UPDATE', user });
				if (uniqueUsers.size >= REACTION_AVATAR_LIMIT) break;
			}
			if (uniqueUsers.size >= REACTION_AVATAR_LIMIT) break;
		} catch (error) {
			console.error(error);
		}
	}
	return [...uniqueUsers.values()];
}

function loadReactionUsers(state: ReactionSurfaceState): void {
	if (state.loading) return;
	state.loading = true;
	const requestKey = state.context.key;
	const requestGeneration = state.requestGeneration;
	const token = lifecycle;
	void userCache
		.load(requestKey, () => fetchReactionUsers(state.context))
		.then((reactors) => {
			if (
				token !== lifecycle ||
				reactionStates.get(nativeKey(state.view)) !== state ||
				!isCurrentReactionRequest(
					requestKey,
					state.context.key,
					requestGeneration,
					state.requestGeneration,
				)
			)
				return;
			state.loading = false;
			state.users = reactors;
			updateSurface(state);
			if (reactors.length > 0) {
				if (state.emptyResultRetryTimer) clearTimeout(state.emptyResultRetryTimer);
				state.emptyResultRetryTimer = null;
				state.emptyResultRetryCount = 0;
			} else {
				scheduleEmptyReactionRetry(state);
			}
		})
		.catch(() => {
			if (
				token !== lifecycle ||
				reactionStates.get(nativeKey(state.view)) !== state ||
				!isCurrentReactionRequest(
					requestKey,
					state.context.key,
					requestGeneration,
					state.requestGeneration,
				)
			)
				return;
			state.loading = false;
			scheduleEmptyReactionRetry(state);
		});
}

function scheduleEmptyReactionRetry(state: ReactionSurfaceState): void {
	if (
		state.totalCount <= 0 ||
		state.emptyResultRetryTimer ||
		state.emptyResultRetryCount >= MAX_EMPTY_RESULT_RETRIES
	)
		return;
	state.emptyResultRetryCount++;
	const token = lifecycle;
	state.emptyResultRetryTimer = setTimeout(() => {
		state.emptyResultRetryTimer = null;
		if (
			token !== lifecycle ||
			reactionStates.get(nativeKey(state.view)) !== state ||
			state.users.length > 0 ||
			state.loading
		)
			return;
		userCache.invalidate(state.context.key);
		loadReactionUsers(state);
	}, EMPTY_RESULT_RETRY_DELAY);
}

function syncReactionView(
	cellKey: string,
	layoutKey: string,
	itemIndex: number,
	collectionCell: NativeObjectHandle,
	view: NativeObjectHandle,
	context: ReactionContext | null,
	message: Message,
): void {
	const key = nativeKey(view);
	const existing = reactionStates.get(key);
	const collectionCellKey = nativeKey(collectionCell);
	if (!context) {
		if (existing) disposeReactionState(key, existing, true);
		return;
	}
	if (
		existing?.context.key === context.key &&
		existing.cellKey === cellKey &&
		nativeKey(existing.collectionCell) === collectionCellKey
	) {
		if (existing.layoutKey !== layoutKey || existing.itemIndex !== itemIndex) {
			setReactionLayoutExtraWidth(existing, 0);
			existing.layoutKey = layoutKey;
			existing.itemIndex = itemIndex;
			setReactionLayoutExtraWidth(existing, existing.extraWidth);
		}
		existing.context = context;
		existing.message = message;
		const totalCount = reactionAvatarSelection(context.reaction, context.reactionType).count;
		if (existing.totalCount !== totalCount) {
			existing.totalCount = totalCount;
			existing.avatarWidth = reactionAvatarStackWidth(
				reactionAvatarReservedSlotCount(totalCount),
			);
			existing.extraWidth = reactionAvatarReservedExtraWidth(
				totalCount,
				AVATAR_LEADING_INSET,
				AVATAR_TRAILING_PADDING,
			);
			existing.widthMeasured = false;
			setReactionLayoutExtraWidth(existing, existing.extraWidth);
			if (existing.users.length > 0) updateSurface(existing);
			else setSurfaceRenderState(existing);
		}
		if (existing.loading || existing.users.length > 0) return;
		const cached = userCache.get(context.key);
		if (cached !== undefined) {
			existing.users = cached;
			if (cached.length > 0) updateSurface(existing);
			else scheduleEmptyReactionRetry(existing);
			return;
		}
		loadReactionUsers(existing);
		return;
	}
	if (existing) disposeReactionState(key, existing, true);
	const state = createReactionState(
		cellKey,
		layoutKey,
		itemIndex,
		collectionCell,
		view,
		context,
		message,
	);
	reactionStates.set(key, state);
	setReactionLayoutExtraWidth(state, state.extraWidth);
	const cached = userCache.get(context.key);
	if (cached !== undefined) {
		state.users = cached;
		updateSurface(state);
		if (cached.length === 0) scheduleEmptyReactionRetry(state);
		return;
	}
	loadReactionUsers(state);
}

function disposeReactionState(key: string, state: ReactionSurfaceState, resetWidth: boolean): void {
	if (state.emptyResultRetryTimer) clearTimeout(state.emptyResultRetryTimer);
	state.requestGeneration++;
	removeSurface(state, resetWidth);
	reactionStates.delete(key);
}

function reactionViewForCollectionCell(cell: NativeObjectHandle): NativeObjectHandle | null {
	return firstNativeViewByClass(cell, 'ReactionView', MAX_REACTION_CELL_NODES, 5);
}

function setNativeFrame(view: NativeObjectHandle, frame: NativeFrame): void {
	if (!objc) return;
	const current = nativeFrameForView(view);
	if (
		current &&
		Math.abs(current.x - frame.x) < 0.5 &&
		Math.abs(current.y - frame.y) < 0.5 &&
		Math.abs(current.width - frame.width) < 0.5 &&
		Math.abs(current.height - frame.height) < 0.5
	)
		return;
	nativeCall(
		view,
		'setFrame:',
		objc.struct('CGRect', {
			origin: { x: frame.x, y: frame.y },
			size: { height: frame.height, width: frame.width },
		}),
	);
}

function setReactionAncestorFrames(entry: ReactionLayoutEntry, delta: number): void {
	for (const { frame, view } of entry.ancestorFrames) {
		setNativeFrame(view, { ...frame, height: frame.height + delta });
	}
}

function reactionCollectionBottomInCell(entry: ReactionLayoutEntry): number | undefined {
	if (!entry.ownerCell || !entry.plan) return;
	let offset = 0;
	let current: NativeObjectHandle | null = entry.collection;
	for (let depth = 0; current && depth < 12; depth++) {
		if (nativeKey(current) === entry.ownerCellKey) return offset + entry.plan.height + 2;
		const frame = nativeFrameForView(current);
		if (!frame) return;
		offset += frame.y;
		current = nativeCall(current, 'superview') as NativeObjectHandle | null;
	}
}

function removeReactionCellHeightFloor(state: ReactionCellSizeEntry): void {
	if (!objc || !reactionCellSizeHook) return;
	try {
		reactionCellSizeHook.removeSizeHeightFloor(state.cell, [
			objc.struct('CGSize', { width: state.width, height: 0 }),
		]);
	} catch {}
}

function clearReactionCellSize(entry: ReactionLayoutEntry): boolean {
	const state = reactionCellSizes.get(entry.ownerCellKey);
	if (!state || state.messageKey !== entry.ownerMessageKey) return false;
	const key = nativeKey(entry.collection);
	if (!state.contributions.delete(key)) return false;
	if (state.contributions.size === 0) {
		removeReactionCellHeightFloor(state);
		reactionCellSizes.delete(entry.ownerCellKey);
		return true;
	}
	const floor = reactionCellHeightFloor(state.contributions.values());
	if (Math.abs(state.floor - floor) < 0.5) return false;
	if (!objc || !reactionCellSizeHook) {
		reactionCellSizes.delete(entry.ownerCellKey);
		return true;
	}
	try {
		reactionCellSizeHook.setSizeHeightFloor(
			state.cell,
			[objc.struct('CGSize', { width: state.width, height: 0 })],
			floor,
		);
		state.floor = floor;
	} catch {
		removeReactionCellHeightFloor(state);
		reactionCellSizes.delete(entry.ownerCellKey);
	}
	return true;
}

function updateReactionCellSize(entry: ReactionLayoutEntry): boolean {
	if (!objc || !entry.ownerCell || !entry.plan) return false;
	const baselineHeight = entry.ancestorFrames[0]?.frame.height;
	const cellFrame = nativeFrameForView(entry.ownerCell);
	if (baselineHeight === undefined || !cellFrame || cellFrame.width <= 0) return false;
	const extraHeight = reactionAncestorHeightDelta(entry.plan.height, baselineHeight);
	if (extraHeight < 1) return clearReactionCellSize(entry);
	const floor = reactionCollectionBottomInCell(entry);
	if (floor === undefined || floor <= 0 || floor > 4096) return false;
	let state = reactionCellSizes.get(entry.ownerCellKey);
	if (
		state &&
		(state.messageKey !== entry.ownerMessageKey ||
			Math.abs(state.width - cellFrame.width) >= 0.5)
	) {
		removeReactionCellHeightFloor(state);
		reactionCellSizes.delete(entry.ownerCellKey);
		state = undefined;
	}
	if (!state) {
		try {
			if (!reactionCellSizeHook) {
				const hook = objc.hook(
					'DCDMessageTableViewCell',
					'sizeThatFits:',
					{},
					{ cacheOnly: true, thread: 'main' },
				);
				if (typeof hook.setSizeHeightFloor !== 'function') {
					hook.remove();
					return false;
				}
				reactionCellSizeHook = hook;
			}
			state = {
				cell: entry.ownerCell,
				contributions: new Map(),
				floor: 0,
				messageKey: entry.ownerMessageKey,
				width: cellFrame.width,
			};
			reactionCellSizes.set(entry.ownerCellKey, state);
		} catch {
			return false;
		}
	}
	state.contributions.set(nativeKey(entry.collection), floor);
	const targetFloor = reactionCellHeightFloor(state.contributions.values());
	if (Math.abs(state.floor - targetFloor) < 0.5) return false;
	try {
		reactionCellSizeHook.setSizeHeightFloor(
			state.cell,
			[objc.struct('CGSize', { width: state.width, height: 0 })],
			targetFloor,
		);
		state.floor = targetFloor;
	} catch {
		removeReactionCellHeightFloor(state);
		reactionCellSizes.delete(entry.ownerCellKey);
		return false;
	}
	return true;
}

function restoreReactionLayoutEntry(entry: ReactionLayoutEntry): void {
	if (!objc) return;
	clearReactionCellSize(entry);
	setReactionAncestorFrames(entry, 0);
	const baseItems = [...entry.baseItems.values()];
	for (const cell of nativeArray(nativeCall(entry.collection, 'visibleCells'))) {
		const index = itemForCollectionCell(entry.collection, cell);
		const frame = index === undefined ? undefined : entry.baseItems.get(index);
		if (frame) setNativeFrame(cell, frame);
	}
	const baseHeight = baseItems.length
		? Math.max(...baseItems.map((item) => item.y + item.height))
		: entry.plan?.baseHeight;
	if (baseHeight !== undefined) {
		const currentSize = nativeStructFields(nativeCall(entry.collection, 'contentSize'));
		const currentFrame = nativeFrameForView(entry.collection);
		nativeCall(
			entry.collection,
			'setContentSize:',
			objc.struct('CGSize', {
				height: baseHeight,
				width: currentSize.width ?? currentFrame?.width ?? 0,
			}),
		);
		if (currentFrame) setNativeFrame(entry.collection, { ...currentFrame, height: baseHeight });
	}
	const tableLayout = reactionTableLayouts.get(entry.ownerTableKey);
	if (tableLayout) {
		tableLayout.dirty = true;
		scheduleReactionTableLayout(tableLayout);
	}
}

function scheduleReactionLayoutRefresh(messageId: string, channelId?: string): void {
	const key = `${channelId ?? '*'}:${messageId}`;
	const existing = reactionLayoutRefreshes.get(key);
	if (existing) clearTimeout(existing);
	const token = lifecycle;
	const timeout = setTimeout(() => {
		reactionLayoutRefreshes.delete(key);
		if (token !== lifecycle || !activated) return;
		for (const entry of reactionLayouts.values()) {
			if (
				channelId
					? entry.ownerMessageKey !== messageKey(channelId, messageId)
					: !entry.ownerMessageKey.endsWith(`:${messageId}`)
			)
				continue;

			restoreReactionLayoutEntry(entry);
			entry.itemCount = reactionCount(entry.collection);
			entry.baseItems.clear();
			entry.appliedCells.clear();
			entry.appliedLayoutRevision = -1;
			entry.appliedLayoutWidth = -1;
			entry.plan = null;
			entry.revision++;
			nativeCall(entry.layout, 'invalidateLayout');
			nativeCall(entry.collection, 'layoutIfNeeded');
			if (entry.ownerCell) scheduleCell(entry.ownerCell, true);
		}
	}, 100);
	reactionLayoutRefreshes.set(key, timeout);
}

function reactionTableLayout(table: NativeObjectHandle): ReactionTableLayout {
	const key = nativeKey(table);
	const existing = reactionTableLayouts.get(key);
	if (existing) return existing;
	const entry: ReactionTableLayout = {
		layoutHookInstalled: false,
		layoutScheduled: false,
		dirty: true,
		pending: null,
		table,
	};
	reactionTableLayouts.set(key, entry);
	return entry;
}

function applyReactionTableLayout(entry: ReactionTableLayout): void {
	if (!objc || !entry.dirty || entry.pending) return;
	const bridge = objc;
	const token = lifecycle;
	entry.dirty = false;
	try {
		const pending = bridge.batch([
			{ target: entry.table, selector: 'beginUpdates', args: [] },
			{ target: entry.table, selector: 'endUpdates', args: [] },
		]);
		entry.pending = pending;
		void pending.then(
			() => {
				if (entry.pending !== pending) return;
				entry.pending = null;
				if (token !== lifecycle || objc !== bridge) return;
				if (entry.dirty) scheduleReactionTableLayout(entry);
			},
			() => {
				if (entry.pending !== pending) return;
				entry.pending = null;
				if (token === lifecycle && objc === bridge) entry.dirty = true;
			},
		);
	} catch {
		entry.dirty = true;
	}
}

function scheduleReactionTableLayout(entry: ReactionTableLayout): void {
	if (entry.layoutScheduled) return;
	entry.layoutScheduled = true;
	const token = lifecycle;
	setTimeout(() => {
		entry.layoutScheduled = false;
		if (token !== lifecycle || !objc || !entry.dirty) return;
		applyReactionTableLayout(entry);
	}, 0);
}

function applyDirtyReactionTableLayout(ownerTableKey: string): void {
	const tableLayout = reactionTableLayouts.get(ownerTableKey);
	if (tableLayout?.dirty) scheduleReactionTableLayout(tableLayout);
}

function installReactionTableLayoutHook(entry: ReactionLayoutEntry): boolean {
	if (!objc || !entry.ownerCell) return false;
	const table = ancestorNativeViewByClass(entry.ownerCell, 'DCDTableView', 12);
	if (!table) return false;
	const tableEntry = reactionTableLayout(table);
	if (tableEntry.layoutHookInstalled) return true;
	try {
		hooks.push(
			objc.hook(
				'DCDTableView',
				'layoutSubviews',
				{
					after: () => {
						if (tableEntry.dirty) scheduleReactionTableLayout(tableEntry);
					},
				},
				{ instance: table, thread: 'main' },
			),
		);
		tableEntry.layoutHookInstalled = true;
		return true;
	} catch {
		return false;
	}
}

function applyReactionLayout(entry: ReactionLayoutEntry): void {
	if (!objc) return;
	if (entry.extraWidths.size === 0) {
		if (entry.appliedLayoutRevision >= 0) restoreReactionLayoutEntry(entry);
		else setReactionAncestorFrames(entry, 0);
		entry.appliedCells.clear();
		entry.appliedLayoutRevision = -1;
		entry.appliedLayoutWidth = -1;
		applyDirtyReactionTableLayout(entry.ownerTableKey);
		return;
	}
	captureReactionLayoutItems(entry);
	if (!ensureReactionLayoutPlan(entry) || !entry.plan) return;
	const planChanged =
		entry.appliedLayoutRevision !== entry.plan.revision ||
		Math.abs(entry.appliedLayoutWidth - entry.plan.width) >= 0.5;
	const tableLayout = reactionTableLayouts.get(entry.ownerTableKey);
	if (planChanged && tableLayout) tableLayout.dirty = true;
	if (updateReactionCellSize(entry) && tableLayout) tableLayout.dirty = true;
	for (const cell of nativeArray(nativeCall(entry.collection, 'visibleCells'))) {
		const index = itemForCollectionCell(entry.collection, cell);
		if (index === undefined) continue;
		const frame = entry.plan.frames.get(index);
		if (!frame) continue;
		const cellKey = nativeKey(cell);
		const appliedCell = entry.appliedCells.get(cellKey);
		const currentFrame = nativeFrameForView(cell);
		const frameChanged = !reactionLayoutFrameMatches(currentFrame ?? undefined, frame);
		if (
			frameChanged ||
			!appliedCell ||
			appliedCell.index !== index ||
			appliedCell.revision !== entry.plan.revision
		) {
			setNativeFrame(cell, frame);
			entry.appliedCells.set(cellKey, { index, revision: entry.plan.revision });
		}
		const reactionView = reactionViewForCollectionCell(cell);
		const state = reactionView ? reactionStates.get(nativeKey(reactionView)) : undefined;
		if (state) updateReactionViewFrame(state);
	}
	const currentSize = nativeStructFields(nativeCall(entry.collection, 'contentSize'));
	const currentFrame = nativeRectFields(nativeCall(entry.collection, 'frame'));
	const currentHeight = currentFrame.size?.height ?? 0;
	const contentHeight = currentSize.height ?? 0;
	const targetHeight = entry.plan.height;
	const dimensionsChanged = reactionLayoutNeedsInvalidation(
		{ contentHeight, frameHeight: currentHeight },
		{ contentHeight: targetHeight, frameHeight: targetHeight },
	);
	if (Math.abs(contentHeight - entry.plan.height) >= 1) {
		nativeCall(
			entry.collection,
			'setContentSize:',
			objc.struct('CGSize', {
				height: entry.plan.height,
				width: currentSize.width ?? entry.plan.width,
			}),
		);
	}
	if (planChanged && dimensionsChanged) {
		nativeCall(entry.collection, 'invalidateIntrinsicContentSize');
		nativeCall(entry.list, 'invalidateIntrinsicContentSize');
		nativeCall(entry.list, 'setNeedsLayout');
	}
	if (Math.abs(currentHeight - targetHeight) >= 1) {
		setNativeFrame(entry.collection, {
			height: targetHeight,
			width: currentFrame.size?.width ?? entry.plan.width,
			x: currentFrame.origin?.x ?? 0,
			y: currentFrame.origin?.y ?? 0,
		});
	}
	const baselineHeight = entry.ancestorFrames[0]?.frame.height;
	if (baselineHeight !== undefined) {
		setReactionAncestorFrames(
			entry,
			reactionAncestorHeightDelta(entry.plan.height, baselineHeight),
		);
	}
	if (planChanged) {
		entry.appliedLayoutRevision = entry.plan.revision;
		entry.appliedLayoutWidth = entry.plan.width;
	}
	applyDirtyReactionTableLayout(entry.ownerTableKey);
}

function restoreReactionTableLayout(entry: ReactionTableLayout): void {
	if (!objc) return;
	entry.pending?.cancel();
	entry.pending = null;
	for (const layout of reactionLayouts.values()) {
		if (layout.ownerTableKey === nativeKey(entry.table)) restoreReactionLayoutEntry(layout);
	}
	entry.dirty = false;
	nativeCall(entry.table, 'beginUpdates');
	nativeCall(entry.table, 'endUpdates');
}

function updateCell(
	cell: NativeObjectHandle,
	info: MessageInfo | undefined,
	views: ReactionCellViews | undefined,
): void {
	if (!objc || !fabric || !messages) return;
	const cellKey = nativeKey(cell);
	const messageContext = info ? messageContextForCell(info) : null;
	if (!messageContext || !views) {
		cleanupCellReactions(cellKey);
		return;
	}
	const { collection, layout, list: reactionList } = views;
	const visibleCells = nativeArray(views.visibleCells);
	const layoutEntry = reactionLayoutEntry(
		layout,
		collection,
		reactionList,
		messageKey(messageContext.channelId, messageContext.messageId),
	);
	installReactionTableLayoutHook(layoutEntry);
	const layoutKey = nativeKey(collection);
	captureReactionLayoutItems(layoutEntry);
	const reactions = Array.isArray(messageContext.message.reactions)
		? messageContext.message.reactions
		: [];
	const renderAvatars = shouldRenderReactionAvatars(reactions.length);
	const visibleKeys = new Set<string>();
	for (const collectionCell of visibleCells) {
		const index = itemForCollectionCell(collection, collectionCell);
		if (index === undefined) continue;
		if (!layoutEntry.baseItems.has(index)) {
			const frame = fabric.measure(collectionCell);
			captureReactionLayoutItem(layoutEntry, index, {
				origin: { x: frame.x, y: frame.y },
				size: { height: frame.height, width: frame.width },
			});
		}
		const reactionView = reactionViewForCollectionCell(collectionCell);
		if (!reactionView) continue;
		const reaction = reactions[index];
		const context =
			reaction && renderAvatars
				? reactionContextForMessage(
						messageContext.message,
						messageContext.channelId,
						reaction,
					)
				: null;
		const key = nativeKey(reactionView);
		visibleKeys.add(key);
		syncReactionView(
			cellKey,
			layoutKey,
			index,
			collectionCell,
			reactionView,
			context,
			messageContext.message,
		);
		const state = reactionStates.get(key);
		if (state?.surface) updateSurfaceFrame(state);
	}
	for (const [key, state] of reactionStates) {
		if (state.cellKey === cellKey && !visibleKeys.has(key)) {
			disposeReactionState(key, state, false);
		}
	}
	applyReactionLayout(layoutEntry);
}

function cleanupCellReactions(cellKey: string, preserveLayout: boolean = false): void {
	activeCells.delete(cellKey);
	lastCellScans.delete(cellKey);
	for (const [key, state] of reactionStates) {
		if (state.cellKey !== cellKey) continue;
		disposeReactionState(key, state, !preserveLayout);
	}
	if (preserveLayout) return;
	for (const [key, entry] of reactionLayouts) {
		if (entry.ownerCellKey !== cellKey) continue;
		restoreReactionLayoutEntry(entry);
		reactionLayouts.delete(key);
	}
}

function scheduleCell(cell: NativeObjectHandle, force: boolean = false): void {
	const key = nativeKey(cell);
	activeCells.set(key, cell);
	const now = Date.now();
	if (!force && now - (lastCellScans.get(key) ?? 0) < CELL_SCAN_INTERVAL) return;
	if (scheduledCells.has(key)) {
		if (force) pendingForcedCells.add(key);
		return;
	}
	scheduledCells.add(key);
	const token = lifecycle;
	setTimeout(() => {
		const bridge = objc;
		if (token !== lifecycle || !bridge) {
			scheduledCells.delete(key);
			return;
		}
		void (async () => {
			const viewModel = bridge.getIvar(cell, 'viewModel') as NativeObjectHandle | null;
			const info = await readNativeMessageInfo(cell, bridge, selectedChannelId);
			const resolvedInfo = info?.channelId
				? { channelId: info.channelId, messageId: info.messageId }
				: undefined;
			const views = resolvedInfo ? await readReactionCellViews(cell, bridge) : undefined;
			if (resolvedInfo && viewModel) {
				const currentViewModel = bridge.getIvar(
					cell,
					'viewModel',
				) as NativeObjectHandle | null;
				if (
					!currentViewModel ||
					!(await bridge.invokeAsync(viewModel, 'isEqual:', [currentViewModel]))
				)
					return;
			}
			if (token !== lifecycle || objc !== bridge || !activeCells.has(key)) return;
			lastCellScans.set(key, Date.now());
			updateCell(cell, resolvedInfo, views);
		})()
			.catch(() => undefined)
			.finally(() => {
				if (token !== lifecycle) return;
				scheduledCells.delete(key);
				if (!pendingForcedCells.delete(key)) return;
				const currentCell = activeCells.get(key);
				if (currentCell) scheduleCell(currentCell, true);
			});
	}, 0);
}

async function scanVisibleReactionCells(): Promise<number> {
	if (!objc) return 0;
	const bridge = objc;
	const applicationClass = bridge.getClass('UIApplication');
	if (!applicationClass) return 0;
	const token = lifecycle;
	const revision = ++visibleScanRevision;
	const channelId = selectedChannelId();
	try {
		const values = await bridge.batch([
			{ target: applicationClass, selector: 'sharedApplication', args: [] },
			{ target: { $nativeBatchResult: 0 }, selector: 'windows', args: [] },
			{ target: { $nativeBatchResult: 0 }, selector: 'keyWindow', args: [] },
		]);
		if (
			token !== lifecycle ||
			revision !== visibleScanRevision ||
			channelId !== selectedChannelId()
		)
			return 0;
		const windows = nativeArray(values[1]);
		const keyWindow = values[2] as NativeObjectHandle | null;
		if (keyWindow && !windows.some((window) => nativeKey(window) === nativeKey(keyWindow))) {
			windows.push(keyWindow);
		}
		const cells = new Map<string, NativeObjectHandle>();
		for (const window of windows) {
			const found = await bridge.findViews(window, 'DCDMessageTableViewCell', {
				maxDepth: MAX_VISIBLE_CELL_SCAN_DEPTH,
				maxVisited: MAX_VISIBLE_CELL_SCAN_NODES,
				maxResults: 256,
				attachedOnly: true,
				stopAtMatch: true,
			});
			if (
				token !== lifecycle ||
				revision !== visibleScanRevision ||
				channelId !== selectedChannelId()
			)
				return 0;
			for (const cell of found) cells.set(nativeKey(cell), cell);
		}
		for (const cell of cells.values()) scheduleCell(cell, true);
		return cells.size;
	} catch {
		return 0;
	}
}

function onReactionChange(event: AnyRecord): void {
	const messageId = stringValue(property(event, 'messageId'), property(event, 'message_id'));
	if (!messageId) return;
	const channelId = stringValue(property(event, 'channelId'), property(event, 'channel_id'));
	userCache.invalidateMessage(messageId, channelId ?? undefined);
	scheduleReactionLayoutRefresh(messageId, channelId ?? undefined);
	const states = [...reactionStates.values()].filter(
		(state) =>
			state.context.messageId === messageId &&
			(!channelId || state.context.channelId === channelId),
	);
	for (const state of states) {
		state.requestGeneration++;
		state.loading = false;
		loadReactionUsers(state);
		const cell = activeCells.get(state.cellKey);
		if (cell) scheduleCell(cell, true);
	}
}

function onConnectionOpen(): void {
	userCache.clear();
	for (const state of reactionStates.values()) {
		state.requestGeneration++;
		state.loading = false;
		loadReactionUsers(state);
		const cell = activeCells.get(state.cellKey);
		if (cell) scheduleCell(cell, true);
	}
}

function onSelectedChannelChange(): void {
	const nextChannelId = selectedChannelId();
	if (!shouldHandleChannelChange(currentSelectedChannelId, nextChannelId)) return;
	currentSelectedChannelId = nextChannelId;
	visibleScanRevision++;
	for (const timeout of channelScanTimeouts) clearTimeout(timeout);
	channelScanTimeouts = [];
	for (const timeout of reactionLayoutRefreshes.values()) clearTimeout(timeout);
	reactionLayoutRefreshes.clear();
	for (const [key, state] of reactionStates) {
		disposeReactionState(key, state, true);
	}
	for (const [key, entry] of reactionLayouts) {
		restoreReactionLayoutEntry(entry);
		reactionLayouts.delete(key);
	}
	activeCells.clear();
	lastCellScans.clear();
	userCache.cancelQueuedOutsideChannel(selectedChannelId());
	const token = lifecycle;
	for (const delay of [100, 500, 1_500, 3_000]) {
		const timeout = setTimeout(() => {
			channelScanTimeouts = channelScanTimeouts.filter((candidate) => candidate !== timeout);
			if (token !== lifecycle || !activated) return;
			userCache.cancelQueuedOutsideChannel(selectedChannelId());
			void scanVisibleReactionCells();
		}, delay);
		channelScanTimeouts.push(timeout);
	}
}

function installReactionEventListeners(): void {
	for (const event of REACTION_EVENTS) dispatcher?.subscribe?.(event, onReactionChange);
	dispatcher?.subscribe?.('CONNECTION_OPEN', onConnectionOpen);
	currentSelectedChannelId = selectedChannelId();
	selectedChannel?.addChangeListener?.(onSelectedChannelChange);
}

function removeReactionEventListeners(): void {
	if (dispatcher?.unsubscribe) {
		for (const event of REACTION_EVENTS) dispatcher.unsubscribe(event, onReactionChange);
		dispatcher.unsubscribe('CONNECTION_OPEN', onConnectionOpen);
	}
	selectedChannel?.removeChangeListener?.(onSelectedChannelChange);
	for (const timeout of channelScanTimeouts) clearTimeout(timeout);
	channelScanTimeouts = [];
	for (const timeout of reactionLayoutRefreshes.values()) clearTimeout(timeout);
	reactionLayoutRefreshes.clear();
}

function installNativeHooks(): boolean {
	if (!objc || !fabric || hooks.length > 0) return hooks.length > 0;
	const installed: NativeHookToken[] = [];
	try {
		installed.push(
			objc.hook('DCDMessageTableViewCell', 'didMoveToWindow', {
				after: ({ self }: { self: NativeObjectHandle }) => {
					const bridge = objc;
					const token = lifecycle;
					if (!bridge) return;
					void bridge
						.invokeAsync(self, 'window', [])
						.then((window) => {
							if (token !== lifecycle || objc !== bridge) return;
							const action = reactionCellLifecycleAction(Boolean(window), false);
							if (action === 'render') scheduleCell(self, true);
						})
						.catch(() => undefined);
				},
			}),
		);
		installed.push(
			objc.hook('DCDMessageTableViewCell', 'prepareForReuse', {
				after: ({ self }: { self: NativeObjectHandle }) => {
					const action = reactionCellLifecycleAction(false, true);
					if (action === 'dispose') cleanupCellReactions(nativeKey(self));
					scheduleCell(self, true);
				},
			}),
		);
		installed.push(
			objc.hook('DCDMessageTableViewCell', 'layoutSubviews', {
				after: ({ self }: { self: NativeObjectHandle }) => scheduleCell(self),
			}),
		);
		hooks.push(...installed);
		return true;
	} catch {
		for (const hook of installed) hook.remove();
		return false;
	}
}

function dependenciesReady(): boolean {
	return Boolean(
		objc &&
		fabric &&
		reactionActions?.getReactors &&
		messages?.getMessage &&
		dispatcher?.dispatch &&
		users?.getUser &&
		channels?.getChannel &&
		userSummaryItem,
	);
}

function activate(): void {
	if (activated) return;
	if (!dependenciesReady() || !registerSurface() || !installNativeHooks()) return;
	configureReactionAvatarSurface(userSummaryItem, users);
	installReactionEventListeners();
	activated = true;
	clearModuleListener();
	const token = lifecycle;
	setTimeout(() => {
		if (token !== lifecycle || !activated) return;
		void scanVisibleReactionCells();
	}, 0);
}

function captureCandidate(candidate: unknown): void {
	if (!record(candidate) && typeof candidate !== 'function') return;
	const value = candidate as AnyRecord;
	if (!messages && isMessageStoreCandidate(candidate)) messages = value as MessageStore;
}

function modulePath(id: number | string): string | undefined {
	return ((globalThis as AnyRecord).window as RuntimeWindow).modules?.get(id)?.__filePath;
}

function captureLoadedModule(module: unknown, id: number | string): void {
	if (!record(module) && typeof module !== 'function') return;
	const value = module as AnyRecord;
	const path = modulePath(id);
	if (path === REACTION_ACTIONS_PATH) reactionActions = value as ReactionActions;
	captureCandidate(value);
	captureCandidate(value.default);
	if (dependenciesReady()) activate();
}

function captureInitializedModules(): void {
	const modules = ((globalThis as AnyRecord).window as RuntimeWindow).modules;
	if (!modules) return;
	for (const [id, module] of modules) {
		if (!module.isInitialized) continue;
		captureLoadedModule(module.publicModule?.exports, id);
		if (dependenciesReady()) return;
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
	reactionActions =
		(metro.findByFilePath(REACTION_ACTIONS_PATH, {
			interop: false,
		}) as ReactionActions | null) ?? reactionActions;
	messages =
		(metro.findByProps('_dispatcher', 'getName', 'getMessage') as MessageStore | null) ??
		messages;
	dispatcher = (metro.findByProps('dispatch', 'subscribe') as Dispatcher | null) ?? dispatcher;
	users = (metro.findByProps('getUser', 'getCurrentUser') as UserStore | null) ?? users;
	channels = (metro.findByProps('getChannel') as ChannelStore | null) ?? channels;
	selectedChannel =
		(metro.findByProps('getChannelId', 'getLastSelectedChannelId') as SelectedChannel | null) ??
		selectedChannel;
	userSummaryItem = userSummaryComponent() ?? userSummaryItem;
	captureInitializedModules();
	activate();
}

function start(context?: PluginContext): void {
	stop();
	lifecycle++;
	objc = context?.native.objc ?? null;
	fabric = context?.native.fabric ?? null;
	activated = false;
	initialize();
}

function stop(): void {
	lifecycle++;
	activated = false;
	removeReactionEventListeners();
	clearModuleListener();
	for (const hook of hooks.splice(0)) hook.remove();
	for (const timeout of reactionLayoutRefreshes.values()) clearTimeout(timeout);
	reactionLayoutRefreshes.clear();
	for (const [key, state] of reactionStates) disposeReactionState(key, state, true);
	for (const table of reactionTableLayouts.values()) restoreReactionTableLayout(table);
	reactionCellSizeHook?.remove();
	reactionCellSizeHook = null;
	reactionCellSizes.clear();
	reactionLayouts.clear();
	reactionTableLayouts.clear();
	activeCells.clear();
	scheduledCells.clear();
	pendingForcedCells.clear();
	lastCellScans.clear();
	userCache.clear();
	clearReactionAvatarSurfaceStates();
	reactionActions = null;
	messages = null;
	dispatcher = null;
	users = null;
	channels = null;
	selectedChannel = null;
	currentSelectedChannelId = undefined;
	userSummaryItem = null;
	objc = null;
	fabric = null;
	surfaceModuleName = '';
}

export default { start, stop };
