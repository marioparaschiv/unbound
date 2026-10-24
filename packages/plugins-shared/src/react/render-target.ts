import type { AnyProps } from '@unbound-app/api/metro';

export type RenderTarget = {
	holder: AnyProps;
	key: string;
};

/**
 * @description Finds the render function behind the component at `owner[key]`, unwrapping `memo` (`type`) and `forwardRef` (`render`).
 * @param owner The object holding the component, such as a module's exports or a rendered element.
 * @param key The property holding the component, such as `default` for a module or `type` for an element.
 * @returns The object and key to patch, or `null` when no render function is found.
 */
export function findRenderTarget(owner: AnyProps, key: string = 'default'): RenderTarget | null {
	let holder = owner;
	let prop = key;
	let current = owner[key];

	while (current && typeof current === 'object') {
		const next = current.type ? 'type' : current.render ? 'render' : null;

		if (!next) {
			break;
		}

		holder = current;
		prop = next;
		current = current[next];
	}

	return typeof current === 'function' ? { holder, key: prop } : null;
}

export default findRenderTarget;
