import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';

import { createHookRenderer } from '../../helpers/render-hook';

type Finish = (finished?: boolean) => void;
type Animation = { kind: 'spring' | 'timing'; to: number; duration?: number; finish: Finish };

const { React, renderHook } = createHookRenderer();
const animations: Animation[] = [];
let reduced = false;

// The spring or timing config the hook passes; the fakes record its duration.
type AnimationConfig = { duration?: number; easing?: unknown };

// Reanimated's clamped linear interpolation over one input segment, as the hook uses it.
function interpolate(value: number, [from, to]: number[], [start, end]: number[]) {
	const t = Math.min(1, Math.max(0, (value - from) / (to - from)));

	return start + (end - start) * t;
}

function animate(kind: Animation['kind']) {
	return (to: number, config: AnimationConfig, finish: Finish) => {
		animations.push({ kind, to, duration: config.duration, finish });

		return to;
	};
}

mock.module('react', () => React);

// The real JSX runtime reads React's internals, which the hook renderer's React lacks.
function jsx<T, P>(type: T, props: P) {
	return { type, props };
}

mock.module('react/jsx-runtime', () => ({ jsx, jsxs: jsx, Fragment: 'Fragment' }));
mock.module('react/jsx-dev-runtime', () => ({ jsxDEV: jsx, Fragment: 'Fragment' }));
mock.module('react-native-reanimated', () => ({
	runOnJS: (callback: () => void) => callback,
	useSharedValue: (initial: number) => React.useRef({ value: initial }).current,
	useAnimatedStyle: (style: () => object) => style(),
	withSpring: animate('spring'),
	withTiming: animate('timing'),
	interpolate,
	Extrapolation: { CLAMP: 'clamp' },
	Easing: {
		cubic: 'cubic',
		in: (curve: string) => `in-${curve}`,
		out: (curve: string) => `out-${curve}`,
	},
}));
mock.module('~/ui/hooks/use-reduced-motion', () => ({ default: () => reduced }));

// The manager's `changed` event, as `useAddonPhase` hears it: one call re-renders the hook's component.
let announceChange: () => void = () => {};

mock.module('~/ui/hooks/use-addon-phase', () => ({
	default: () => {
		const [version, setVersion] = React.useState(0);

		announceChange = () => setVersion(version + 1);
	},
}));
mock.module('~/metro/components', () => ({ Discord: { Text: 'Text' } }));
mock.module('~/metro/common', () => ({ Theme: { colors: {} } }));
mock.module('~/i18n/api', () => ({ messages: { UNBOUND_PLUGIN_NOT_RUNNING: 'Not running' } }));
mock.module('~/ui/addons/addon-panel-host.style', () => ({ default: () => ({ notice: {} }) }));

const { default: useSettingsButtonMotion } = await import('~/ui/addons/use-settings-button-motion');
const { default: AddonPanelHost } = await import('~/ui/addons/addon-panel-host');

// Flips the hook's `visible` the way a re-render with a new prop would.
function mountMotion(initial: boolean) {
	let setVisible: (next: boolean) => void = () => {};
	const rendered = renderHook(() => {
		const [visible, set] = React.useState(initial);

		setVisible = set;

		return useSettingsButtonMotion(visible);
	});

	return { rendered, set: (next: boolean) => setVisible(next) };
}

beforeEach(() => {
	animations.length = 0;
	reduced = false;
});

afterEach(() => {
	animations.length = 0;
});

describe('the settings button motion', () => {
	test('mounts and slides in when it shows, and unmounts only after the exit finishes', () => {
		const motion = mountMotion(false);

		expect(motion.rendered.current.mounted).toBe(false);

		motion.set(true);

		expect(motion.rendered.current.mounted).toBe(true);
		expect(animations.at(-1)).toMatchObject({ kind: 'timing', to: 1 });

		motion.set(false);

		expect(animations.at(-1)).toMatchObject({ kind: 'timing', to: 0 });
		expect(motion.rendered.current.mounted).toBe(true);

		animations.at(-1)?.finish(true);

		expect(motion.rendered.current.mounted).toBe(false);
	});

	test('starts tucked under the overflow button at no size, its slot closed', () => {
		const motion = mountMotion(false);

		expect(motion.rendered.current.style).toMatchObject({
			marginRight: -40,
			transform: [{ scale: 0 }],
		});
	});

	test('lands exactly in its slot at full size', () => {
		const motion = mountMotion(true);

		expect(motion.rendered.current.style).toMatchObject({
			marginRight: -0,
			transform: [{ scale: 1 }],
		});
	});

	test('keeps the button when a re-show interrupts the exit, reversing from where it is', () => {
		const motion = mountMotion(true);

		motion.set(false);

		const exit = animations.at(-1);

		motion.set(true);
		exit?.finish(false);

		expect(animations.at(-1)).toMatchObject({ kind: 'timing', to: 1 });
		expect(motion.rendered.current.mounted).toBe(true);
	});

	test('cross-fades without a slide or scale under reduced motion', () => {
		reduced = true;

		const motion = mountMotion(false);

		motion.set(true);

		expect(animations.at(-1)).toMatchObject({ kind: 'timing', to: 1 });
		expect(motion.rendered.current.style).toMatchObject({ marginRight: 0, transform: [] });
	});
});

describe('an open settings panel', () => {
	test("swaps to a notice once the plugin stops, instead of rendering the stopped plugin's components", () => {
		function Panel() {
			return null;
		}

		const addon = {
			id: 'panel.example',
			phase: 'running' as const,
			hasSettingsPanel: true,
			SettingsPanel: Panel as typeof Panel | undefined,
		};
		const rendered = renderHook(() => AddonPanelHost({ addon }));

		expect(rendered.current.type).toBe(Panel);

		addon.SettingsPanel = undefined;
		announceChange();

		expect(rendered.current.type).toBe('Text');
		expect(rendered.current.props.children).toBe('Not running');
	});
});
