import type { PatchParent } from 'possess';
import type { ReactNode } from 'react';
import { patches } from 'possess';

/** Where a patched render lives. */
export type RenderPlace = { parent: PatchParent; method: string };

/** The props {@link UnpatchedRender} takes. */
export type UnpatchedRenderProps = {
	place: RenderPlace;
	// UNKNOWN: a class instance, or whatever `this` a function component was called with.
	self: unknown;
	// UNKNOWN: props then a ref or legacy context, passed through unread.
	args: unknown[];
};

/**
 * @description Renders Discord's own render for a component, skipping every patch on it. Its hooks run in this fiber.
 * @param props The render's place, `this` and arguments.
 * @returns Discord's tree.
 */
function UnpatchedRender({ place, self, args }: UnpatchedRenderProps): ReactNode {
	const entry = patches.find(
		(patched) => patched.parent.deref() === place.parent && patched.method === place.method,
	);
	const render = entry ? entry.original : Reflect.get(place.parent, place.method);

	return Reflect.apply(render, self, args);
}

export default UnpatchedRender;
