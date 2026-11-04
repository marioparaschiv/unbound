import { describe, expect, test } from 'bun:test';

import { appendToLabel, type TreeNode } from '~/indicators/label-tree';

function clone(node: TreeNode, props: Record<string, unknown>) {
	return { ...node, props: { ...node.props, ...props } };
}

describe('appendToLabel', () => {
	test('adds the suffix after a top-level label', () => {
		expect(appendToLabel({ props: { label: 'name' } }, 'icons', clone)).toEqual({
			props: { label: ['name', 'icons'] },
		});
	});

	test('rebuilds the parents of a nested label and only the first match', () => {
		const tree: { type: string; props: { children: TreeNode[] } } = {
			type: 'View',
			props: {
				children: [
					{ props: { other: 1 } },
					{ props: { label: 'a' } },
					{ props: { label: 'b' } },
				],
			},
		};
		const result = appendToLabel(tree, 'icons', clone) as typeof tree;

		expect(result.props.children).toEqual([
			{ props: { other: 1 } },
			{ props: { label: ['a', 'icons'] } },
			{ props: { label: 'b' } },
		]);
		expect(tree.props.children[1]).toEqual({ props: { label: 'a' } });
	});

	test('returns undefined when nothing has a label', () => {
		expect(appendToLabel({ props: { children: 'text' } }, 'icons', clone)).toBeUndefined();
		expect(appendToLabel(null, 'icons', clone)).toBeUndefined();
		expect(appendToLabel([{ props: { label: 'a' } }], 'icons', clone)).toBeUndefined();
	});
});
