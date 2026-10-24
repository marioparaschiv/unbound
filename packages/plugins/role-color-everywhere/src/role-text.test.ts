import { describe, expect, test } from 'bun:test';
import { createElement, type ReactElement } from 'react';

import { paintRoleText, paintRoleTextTree } from '~/role-text';

type Props = { children?: ReactElement<Props>[] | string; style?: unknown };

function Text() {
	return null;
}

describe('paintRoleTextTree', () => {
	test('colors only the matching nested name', () => {
		const name = createElement(Text, { style: { fontWeight: '700' } }, 'adrián');
		const suffix = createElement(Text, null, 'is typing');
		const tree = createElement('View', null, name, suffix);
		const appearances = new Map([['adrián', { colors: ['#1288bb'], style: 'solid' as const }]]);
		const painted = paintRoleTextTree(tree, appearances, Text) as ReactElement<Props>;
		const [paintedName, paintedSuffix] = painted.props.children as ReactElement<Props>[];

		expect(paintedName.props.style).toEqual([{ fontWeight: '700' }, { color: '#1288bb' }]);
		expect(paintedSuffix).toBe(suffix);
	});

	test('returns the same tree when no name matches', () => {
		const tree = createElement('View', null, createElement(Text, null, 'someone'));

		expect(paintRoleTextTree(tree, new Map(), Text)).toBe(tree);
	});
});

test('paintRoleText spreads every enhanced stop across a name', () => {
	const painted = paintRoleText(
		'ABC',
		{ colors: ['#ff0000', '#00ff00', '#0000ff'], style: 'holographic' },
		Text,
	) as ReactElement<Props>;
	const characters = painted.props.children as ReactElement<Props>[];

	expect(characters.map((character) => character.props.style)).toEqual([
		{ color: '#ff0000' },
		{ color: '#00ff00' },
		{ color: '#0000ff' },
	]);
	expect(characters.map((character) => character.props.children)).toEqual(['A', 'B', 'C']);
});
