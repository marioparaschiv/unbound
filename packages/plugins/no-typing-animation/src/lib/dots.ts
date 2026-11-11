import type { ComponentType } from 'react';

import { ANIMATED_DOT_NAME } from '~/lib/constants';

export type DotElement = {
	type: ComponentType<Record<string, unknown>>;
	key: string | null;
	props: Record<string, unknown>;
};

function isElement(value: unknown): value is { type: unknown; key: string | null; props: object } {
	return (
		typeof value === 'object' &&
		value !== null &&
		'type' in value &&
		'props' in value &&
		typeof value.props === 'object' &&
		value.props !== null
	);
}

/**
 * @description Tells whether a rendered element is one of Discord's animated typing dots, by its component name. Discord's Reduce Motion dot gets the same props, so the name is the only safe signal.
 * @param value A child of the typing dots' row.
 * @returns `true` for an animated dot.
 */
export function isAnimatedDot(value: unknown): value is DotElement {
	if (!isElement(value) || typeof value.type !== 'function') return false;

	return value.type.name === ANIMATED_DOT_NAME;
}

/**
 * @description Swaps every animated dot in the typing dots' children for a still one, leaving other children alone.
 * @param children The children of the row Discord's typing dots render.
 * @param still Renders the still dot that replaces an animated one.
 * @returns New children when a dot was swapped, otherwise the same `children`.
 */
export function stillDots<T, R>(children: T, still: (dot: DotElement) => R): T | R[] {
	if (!Array.isArray(children) || !children.some(isAnimatedDot)) return children;

	return children.map((child) => (isAnimatedDot(child) ? still(child) : child));
}
