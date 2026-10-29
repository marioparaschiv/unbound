import type {
	DesignComponentName,
	DesignModule,
	ResolvedStyles,
	StyleSheetSpec,
	StyleSheetSpecOrFactory,
} from '@unbound-app/types/components';
import { DESIGN_COMPONENTS } from '@unbound-app/types/components';
import type { ComponentType, ElementType } from 'react';

import { findByPropsLazy } from '~/api/metro/wrappers';

const designModule: DesignModule = findByPropsLazy('createStyles', 'dismissAlerts', 'ContextMenu');
const designFallbacks = new Map<DesignComponentName, ComponentType<never>>();

/**
 * @description Tells whether a value can be rendered as a React element type: a function or class
 * component, or a `memo`/`forwardRef`/`lazy` object.
 * @param value The value to check.
 * @returns Whether React can render it.
 */
export function isRenderable(
	value:
		| DesignModule[keyof DesignModule]
		| ElementType
		| Record<string, ComponentType<never>>
		| undefined,
): value is ElementType {
	return (
		typeof value === 'function' ||
		(typeof value === 'object' && value !== null && '$$typeof' in value)
	);
}

function isDesignComponent(key: PropertyKey): key is DesignComponentName {
	return typeof key === 'string' && (DESIGN_COMPONENTS as readonly string[]).includes(key);
}

function readDesignModule(key: PropertyKey): DesignModule[keyof DesignModule] | undefined {
	try {
		return Reflect.get(designModule, key);
	} catch {
		return undefined;
	}
}

/**
 * @description Registers the component the design module returns when a Discord build lacks the
 * named one or ships something React can't render.
 * @param name The design component to stand in for.
 * @param component The fallback.
 */
export function registerDesignFallback<K extends DesignComponentName>(
	name: K,
	component: DesignModule[K],
): void {
	designFallbacks.set(name, component as ComponentType<never>);
}

// Style files call `createStyles` when imported, so the design module is read on the first render instead.
function createStyles<T extends StyleSheetSpec>(
	styles: StyleSheetSpecOrFactory<T>,
): () => ResolvedStyles<T> {
	let useStyles: (() => ResolvedStyles<T>) | undefined;

	return () => {
		useStyles ??= designModule.createStyles(styles);

		return useStyles();
	};
}

const designTarget: DesignModule = Object.create(null);

/** Discord's design module, with Unbound's fallbacks standing in for components a build lacks. */
export const Discord: DesignModule = new Proxy(designTarget, {
	get(_, key) {
		if (key === 'createStyles') {
			return createStyles;
		}

		const value = readDesignModule(key);

		if (isDesignComponent(key) && !isRenderable(value)) {
			return designFallbacks.get(key) ?? value;
		}

		return value;
	},
	has: (_, key) =>
		readDesignModule(key) !== undefined || (isDesignComponent(key) && designFallbacks.has(key)),
});

/** How each design component resolves on the running Discord build. */
export type DesignComponentAudit = {
	native: DesignComponentName[];
	fallback: DesignComponentName[];
	missing: DesignComponentName[];
};

/**
 * @description Checks every design component the SDK exposes against the running Discord build.
 * @returns The components Discord renders itself, the ones a fallback stands in for, and the ones nothing renders.
 */
export function auditDesignComponents(): DesignComponentAudit {
	const audit: DesignComponentAudit = { native: [], fallback: [], missing: [] };

	for (const name of DESIGN_COMPONENTS) {
		if (isRenderable(readDesignModule(name))) {
			audit.native.push(name);
		} else if (designFallbacks.has(name)) {
			audit.fallback.push(name);
		} else {
			audit.missing.push(name);
		}
	}

	return audit;
}
