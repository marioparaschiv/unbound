import { afterEach, describe, expect, mock, test } from 'bun:test';

const composerContainerModule = { default: () => null };
let patchCount = 0;
let unpatchCount = 0;
let removeListenerCount = 0;
let composerContainerAvailable = true;
let filePathQuery = '';
let moduleListener: ((module: any, id: string) => void) | null = null;
let afterHandler: ((context: any) => any) | null = null;
let effectCleanups: Array<() => void> = [];
let snapshotText = '';
const themeColors = { TEXT_DEFAULT: '#f2f3f5' };
const fragment = Symbol('Fragment');
const reactMock = {
	Fragment: fragment,
	createElement(type: any, props: any, ...children: any[]) {
		return { type, props: { ...props, children } };
	},
	cloneElement(element: any, props: any, ...children: any[]) {
		return {
			...element,
			ref: props?.ref ?? element.ref,
			props: { ...element.props, ...props, children: children[0] },
		};
	},
	useState(initial: unknown) {
		if (typeof initial === 'object' && initial !== null && 'text' in initial) {
			return [{ ...initial, text: snapshotText }, () => {}];
		}
		return [initial, () => {}];
	},
	useEffect(effect: () => void | (() => void)) {
		const cleanup = effect();
		if (cleanup) effectCleanups.push(cleanup);
	},
};

mock.module('@unbound-app/api', () => ({
	metro: {
		common: {
			React: reactMock,
			ReactNative: {
				Text: (props: any) => ({ type: 'Text', props }),
				View: (props: any) => ({ type: 'View', props }),
			},
			Theme: { colors: themeColors },
		},
		findByFilePath: (path: string) => {
			filePathQuery = path;
			return composerContainerAvailable ? composerContainerModule : undefined;
		},
		findByProps: (...props: string[]) => {
			if (props.includes('getBestActiveInputForChannelId')) {
				return { getBestActiveInputForChannelId: () => ({ getText: () => '' }) };
			}
			if (props.includes('getCurrentUser'))
				return { getCurrentUser: () => ({ premiumType: 0 }) };
			if (props.includes('getChannelId')) return { getChannelId: () => 'channel' };
			return undefined;
		},
		addListener: (listener: (module: any, id: string) => void) => {
			moduleListener = listener;
			return () => {
				removeListenerCount++;
				return true;
			};
		},
	},
	patcher: {
		after: (_holder: any, _prop: string, callback: (context: any) => any) => {
			patchCount++;
			afterHandler = callback;
			return () => unpatchCount++;
		},
	},
	storage: { getStore: () => ({ get: (_key: string, fallback: unknown) => fallback }) },
}));
mock.module('@shared/settings-ui', () => ({
	getSettingsColors: () => ({}),
	SettingsCard: () => null,
	SettingsRow: () => null,
	SettingsScrollView: () => null,
	SettingsSection: () => null,
	SettingsSwitchRow: () => null,
}));

const {
	characterLimit,
	counterOverlayStyle,
	counterSurface,
	counterTone,
	default: plugin,
} = await import('@character-counter/index');

afterEach(() => {
	plugin.stop();
	for (const cleanup of effectCleanups) cleanup();
	effectCleanups = [];
	patchCount = 0;
	unpatchCount = 0;
	removeListenerCount = 0;
	composerContainerAvailable = true;
	filePathQuery = '';
	moduleListener = null;
	afterHandler = null;
	effectCleanups = [];
	snapshotText = '';
});

describe('character counter limits', () => {
	test('uses Discord message limits for standard and Nitro accounts', () => {
		expect(characterLimit(0)).toBe(2000);
		expect(characterLimit(2)).toBe(4000);
	});
});

describe('counter color thresholds', () => {
	test('moves through warning colors as the limit approaches', () => {
		expect(counterTone(999, 2000, true)).toBe('muted');
		expect(counterTone(1000, 2000, true)).toBe('yellow');
		expect(counterTone(1500, 2000, true)).toBe('orange');
		expect(counterTone(1800, 2000, true)).toBe('red');
	});

	test('can disable warning colors', () => {
		expect(counterTone(1950, 2000, false)).toBe('primary');
	});

	test('anchors the counter just above the composer without affecting its layout', () => {
		expect(counterOverlayStyle()).toEqual({
			position: 'absolute',
			top: -26,
			right: 28,
			zIndex: 10,
		});
	});
});

describe('counter pill contrast', () => {
	test('chooses a subtle surface against dark and light theme text', () => {
		expect(counterSurface('#f2f3f5')).toBe('rgba(255, 255, 255, 0.12)');
		expect(counterSurface('rgb(49, 51, 56)')).toBe('rgba(0, 0, 0, 0.08)');
		expect(counterSurface(undefined)).toBe('rgba(255, 255, 255, 0.12)');
	});
});

describe('composer lifecycle', () => {
	test('installs one composer patch and removes it when stopped', () => {
		plugin.start();
		plugin.start();
		expect(patchCount).toBe(1);

		plugin.stop();
		expect(unpatchCount).toBe(1);
	});

	test('targets the loaded Discord composer module', () => {
		plugin.start();

		expect(filePathQuery).toBe('modules/chat_input/native/FloatingChatInputContainer.tsx');
	});

	test('adds an absolute counter overlay without changing composer layout', () => {
		plugin.start();
		const originalChild = { type: 'Composer' };
		const originalStyle = { height: 72 };
		const originalOnLayout = () => {};
		const result = {
			type: 'View',
			props: { children: originalChild, onLayout: originalOnLayout, style: originalStyle },
		};

		const patched = afterHandler?.({
			args: [{ channel: { id: 'channel-7' } }],
			result,
		});
		const [composer, overlay] = patched.props.children.props.children;
		const renderedOverlay = overlay.type(overlay.props);

		expect(patched.type).toBe(result.type);
		expect(patched.props.style).toBe(originalStyle);
		expect(patched.props.onLayout).toBe(originalOnLayout);
		expect(patched.props.children.type).toBe(fragment);
		expect(composer).toBe(originalChild);
		expect(overlay.type.name).toBe('CounterOverlay');
		expect(overlay.props.channelId).toBe('channel-7');
		expect(renderedOverlay.props.pointerEvents).toBe('none');
		expect(renderedOverlay.props.style).toEqual(counterOverlayStyle());
	});

	test('replaces stale overlay children instead of duplicating them on rerender', () => {
		plugin.start();
		const args = [{ channel: { id: 'channel-7' } }];
		let result: any = { type: 'View', props: { children: { type: 'Composer' } } };

		for (let render = 0; render < 3; render++) {
			result = afterHandler?.({ args, result });
		}

		function countCounterOverlays(node: any): number {
			if (Array.isArray(node))
				return node.reduce((count, child) => count + countCounterOverlays(child), 0);
			if (!node || typeof node !== 'object') return 0;
			if (node.type?.name === 'CounterOverlay') return 1;
			return node.type === fragment ? countCounterOverlays(node.props?.children) : 0;
		}

		expect(countCounterOverlays(result.props.children)).toBe(1);
	});

	test('mounts the counter and cleans up its live input refresh', () => {
		snapshotText = 'counter-check';
		plugin.start();
		const patched = afterHandler?.({
			args: [{ channel: { id: 'channel-7' } }],
			result: { type: 'View', props: { children: [] } },
		});
		const overlay = patched.props.children.props.children[1];
		const positionedOverlay = overlay.type(overlay.props);
		const counter = positionedOverlay.props.children;

		const rendered = counter.type(counter.props);

		expect(typeof rendered.type).toBe('function');
		expect(rendered.props.style.backgroundColor).toBe('rgba(255, 255, 255, 0.12)');
		expect(rendered.props.style.height).toBe(20);
		expect(rendered.props.children.props.style.color).toBe('#f2f3f5');
		expect(rendered.props.children.props.style.lineHeight).toBe(14);
		expect(rendered.props.children.props.style.transform).toBeUndefined();
		expect(rendered.props.children.props.children).toEqual([13, '/', 2000]);
		expect(effectCleanups).toHaveLength(1);
	});

	test('waits for the floating composer module without polling and removes its listener', () => {
		composerContainerAvailable = false;
		plugin.start();
		expect(patchCount).toBe(0);

		composerContainerAvailable = true;
		moduleListener?.(composerContainerModule, 'composer-container');

		expect(patchCount).toBe(1);
		expect(removeListenerCount).toBe(1);
	});
});
