import { describe, expect, test } from 'bun:test';

import { paintRoleTextTree } from '@role-color-everywhere/role-text';

interface TestElement {
	type: string;
	props: Record<string, any>;
}

const React = {
	isValidElement(value: unknown): value is TestElement {
		return Boolean(value && typeof value === 'object' && 'type' in value && 'props' in value);
	},
	cloneElement(element: TestElement, props: Record<string, unknown>): TestElement {
		return { ...element, props: { ...element.props, ...props } };
	},
	createElement(type: string, props: Record<string, unknown>, child: unknown): TestElement {
		return { type, props: { ...props, children: child } };
	},
};

const runtime = { React, Text: 'Text' };

describe('role-colored text', () => {
	test('colors only a matching nested name', () => {
		const tree = {
			type: 'View',
			props: {
				children: [
					{ type: 'Text', props: { children: 'adrián', style: { fontWeight: '700' } } },
					{ type: 'Text', props: { children: 'is typing' } },
				],
			},
		};
		const appearances = new Map([['adrián', { colors: ['#1288bb'], style: 'solid' as const }]]);
		const painted = paintRoleTextTree(tree, appearances, runtime) as TestElement;
		const [name, suffix] = painted.props.children as TestElement[];

		expect(name.props.style).toEqual([{ fontWeight: '700' }, { color: '#1288bb' }]);
		expect(suffix).toBe(tree.props.children[1]);
	});

	test('uses every enhanced stop across a name', () => {
		const tree = { type: 'Text', props: { children: 'ABC' } };
		const appearances = new Map([
			['ABC', { colors: ['#ff0000', '#00ff00', '#0000ff'], style: 'holographic' as const }],
		]);
		const painted = paintRoleTextTree(tree, appearances, runtime) as TestElement;
		const characters = painted.props.children as TestElement[];

		expect(characters.map((character) => character.props.style.color)).toEqual([
			'#ff0000',
			'#00ff00',
			'#0000ff',
		]);
		expect(characters.map((character) => character.props.children).join('')).toBe('ABC');
	});
});
