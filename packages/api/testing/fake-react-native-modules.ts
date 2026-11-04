import { createElement, type ReactNode } from 'react';

type Listener = (...args: never[]) => void;

type Children = { children?: ReactNode };

type ValueState = { value: number };

type ValueListener = (state: ValueState) => void;

type AnimationConfig = { toValue?: number };

type InterpolationConfig = { inputRange: number[]; outputRange: (number | string)[] };

type Curve = (value: number) => number;

/** A subscription: `remove` stops it. */
export type EmitterSubscription = { remove: () => void };

/**
 * @description `react-native`'s `NativeEventEmitter`: `addListener` subscribes, and a test calls `emit` to fire an event as the native module would.
 */
export class NativeEventEmitter {
	private readonly listeners = new Map<string, Set<Listener>>();

	addListener(event: string, listener: Listener): EmitterSubscription {
		const set = this.listeners.get(event) ?? new Set<Listener>();

		this.listeners.set(event, set);
		set.add(listener);

		return { remove: () => void set.delete(listener) };
	}

	emit(event: string, ...args: unknown[]): void {
		for (const listener of this.listeners.get(event) ?? []) {
			(listener as (...params: unknown[]) => void)(...args);
		}
	}

	listenerCount(event: string): number {
		return this.listeners.get(event)?.size ?? 0;
	}

	removeAllListeners(event?: string): void {
		if (event === undefined) {
			this.listeners.clear();
		} else {
			this.listeners.delete(event);
		}
	}
}

function channels(hex: string): [number, number, number, number] | undefined {
	const digits =
		hex.length === 3 || hex.length === 4
			? Array.from(hex, (char) => char + char)
			: hex.match(/../g);

	if (!digits || (digits.length !== 3 && digits.length !== 4)) return;

	const [red, green, blue, alpha = 255] = digits.map((digit) => Number.parseInt(digit, 16));

	return [red, green, blue, alpha].some((value) => Number.isNaN(value))
		? undefined
		: [red, green, blue, alpha];
}

function functional(color: string): [number, number, number, number] | undefined {
	const open = color.indexOf('(');

	if (open < 0 || !color.endsWith(')')) return;

	const parts = color
		.slice(open + 1, -1)
		.split(/[\s,/]+/)
		.filter(Boolean)
		.map(Number);
	const [red, green, blue, alpha = 1] = parts;

	if (parts.length < 3 || parts.some((value) => Number.isNaN(value))) return;

	return [red, green, blue, Math.round(alpha * 255)];
}

/**
 * @description `react-native`'s `processColor` for hex and `rgb()`/`rgba()` strings: the colour as the unsigned `0xAARRGGBB` number native receives.
 * @param color The colour, such as `#5865f2` or `rgba(0, 0, 0, 0.5)`.
 * @returns The number, `undefined` for a string it cannot read, or `color` itself when it is `null` or `undefined`.
 */
export function processColor(color: string | number | null | undefined) {
	if (color === null || color === undefined) {
		return color;
	}

	if (typeof color === 'number') {
		return color >>> 0;
	}

	const text = color.trim().toLowerCase();
	const read = text.startsWith('#') ? channels(text.slice(1)) : functional(text);

	if (!read) return;

	const [red, green, blue, alpha] = read;

	return ((alpha << 24) | (red << 16) | (green << 8) | blue) >>> 0;
}

/** An animated number: reads and writes like `react-native`'s `Animated.Value`, with no frames. */
export class AnimatedValue {
	private current: number;
	private readonly listeners = new Set<ValueListener>();

	constructor(value: number) {
		this.current = value;
	}

	setValue(value: number): void {
		this.current = value;

		for (const listener of this.listeners) listener({ value });
	}

	setOffset(): void {}

	flattenOffset(): void {}

	stopAnimation(callback?: (value: number) => void): void {
		callback?.(this.current);
	}

	addListener(listener: ValueListener): string {
		this.listeners.add(listener);

		return String(this.listeners.size);
	}

	removeAllListeners(): void {
		this.listeners.clear();
	}

	interpolate(config: InterpolationConfig) {
		const { inputRange, outputRange } = config;
		const index = inputRange.findLastIndex((input) => input <= this.current);

		return outputRange[Math.max(index, 0)];
	}

	__getValue(): number {
		return this.current;
	}
}

type Finish = { finished: boolean };

type Completion = (result: Finish) => void;

type Animation = { start: (callback?: Completion) => void; stop: () => void; reset: () => void };

function instant(run: () => void): Animation {
	return {
		start(callback) {
			run();
			callback?.({ finished: true });
		},
		stop() {},
		reset() {},
	};
}

function toValue(config: AnimationConfig) {
	return config.toValue ?? 0;
}

function settle(animations: Animation[]): Animation {
	return instant(() => {
		for (const animation of animations) animation.start();
	});
}

function component(name: string) {
	return (props: Children) => createElement(name, props);
}

/**
 * @description Creates the `Animated` of `react-native`: every animation finishes at once with its end value, and its views are host nodes `find` reaches by name.
 * @returns The module.
 */
export function createFakeAnimated() {
	return {
		Value: AnimatedValue,
		ValueXY: class AnimatedValueXY {
			x = new AnimatedValue(0);
			y = new AnimatedValue(0);
		},
		timing: (value: AnimatedValue, config: AnimationConfig) =>
			instant(() => value.setValue(toValue(config))),
		spring: (value: AnimatedValue, config: AnimationConfig) =>
			instant(() => value.setValue(toValue(config))),
		decay: () => instant(() => {}),
		parallel: settle,
		sequence: settle,
		stagger: (_delay: number, animations: Animation[]) => settle(animations),
		delay: () => instant(() => {}),
		loop: (animation: Animation) => instant(() => animation.start()),
		event: () => () => {},
		add: (left: AnimatedValue, right: AnimatedValue) =>
			new AnimatedValue(left.__getValue() + right.__getValue()),
		subtract: (left: AnimatedValue, right: AnimatedValue) =>
			new AnimatedValue(left.__getValue() - right.__getValue()),
		multiply: (left: AnimatedValue, right: AnimatedValue) =>
			new AnimatedValue(left.__getValue() * right.__getValue()),
		divide: (left: AnimatedValue, right: AnimatedValue) =>
			new AnimatedValue(left.__getValue() / right.__getValue()),
		createAnimatedComponent: <T>(wrapped: T) => wrapped,
		View: 'Animated.View',
		Text: 'Animated.Text',
		Image: 'Animated.Image',
		ScrollView: 'Animated.ScrollView',
		FlatList: component('Animated.FlatList'),
	};
}

const identity = (value: number) => value;

/**
 * @description Passes an easing curve through, since the fake draws no frames.
 * @param curve The curve.
 * @returns The same curve.
 */
function keep(curve: Curve): Curve {
	return curve;
}

/**
 * @description `Easing.bezier` for the fake: every curve is linear.
 * @returns The linear curve.
 */
function bezier(): Curve {
	return identity;
}

/** The `Easing` of `react-native`: every curve is linear, as there are no frames to draw. */
export const Easing = {
	linear: identity,
	ease: identity,
	quad: identity,
	cubic: identity,
	sin: identity,
	circle: identity,
	exp: identity,
	bounce: identity,
	in: keep,
	out: keep,
	inOut: keep,
	bezier,
};

/**
 * @description `Share.share` for the fake: sharing succeeds at once.
 * @returns The shared action.
 */
async function share() {
	return { action: 'sharedAction' };
}

/** The `Share` of `react-native`: sharing succeeds at once. */
export const Share = {
	sharedAction: 'sharedAction',
	dismissedAction: 'dismissedAction',
	share,
};
