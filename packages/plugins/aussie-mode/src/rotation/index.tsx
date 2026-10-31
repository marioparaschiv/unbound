import { whenLoaded } from '@unbound-plugins/shared/metro/when-loaded';
import { metro, patcher } from '@unbound-app/api';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { ROTATED_CLASS_COMPONENTS, ROTATED_NAVIGATOR, ROTATED_SCREEN_FILES } from '~/constants';

type Cleanup = () => void;
type Render = (...args: never[]) => ReactNode;
type RenderedModule = { default?: unknown };
type ScreenElement = { props?: { name?: string; getComponent?: () => unknown } };

let generation = 0;

function rotated(result: ReactNode) {
	return (
		<View pointerEvents='box-none' style={{ flex: 1, transform: [{ rotate: '180deg' }] }}>
			{result}
		</View>
	);
}

function rotateClassComponent(name: string): Cleanup {
	const Component = metro.findByName(name, { lazy: false });

	if (typeof Component?.prototype?.render !== 'function') return () => {};

	return patcher.after(Component.prototype, 'render', ({ result }) => rotated(result));
}

function rotateScreenModule(module: RenderedModule): Cleanup | void {
	const Component = module.default as { type?: unknown } | undefined;

	if (typeof Component === 'function') {
		return patcher.after(module as { default: Render }, 'default', ({ result }) =>
			rotated(result),
		);
	}

	if (typeof Component?.type === 'function') {
		return patcher.after(Component as { type: Render }, 'type', ({ result }) =>
			rotated(result),
		);
	}
}

function rotateNavigatorRoot(): Cleanup {
	const navigation = metro.findByProps('useNavigationBuilder', { lazy: false });

	if (typeof navigation?.useNavigationBuilder !== 'function') return () => {};

	const patched = new WeakSet<object>();

	return patcher.before(navigation, 'useNavigationBuilder', ({ args }) => {
		const children = (args[1] as { children?: unknown } | undefined)?.children;
		const screens = (
			Array.isArray(children) ? children : children ? [children] : []
		) as ScreenElement[];
		const names = screens.map((screen) => screen?.props?.name).filter(Boolean);

		if (!ROTATED_NAVIGATOR.siblings.every((name) => names.includes(name))) return;

		const target = screens.find((screen) => screen?.props?.name === ROTATED_NAVIGATOR.target);
		const Component = target?.props?.getComponent?.() as { type?: unknown } | undefined;

		if (!Component || typeof Component.type !== 'function' || patched.has(Component)) return;

		patched.add(Component);
		patcher.after(Component as { type: Render }, 'type', ({ result }) => rotated(result));
	});
}

function rotateActionSheets(current: number): Cleanup {
	const sheets = metro.findByProps('openLazy', 'hideActionSheet', { lazy: false });

	if (typeof sheets?.openLazy !== 'function') return () => {};

	return patcher.before(sheets, 'openLazy', ({ args }) => {
		const [pending] = args as [Promise<RenderedModule> | undefined];

		if (typeof pending?.then !== 'function') return;

		args[0] = pending.then((module) => {
			const Component = module?.default as ((props: object) => ReactNode) | undefined;

			if (current !== generation || !Component) return module;

			return { ...module, default: (props: object) => rotated(<Component {...props} />) };
		});
	});
}

/**
 * @description Turns Discord upside down: the root error boundary, the You and Settings tabs, the chat
 * navigator's root screen and every lazily opened action sheet render inside a view rotated 180 degrees.
 * Screens that load later are patched when their module loads. All of it is React Native, so it is the
 * same on iOS and Android.
 * @returns A function that removes every rotation.
 */
export function startRotation(): Cleanup {
	const current = ++generation;
	const cleanups = [
		...ROTATED_CLASS_COMPONENTS.map(rotateClassComponent),
		...ROTATED_SCREEN_FILES.map((file) =>
			whenLoaded<RenderedModule>(file, rotateScreenModule, { interop: false }),
		),
		rotateNavigatorRoot(),
		rotateActionSheets(current),
	];

	return () => {
		generation++;
		for (const cleanup of cleanups.reverse()) cleanup();
	};
}
