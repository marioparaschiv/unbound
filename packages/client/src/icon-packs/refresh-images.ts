import { reconcile, type Fiber } from '~/hot-refresh/refresh';

// A component handed an asset id resolves it to a file while it renders, so only these need to run again.
function drawsAsset(fiber: Fiber): boolean {
	const props = fiber.memoizedProps;

	return (
		typeof fiber.type !== 'string' &&
		props !== null &&
		'source' in props &&
		typeof props.source === 'number'
	);
}

/**
 * @description Re-renders, in place, every mounted component drawing an asset by id, so a pack applied or removed
 * shows at once. Host views and everything else are left alone.
 * @returns How many components were scheduled.
 */
export function refreshImages(): number {
	return reconcile((fiber) => (drawsAsset(fiber) ? 'render' : null));
}
