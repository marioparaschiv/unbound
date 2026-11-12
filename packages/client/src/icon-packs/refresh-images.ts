import { reconcile, type Fiber } from '~/hot-refresh/refresh';
import { ReactNative } from '~/metro/common';

// Only React Native's `Image` resolves an asset id to a file, while it renders. Wrappers handed the same id, such
// as icons and avatars, render the same output again, so re-rendering them is wasted work.
function drawsAsset(fiber: Fiber): boolean {
	const props = fiber.memoizedProps;

	return (
		// `Object.is`, as the typings declare `Image` a class while Discord's build makes it a function component.
		Object.is(fiber.type, ReactNative.Image) &&
		props !== null &&
		'source' in props &&
		typeof props.source === 'number'
	);
}

/**
 * @description Re-renders, in place, every mounted `Image` drawing an asset by id, so a pack applied or removed
 * shows at once. Everything else is left alone.
 * @returns How many components were scheduled.
 */
export function refreshImages(): number {
	return reconcile((fiber) => (drawsAsset(fiber) ? 'render' : null));
}
