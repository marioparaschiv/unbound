import { afterEach, describe, expect, mock, test } from 'bun:test';
import type { NativeObjCBridge } from '@unbound-app/api/native';

const removed: string[] = [];
const hooks: string[] = [];
const nativeCalls: string[] = [];
const hookHandlers = new Map<string, (context: { self: { name: string } }) => void>();
const channelListeners = new Set<() => void>();
const tintableSelectors = new Set<string>();
let tintedImage: unknown = { name: 'tinted-image' };
let fixtureMessage: { channel_id: string; content: string; id: string } | null = null;
let fixtureTextView = false;
let fixtureAttributedText = false;
let nestedViewDepth = 0;
let reactionSubtree = false;
let attributedTextValue = '@member';
let highlightedStart = -1;
let highlightedLength = 0;
let scanCells = [{ name: 'cell' }];

const selectedChannel = {
	addChangeListener: (listener: () => void) => channelListeners.add(listener),
	getChannelId: () => 'channel',
	getLastSelectedChannelId: () => 'channel',
	removeChangeListener: (listener: () => void) => channelListeners.delete(listener),
};

const native = {
	objc: {
		array: (value: unknown) => value,
		alloc: (value: unknown) => value,
		call: (target: { name?: string }, selector: string) => {
			nativeCalls.push(`${target.name}:current:${selector}`);
			if (target.name === 'cell' && selector === 'hash') return 1;
			if (target.name === 'text' && selector === 'hash') return 2;
			return null;
		},
		batch: async () => {
			nativeCalls.push('UIApplication:sharedApplication', 'application:windows');
			return [{ name: 'application' }, [{ name: 'window' }]];
		},
		className: (target: { name?: string }) =>
			target?.name === 'cell'
				? 'DCDMessageTableViewCell'
				: target?.name === 'reaction-list'
					? 'DCDReactionListView'
					: 'UIView',
		data: () => ({ imageData: true }),
		findViews: async () => {
			nativeCalls.push('window:findViews');
			return scanCells;
		},
		getClass: (name: string) => ({ name }),
		getIvar: (target: { name?: string }, name: string) =>
			fixtureMessage && target.name === 'cell' && name === 'viewModel'
				? { name: 'viewModel' }
				: null,
		invoke: (target: { name?: string }, selector: string, args: unknown[] = []) => {
			nativeCalls.push(`${target.name}:${selector}`);
			if (target.name === 'viewModel' && selector === 'message') return { name: 'message' };
			if (target.name === 'message' && selector === 'id') return fixtureMessage?.id;
			if (target.name === 'image' && selector.startsWith('imageWithTintColor:'))
				return tintedImage;
			if (target.name === 'UIApplication' && selector === 'sharedApplication')
				return { name: 'application' };
			if (target.name === 'application' && selector === 'windows')
				return [{ name: 'window' }];
			if (target.name === 'window' && selector === 'subviews') return [{ name: 'cell' }];
			if (target.name === 'cell' && selector === 'window') return { name: 'window' };
			if (target.name === 'cell' && selector === 'hash') return 1;
			if (target.name === 'cell' && selector === 'subviews')
				return fixtureTextView
					? [{ name: 'text' }]
					: reactionSubtree
						? [{ name: 'reaction-list' }]
						: nestedViewDepth > 0
							? [{ name: 'node-1' }]
							: [];
			if (target.name === 'reaction-list' && selector === 'subviews')
				return [{ name: 'text' }];
			if (target.name?.startsWith('node-') && selector === 'subviews') {
				const index = Number(target.name.slice(5));
				return index < nestedViewDepth ? [{ name: `node-${index + 1}` }] : [];
			}
			if (target.name === 'text' && selector === 'window') return { name: 'window' };
			if (target.name === 'text' && selector === 'hash') return 2;
			if (target.name === 'text' && selector === 'attributedText')
				return fixtureAttributedText ? { name: 'attributed' } : null;
			if (
				(target.name === 'attributed' || target.name === 'mutable') &&
				selector === 'string'
			)
				return attributedTextValue;
			if (target.name === 'attributed' && selector === 'mutableCopy')
				return { name: 'mutable' };
			if (target.name === 'mutable' && selector === 'attributesAtIndex:effectiveRange:') {
				const index = Number(args[0]);
				return index >= highlightedStart && index < highlightedStart + highlightedLength
					? { YYTextHighlight: {} }
					: null;
			}
			if (target.name === 'attributed' && selector === 'isEqual:') return true;
			if (target.name === 'mutable' && selector === 'isEqual:') return true;
			return null;
		},
		invokeAsync: async (target: { name?: string }, selector: string) => {
			nativeCalls.push(`${target.name}:async:${selector}`);
			return target.name === 'cell' && selector === 'window' ? { name: 'window' } : null;
		},
		hook: (
			_className: string,
			selector: string,
			handlers: { after?: (context: { self: { name: string } }) => void },
		) => {
			hooks.push(selector);
			if (handlers.after) hookHandlers.set(selector, handlers.after);
			return {
				active: true,
				remove: () => removed.push(selector),
			};
		},
		respondsTo: (target: { name?: string }, selector: string) =>
			(target.name === 'image' && tintableSelectors.has(selector)) ||
			(target.name === 'viewModel' && selector === 'message') ||
			(target.name === 'message' && selector === 'id') ||
			(target.name === 'cell' && selector === 'hash') ||
			(target.name === 'text' && selector === 'hash') ||
			(target.name === 'text' && selector === 'setAttributedText:') ||
			(target.name === 'text' && selector === 'attributedText') ||
			(target.name?.startsWith('node-') && selector === 'subviews') ||
			(target.name === 'reaction-list' && selector === 'subviews') ||
			((target.name === 'window' || target.name === 'cell') && selector === 'subviews'),
		struct: (name: string, fields: unknown) => ({ name, fields }),
	},
};

const target = { generateMessageRowData: () => undefined };

mock.module('@unbound-app/api', () => ({
	metro: {
		common: {
			ReactNative: {
				Image: {
					resolveAssetSource: (asset: number) =>
						asset === 42
							? { uri: 'file:///private/Discord.app/default-avatar.png' }
							: null,
				},
			},
		},
		find: () => ({ getRole: () => undefined, getSortedRoles: () => [] }),
		findByProps: (...props: string[]) => {
			if (props.includes('generateMessageRowData')) return target;
			if (props.includes('getLastSelectedChannelId')) return selectedChannel;
			if (props.includes('getChannelId')) return selectedChannel;
			if (props.includes('getChannel')) return { getChannel: () => undefined };
			if (props.includes('getCurrentUser'))
				return {
					getUser: (id: string) =>
						fixtureMessage && id === '123' ? { id, username: 'member' } : undefined,
				};
			return undefined;
		},
		findStore: (name: string) => {
			if (name === 'Message')
				return {
					getMessage: (_channelId: string, id: string) =>
						fixtureMessage?.id === id ? fixtureMessage : undefined,
					getMessages: () => ({ _array: fixtureMessage ? [fixtureMessage] : [] }),
				};
			return {};
		},
		patcher: {
			after: () => () => undefined,
		},
	},
	patcher: {
		after: () => () => undefined,
	},
	storage: {
		getStore: () => ({
			get: (_key: string, fallback: unknown) => fallback,
		}),
	},
}));

const {
	cellRenderDecision,
	containsMentionText,
	default: plugin,
	extractMentionTokens,
	imageCacheAction,
	loadMentionImageBytes,
	mentionImageMetrics,
	roleImageSource,
	userAvatarURL,
	tintRoleSymbol,
	ROLE_SYMBOL_METRICS,
	selectMentionLabel,
	shouldHandleChannelChange,
	mentionCellLifecycleAction,
} = await import('@mention-avatars/index');

afterEach(() => {
	plugin.stop?.();
	hooks.length = 0;
	removed.length = 0;
	nativeCalls.length = 0;
	hookHandlers.clear();
	channelListeners.clear();
	tintableSelectors.clear();
	tintedImage = { name: 'tinted-image' };
	fixtureMessage = null;
	fixtureTextView = false;
	fixtureAttributedText = false;
	nestedViewDepth = 0;
	reactionSubtree = false;
	attributedTextValue = '@member';
	highlightedStart = -1;
	highlightedLength = 0;
	scanCells = [{ name: 'cell' }];
});

describe('mention token matching', () => {
	test('preserves message order for adjacent user and role mentions', () => {
		expect(extractMentionTokens('Hi <@123> and <@&456>')).toEqual([
			{ id: '123', type: 'user' },
			{ id: '456', type: 'role' },
		]);
	});

	test('matches the complete visible label instead of a shared prefix', () => {
		expect(selectMentionLabel('@autosupport', ['auto', 'autosupport'])).toBe('autosupport');
		expect(selectMentionLabel('@dylib.dev\u2069', ['autosupport', 'dylib.dev'])).toBe(
			'dylib.dev',
		);
		expect(selectMentionLabel('@autosupporter', ['autosupport'])).toBeUndefined();
	});

	test('checks every mention label before replacing a saved string', () => {
		expect(
			containsMentionText('@autosupport @dylib.dev', [
				{ labels: ['autosupport'], type: 'user' },
				{ labels: ['dylib.dev'], type: 'user' },
			]),
		).toBe(true);
		expect(
			containsMentionText('@autosupporter', [{ labels: ['autosupport'], type: 'user' }]),
		).toBe(false);
	});
});

describe('mention image decisions', () => {
	test('uses a custom avatar when Discord resolves its avatar to a numeric asset', () => {
		expect(
			userAvatarURL({
				avatar: 'avatar-hash',
				getAvatarURL: () => 42,
				id: '123',
			}),
		).toBe('https://cdn.discordapp.com/avatars/123/avatar-hash.png?size=32');
	});

	test('resolves numeric default avatar assets to their local image file', () => {
		expect(userAvatarURL({ getAvatarURL: () => 42, id: '123' })).toBe(
			'file:///private/Discord.app/default-avatar.png',
		);
		expect(userAvatarURL({ getAvatarURL: () => 43, id: '123' })).toBeUndefined();
	});

	test('loads a bundled default avatar through the scoped native bridge', async () => {
		const bytes = new Uint8Array([1, 2, 3]);
		const bridge = {
			getClass: () => ({ name: 'NSData' }),
			invokeAsync: async (_target: unknown, selector: string, args: unknown[]) => {
				expect(selector).toBe('dataWithContentsOfFile:');
				expect(args).toEqual(['/private/Discord.app/default avatar.png']);
				return bytes;
			},
		} as NativeObjCBridge;
		expect(
			await loadMentionImageBytes('file:///private/Discord.app/default%20avatar.png', bridge),
		).toBe(bytes);
	});

	test('retains the verified SE role symbol size', () => {
		expect(ROLE_SYMBOL_METRICS).toEqual({ pointSize: 14 });
	});

	test('uses the original role and user attachment metrics', () => {
		expect(mentionImageMetrics('role')).toEqual({ leading: 4, size: 16, trailing: 2 });
		expect(mentionImageMetrics('user')).toEqual({ leading: 2, size: 16, trailing: 4 });
	});

	test('falls back to role color when the role has no custom icon', () => {
		expect(roleImageSource({ id: '123', color: 0x336699, icon: null })).toEqual({
			avatarURL: undefined,
			roleColor: 0x336699,
		});
	});

	test('uses the UIImage tint API without passing CGColor pointers through the bridge', () => {
		tintableSelectors.add('imageWithTintColor:renderingMode:');
		plugin.start?.({ native } as never);

		const image = { name: 'image' };
		const tint = { name: 'tint' };

		expect(tintRoleSymbol(image, tint)).toBe(tintedImage);
		expect(nativeCalls).toContain('image:imageWithTintColor:renderingMode:');
		expect(nativeCalls).not.toContain('tint:CGColor');
	});

	test('does not start duplicate image requests while pending or in retry delay', () => {
		const pending = Promise.resolve(null);
		expect(imageCacheAction({ image: null, pending }, 100)).toBe('pending');
		expect(imageCacheAction({ image: null, retryAt: 200 }, 100)).toBe('retry');
		expect(imageCacheAction({ image: null, retryAt: 100 }, 100)).toBe('load');
	});
});

describe('mention channel lifecycle', () => {
	test('ignores store notifications that keep the selected channel', () => {
		expect(shouldHandleChannelChange('channel', 'channel')).toBe(false);
		expect(shouldHandleChannelChange('channel', undefined)).toBe(false);
	});

	test('handles transitions to a different selected channel', () => {
		expect(shouldHandleChannelChange('channel', 'another-channel')).toBe(true);
		expect(shouldHandleChannelChange(undefined, 'channel')).toBe(true);
	});
});

describe('mention cell lifecycle', () => {
	test('preserves detached cells and renders only when they are attached', () => {
		expect(mentionCellLifecycleAction(false, false)).toBe('preserve');
		expect(mentionCellLifecycleAction(true, false)).toBe('render');
		expect(mentionCellLifecycleAction(false, true)).toBe('reset');
	});
});

describe('cell reuse rendering', () => {
	test('retries when a reused cell has unresolved message data', () => {
		expect(cellRenderDecision('message', true, true, [])).toBe('retry');
		expect(cellRenderDecision('message', false, false, [])).toBe('retry');
	});

	test('renders known mentions and idles for an empty cell', () => {
		expect(
			cellRenderDecision('message', true, false, [{ labels: ['member'], type: 'user' }]),
		).toBe('render');
		expect(cellRenderDecision(undefined, true, false, [])).toBe('idle');
	});
});

describe('mention avatars native lifecycle', () => {
	test('does not repeatedly redraw a hydrated mention after one layout event', async () => {
		fixtureMessage = { channel_id: 'channel', content: '<@123>', id: 'message' };
		scanCells = [];
		plugin.start?.({ native } as never);

		hookHandlers.get('layoutSubviews')?.({ self: { name: 'cell' } });
		await new Promise((resolve) => setTimeout(resolve, 250));

		expect(nativeCalls.filter((call) => call === 'cell:subviews')).toHaveLength(1);
	});

	test('reuses attached text views across repeated layout events', async () => {
		fixtureMessage = { channel_id: 'channel', content: '<@123>', id: 'message' };
		fixtureTextView = true;
		scanCells = [];
		plugin.start?.({ native } as never);

		for (let index = 0; index < 3; index++) {
			hookHandlers.get('layoutSubviews')?.({ self: { name: 'cell' } });
			await new Promise((resolve) => setTimeout(resolve, 0));
		}

		expect(nativeCalls.filter((call) => call === 'cell:subviews')).toHaveLength(1);
	});

	test('does not rebuild unchanged attributed mentions on repeated layout events', async () => {
		fixtureMessage = { channel_id: 'channel', content: '<@123>', id: 'message' };
		fixtureTextView = true;
		fixtureAttributedText = true;
		scanCells = [];
		plugin.start?.({ native } as never);

		for (let index = 0; index < 2; index++) {
			hookHandlers.get('layoutSubviews')?.({ self: { name: 'cell' } });
			await new Promise((resolve) => setTimeout(resolve, 0));
		}

		expect(nativeCalls.filter((call) => call === 'attributed:mutableCopy')).toHaveLength(1);
	});

	test('bounds native view traversal for a deeply nested message cell', async () => {
		fixtureMessage = { channel_id: 'channel', content: '<@123>', id: 'message' };
		nestedViewDepth = 2_000;
		scanCells = [];
		plugin.start?.({ native } as never);

		hookHandlers.get('layoutSubviews')?.({ self: { name: 'cell' } });
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(nativeCalls.filter((call) => call.endsWith(':subviews')).length).toBeLessThanOrEqual(
			1_600,
		);
	});

	test('skips text view traversal for cells without mentions', async () => {
		fixtureMessage = { channel_id: 'channel', content: 'hello', id: 'message' };
		scanCells = [];
		plugin.start?.({ native } as never);

		hookHandlers.get('layoutSubviews')?.({ self: { name: 'cell' } });
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(nativeCalls).not.toContain('cell:subviews');
	});

	test('searches long message text without querying attributes for every character', async () => {
		fixtureMessage = { channel_id: 'channel', content: '<@123>', id: 'message' };
		fixtureTextView = true;
		fixtureAttributedText = true;
		attributedTextValue = `${'x'.repeat(400)}@member`;
		highlightedStart = 400;
		highlightedLength = 7;
		scanCells = [];
		plugin.start?.({ native } as never);

		hookHandlers.get('layoutSubviews')?.({ self: { name: 'cell' } });
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(
			nativeCalls.filter((call) => call === 'mutable:attributesAtIndex:effectiveRange:')
				.length,
		).toBeLessThan(24);
	});

	test('stops reading highlight attributes after the matched mention label', async () => {
		fixtureMessage = { channel_id: 'channel', content: '<@123>', id: 'message' };
		fixtureTextView = true;
		fixtureAttributedText = true;
		attributedTextValue = `@member ${'x'.repeat(400)}`;
		highlightedStart = 0;
		highlightedLength = attributedTextValue.length;
		scanCells = [];
		plugin.start?.({ native } as never);

		hookHandlers.get('layoutSubviews')?.({ self: { name: 'cell' } });
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(
			nativeCalls.filter((call) => call === 'mutable:attributesAtIndex:effectiveRange:')
				.length,
		).toBeLessThan(24);
	});

	test('does not copy unrelated attributed text without a mention marker', async () => {
		fixtureMessage = { channel_id: 'channel', content: '<@123>', id: 'message' };
		fixtureTextView = true;
		fixtureAttributedText = true;
		attributedTextValue = 'plain content';
		scanCells = [];
		plugin.start?.({ native } as never);

		hookHandlers.get('layoutSubviews')?.({ self: { name: 'cell' } });
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(nativeCalls).not.toContain('attributed:mutableCopy');
	});

	test('does not descend into reaction avatars while finding message text', async () => {
		fixtureMessage = { channel_id: 'channel', content: '<@123>', id: 'message' };
		reactionSubtree = true;
		scanCells = [];
		plugin.start?.({ native } as never);

		hookHandlers.get('layoutSubviews')?.({ self: { name: 'cell' } });
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(nativeCalls).not.toContain('reaction-list:subviews');
	});

	test('installs generic cell lifecycle hooks through the scoped native facade', () => {
		plugin.start?.({ native } as never);

		expect(hooks).toEqual(['didMoveToWindow', 'layoutSubviews', 'prepareForReuse']);
	});

	test('checks cell attachment asynchronously after the visibility hook', async () => {
		fixtureMessage = { channel_id: 'channel', content: '<@123>', id: 'message' };
		scanCells = [];
		plugin.start?.({ native } as never);
		nativeCalls.length = 0;

		hookHandlers.get('didMoveToWindow')?.({ self: { name: 'cell' } });

		expect(nativeCalls).toContain('cell:async:window');
		expect(nativeCalls).not.toContain('cell:window');
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(nativeCalls).toContain('cell:current:hash');
	});

	test('identifies a layout cell without crossing to the main thread', () => {
		scanCells = [];
		plugin.start?.({ native } as never);
		nativeCalls.length = 0;

		hookHandlers.get('layoutSubviews')?.({ self: { name: 'cell' } });

		expect(nativeCalls).toContain('cell:current:hash');
		expect(nativeCalls).not.toContain('cell:hash');
	});

	test('discards a visibility result after the plugin stops', async () => {
		const originalInvokeAsync = native.objc.invokeAsync;
		let resolveWindow: ((window: { name: string }) => void) | undefined;
		native.objc.invokeAsync = () =>
			new Promise((resolve) => {
				resolveWindow = resolve;
			});
		try {
			scanCells = [];
			plugin.start?.({ native } as never);
			nativeCalls.length = 0;
			hookHandlers.get('didMoveToWindow')?.({ self: { name: 'cell' } });
			plugin.stop?.();
			resolveWindow?.({ name: 'window' });
			await new Promise((resolve) => setTimeout(resolve, 0));
			expect(nativeCalls).not.toContain('cell:current:hash');
		} finally {
			native.objc.invokeAsync = originalInvokeAsync;
		}
	});

	test('removes every native hook when the plugin stops', () => {
		plugin.start?.({ native } as never);
		plugin.stop?.();

		expect(removed).toEqual(['didMoveToWindow', 'layoutSubviews', 'prepareForReuse']);
	});

	test('rescans cells on channel changes and removes the listener when stopped', () => {
		plugin.start?.({ native } as never);

		expect(channelListeners.size).toBe(1);

		plugin.stop?.();

		expect(channelListeners.size).toBe(0);
	});

	test('scans message cells through the active application windows', async () => {
		plugin.start?.({ native } as never);

		await new Promise((resolve) => setTimeout(resolve, 25));

		expect(nativeCalls).toContain('UIApplication:sharedApplication');
		expect(nativeCalls).toContain('application:windows');
		expect(nativeCalls).toContain('window:findViews');
		expect(nativeCalls).not.toContain('window:subviews');
	});

	test('discards a visible-cell search after the plugin stops', async () => {
		const originalFindViews = native.objc.findViews;
		let resolveSearch: ((cells: { name: string }[]) => void) | undefined;
		native.objc.findViews = () =>
			new Promise((resolve) => {
				resolveSearch = resolve;
			});
		try {
			plugin.start?.({ native } as never);
			await new Promise((resolve) => setTimeout(resolve, 25));
			plugin.stop?.();
			resolveSearch?.([{ name: 'cell' }]);
			await new Promise((resolve) => setTimeout(resolve, 0));
			expect(nativeCalls).not.toContain('cell:hash');
		} finally {
			native.objc.findViews = originalFindViews;
		}
	});
});
