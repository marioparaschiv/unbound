import { cloneElement, createElement, Fragment, isValidElement, memo } from 'react';
import { afterEach, describe, expect, mock, test } from 'bun:test';
import type { ReactElement, ReactNode } from 'react';

import type { ElementBoundaryProps } from '~/patcher/element-boundary';

// No React surface is mounted under bun, so the renderer finds no roots.
mock.module('~/metro/wrappers', () => ({
	findByPropsLazy: () => ({ getPublicInstanceFromRootTag: () => null }),
}));

const { react, unpatchAll } = await import('~/patcher/api');
const { isPatchBoundary } = await import('~/patcher/patch-boundary');
const { withElementBoundary } = await import('~/patcher/element-boundary');

type Parent = ReactElement<{ children: ReactNode[] }>;

const ElementBoundary = withElementBoundary(createElement('View'), 'probe').type;

const row = createElement('Text', { key: 'row' }, 'row');

// Discord's tree: a list holding one memoised row, as a component would render it.
const List = memo(() => createElement('View', null, [row, createElement('Text', { key: 'b' })]));

function Added(): ReactNode {
	return 'added';
}

// Reads the patched tree inside the patch boundary.
function patched(): Parent {
	const tree = List.type();

	if (!isPatchBoundary(tree)) {
		throw new TypeError('Expected a patch boundary.');
	}

	return tree.props.children as Parent;
}

afterEach(() => unpatchAll());

describe('patcher.react isolation', () => {
	test("wraps an element added beside Discord's and keeps Discord's elements", () => {
		react.after(List, ({ result }) =>
			cloneElement(result as Parent, {}, [
				(result as Parent).props.children,
				createElement(Added, { key: 'added' }),
			]),
		);

		const [discord, added] = patched().props.children as [ReactNode[], ReactElement];

		expect(discord[0]).toBe(row);
		expect(added.type).toBe(ElementBoundary);
		expect(added.key).toBe('added');
	});

	test('wraps an element pushed into Discord’s children in place', () => {
		react.after(List, ({ result }) => {
			(result as Parent).props.children.push(createElement(Added, { key: 'added' }));
		});

		const children = patched().props.children as ReactElement[];

		expect(children[0]).toBe(row);
		expect(children[2]?.type).toBe(ElementBoundary);
	});

	test('wraps an element added inside a fragment of Discord’s children', () => {
		react.after(List, ({ result }) =>
			cloneElement(
				result as Parent,
				{},
				createElement(
					Fragment,
					null,
					(result as Parent).props.children,
					createElement(Added),
				),
			),
		);

		const fragment = patched().props.children as unknown as ReactElement<{
			children: ReactNode[];
		}>;

		expect((fragment.props.children[1] as ReactElement).type).toBe(ElementBoundary);
	});

	test('leaves an element alone when a sibling of Discord’s has its type', () => {
		const extra = createElement('Text', { key: 'extra' });

		react.after(List, ({ result }) => {
			(result as Parent).props.children.push(extra);
		});

		expect(patched().props.children[2]).toBe(extra);
	});

	test('leaves a tree that replaces Discord’s unwrapped', () => {
		const replacement = createElement(Added);

		react.after(List, () => replacement);

		expect(patched()).toBe(replacement as unknown as Parent);
	});

	test('an added element that throws renders nothing and keeps the patch', () => {
		const original = List.type;

		react.after(List, ({ result }) => {
			(result as Parent).props.children.push(createElement(Added, { key: 'added' }));
		});

		const added = patched().props.children[2];

		if (!isValidElement<ElementBoundaryProps>(added) || added.type !== ElementBoundary) {
			throw new TypeError('Expected an element boundary.');
		}

		const boundary = new ElementBoundary(added.props);

		boundary.state = { failed: true };
		boundary.componentDidCatch?.(new Error('render failed'), { componentStack: '' });

		expect(boundary.render()).toBeNull();
		expect(List.type).not.toBe(original);
	});
});
