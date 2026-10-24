import type {
	NativeFabricBridge,
	NativeHookToken,
	NativeObjCBridge,
	NativeObjectHandle,
	NativePluginBridge,
} from '@unbound-app/api/native';

import type { ReactionViewState } from '~/native/reaction-views';
import type { ReactionCellViews } from '~/native/cell-views';
import type { LayoutEntry } from '~/native/collections';
import type { CellHeight } from '~/native/cell-heights';
import type { TableLayout } from '~/native/tables';
import ReactionUserCache from '~/reactor-cache';
import type { Reactor } from '~/avatars';

export type MessageInfo = {
	channelId: string;
	messageId: string;
};

export type CellRenderer = (
	session: Session,
	cell: NativeObjectHandle,
	info: MessageInfo | undefined,
	views: ReactionCellViews | undefined,
) => void;

/** Everything one run of the plugin owns, from `start` to `stop`. */
export type Session = {
	objc: NativeObjCBridge;
	fabric: NativeFabricBridge;
	/** Aborted on `stop`, so timers and native calls still in flight from this run do nothing. */
	signal: AbortSignal;
	/** The registered `AppRegistry` name of the avatar stack's root component. */
	surfaceName: string;
	render: CellRenderer;
	reactors: ReactionUserCache<Reactor>;
	/** Message cells seen recently, by key, so a reaction change can re-render the one showing it. */
	cells: Map<string, NativeObjectHandle>;
	lastRenders: Map<string, number>;
	scheduledCells: Set<string>;
	/** Cells asked to render again, forcibly, while a render was already in flight. */
	forcedCells: Set<string>;
	/** Reaction pills that show an avatar stack, by their `ReactionView`'s key. */
	reactions: Map<string, ReactionViewState>;
	layouts: Map<string, LayoutEntry>;
	layoutRefreshes: Map<string, ReturnType<typeof setTimeout>>;
	tables: Map<string, TableLayout>;
	tableHooks: NativeHookToken[];
	cellHeights: Map<string, CellHeight>;
	sizeHook: NativeHookToken | null;
	/** Bumped to abandon a visible-cell scan that is still walking the windows. */
	scanRevision: number;
};

/**
 * @description Opens a session on the plugin's native bridge.
 * @param native The bridge from the plugin context.
 * @param surfaceName The registered name of the avatar stack's root component.
 * @param render Renders one message cell's avatars.
 * @returns The session, and `close`, which ends it so callbacks still in flight do nothing.
 */
export function createSession(
	native: NativePluginBridge,
	surfaceName: string,
	render: CellRenderer,
) {
	const controller = new AbortController();
	const session: Session = {
		objc: native.objc,
		fabric: native.fabric,
		signal: controller.signal,
		surfaceName,
		render,
		reactors: new ReactionUserCache<Reactor>(),
		cells: new Map(),
		lastRenders: new Map(),
		scheduledCells: new Set(),
		forcedCells: new Set(),
		reactions: new Map(),
		layouts: new Map(),
		layoutRefreshes: new Map(),
		tables: new Map(),
		tableHooks: [],
		cellHeights: new Map(),
		sizeHook: null,
		scanRevision: 0,
	};

	return { session, close: () => controller.abort() };
}

export default createSession;
