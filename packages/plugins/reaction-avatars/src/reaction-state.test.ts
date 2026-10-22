import { describe, expect, mock, test } from 'bun:test';

import {
	hydrateReactorsInOrder,
	isCurrentReactionRequest,
	ReactionUserCache,
	type Reactor,
	reactionAncestorHeightDelta,
	reactionAvatarExtraWidth,
	reactionAvatarFrame,
	reactionAvatarKey,
	reactionAvatarPrefix,
	reactionAvatarPresentation,
	reactionAvatarReservedExtraWidth,
	reactionAvatarReservedSlotCount,
	reactionAvatarSelection,
	reactionAvatarStackPositions,
	reactionAvatarStackWidth,
	reactionAvatarSummaryProps,
	reactionBaseViewWidth,
	reactionCellHeightFloor,
	reactionCellLifecycleAction,
	reactionCellWidth,
	reactionLayoutFrameMatches,
	reactionLayoutIdentityChanged,
	reactionLayoutNeedsInvalidation,
	reflowReactionItems,
	shouldHandleChannelChange,
	shouldMeasureReactionAvatarWidth,
	shouldRenderReactionAvatars,
} from '@reaction-avatars/reaction-state';

type ElementTree = {
	children: unknown[];
	props: Record<string, unknown> | null;
	type: unknown;
};
type PropagationEvent = {
	stopPropagation: () => void;
};
function createElement(
	type: unknown,
	props?: Record<string, unknown> | null,
	...children: unknown[]
): ElementTree {
	return { children, props: props ?? null, type };
}

function asElementTree(value: unknown): ElementTree {
	return value as ElementTree;
}

const ReactNative = { Text: 'Text', View: 'View' };

mock.module('@unbound-app/api', () => ({
	metro: { common: { React: { createElement }, ReactNative } },
}));

const {
	clearReactionAvatarSurfaceStates,
	configureReactionAvatarSurface,
	ReactionAvatarSurface,
	setReactionAvatarSurfaceState,
} = await import('@reaction-avatars/reaction-surface');

describe('reaction avatar state', () => {
	test('selects normal and burst reactor requests independently', () => {
		const reaction = { burst_count: 3, count: 9, count_details: { burst: 3, normal: 6 } };

		expect(reactionAvatarSelection(reaction, 0)).toEqual({ count: 6, types: [0] });
		expect(reactionAvatarSelection(reaction, 1)).toEqual({ count: 3, types: [1] });
		expect(reactionAvatarSelection(reaction)).toEqual({ count: 9, types: [0, 1] });
	});

	test('falls back to reaction totals when split counts are absent', () => {
		expect(reactionAvatarSelection({ burst_count: 2, count: 8 })).toEqual({
			count: 8,
			types: [0, 1],
		});
	});

	test('keeps reactor request keys distinct by channel, message, emoji, and type', () => {
		const emoji = { id: 'custom:emoji', name: 'wave' };

		expect(reactionAvatarKey('channel', 'message', emoji, [0])).not.toBe(
			reactionAvatarKey('channel', 'message', emoji, [1]),
		);
		expect(reactionAvatarKey('channel', 'message', emoji, [0])).not.toBe(
			reactionAvatarKey('another-channel', 'message', emoji, [0]),
		);
	});

	test('preserves API order when hydrating the avatar stack', () => {
		const cachedUsers = new Map<string, Reactor>([
			['first', { id: 'first', username: 'First' }],
			['second', { id: 'second', username: 'Second' }],
		]);
		const reactors: Reactor[] = [{ id: 'first' }, { id: 'second' }];

		expect(hydrateReactorsInOrder(reactors, (id) => cachedUsers.get(id))).toEqual([
			{ id: 'first', username: 'First' },
			{ id: 'second', username: 'Second' },
		]);
	});

	test('rejects reactor results from an earlier reaction generation', () => {
		expect(isCurrentReactionRequest('reaction', 'reaction', 4, 4)).toBe(true);
		expect(isCurrentReactionRequest('reaction', 'reaction', 4, 5)).toBe(false);
		expect(isCurrentReactionRequest('previous', 'reaction', 5, 5)).toBe(false);
	});

	test('ignores selected-channel notifications without a selected channel change', () => {
		expect(shouldHandleChannelChange('channel', 'channel')).toBe(false);
		expect(shouldHandleChannelChange('channel', 'another-channel')).toBe(true);
		expect(shouldHandleChannelChange('channel', undefined)).toBe(false);
	});

	test('preserves detached reaction surfaces until cell reuse', () => {
		expect(reactionCellLifecycleAction(false, false)).toBe('preserve');
		expect(reactionCellLifecycleAction(true, false)).toBe('render');
		expect(reactionCellLifecycleAction(false, true)).toBe('dispose');
	});

	test('passes avatar order and max count to the Vencord summary component', () => {
		const users = Array.from({ length: 8 }, (_, index) => ({ id: String(index) }));

		expect(reactionAvatarSummaryProps(users, 'guild')).toEqual({
			guildId: 'guild',
			max: 5,
			renderIcon: false,
			showDefaultAvatarsForNullUsers: true,
			showUserPopout: true,
			users,
		});
	});

	test('renders individually stacked summaries with a centered three-digit overflow badge', () => {
		const users = Array.from({ length: 108 }, (_, index) => ({ id: String(index) }));
		const summaryComponent = { name: 'UserSummaryItem' };
		const onWidth = mock();
		configureReactionAvatarSurface(summaryComponent, { getUser: (id) => ({ id }) });
		setReactionAvatarSurfaceState('surface', {
			guildId: 'guild',
			height: 30,
			measured: false,
			onWidth,
			totalCount: 108,
			users,
			width: 43,
		});

		try {
			const root = asElementTree(
				ReactionAvatarSurface({ revision: 1, surfaceId: 'surface' }),
			);
			const rootStyle = (root.props as Record<string, unknown>).style as Record<
				string,
				unknown
			>;
			const rootProps = root.props as Record<string, unknown>;
			const stack = root.children[0] as ElementTree;
			const stackProps = stack.props as Record<string, unknown>;
			const stackStyle = stackProps.style as Record<string, unknown>;
			const avatars = stack.children.slice(0, 5) as ElementTree[];
			const overflow = stack.children[5] as ElementTree;
			const overflowStyle = (overflow.props as Record<string, unknown>).style as Record<
				string,
				unknown
			>;
			const text = overflow.children[0] as ElementTree;
			expect(rootStyle).toMatchObject({
				alignItems: 'flex-start',
				height: 30,
				justifyContent: 'center',
				marginLeft: 0,
				transform: [{ scale: 0.9 }],
			});
			expect(stackStyle).toMatchObject({ height: 18, justifyContent: 'center', width: 43 });
			expect(avatars).toHaveLength(5);
			for (const [index, avatar] of avatars.entries()) {
				const avatarStyle = avatar.props?.style as Record<string, unknown>;
				const summary = avatar.children[0] as ElementTree;
				const props = summary.props as Record<string, unknown>;
				expect(avatarStyle).toMatchObject({
					height: 18,
					left: index * 5,
					position: 'absolute',
					top: 0,
					width: 18,
					zIndex: index + 1,
				});
				expect(summary.type).toBe(summaryComponent);
				expect(props.max).toBe(1);
				expect(props.users).toEqual([users[index]]);
				expect(props.guildId).toBe('guild');
			}
			expect(stack.children).toHaveLength(6);
			const onLayout = stackProps.onLayout as (event: {
				nativeEvent: { layout: { width: number } };
			}) => void;
			onLayout({ nativeEvent: { layout: { width: 43 } } });
			expect(onWidth).toHaveBeenCalledWith(43);
			for (const key of ['onClick', 'onKeyDown']) {
				const stopPropagation = mock();
				const handler = rootProps[key] as (event: PropagationEvent) => void;
				handler({ stopPropagation });
				expect(stopPropagation).toHaveBeenCalledTimes(1);
			}
			expect(overflow.type).toBe('View');
			expect(overflowStyle).toMatchObject({
				backgroundColor: '#000',
				borderRadius: 9,
				height: 18,
				left: 25,
				justifyContent: 'center',
				position: 'absolute',
				zIndex: 6,
				width: 18,
			});
			expect(text.type).toBe('Text');
			expect(text.props).toMatchObject({
				adjustsFontSizeToFit: true,
				includeFontPadding: false,
				minimumFontScale: 0.5,
				numberOfLines: 1,
			});
			expect((text.props as Record<string, unknown>).style).toMatchObject({
				fontSize: 8,
				height: 18,
				lineHeight: 18,
				textAlign: 'center',
				width: 18,
			});
			expect(text.children[0]).toBe('+103');
		} finally {
			clearReactionAvatarSurfaceStates();
		}
	});

	test('renders each visible user in an overlapping summary layer', () => {
		const users = Array.from({ length: 5 }, (_, index) => ({ id: String(index) }));
		configureReactionAvatarSurface({ name: 'UserSummaryItem' }, { getUser: (id) => ({ id }) });
		setReactionAvatarSurfaceState('surface', {
			height: 30,
			measured: false,
			onWidth: () => void 0,
			totalCount: 5,
			users,
			width: 74,
		});

		try {
			const root = asElementTree(
				ReactionAvatarSurface({ revision: 1, surfaceId: 'surface' }),
			);
			const stack = root.children[0] as ElementTree;
			expect(stack.children).toHaveLength(5);
			for (const [index, avatar] of stack.children.entries()) {
				const summary = (avatar as ElementTree).children[0] as ElementTree;
				expect(summary.props?.max).toBe(1);
				expect(summary.props?.users).toEqual([users[index]]);
			}
		} finally {
			clearReactionAvatarSurfaceStates();
		}
	});

	test('preserves the full reactor list for the native avatar stack', () => {
		const users = Array.from({ length: 8 }, (_, index) => ({ id: String(index) }));

		expect(reactionAvatarPresentation(users)).toEqual({
			overflowCount: 3,
			slotCount: 6,
			users,
		});
	});

	test('uses the message reaction count to reserve the overflow slot before users load', () => {
		expect(reactionAvatarReservedSlotCount(0)).toBe(0);
		expect(reactionAvatarReservedSlotCount(3)).toBe(3);
		expect(reactionAvatarReservedSlotCount(5)).toBe(5);
		expect(reactionAvatarReservedSlotCount(6)).toBe(6);
		expect(reactionAvatarReservedSlotCount(100)).toBe(6);
	});

	test('derives the overflow badge from the loaded reactor list', () => {
		const users = Array.from({ length: 100 }, (_, index) => ({ id: String(index) }));

		expect(reactionAvatarPresentation(users)).toEqual({
			overflowCount: 95,
			slotCount: 6,
			users,
		});
	});

	test('does not invent an overflow slot beyond the loaded reactor list', () => {
		const users = Array.from({ length: 5 }, (_, index) => ({ id: String(index) }));

		expect(reactionAvatarPresentation(users)).toEqual({
			overflowCount: 0,
			slotCount: 5,
			users,
		});
	});

	test('does not invalidate intrinsic layout when geometry is unchanged', () => {
		expect(
			reactionLayoutNeedsInvalidation(
				{ contentHeight: 136, frameHeight: 136 },
				{ contentHeight: 136, frameHeight: 136 },
			),
		).toBe(false);
	});

	test('invalidates intrinsic layout when collection geometry changes', () => {
		expect(
			reactionLayoutNeedsInvalidation(
				{ contentHeight: 136, frameHeight: 136 },
				{ contentHeight: 374, frameHeight: 374 },
			),
		).toBe(true);
	});

	test('keeps the reaction list as tall as its reflowed collection', () => {
		expect(reactionAncestorHeightDelta(306, 170)).toBe(136);
		expect(reactionAncestorHeightDelta(170, 170)).toBe(0);
		expect(reactionAncestorHeightDelta(136, 170)).toBe(0);
	});

	test('shares one row-height reservation across reaction-list duplicates', () => {
		expect(reactionCellHeightFloor([741, 741])).toBe(741);
		expect(reactionCellHeightFloor([337, 741])).toBe(741);
		expect(reactionCellHeightFloor([])).toBe(0);
	});

	test('resets a reused reaction collection when its message changes', () => {
		const previous = { itemCount: 12, messageKey: 'channel-a:message-a', ownerCellKey: 'cell' };

		expect(
			reactionLayoutIdentityChanged(previous, {
				...previous,
				messageKey: 'channel-b:message-b',
			}),
		).toBe(true);
		expect(
			reactionLayoutIdentityChanged(previous, {
				...previous,
				itemCount: 13,
			}),
		).toBe(true);
		expect(
			reactionLayoutIdentityChanged(previous, {
				...previous,
				ownerCellKey: 'another-cell',
			}),
		).toBe(true);
		expect(reactionLayoutIdentityChanged(previous, previous)).toBe(false);
	});

	test('detects when native layout replaces an expanded reaction cell frame', () => {
		const expanded = { height: 34, width: 67.5, x: 0, y: 0 };
		const restored = { height: 34, width: 49.5, x: 0, y: 0 };

		expect(reactionLayoutFrameMatches(expanded, expanded)).toBe(true);
		expect(reactionLayoutFrameMatches(restored, expanded)).toBe(false);
		expect(reactionLayoutFrameMatches(undefined, expanded)).toBe(false);
	});

	test('reserves no overflow slot for five or fewer reactors', () => {
		const users = Array.from({ length: 5 }, (_, index) => ({ id: String(index) }));

		expect(reactionAvatarPresentation(users)).toEqual({
			overflowCount: 0,
			slotCount: 5,
			users,
		});
	});

	test('keeps avatar overlap compact and sizes the overflow slot from the same step', () => {
		expect(reactionAvatarStackPositions(6)).toEqual([0, 5, 10, 15, 20, 25]);
		expect(reactionAvatarStackWidth(4)).toBe(33);
		expect(reactionAvatarStackWidth(6)).toBe(43);
	});

	test('reserves the avatar width before the asynchronous surface measurement', () => {
		expect(reactionAvatarExtraWidth(33, 4, 4, false)).toBe(0);
		expect(reactionAvatarExtraWidth(33, 4, 4, true)).toBe(33);
		expect(reactionAvatarReservedExtraWidth(0, 4, 4)).toBe(0);
		expect(reactionAvatarReservedExtraWidth(1, 4, 4)).toBe(18);
		expect(reactionAvatarReservedExtraWidth(5, 4, 4)).toBe(38);
		expect(reactionAvatarReservedExtraWidth(6, 4, 4)).toBe(43);
	});

	test('commits the first measured width even when it matches the predicted width', () => {
		expect(shouldMeasureReactionAvatarWidth(false, 33, 33)).toBe(true);
		expect(shouldMeasureReactionAvatarWidth(false, 33, 34)).toBe(true);
		expect(shouldMeasureReactionAvatarWidth(true, 33, 33)).toBe(false);
		expect(shouldMeasureReactionAvatarWidth(true, 33, 34)).toBe(false);
	});

	test('does not let native layout measurements shrink the reserved avatar width', () => {
		expect(shouldMeasureReactionAvatarWidth(false, 43, 38)).toBe(false);
		expect(shouldMeasureReactionAvatarWidth(true, 43, 38)).toBe(false);
	});

	test('keeps avatar summaries enabled on high-reaction messages', () => {
		expect(shouldRenderReactionAvatars(0)).toBe(false);
		expect(shouldRenderReactionAvatars(10)).toBe(true);
		expect(shouldRenderReactionAvatars(20)).toBe(true);
		expect(shouldRenderReactionAvatars(100)).toBe(true);
	});

	test('expands reaction collection cells from their original width without accumulating extras', () => {
		const baseWidth = 58;
		const extraWidth = 80;

		expect(reactionCellWidth(baseWidth, extraWidth)).toBe(138);
		expect(reactionCellWidth(baseWidth, 0)).toBe(baseWidth);
	});

	test('recovers the original reaction view width after native cell reuse', () => {
		expect(reactionBaseViewWidth(47.5, 47.5, 43.5)).toBe(43.5);
		expect(reactionBaseViewWidth(47.5, 65.5, 61.5)).toBe(43.5);
		expect(reactionBaseViewWidth(47.5, 83.5, 79.5)).toBe(43.5);
	});

	test('places the avatar surface after the reaction pill instead of over it', () => {
		const frame = reactionAvatarFrame({ width: 54, x: 0 }, 80);

		expect(frame).toEqual({ x: 54, width: 80 });
		expect(reactionAvatarFrame({ width: 54, x: 12 }, 80)).toEqual({ x: 66, width: 80 });
		expect(reactionAvatarFrame({ width: 54, x: 0 }, 80, 4)).toEqual({ x: 50, width: 80 });
	});

	test('reflows expanded reaction pills before they overlap neighboring pills', () => {
		const frames = reflowReactionItems(
			[
				{ height: 34, index: 2, width: 70, x: 140, y: 0 },
				{ extraWidth: 60, height: 34, index: 1, width: 70, x: 70, y: 0 },
				{ height: 34, index: 0, width: 70, x: 0, y: 0 },
				{ height: 34, index: 3, width: 70, x: 0, y: 34 },
			],
			220,
		);

		expect(frames).toEqual([
			{ height: 34, index: 0, width: 70, x: 0, y: 0 },
			{ height: 34, index: 1, width: 130, x: 70, y: 0 },
			{ height: 34, index: 2, width: 70, x: 0, y: 34 },
			{ height: 34, index: 3, width: 70, x: 70, y: 34 },
		]);
	});

	test('keeps the add-reaction cell after the widened final reaction pill', () => {
		const frames = reflowReactionItems(
			[
				{ extraWidth: 18, height: 34, index: 0, width: 49.5, x: 0, y: 0 },
				{ height: 34, index: 1, width: 38, x: 49.5, y: 0 },
			],
			291,
		);

		expect(frames).toEqual([
			{ height: 34, index: 0, width: 67.5, x: 0, y: 0 },
			{ height: 34, index: 1, width: 38, x: 67.5, y: 0 },
		]);
		expect(frames[0].x + frames[0].width).toBeLessThanOrEqual(frames[1].x);
	});

	test('keeps the add-reaction cell clear when a message gets its first reaction', () => {
		const frames = reflowReactionItems(
			[
				{
					extraWidth: reactionAvatarReservedExtraWidth(1, 4, 4),
					height: 34,
					index: 0,
					width: 49.5,
					x: 0,
					y: 0,
				},
				{ height: 34, index: 1, width: 34, x: 49.5, y: 0 },
			],
			291,
		);

		expect(frames[0].width).toBe(67.5);
		expect(frames[1].x).toBe(67.5);
		expect(frames[0].x + frames[0].width).toBeLessThanOrEqual(frames[1].x);
	});

	test('reflows a twenty-reaction stress grid with avatar stacks inside the viewport width', () => {
		const frames = reflowReactionItems(
			Array.from({ length: 20 }, (_, index) => ({
				extraWidth: 47,
				height: 30,
				index,
				width: 70,
				x: (index % 5) * 76,
				y: Math.floor(index / 5) * 38,
			})),
			350,
		);
		const rows = new Map<number, typeof frames>();

		for (const frame of frames) {
			rows.set(frame.y, [...(rows.get(frame.y) ?? []), frame]);
			expect(frame.x + frame.width).toBeLessThanOrEqual(350);
		}

		expect(frames).toHaveLength(20);
		expect(rows.size).toBe(10);
		for (const row of rows.values()) {
			for (let index = 1; index < row.length; index++) {
				expect(row[index - 1].x + row[index - 1].width).toBeLessThanOrEqual(row[index].x);
			}
		}
	});

	test('invalidates every emoji and reaction type for a message', () => {
		const prefix = reactionAvatarPrefix('channel', 'message');
		expect(prefix).toBe('channel:message:');
		expect(
			reactionAvatarKey('channel', 'message', { id: 'emoji', name: 'wave' }, [0]).startsWith(
				prefix,
			),
		).toBe(true);
	});

	test('invalidates all cached reactions for one message without clearing other messages', async () => {
		const cache = new ReactionUserCache<Reactor>();
		const affectedNormal = reactionAvatarKey(
			'channel',
			'message',
			{ id: 'emoji', name: 'wave' },
			[0],
		);
		const affectedBurst = reactionAvatarKey(
			'channel',
			'message',
			{ id: 'emoji', name: 'wave' },
			[1],
		);
		const unrelated = reactionAvatarKey(
			'channel',
			'another-message',
			{ id: 'emoji', name: 'wave' },
			[0],
		);
		const load = async () => [{ id: 'user' }];

		await Promise.all([
			cache.load(affectedNormal, load),
			cache.load(affectedBurst, load),
			cache.load(unrelated, load),
		]);
		cache.invalidateMessage('message', 'channel');

		expect(cache.get(affectedNormal)).toBeUndefined();
		expect(cache.get(affectedBurst)).toBeUndefined();
		expect(cache.get(unrelated)).toEqual([{ id: 'user' }]);

		cache.invalidateMessage('another-message');

		expect(cache.get(unrelated)).toBeUndefined();
	});

	test('deduplicates reactor requests and keeps cached results in recent-use order', async () => {
		const cache = new ReactionUserCache<Reactor>(2, 1, 1000);
		const load = mock(async () => [{ id: 'user' }]);

		const [first, second] = await Promise.all([
			cache.load('first', load),
			cache.load('first', load),
		]);
		expect(load).toHaveBeenCalledTimes(1);
		expect(first).toEqual(second);
		expect(cache.get('first')).toEqual([{ id: 'user' }]);
	});

	test('serializes reactor requests when configured for Vencord ordering', async () => {
		const cache = new ReactionUserCache<Reactor>(4, 1, 1000);
		let completeFirst: ((users: Reactor[]) => void) | undefined;
		const firstLoad = mock(
			() =>
				new Promise<Reactor[]>((resolve) => {
					completeFirst = resolve;
				}),
		);
		const secondLoad = mock(async () => [{ id: 'second' }]);
		const firstRequest = cache.load('first', firstLoad);
		const secondRequest = cache.load('second', secondLoad);

		await Promise.resolve();
		expect(firstLoad).toHaveBeenCalledTimes(1);
		expect(secondLoad).not.toHaveBeenCalled();

		completeFirst?.([{ id: 'first' }]);
		expect(await firstRequest).toEqual([{ id: 'first' }]);
		expect(await secondRequest).toEqual([{ id: 'second' }]);
		expect(secondLoad).toHaveBeenCalledTimes(1);
	});

	test('loads visible reactor requests in bounded parallel batches', async () => {
		const cache = new ReactionUserCache<Reactor>(10, 3, 1000);
		let active = 0;
		let maximumActive = 0;
		const load = async (id: string) => {
			active++;
			maximumActive = Math.max(maximumActive, active);
			await Promise.resolve();
			active--;
			return [{ id }];
		};

		await Promise.all(
			['first', 'second', 'third', 'fourth', 'fifth'].map((id) =>
				cache.load(id, () => load(id)),
			),
		);

		expect(maximumActive).toBe(3);
	});

	test('drops queued requests from inactive channels without dropping the selected channel', async () => {
		const cache = new ReactionUserCache<Reactor>(10, 1, 1000);
		let completeActive: ((users: Reactor[]) => void) | undefined;
		const activeRequest = cache.load(
			'old-channel:active-message',
			() =>
				new Promise((resolve) => {
					completeActive = resolve;
				}),
		);
		await Promise.resolve();

		const staleLoad = mock(async () => [{ id: 'stale' }]);
		const staleRequest = cache.load('old-channel:queued-message', staleLoad);
		cache.cancelQueuedOutsideChannel('new-channel');
		const currentLoad = mock(async () => [{ id: 'current' }]);
		const currentRequest = cache.load('new-channel:visible-message', currentLoad);

		expect(await staleRequest).toEqual([]);
		expect(staleLoad).not.toHaveBeenCalled();

		completeActive?.([{ id: 'active' }]);
		await activeRequest;

		expect(await currentRequest).toEqual([{ id: 'current' }]);
		expect(currentLoad).toHaveBeenCalledTimes(1);
	});

	test('retries empty reactor results after a short cache period', async () => {
		const cache = new ReactionUserCache<Reactor>(10, 1, 60_000, 50);
		const initialLoad = mock(async () => []);
		const retryLoad = mock(async () => [{ id: 'user' }]);

		await cache.load('reaction', initialLoad);
		await cache.load('reaction', retryLoad, Date.now() + 51);

		expect(initialLoad).toHaveBeenCalledTimes(1);
		expect(retryLoad).toHaveBeenCalledTimes(1);
		expect(cache.get('reaction')).toEqual([{ id: 'user' }]);
	});

	test('does not reuse a stale in-flight request after reaction changes', async () => {
		const cache = new ReactionUserCache<Reactor>();
		let completeOld: ((users: Reactor[]) => void) | undefined;
		let completeCurrent: ((users: Reactor[]) => void) | undefined;
		const oldRequest = cache.load(
			'channel:message:emoji:0',
			() =>
				new Promise((resolve) => {
					completeOld = resolve;
				}),
		);

		await Promise.resolve();
		cache.invalidate('channel:message:');
		const currentRequest = cache.load(
			'channel:message:emoji:0',
			() =>
				new Promise((resolve) => {
					completeCurrent = resolve;
				}),
		);

		await Promise.resolve();
		completeOld?.([{ id: 'stale' }]);
		expect(await oldRequest).toEqual([]);
		expect(cache.get('channel:message:emoji:0')).toBeUndefined();

		completeCurrent?.([{ id: 'current' }]);
		await currentRequest;
		expect(cache.get('channel:message:emoji:0')).toEqual([{ id: 'current' }]);
	});

	test('clears pending and completed data when its plugin scope resets', async () => {
		const cache = new ReactionUserCache<Reactor>();
		let complete: ((users: Reactor[]) => void) | undefined;
		const request = cache.load(
			'first',
			() =>
				new Promise((resolve) => {
					complete = resolve;
				}),
		);

		await Promise.resolve();
		cache.clear();
		complete?.([{ id: 'user' }]);
		await request;

		expect(cache.get('first')).toBeUndefined();
	});
});
