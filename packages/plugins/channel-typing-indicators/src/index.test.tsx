import { afterEach, describe, expect, mock, test } from 'bun:test';

let patchHandler: ((context: any) => any) | null = null;
let threadPatchHandler: ((context: any) => any) | null = null;
let threadRendererPatchHandler: ((context: any) => any) | null = null;
let unpatchCount = 0;
let moduleListenerCount = 0;
let moduleListener: (() => void) | null = null;
let moduleAvailable = true;
let typingStoreAvailable = true;
let userStoreAvailable = true;
let selectedChannelId: string | null = null;
let typingUserSnapshot: Record<string, number> = {};
let nextDotIndex = 0;
let dotAnimation: any = null;
let profileOpen: any = null;
let translatedLabels: Record<string, string> | null = null;
const linear = () => 0;
const settingsValues = new Map<string, unknown>();
const unresolvedUsers = new Set<string>();
const target = { type: () => null };
const threadModule = { default: () => null };
const userSummaryItem = () => null;
const typingListeners = new Set<() => void>();
const effectCleanups = new Set<() => void>();
const typingStore = {
	getTypingUsers: () => typingUserSnapshot,
	addChangeListener(listener: () => void) {
		typingListeners.add(listener);
	},
	removeChangeListener(listener: () => void) {
		typingListeners.delete(listener);
	},
};
const react = {
	Component: class {
		props: any;
		constructor(props: any) {
			this.props = props;
		}
	},
	createElement(type: any, props: any, ...children: any[]) {
		return {
			type,
			props: {
				...props,
				children: children.length
					? children.length === 1
						? children[0]
						: children
					: props?.children,
			},
		};
	},
	cloneElement(element: any, props: any, ...children: any[]) {
		return {
			...element,
			props: {
				...element.props,
				...props,
				children: children.length ? children[0] : element.props.children,
			},
		};
	},
	useState(initial: any) {
		return [typeof initial === 'function' ? initial() : initial, () => {}];
	},
	useEffect(effect: () => void | (() => void)) {
		const cleanup = effect();
		if (cleanup) effectCleanups.add(cleanup);
	},
	useRef(value: unknown) {
		return { current: value };
	},
};
const animated = {
	Value: class {
		index = nextDotIndex++;
		constructor(public initial: number) {}
	},
	View: 'AnimatedView',
	add(value: any, offset: number) {
		return { kind: 'add', value, offset };
	},
	modulo(value: any, modulus: number) {
		return {
			kind: 'modulo',
			value,
			modulus,
			interpolate(options: any) {
				return { kind: 'interpolation', source: this, ...options };
			},
		};
	},
	timing(value: { index: number }, options: any) {
		return { kind: 'timing', index: value.index, ...options };
	},
	parallel(children: any[]) {
		return { kind: 'parallel', children };
	},
	sequence(children: any[]) {
		return { kind: 'sequence', children };
	},
	delay(duration: number) {
		return { kind: 'delay', duration };
	},
	loop(sequence: any) {
		dotAnimation = sequence;
		return { start() {}, stop() {} };
	},
};

mock.module('@unbound-app/api', () => ({
	metro: {
		common: {
			React: react,
			i18n: {
				t: Object.fromEntries(
					['lJ9sZX', 'rB0CUa', 'StKThj', 'uVDhqZ'].map((key) => [key, () => key]),
				),
				intl: {
					formatToPlainString(message: () => string, values: Record<string, string>) {
						const template = translatedLabels?.[message()];
						if (!template) throw new Error('No translation');
						return template.replace(/\{([abc])\}/g, (_, key) => values[key]);
					},
				},
			},
			ReactNative: {
				View: 'View',
				Text: 'Text',
				Pressable: 'Pressable',
				Modal: 'Modal',
				Dimensions: { get: () => ({ width: 375, height: 667 }) },
				Animated: animated,
				Easing: { linear },
			},
			Theme: {
				colors: { TEXT_MUTED: 'muted' },
				internal: { resolveSemanticColor: () => '#96979e' },
				themes: { DARK: 'darker' },
			},
		},
		find: (predicate: (module: any) => boolean) => {
			const profile = { default: { type: { name: 'UserProfileActionSheet' } } };
			return predicate(profile) ? profile : { theme: 'darker' };
		},
		findByName: () => null,
		findByProps: (...props: string[]) => {
			if (props.includes('openLazy'))
				return {
					openLazy(component: unknown, key: string, options: unknown) {
						profileOpen = { component, key, options };
					},
					hideActionSheet() {},
				};
			if (props.includes('getTypingUsers')) return typingStoreAvailable ? typingStore : null;
			if (props.includes('getChannelId')) return { getChannelId: () => selectedChannelId };
			if (props.includes('getCurrentUser'))
				return userStoreAvailable
					? {
							getCurrentUser: () => ({ id: 'self' }),
							getUser: (id: string) => (unresolvedUsers.has(id) ? null : { id }),
						}
					: null;
			if (props.includes('isChannelMuted')) return { isChannelMuted: () => false };
			if (props.includes('isBlocked')) return { isBlocked: () => false };
			if (props.includes('UserIcon')) return { UserIcon: () => null };
			return {};
		},
		findByFilePath: (path: string) =>
			moduleAvailable
				? path.includes('UserSummaryItem')
					? { default: userSummaryItem }
					: path.includes('ThreadChannel')
						? threadModule
						: { default: target }
				: null,
		addListener: (listener: () => void) => {
			moduleListenerCount++;
			moduleListener = listener;
			return () => true;
		},
	},
	patcher: {
		after: (_holder: any, key: string, handler: (context: any) => any) => {
			if (key === 'default') threadPatchHandler = handler;
			else if (key === 'render') threadRendererPatchHandler = handler;
			else patchHandler = handler;
			return () => {
				unpatchCount++;
			};
		},
	},
	storage: {
		getStore: () => ({
			useSettingsStore: () => ({
				get: (key: string, fallback: unknown) => settingsValues.get(key) ?? fallback,
				set: (key: string, value: unknown) => settingsValues.set(key, value),
			}),
		}),
	},
}));

mock.module('@shared/settings-ui', () => ({
	SettingsRow: () => null,
	SettingsScrollView: () => null,
	SettingsSection: () => null,
	SettingsSwitchRow: () => null,
}));

const {
	default: plugin,
	insertThreadTypingIndicator,
	insertTypingIndicator,
	sameIds,
	tooltipPlacement,
	typingLabel,
	visibleTypingIds,
} = await import('@channel-typing-indicators/index');

function channelRow(channelId: string) {
	const channel = { id: channelId, guild_id: 'guild' };
	const info = { type: 'ChannelInfo', props: { channel } };
	const content = {
		type: 'View',
		props: { children: [{ type: 'Icon' }, { type: 'Text' }, info] },
	};
	const row = {
		type: 'Pressable',
		props: { accessibilityRole: 'button', children: [false, content] },
	};
	return { type: 'Root', props: { children: [null, row, false] } };
}

function threadRow(channelId: string): any {
	const channel = { id: channelId, guild_id: 'guild', type: 11 };
	const row = {
		type: 'ThreadRow',
		props: { channel, accessibilityRole: 'button', channelInfo: null },
	};
	const container = { type: 'View', props: { children: [false, null, row] } };
	return { type: 'Fragment', props: { children: [null, null, container] } };
}

function wrappedIndicator(boundary: any): any {
	return boundary.props.children;
}

function renderIndicator(indicator: any): any {
	return indicator.type(indicator.props).props.children[0];
}

afterEach(() => {
	for (const cleanup of effectCleanups) cleanup();
	effectCleanups.clear();
	plugin.stop();
	patchHandler = null;
	threadPatchHandler = null;
	threadRendererPatchHandler = null;
	unpatchCount = 0;
	moduleListenerCount = 0;
	moduleListener = null;
	moduleAvailable = true;
	typingStoreAvailable = true;
	userStoreAvailable = true;
	selectedChannelId = null;
	typingUserSnapshot = {};
	nextDotIndex = 0;
	dotAnimation = null;
	profileOpen = null;
	translatedLabels = null;
	settingsValues.clear();
	unresolvedUsers.clear();
	typingListeners.clear();
});

describe('channel typing user selection', () => {
	test('uses Vencord-style typing labels without unbounded user lists', () => {
		expect(typingLabel([])).toBe('');
		expect(typingLabel(['Alice'])).toBe('Alice is typing...');
		expect(typingLabel(['Alice', 'Bob'])).toBe('Alice and Bob are typing...');
		expect(typingLabel(['Alice', 'Bob', 'Casey'])).toBe('Alice, Bob, and Casey are typing...');
		expect(typingLabel(['Alice', 'Bob', 'Casey', 'Drew'])).toBe('Several people are typing...');
	});
	test('uses Discord locale strings for the typing tooltip when available', () => {
		translatedLabels = {
			lJ9sZX: '{a} schreibt...',
			uVDhqZ: 'Mehrere Personen schreiben...',
		};
		expect(typingLabel(['Alice'])).toBe('Alice schreibt...');
		expect(typingLabel(['Alice', 'Bob', 'Casey', 'Drew'])).toBe(
			'Mehrere Personen schreiben...',
		);
	});
	test('hides the current user and blocked users by default', () => {
		const typing = { self: 1, blocked: 2, visible: 3 };
		expect(visibleTypingIds(typing, 'self', (id) => id === 'blocked', false)).toEqual([
			'visible',
		]);
	});

	test('optionally includes blocked users while still hiding the current user', () => {
		const typing = { self: 1, blocked: 2, visible: 3 };
		expect(visibleTypingIds(typing, 'self', () => true, true)).toEqual(['blocked', 'visible']);
	});

	test('hides ignored users unless they are explicitly included', () => {
		const typing = { ignored: 1, visible: 2 };
		expect(
			visibleTypingIds(
				typing,
				undefined,
				() => false,
				false,
				(id) => id === 'ignored',
				false,
			),
		).toEqual(['visible']);
		expect(
			visibleTypingIds(
				typing,
				undefined,
				() => false,
				false,
				(id) => id === 'ignored',
				true,
			),
		).toEqual(['ignored', 'visible']);
	});

	test('ignores unchanged typing snapshots', () => {
		expect(sameIds(['a', 'b'], ['a', 'b'])).toBe(true);
		expect(sameIds(['a', 'b'], ['b', 'a'])).toBe(false);
		expect(sameIds(['a'], ['a', 'b'])).toBe(false);
	});
});

describe('channel row integration', () => {
	test('positions the typing tooltip within the viewport and points at the indicator', () => {
		const above = tooltipPlacement({ x: 270, y: 500, width: 40, height: 16 }, 28, 375);
		expect(above.arrowDirection).toBe('DOWN');
		expect(above.left).toBeGreaterThanOrEqual(8);
		expect(above.left + above.width).toBeLessThanOrEqual(367);
		expect(above.left + above.arrowOffset + 8).toBe(290);
		const below = tooltipPlacement({ x: 16, y: 30, width: 40, height: 16 }, 28, 375);
		expect(below.arrowDirection).toBe('UP');
		expect(below.top).toBeGreaterThan(46);
	});
	test('inserts the indicator inside the original row before channel info', () => {
		const channel = { id: 'channel', guild_id: 'guild' };
		const original = channelRow(channel.id);
		const updated = insertTypingIndicator(original, channel, false);
		const row = updated.props.children[1];
		const children = row.props.children[1].props.children;

		expect(updated.type).toBe('Root');
		expect(row.type).toBe('Pressable');
		expect(children).toHaveLength(4);
		expect(wrappedIndicator(children[2]).props.channel).toBe(channel);
		expect(children[3].type).toBe('ChannelInfo');
		expect(insertTypingIndicator(updated, channel, false)).toBe(updated);
	});

	test('does not alter an unfamiliar row layout', () => {
		const original = { type: 'Root', props: { children: ['unchanged'] } };
		expect(insertTypingIndicator(original, { id: 'channel' }, false)).toBe(original);
	});

	test('does not insert a second indicator from a previous plugin evaluation', () => {
		const channel = { id: 'channel', guild_id: 'guild' };
		const updated = insertTypingIndicator(channelRow(channel.id), channel, false);
		const children = updated.props.children[1].props.children[1].props.children;
		children[2] = {
			...children[2],
			type: 'PreviousIndicatorBoundary',
			key: 'unbound.channel-typing-indicators',
		};
		expect(insertTypingIndicator(updated, channel, false)).toBe(updated);
	});

	test('adds typing to thread rows without replacing their native layout', () => {
		const channel = { id: 'thread', guild_id: 'guild' };
		const original = threadRow(channel.id);
		const updated = insertThreadTypingIndicator(original, channel, false);
		const row = updated.props.children[2].props.children[2];
		expect(updated.type).toBe('Fragment');
		expect(row.type).toBe('ThreadRow');
		expect(wrappedIndicator(row.props.channelInfo).props.channel).toBe(channel);
		expect(insertThreadTypingIndicator(updated, channel, false)).toBe(updated);
	});

	test('preserves existing thread channel information', () => {
		const channel = { id: 'thread', guild_id: 'guild' };
		const original = threadRow(channel.id);
		original.props.children[2].props.children[2].props.channelInfo = {
			type: 'ExistingBadge',
			props: {},
		};
		const updated = insertThreadTypingIndicator(original, channel, false);
		const info = updated.props.children[2].props.children[2].props.channelInfo;
		expect(info.props.children[0].type).toBe('ExistingBadge');
		expect(wrappedIndicator(info.props.children[1]).props.channel).toBe(channel);
		expect(insertThreadTypingIndicator(updated, channel, false)).toBe(updated);
	});

	test('does not insert a second thread indicator from a previous plugin evaluation', () => {
		const channel = { id: 'thread', guild_id: 'guild' };
		const updated = insertThreadTypingIndicator(threadRow(channel.id), channel, false);
		const row = updated.props.children[2].props.children[2];
		row.props.channelInfo = {
			...row.props.channelInfo,
			type: 'PreviousIndicatorBoundary',
			key: 'unbound.channel-typing-indicators',
		};
		expect(insertThreadTypingIndicator(updated, channel, false)).toBe(updated);
	});

	test('installs one patch and removes it on stop', () => {
		plugin.start();
		plugin.start();
		expect(patchHandler).toBeFunction();
		expect(moduleListenerCount).toBe(0);

		const original = channelRow('channel');
		const updated = patchHandler?.({
			args: [{ channel: { id: 'channel', guild_id: 'guild' }, muted: false }],
			result: original,
		});
		expect(updated.props.children[1].props.children[1].props.children).toHaveLength(4);

		plugin.stop();
		expect(unpatchCount).toBe(2);
	});

	test('patches the rendered thread row and removes both thread hooks on stop', () => {
		plugin.start();
		const outer = threadPatchHandler?.({
			result: { type: () => null, props: { channel: { id: 'thread' } } },
		});
		expect(outer.type).toBeFunction();
		const channel = { id: 'thread', guild_id: 'guild' };
		const updated = threadRendererPatchHandler?.({
			args: [{ channel, muted: false }],
			result: threadRow(channel.id),
		});
		expect(
			wrappedIndicator(updated.props.children[2].props.children[2].props.channelInfo).props
				.channel,
		).toBe(channel);
		plugin.stop();
		expect(unpatchCount).toBe(3);
	});

	test('removes mounted row listeners when disabled', () => {
		plugin.start();
		const original = channelRow('channel');
		const updated = patchHandler?.({
			args: [{ channel: { id: 'channel', guild_id: 'guild' }, muted: false }],
			result: original,
		});
		const indicator = wrappedIndicator(
			updated.props.children[1].props.children[1].props.children[2],
		);
		indicator.type(indicator.props);
		expect(typingListeners.size).toBe(1);

		plugin.stop();
		expect(typingListeners.size).toBe(0);
	});

	test('resumes mounted row listeners when re-enabled without a row remount', () => {
		typingUserSnapshot = { other: 1 };
		plugin.start();
		const updated = patchHandler?.({
			args: [{ channel: { id: 'channel', guild_id: 'guild' }, muted: false }],
			result: channelRow('channel'),
		});
		const indicator = wrappedIndicator(
			updated.props.children[1].props.children[1].props.children[2],
		);
		indicator.type(indicator.props);
		expect(typingListeners.size).toBe(1);
		plugin.stop();
		expect(typingListeners.size).toBe(0);
		plugin.start();
		expect(typingListeners.size).toBe(1);
	});

	test('can hide the selected channel without hiding other typing channels', () => {
		settingsValues.set('includeCurrentChannel', false);
		selectedChannelId = 'channel';
		typingUserSnapshot = { other: 1 };
		plugin.start();
		const updated = patchHandler?.({
			args: [{ channel: { id: 'channel', guild_id: 'guild' }, muted: false }],
			result: channelRow('channel'),
		});
		const indicator = wrappedIndicator(
			updated.props.children[1].props.children[1].props.children[2],
		);
		expect(indicator.type(indicator.props)).toBeNull();
		selectedChannelId = 'different';
		expect(indicator.type(indicator.props)).not.toBeNull();
	});

	test('supports avatars-only and dots-only display modes', () => {
		typingUserSnapshot = { other: 1 };
		plugin.start();
		const updated = patchHandler?.({
			args: [{ channel: { id: 'channel', guild_id: 'guild' }, muted: false }],
			result: channelRow('channel'),
		});
		const indicator = wrappedIndicator(
			updated.props.children[1].props.children[1].props.children[2],
		);
		settingsValues.set('indicatorMode', 2);
		const avatarsOnly = renderIndicator(indicator);
		expect(avatarsOnly.props.children[0]).not.toBeNull();
		expect(avatarsOnly.props.children[1]).toBeNull();
		settingsValues.set('indicatorMode', 1);
		const dotsOnly = renderIndicator(indicator);
		expect(dotsOnly.props.children[0]).toBeNull();
		expect(dotsOnly.props.children[1]).not.toBeNull();
	});

	test('keeps typing avatars outside the tooltip press target', () => {
		typingUserSnapshot = { known: 1 };
		plugin.start();
		const updated = patchHandler?.({
			args: [{ channel: { id: 'channel', guild_id: 'guild' }, muted: false }],
			result: channelRow('channel'),
		});
		const indicator = wrappedIndicator(
			updated.props.children[1].props.children[1].props.children[2],
		);
		const content = renderIndicator(indicator);
		expect(content.type).toBe('View');
		expect(content.props.children[0].type).toBeFunction();
		expect(content.props.children[1].type).toBe('Pressable');
		expect(content.props.children[1].props.children.type).toBeFunction();
		let stopped = false;
		content.props.children[1].props.onPress({ stopPropagation: () => (stopped = true) });
		expect(stopped).toBe(true);
	});

	test('opens a known typing avatar profile without navigating the channel', async () => {
		typingUserSnapshot = { known: 1 };
		plugin.start();
		const updated = patchHandler?.({
			args: [{ channel: { id: 'channel', guild_id: 'guild' }, muted: false }],
			result: channelRow('channel'),
		});
		const indicator = wrappedIndicator(
			updated.props.children[1].props.children[1].props.children[2],
		);
		const avatars = renderIndicator(indicator).props.children[0];
		const avatar = avatars.type(avatars.props).props.children[0][0].props.children;
		expect(avatar.type).toBe('Pressable');
		let stopped = false;
		avatar.props.onPress({ stopPropagation: () => (stopped = true) });
		expect(stopped).toBe(true);
		expect(profileOpen?.key).toBe('UserProfileknown');
		expect(profileOpen?.options).toMatchObject({ userId: 'known', channelId: 'channel' });
		expect((await profileOpen?.component)?.default?.type?.name).toBe('UserProfileActionSheet');
	});

	test('reveals the typing tooltip from an avatar long press in avatars-only mode', () => {
		typingUserSnapshot = { known: 1 };
		settingsValues.set('indicatorMode', 2);
		plugin.start();
		const updated = patchHandler?.({
			args: [{ channel: { id: 'channel', guild_id: 'guild' }, muted: false }],
			result: channelRow('channel'),
		});
		const indicator = wrappedIndicator(
			updated.props.children[1].props.children[1].props.children[2],
		);
		const avatars = renderIndicator(indicator).props.children[0];
		let measured = false;
		avatars.props.containerRef.current = {
			measureInWindow(
				callback: (x: number, y: number, width: number, height: number) => void,
			) {
				measured = true;
				callback(250, 400, 48, 16);
			},
		};
		const avatar = avatars.type(avatars.props).props.children[0][0].props.children;
		avatar.props.onLongPress({ stopPropagation() {} });
		expect(measured).toBe(true);
		expect(profileOpen).toBeNull();
	});

	test('keeps default avatars for typing users absent from the user cache', () => {
		typingUserSnapshot = { uncached: 1, known: 2 };
		unresolvedUsers.add('uncached');
		plugin.start();
		const updated = patchHandler?.({
			args: [{ channel: { id: 'channel', guild_id: 'guild' }, muted: false }],
			result: channelRow('channel'),
		});
		const indicator = wrappedIndicator(
			updated.props.children[1].props.children[1].props.children[2],
		);
		const avatars = renderIndicator(indicator).props.children[0];
		const stack = avatars.type(avatars.props);
		const first = stack.props.children[0][0].props.children;
		const second = stack.props.children[0][1].props.children;
		expect(first.type).toBe('Pressable');
		expect(first.props.onLongPress).toBeFunction();
		let stopped = false;
		first.props.onPress({ stopPropagation: () => (stopped = true) });
		expect(stopped).toBe(true);
		expect(first.props.children.type).toBe('View');
		expect(first.props.children.props.children.type).toBeFunction();
		expect(second.type).toBe('Pressable');
		const summary = second.props.children;
		expect(summary.type).toBe(userSummaryItem);
		expect(summary.props.users).toEqual([{ id: 'known' }]);
		expect(summary.props.showDefaultAvatarsForNullUsers).toBe(true);
		expect(summary.props.showUserPopout).toBe(true);
		expect(summary.props.max).toBe(1);
	});

	test('shows a legible overflow count after three avatars', () => {
		typingUserSnapshot = { a: 1, b: 2, c: 3, d: 4, e: 5 };
		plugin.start();
		const updated = patchHandler?.({
			args: [{ channel: { id: 'channel', guild_id: 'guild' }, muted: false }],
			result: channelRow('channel'),
		});
		const indicator = wrappedIndicator(
			updated.props.children[1].props.children[1].props.children[2],
		);
		const avatars = renderIndicator(indicator).props.children[0];
		const overflow = avatars.type(avatars.props).props.children[1];
		expect(overflow.type).toBe('Pressable');
		expect(overflow.props.onLongPress).toBeFunction();
		let stopped = false;
		overflow.props.onPress({ stopPropagation: () => (stopped = true) });
		expect(stopped).toBe(true);
		expect(overflow.props.children.props.children.props.children).toBe('+2');
		expect(overflow.props.style.marginLeft).toBe(-6);
		expect(overflow.props.style.zIndex).toBeGreaterThan(3);
	});

	test('hides a failed indicator without replacing the channel row', () => {
		const updated = insertTypingIndicator(channelRow('channel'), { id: 'channel' }, false);
		const boundary = updated.props.children[1].props.children[1].props.children[2];
		const instance = new boundary.type(boundary.props);
		expect(instance.render()).toBe(boundary.props.children);
		instance.state = boundary.type.getDerivedStateFromError();
		expect(instance.render()).toBeNull();
	});

	test('animates dot size and opacity with Discord’s staggered 2.4-second cycle', () => {
		typingUserSnapshot = { other: 1 };
		plugin.start();
		const updated = patchHandler?.({
			args: [{ channel: { id: 'channel', guild_id: 'guild' }, muted: false }],
			result: channelRow('channel'),
		});
		const indicator = wrappedIndicator(
			updated.props.children[1].props.children[1].props.children[2],
		);
		const dots = renderIndicator(indicator).props.children[1].props.children;
		const rendered = dots.type(dots.props);
		const dotViews = rendered.props.children;
		expect(rendered.props.style.marginLeft).toBe(6);
		expect(dotAnimation).toMatchObject({
			duration: 2400,
			easing: linear,
			toValue: 6.8,
			useNativeDriver: true,
		});
		expect(dotViews).toHaveLength(3);
		expect(dotViews.map((dot: any) => dot.props.style.opacity.source.value.offset)).toEqual([
			0, -0.25, -0.5,
		]);
		for (const dot of dotViews) {
			expect(dot.props.style.opacity).toMatchObject({
				inputRange: [0, 0.4, 0.8, 1, 1.2, 1.6, 2],
				outputRange: [0.3, 0.3, 1, 1, 1, 0.3, 0.3],
			});
			expect(dot.props.style.transform[0].scale).toMatchObject({
				inputRange: [0, 0.4, 0.8, 1, 1.2, 1.6, 2],
				outputRange: [0.8, 0.8, 1, 1, 1, 0.8, 0.8],
			});
		}
	});

	test('waits for a late-loaded channel module', () => {
		moduleAvailable = false;
		plugin.start();
		expect(moduleListenerCount).toBe(1);
		expect(patchHandler).toBeNull();
	});

	test('waits for a late-loaded typing store before patching channel rows', () => {
		typingStoreAvailable = false;
		plugin.start();
		expect(moduleListenerCount).toBe(1);
		expect(patchHandler).toBeNull();
		typingStoreAvailable = true;
		moduleListener?.();
		expect(patchHandler).toBeFunction();
	});

	test('waits for a late-loaded user store before patching channel rows', () => {
		userStoreAvailable = false;
		plugin.start();
		expect(moduleListenerCount).toBe(1);
		expect(patchHandler).toBeNull();
		userStoreAvailable = true;
		moduleListener?.();
		expect(patchHandler).toBeFunction();
	});
});
