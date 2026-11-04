import type { ReactNode } from 'react';

import type { FakeModule } from './fake-metro';

type ComponentProps = { children?: ReactNode };

/** A fake Discord component: it draws its children, and `find` reaches it by the name it was made with. */
export type FakeComponent = ((props: ComponentProps) => ReactNode) & FakeModule;

const BAGS = [
	'AvatarPiles',
	'Avatars',
	'BackdropFilters',
	'BottomSheets',
	'DefaultAvatars',
	'Discord',
	'FlashList',
	'Forms',
	'Media',
	'Portal',
	'SafeArea',
	'Video',
] as const;

const UI = [
	'ButtonRow',
	'CheckboxRow',
	'ChecklistRow',
	'ColorRow',
	'DurationRow',
	'EntityRow',
	'InputRow',
	'ListRow',
	'MultilineRow',
	'NumberRow',
	'Page',
	'PaletteRow',
	'PickerRow',
	'RadioRow',
	'ResetRow',
	'RestartRow',
	'Row',
	'SchemaPanel',
	'SecretRow',
	'Section',
	'SegmentedRow',
	'SliderRow',
	'StepperRow',
	'SwitchRow',
	'UrlRow',
] as const;

function isCapitalised(key: string): boolean {
	return key !== '' && key[0] === key[0]?.toUpperCase() && key[0] !== key[0]?.toLowerCase();
}

/**
 * @description Creates a component that draws its children and is named `name`, so `find(name)` reaches it with its props.
 * A capitalised member, such as `ActionSheetRow.Icon`, is another component named `ActionSheetRow.Icon`.
 * @param name The name `find` matches.
 * @returns The component.
 */
export function createFakeComponent(name: string): FakeComponent {
	const members = new Map<string, FakeComponent>();

	function Component({ children }: ComponentProps) {
		return children ?? null;
	}

	Component.displayName = name;

	return new Proxy(Component as FakeComponent, {
		get(target, key, receiver) {
			if (typeof key !== 'string' || key in target || !isCapitalised(key)) {
				return Reflect.get(target, key, receiver);
			}

			const member = members.get(key) ?? createFakeComponent(`${name}.${key}`);

			members.set(key, member);

			return member;
		},
	});
}

/**
 * @description Creates a module of fake components: any capitalised name is a component of that name, and a test may set its own.
 * @param members Members that are not components, such as `createStyles`.
 * @returns The module.
 */
function createComponentBag(members: FakeModule = {}): FakeModule {
	const components = new Map<string, unknown>(Object.entries(members));

	return new Proxy<FakeModule>(
		{},
		{
			get(_target, key) {
				if (typeof key !== 'string') {
					return undefined;
				}

				if (!isCapitalised(key)) {
					return components.get(key);
				}

				const component = components.get(key) ?? createFakeComponent(key);

				components.set(key, component);

				return component;
			},
			set(_target, key, value) {
				if (typeof key === 'string') {
					components.set(key, value);
				}

				return true;
			},
			has: (_target, key) =>
				typeof key === 'string' && (isCapitalised(key) || components.has(key)),
		},
	);
}

// `createStyles` of Discord's design module returns a hook of the styles; a factory is called with no theme.
function createStyles<T>(styles: T | (() => T)): () => T {
	return () => (typeof styles === 'function' ? (styles as () => T)() : styles);
}

/**
 * @description Creates the fake `metro.components`: each module a bag of fake components, so `Discord.Text` and `BottomSheets.ActionSheet`
 * render as nodes named after themselves, with `Discord.createStyles` returning the styles it is given.
 * @returns The namespace.
 */
export function createFakeComponents(): FakeModule {
	const bags = Object.fromEntries(BAGS.map((name) => [name, createComponentBag()]));

	return {
		...bags,
		Discord: createComponentBag({ createStyles }),
		HelpMessage: createFakeComponent('HelpMessage'),
		Switch: createFakeComponent('Switch'),
		HelpMessageTypes: {
			0: 'WARNING',
			1: 'INFO',
			2: 'ERROR',
			3: 'SUCCESS',
			WARNING: 0,
			INFO: 1,
			ERROR: 2,
			SUCCESS: 3,
		},
		DESIGN_COMPONENTS: [],
		// UNKNOWN: any value may be tested for being renderable.
		isRenderable: (value: unknown) =>
			typeof value === 'function' ||
			(typeof value === 'object' && value !== null && '$$typeof' in value),
		registerDesignFallback: () => {},
	};
}

/**
 * @description Creates the fake `ui`: each settings row and layout component draws its children and is named after itself.
 * @returns The namespace.
 */
export function createFakeUi(): FakeModule {
	return Object.fromEntries(UI.map((name) => [name, createFakeComponent(name)]));
}
