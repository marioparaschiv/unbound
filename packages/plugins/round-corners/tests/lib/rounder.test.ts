import { describe, expect, test } from 'bun:test';

import { FULL, roundTree, rules } from '~/lib/rounder';

const square = (size: number, radius: number) => ({
	type: 'View',
	props: { style: { width: size, height: size, borderRadius: radius } },
});

describe('roundTree', () => {
	test('rounds a small square into a circle', () => {
		const tree = roundTree(square(40, 8), rules.circleIfSquare(44)) as {
			props: { style: unknown[] };
		};

		expect(tree.props.style[1]).toEqual({ borderRadius: 20 });
	});

	test('leaves views the rule does not pick, and returns the same tree', () => {
		const node = square(80, 8);

		expect(roundTree(node, rules.circleIfSquare(44))).toBe(node);
	});

	test('rounds nested children without editing the original', () => {
		const child = square(40, 8);
		const parent = { type: 'View', props: { children: [child] } };
		const rounded = roundTree(parent, rules.circleIfSquare(44)) as {
			props: { children: unknown[] };
		};

		expect(rounded).not.toBe(parent);
		expect(child.props.style.borderRadius).toBe(8);
		expect(rounded.props.children[0]).not.toBe(child);
	});

	test('makes any large enough corner fully round', () => {
		const tree = roundTree(square(30, 12), rules.fullRoundIf(8)) as {
			props: { style: unknown[] };
		};

		expect(tree.props.style[1]).toEqual({ borderRadius: FULL });
	});
});
