import { createElement, isValidElement } from 'react';
import { expect, test } from 'bun:test';

import { isAnimatedDot, stillDots, type DotElement } from '~/dots';

function AnimatedEllipsisDot() {
	return null;
}

function EllipsisDot() {
	return null;
}

const renamed = () => null;

function dots(type: () => null) {
	return [0, 1, 2].map((index) =>
		createElement(type, {
			key: index,
			delay: index * 233,
			sequenceStartDelay: 116,
			sequenceEndDelay: 116 + 233 * (2 - index),
			dotStyle: { backgroundColor: 'red' },
			disableScale: true,
		}),
	);
}

function still(dot: DotElement) {
	return { still: true, key: dot.key, dotStyle: dot.props.dotStyle, animated: dot.type };
}

test('recognises the animated dot by its name', () => {
	expect(isAnimatedDot(createElement(AnimatedEllipsisDot))).toBe(true);
});

test('ignores an unnamed component even with the delay props', () => {
	const [dot] = dots(renamed);

	expect(isAnimatedDot(dot)).toBe(false);
});

test('leaves the reduced-motion dot and host views alone', () => {
	expect(dots(EllipsisDot).some(isAnimatedDot)).toBe(false);
	expect(isAnimatedDot(createElement('View'))).toBe(false);
	expect(isAnimatedDot(null)).toBe(false);
	expect(isAnimatedDot('text')).toBe(false);
});

test('swaps every animated dot for a still one, keeping keys and dot styles', () => {
	const animated = dots(AnimatedEllipsisDot);
	const result = stillDots(animated, still) as ReturnType<typeof still>[];

	expect(result).toHaveLength(3);
	expect(result.map((dot) => dot.key)).toEqual(['0', '1', '2']);
	expect(result.every((dot) => dot.still && dot.animated === AnimatedEllipsisDot)).toBe(true);
	expect(result[1]?.dotStyle).toEqual({ backgroundColor: 'red' });
});

test('keeps children that are not animated dots', () => {
	const spacer = createElement('View', { key: 'spacer' });
	const result = stillDots([spacer, ...dots(AnimatedEllipsisDot)], still) as unknown[];

	expect(result[0]).toBe(spacer);
	expect(result.slice(1).some(isValidElement)).toBe(false);
});

test('returns the same children when nothing animates', () => {
	const reduced = dots(EllipsisDot);

	expect(stillDots(reduced, still)).toBe(reduced);
	expect(stillDots(undefined, still)).toBeUndefined();
	const single = createElement(AnimatedEllipsisDot);

	expect(stillDots(single, still)).toBe(single);
});
