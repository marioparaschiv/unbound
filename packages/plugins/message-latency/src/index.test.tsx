import { afterEach, describe, expect, mock, test } from 'bun:test';

const rowGenerator = { generateMessageRowData: () => undefined };
interface TestMessage {
	author?: { bot?: boolean; id?: string };
	id?: unknown;
	nonce?: unknown;
}
interface TestRow {
	timestamp?: string;
	timestampAccessibilityLabel?: string;
	timestampTooltip?: string;
	username?: string;
}
interface TestPatchContext {
	args: Array<{ message?: TestMessage }>;
	result?: { message?: TestRow };
}
interface TestNativeContext {
	native: {
		objc: {
			hook: (
				className: string,
				selector: string,
			) => {
				active: boolean;
				remove: () => number;
			};
		};
	};
}
interface TestHookContext {
	self: object;
}
interface TestHookHandlers {
	before?: (context: TestHookContext) => void;
	after?: (context: TestHookContext) => void;
}
let patchCount = 0;
let unpatchCount = 0;
let removeListenerCount = 0;
let removeHookCount = 0;
let rowGeneratorAvailable = true;
let moduleListener: ((module: unknown, id: string) => void) | null = null;
let afterHandler: ((context: TestPatchContext) => unknown) | null = null;
let subscribedEvents: string[] = [];
let unsubscribedEvents: string[] = [];
let nativeHooks: Array<{ className: string; selector: string }> = [];

mock.module('@unbound-app/api', () => ({
	metro: {
		common: {
			ReactNative: { AppRegistry: { registerComponent: () => undefined } },
			Theme: {
				colors: {
					BACKGROUND_SURFACE_HIGHEST: '#222222',
					STATUS_DANGER: '#ff0000',
					STATUS_POSITIVE: '#00ff00',
					STATUS_WARNING: '#ffff00',
					TEXT_DEFAULT: '#ffffff',
					TEXT_MUTED: '#888888',
				},
				internal: { resolveSemanticColor: (_theme: string, color: string) => color },
				themes: { DARK: 'darker' },
			},
		},
		find: () => null,
		findByProps: (...props: string[]) => {
			if (props.includes('generateMessageRowData')) {
				return rowGeneratorAvailable ? rowGenerator : undefined;
			}
			if (props.includes('dispatch') && props.includes('subscribe')) {
				return {
					dispatch: () => undefined,
					subscribe: (event: string) => {
						subscribedEvents.push(event);
					},
					unsubscribe: (event: string) => {
						unsubscribedEvents.push(event);
					},
				};
			}
			if (props.includes('getCurrentUser')) return { getCurrentUser: () => ({ id: 'self' }) };
			return undefined;
		},
		addListener: (listener: (module: unknown, id: string) => void) => {
			moduleListener = listener;
			return () => {
				removeListenerCount++;
				return true;
			};
		},
	},
	patcher: {
		after: (
			_holder: object,
			_prop: string,
			callback: (context: TestPatchContext) => unknown,
		) => {
			patchCount++;
			afterHandler = callback;
			return () => unpatchCount++;
		},
	},
	storage: {
		getStore: () => ({
			get: (_key: string, fallback: unknown) => fallback,
			useSettingsStore: () => ({ get: (_key: string, fallback: unknown) => fallback }),
		}),
	},
}));
mock.module('@shared/settings-ui', () => ({
	getSettingsColors: () => ({}),
	SettingsCard: () => null,
	SettingsScrollView: () => null,
	SettingsSection: () => null,
	SettingsRow: () => null,
	SettingsSwitchRow: () => null,
}));

const {
	default: plugin,
	formatLatency,
	latencyDetails,
	latencyTooltip,
	messageFromCreateEvent,
	snowflakeTimestamp,
} = await import('@message-latency/index');

const DISCORD_EPOCH = 1_420_070_400_000;

afterEach(async () => {
	await plugin.stop();
	patchCount = 0;
	unpatchCount = 0;
	removeListenerCount = 0;
	removeHookCount = 0;
	rowGeneratorAvailable = true;
	moduleListener = null;
	afterHandler = null;
	subscribedEvents = [];
	unsubscribedEvents = [];
	nativeHooks = [];
});

function snowflake(timestamp: number): string {
	return (BigInt(timestamp - DISCORD_EPOCH) << 22n).toString();
}

function nativeContext(): TestNativeContext {
	return {
		native: {
			objc: {
				hook: (className: string, selector: string) => {
					nativeHooks.push({ className, selector });
					return { active: true, remove: () => removeHookCount++ };
				},
			},
		},
	};
}

describe('snowflake timestamps', () => {
	test('extracts the millisecond timestamp without relying on BigInt in the runtime', () => {
		const timestamp = DISCORD_EPOCH + 1_700_000_000_000;
		expect(snowflakeTimestamp(snowflake(timestamp))).toBe(timestamp);
	});

	test('rejects malformed and unsafe numeric values', () => {
		expect(snowflakeTimestamp('not-a-snowflake')).toBeNull();
		expect(snowflakeTimestamp(Number.MAX_SAFE_INTEGER + 1)).toBeNull();
	});
});

describe('message latency decisions', () => {
	const defaults = {
		detectDiscordKotlin: true,
		ignoreSelf: false,
		latency: 2,
		showMillis: false,
	};

	test('matches Vencord warning and danger thresholds', () => {
		const warningMessage = {
			author: { id: 'other', bot: false },
			id: snowflake(DISCORD_EPOCH + 20_000),
			nonce: snowflake(DISCORD_EPOCH + 17_500),
		};
		const dangerMessage = {
			...warningMessage,
			nonce: snowflake(DISCORD_EPOCH + 16_000),
		};
		expect(latencyDetails(warningMessage, 'self', defaults)).toEqual({
			ahead: false,
			androidClient: false,
			delta: 3000,
			displayDelta: '3 seconds',
			fill: ['warning', 'warning', 'muted'],
		});
		expect(latencyDetails(dangerMessage, 'self', defaults)?.fill).toEqual([
			'danger',
			'muted',
			'muted',
		]);
	});

	test('uses muted bars for clock-ahead and long delays', () => {
		const aheadMessage = {
			author: { id: 'other', bot: false },
			id: snowflake(DISCORD_EPOCH + 20_000),
			nonce: snowflake(DISCORD_EPOCH + 25_000),
		};
		const longDelayMessage = {
			author: { id: 'other', bot: false },
			id: snowflake(DISCORD_EPOCH + 200_000),
			nonce: snowflake(DISCORD_EPOCH + 1000),
		};
		expect(latencyDetails(aheadMessage, 'self', defaults)?.fill).toEqual([
			'muted',
			'muted',
			'muted',
		]);
		expect(latencyDetails(longDelayMessage, 'self', defaults)?.fill).toEqual([
			'muted',
			'muted',
			'muted',
		]);
	});

	test('ignores missing nonces, bot messages, fast sends, and optional self messages', () => {
		expect(
			latencyDetails({ id: snowflake(DISCORD_EPOCH + 20_000) }, 'self', defaults),
		).toBeNull();
		expect(
			latencyDetails(
				{
					author: { bot: true },
					id: snowflake(DISCORD_EPOCH + 20_000),
					nonce: snowflake(DISCORD_EPOCH + 17_000),
				},
				'self',
				defaults,
			),
		).toBeNull();
		expect(
			latencyDetails(
				{
					id: snowflake(DISCORD_EPOCH + 20_000),
					nonce: snowflake(DISCORD_EPOCH + 19_000),
				},
				'self',
				defaults,
			),
		).toBeNull();
		expect(
			latencyDetails(
				{
					author: { id: 'self' },
					id: snowflake(DISCORD_EPOCH + 20_000),
					nonce: snowflake(DISCORD_EPOCH + 17_000),
				},
				'self',
				{ ...defaults, ignoreSelf: true },
			),
		).toBeNull();
	});

	test('detects the old Discord Kotlin nonce offset', () => {
		const message = {
			author: { id: 'other', bot: false },
			id: snowflake(DISCORD_EPOCH + 20_000),
			nonce: snowflake(DISCORD_EPOCH + 20_000 + 1_471_228_928),
		};
		expect(latencyDetails(message, 'self', defaults)).toEqual({
			ahead: true,
			androidClient: true,
			delta: 72,
			displayDelta: null,
			fill: ['positive', 'positive', 'muted'],
		});
		expect(
			latencyDetails(message, 'self', { ...defaults, detectDiscordKotlin: false }),
		).toBeNull();
	});

	test('builds the Vencord tooltip text for delays, clock offsets, and old clients', () => {
		const delayed = latencyDetails(
			{
				author: { id: 'other', bot: false },
				id: snowflake(DISCORD_EPOCH + 20_000),
				nonce: snowflake(DISCORD_EPOCH + 17_500),
			},
			'self',
			defaults,
		);
		const ahead = latencyDetails(
			{
				author: { id: 'other', bot: false },
				id: snowflake(DISCORD_EPOCH + 20_000),
				nonce: snowflake(DISCORD_EPOCH + 25_000),
			},
			'self',
			defaults,
		);
		const android = latencyDetails(
			{
				author: { id: 'other', bot: false },
				id: snowflake(DISCORD_EPOCH + 20_000),
				nonce: snowflake(DISCORD_EPOCH + 20_000 + 1_471_228_928),
			},
			'self',
			defaults,
		);
		expect(delayed && latencyTooltip(delayed)).toBe(
			'This message was sent with a delay of 3 seconds.',
		);
		expect(ahead && latencyTooltip(ahead)).toBe("This user's clock is 5 seconds ahead.");
		expect(android && latencyTooltip(android)).toBe(
			'User is suspected to be on an old Discord Android client',
		);
	});
});

describe('message create events', () => {
	test('extracts gateway messages and rejects malformed event payloads', () => {
		const message = { id: 'message-id', nonce: 'message-nonce' };

		expect(messageFromCreateEvent({ type: 'MESSAGE_CREATE', message })).toEqual(message);
		expect(messageFromCreateEvent({ type: 'MESSAGE_CREATE', message: null })).toBeNull();
		expect(messageFromCreateEvent({ type: 'MESSAGE_CREATE' })).toBeNull();
	});

	test('subscribes to live messages and releases the subscription on stop', async () => {
		plugin.start(nativeContext() as Parameters<typeof plugin.start>[0]);
		expect(subscribedEvents).toContain('MESSAGE_CREATE');

		await plugin.stop();
		expect(unsubscribedEvents).toContain('MESSAGE_CREATE');
	});
});

describe('latency formatting', () => {
	test('uses Vencord unit names and separator behavior', () => {
		expect(formatLatency(3000, false)).toBe('3 seconds');
		expect(formatLatency(123_000, false)).toBe('2 minutes and 3 seconds');
		expect(formatLatency(2500, true)).toBe('2 seconds and 500 milliseconds');
		expect(formatLatency(325, true)).toBe('325 milliseconds');
		expect(formatLatency(0, true)).toBe('0 seconds');
	});
});

describe('message row and native lifecycle', () => {
	test('installs one row patch and removes it when stopped', async () => {
		plugin.start();
		plugin.start();
		expect(patchCount).toBe(1);

		await plugin.stop();
		expect(unpatchCount).toBe(1);
	});

	test('uses the native ABI cell hooks and disposes their tokens', async () => {
		plugin.start(nativeContext() as Parameters<typeof plugin.start>[0]);
		expect(nativeHooks).toEqual([
			{ className: 'UIControl', selector: 'endTrackingWithTouch:withEvent:' },
			{ className: 'DCDMessageTableViewCell', selector: 'didMoveToWindow' },
			{ className: 'DCDMessageTableViewCell', selector: 'prepareForReuse' },
		]);

		const stopped = plugin.stop();
		expect(plugin.stop()).toBe(stopped);
		expect(removeHookCount).toBe(3);
		await stopped;
		expect(removeHookCount).toBe(3);
	});

	test('processes cells on window entry and reuse without a per-layout hook', async () => {
		const cell = {};
		const viewModel = {};
		const message = {};
		const messageId = snowflake(DISCORD_EPOCH + 20_000);
		const snapshots: number[] = [];
		const batches: number[] = [];
		const handlers = new Map<string, TestHookHandlers>();
		const context = {
			native: {
				objc: {
					className: () => 'DCDMessageTableViewCell',
					getIvar: () => viewModel,
					call: () => 1,
					snapshot: () => {
						snapshots.push(1);
						return Promise.resolve([
							{
								view: cell,
								parent: -1,
								depth: 0,
								className: 'DCDMessageTableViewCell',
								frame: { x: 0, y: 0, width: 100, height: 40 },
								text: null,
								visible: true,
							},
						]);
					},
					batch: () => {
						batches.push(1);
						return Promise.resolve([message, messageId]);
					},
					hook: (_className: string, selector: string, callback: TestHookHandlers) => {
						handlers.set(selector, callback);
						return { remove: () => undefined };
					},
				},
			},
		};
		plugin.start(context as Parameters<typeof plugin.start>[0]);
		const entered = handlers.get('didMoveToWindow');
		const reuse = handlers.get('prepareForReuse');
		if (!entered?.after || !reuse?.after) throw new Error('Expected asynchronous cell hooks');
		expect(handlers.has('layoutSubviews')).toBe(false);
		expect(reuse.before).toBeUndefined();
		expect(typeof reuse.after).toBe('function');
		entered.after({ self: cell });
		await Bun.sleep(5);
		expect(snapshots).toHaveLength(1);
		expect(batches).toHaveLength(1);
		reuse.after({ self: cell });
		await Bun.sleep(5);
		expect(snapshots).toHaveLength(2);
		expect(batches).toHaveLength(2);
		afterHandler?.({
			args: [
				{
					message: {
						author: { id: 'other', bot: false },
						id: messageId,
						nonce: snowflake(DISCORD_EPOCH + 17_000),
					},
				},
			],
			result: { message: { username: 'adrián' } },
		});
		await Bun.sleep(5);
		expect(snapshots.length).toBeGreaterThan(2);
	});

	test('discards a cell snapshot that resolves after reuse', async () => {
		const cell = {};
		const messageId = snowflake(DISCORD_EPOCH + 20_000);
		const snapshots: Array<(nodes: unknown[]) => void> = [];
		const handlers = new Map<string, TestHookHandlers>();
		let batches = 0;
		plugin.start({
			native: {
				objc: {
					className: () => 'DCDMessageTableViewCell',
					call: () => 1,
					getIvar: () => ({}),
					snapshot: () => new Promise((resolve) => snapshots.push(resolve)),
					batch: () => {
						batches++;
						return Promise.resolve([{}, messageId]);
					},
					hook: (_className: string, selector: string, callback: TestHookHandlers) => {
						handlers.set(selector, callback);
						return { remove: () => undefined };
					},
				},
			},
		} as Parameters<typeof plugin.start>[0]);
		const entered = handlers.get('didMoveToWindow');
		const reuse = handlers.get('prepareForReuse');
		if (!entered?.after || !reuse?.after) throw new Error('Expected cell lifecycle hooks');
		entered.after({ self: cell });
		await Bun.sleep(5);
		reuse.after({ self: cell });
		await Bun.sleep(5);
		expect(snapshots).toHaveLength(2);
		const nodes = [
			{
				view: cell,
				parent: -1,
				depth: 0,
				className: 'DCDMessageTableViewCell',
				frame: { x: 0, y: 0, width: 100, height: 40 },
				text: null,
				visible: true,
			},
		];
		snapshots[0]?.(nodes);
		await Bun.sleep(5);
		expect(batches).toBe(0);
		snapshots[1]?.(nodes);
		await Bun.sleep(5);
		expect(batches).toBe(1);
	});

	test('shows and dismisses tooltips when the displayed name differs from the account name', async () => {
		type Handle = { id: number; name: string };
		type Frame = { x: number; y: number; width: number; height: number };
		let nextId = 0;
		const createHandle = (name: string): Handle => ({ id: ++nextId, name });
		const cell = createHandle('DCDMessageTableViewCell');
		const row = createHandle('UIView');
		const group = createHandle('UIView');
		const wrapper = createHandle('UIView');
		const label = createHandle('DCDLabel');
		const timestamp = createHandle('DCDLabel');
		const window = createHandle('UIWindow');
		const viewModel = createHandle('ViewModel');
		const message = createHandle('Message');
		const messageId = snowflake(DISCORD_EPOCH + 20_000);
		const frames = new Map<Handle, Frame>([
			[row, { x: 0, y: 0, width: 300, height: 20 }],
			[group, { x: 0, y: 0, width: 140, height: 20 }],
			[wrapper, { x: 0, y: 0, width: 70, height: 18 }],
			[label, { x: 0, y: 0, width: 70, height: 16 }],
			[timestamp, { x: 160, y: 0, width: 50, height: 18 }],
			[window, { x: 0, y: 0, width: 320, height: 640 }],
		]);
		const parents = new Map<Handle, Handle>([
			[label, wrapper],
			[wrapper, group],
			[group, row],
		]);
		const children = new Map<Handle, Handle[]>([
			[group, [wrapper]],
			[row, [group, timestamp]],
		]);
		const handlers = new Map<string, TestHookHandlers>();
		const asyncSelectors: string[] = [];
		const synchronousSelectors: string[] = [];
		const surfaces: Handle[] = [];
		const unmounted: Handle[] = [];
		let pauseMount = false;
		let releaseMount: ((surface: Handle) => void) | null = null;
		let icon: Handle | null = null;
		const invoke = (target: Handle, selector: string): unknown => {
			if (selector === 'frame' || selector === 'bounds') {
				const frame = frames.get(target);
				return frame
					? {
							origin: { x: frame.x, y: frame.y },
							size: { width: frame.width, height: frame.height },
						}
					: null;
			}
			if (selector === 'superview') return parents.get(target) ?? null;
			if (selector === 'subviews') return children.get(target) ?? [];
			if (selector === 'window') return window;
			if (selector === 'translatesAutoresizingMaskIntoConstraints') return true;
			if (selector === 'layer') return createHandle('CALayer');
			if (selector === 'colorWithRed:green:blue:alpha:') return createHandle('UIColor');
			if (
				selector ===
				'constraintWithItem:attribute:relatedBy:toItem:attribute:multiplier:constant:'
			)
				return createHandle('NSLayoutConstraint');
			if (selector === 'systemFontOfSize:') return createHandle('UIFont');
			if (selector === 'sizeThatFits:') return { width: 120, height: 18 };
			if (selector === 'convertRect:toView:')
				return { origin: { x: 100, y: 100 }, size: { width: 12, height: 12 } };
			return null;
		};
		const context = {
			native: {
				objc: {
					alloc: (name: string) => {
						const handle = createHandle(name);
						if (name === 'UIButton') icon = handle;
						return handle;
					},
					batch: () => Promise.resolve([message, messageId]),
					call: (handle: Handle) => handle.id,
					className: (handle: Handle) => handle.name,
					getClass: (name: string) => createHandle(name),
					getIvar: () => viewModel,
					hook: (_className: string, selector: string, callbacks: TestHookHandlers) => {
						handlers.set(selector, callbacks);
						return { remove: () => undefined };
					},
					invoke: (handle: Handle, selector: string) => {
						synchronousSelectors.push(selector);
						return invoke(handle, selector);
					},
					invokeAsync: (handle: Handle, selector: string) => {
						asyncSelectors.push(selector);
						return Promise.resolve(invoke(handle, selector));
					},
					snapshot: () =>
						Promise.resolve([
							{ view: cell, parent: -1, visible: true, frame: frames.get(row) },
							{ view: row, parent: 0, visible: true, frame: frames.get(row) },
							{
								view: label,
								parent: 1,
								visible: true,
								className: 'DCDLabel',
								frame: frames.get(label),
								text: 'adrián',
							},
						]),
					struct: (_name: string, value: unknown) => ({ value }),
				},
				fabric: {
					mountAsync: () => {
						const surface = createHandle('Surface');
						surfaces.push(surface);
						if (pauseMount)
							return new Promise<Handle>((resolve) => {
								releaseMount = resolve;
							});
						return Promise.resolve(surface);
					},
					setFrameAsync: () => Promise.resolve(),
					setSizeAsync: () => Promise.resolve(),
					unmountAsync: (surface: Handle) => {
						unmounted.push(surface);
						return Promise.resolve();
					},
				},
			},
		};
		plugin.start(context as Parameters<typeof plugin.start>[0]);
		afterHandler?.({
			args: [
				{
					message: {
						author: { id: 'other' },
						id: messageId,
						nonce: snowflake(DISCORD_EPOCH + 17_000),
					},
				},
			],
			result: { message: { username: 'dylib.dev' } },
		});
		handlers.get('didMoveToWindow')?.after?.({ self: cell });
		await Bun.sleep(10);
		expect(icon).not.toBeNull();
		expect(asyncSelectors).toContain('frame');
		expect(synchronousSelectors).not.toContain('frame');
		if (!icon) throw new Error('Expected a latency icon');
		handlers.get('endTrackingWithTouch:withEvent:')?.after?.({ self: icon });
		await Bun.sleep(10);
		expect(surfaces).toHaveLength(1);
		expect(asyncSelectors).toContain('sizeThatFits:');
		expect(asyncSelectors).toContain('addSubview:');
		expect(synchronousSelectors).not.toContain('sizeThatFits:');
		expect(synchronousSelectors).not.toContain('convertRect:toView:');
		handlers.get('sendEvent:')?.after?.({ self: window });
		await Bun.sleep(10);
		expect(unmounted).toEqual(surfaces);
		expect(asyncSelectors).toContain('removeFromSuperview');
		pauseMount = true;
		handlers.get('endTrackingWithTouch:withEvent:')?.after?.({ self: icon });
		await Bun.sleep(10);
		expect(surfaces).toHaveLength(2);
		expect(releaseMount).not.toBeNull();
		const stopped = plugin.stop();
		releaseMount?.(surfaces[1]);
		await stopped;
		expect(unmounted).toEqual(surfaces);
	});

	test('uses row generation as metadata only without changing Discord row text', () => {
		plugin.start();
		const row = {
			timestamp: '10:00',
			timestampAccessibilityLabel: '10:00 AM',
			timestampTooltip: 'Monday, June 1 at 10:00',
			username: 'adrián',
		};
		const message = {
			author: { id: 'other', bot: false },
			id: snowflake(DISCORD_EPOCH + 20_000),
			nonce: snowflake(DISCORD_EPOCH + 17_500),
		};

		afterHandler?.({ args: [{ message }], result: { message: row } });

		expect(row).toEqual({
			timestamp: '10:00',
			timestampAccessibilityLabel: '10:00 AM',
			timestampTooltip: 'Monday, June 1 at 10:00',
			username: 'adrián',
		});
	});

	test('waits for the message row module and removes its listener', () => {
		rowGeneratorAvailable = false;
		plugin.start();
		expect(patchCount).toBe(0);

		rowGeneratorAvailable = true;
		moduleListener?.(rowGenerator, 'row-generator');

		expect(patchCount).toBe(1);
		expect(removeListenerCount).toBe(1);
	});
});
