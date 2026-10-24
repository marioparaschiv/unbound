import { expect, test } from 'bun:test';

import { findRenderTarget } from './render-target';

function Component() {
	return null;
}

test('patches a plain function component where it is stored', () => {
	const module = { default: Component };
	const element = { type: Component };

	expect(findRenderTarget(module)).toEqual({ holder: module, key: 'default' });
	expect(findRenderTarget(element, 'type')).toEqual({ holder: element, key: 'type' });
});

test('unwraps memo and forwardRef down to the render function', () => {
	const forwardRef = { render: Component };
	const memo = { type: forwardRef };
	const memoOfFunction = { type: Component };

	expect(findRenderTarget({ default: memo })).toEqual({ holder: forwardRef, key: 'render' });
	expect(findRenderTarget({ type: memoOfFunction }, 'type')).toEqual({
		holder: memoOfFunction,
		key: 'type',
	});
});

test('finds nothing when no render function is reachable', () => {
	expect(findRenderTarget({ default: { type: { displayName: 'Broken' } } })).toBeNull();
	expect(findRenderTarget({ type: 'View' }, 'type')).toBeNull();
	expect(findRenderTarget({})).toBeNull();
});
