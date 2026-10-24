import { describe, expect, test } from 'bun:test';

import { findElement, getElementName, type ElementNode } from './find-element';

function Target() {
	return null;
}

function nest(node: ElementNode, levels: number): ElementNode {
	let result = node;

	for (let i = 0; i < levels; i++) result = { type: 'View', props: { children: result } };

	return result;
}

describe('getElementName', () => {
	test('reads host tags, functions, memo and forwardRef wrappers', () => {
		const named = Object.assign(() => null, { displayName: 'Named' });

		expect(getElementName({ type: 'View' })).toBe('View');
		expect(getElementName({ type: Target })).toBe('Target');
		expect(getElementName({ type: named })).toBe('Named');
		expect(getElementName({ type: { type: Target } })).toBe('Target');
		expect(getElementName({ type: { render: Target } })).toBe('Target');
		expect(getElementName({ type: {} })).toBeUndefined();
	});
});

describe('findElement', () => {
	const target = { type: Target, props: {} };
	const isTarget = (element: ElementNode) => element === target;

	test('finds an element through arrays and children', () => {
		const tree = {
			type: 'View',
			props: { children: [null, 'text', [{ type: 'Text' }, target]] },
		};

		expect(findElement(tree, isTarget)).toBe(target);
	});

	test('stops searching past 15 levels', () => {
		expect(findElement(nest(target, 15), isTarget)).toBe(target);
		expect(findElement(nest(target, 16), isTarget)).toBeUndefined();
	});
});
