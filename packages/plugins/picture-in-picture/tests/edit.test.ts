import { describe, expect, test } from 'bun:test';

import {
	findElements,
	insertBeforeLastButton,
	withElementProps,
	type CloneElement,
	type TreeElement,
} from '~/picture-in-picture/tree/edit';

const clone: CloneElement = (element, props) => ({
	...element,
	props: { ...element.props, ...props },
});

const el = (type: string, props: Record<string, unknown> = {}): TreeElement => ({ type, props });

const isButton = (element: TreeElement) => element.type === 'Button';

const kids = (element: TreeElement | undefined) =>
	(element?.props?.children ?? []) as TreeElement[];

describe('findElements', () => {
	test('finds matches in tree order through arrays and single children', () => {
		const tree = el('View', {
			children: [
				el('A', { id: 1 }),
				el('View', { children: el('A', { id: 2 }) }),
				null,
				'text',
			],
		});

		expect(
			findElements(tree, (element) => element.type === 'A').map((e) => e.props?.id),
		).toEqual([1, 2]);
	});
});

describe('withElementProps', () => {
	test('sets props on the first match and clones only its path', () => {
		const sibling = el('Poster');
		const video = el('RCTVideo', { src: { uri: 'x' }, paused: true });
		const tree = el('View', { children: [video, sibling] });
		const next = withElementProps(
			tree,
			(element) => element.type === 'RCTVideo',
			(element) => ({ paused: false, seen: element.props?.paused }),
			clone,
		) as TreeElement;
		const [changed, kept] = kids(next);

		expect(next).not.toBe(tree);
		expect(changed?.props).toEqual({ src: { uri: 'x' }, paused: false, seen: true });
		expect(kept).toBe(sibling);
		expect(video.props?.paused).toBe(true);
	});

	test('returns the same tree when nothing matches', () => {
		const tree = el('View', { children: [el('Image')] });

		expect(
			withElementProps(
				tree,
				() => false,
				() => ({}),
				clone,
			),
		).toBe(tree);
	});
});

describe('insertBeforeLastButton', () => {
	test('adds the element before the last button of the last row of buttons', () => {
		const left = el('View', { children: [el('Button', { id: 'close' })] });
		const right = el('View', {
			children: [el('Button', { id: 'share' }), el('Button', { id: 'download' })],
		});
		const tree = el('Header', { children: [left, el('Text'), right] });
		const next = insertBeforeLastButton(tree, isButton, el('Pip'), clone) as TreeElement;
		const [keptLeft, , changedRight] = kids(next);
		const ids = kids(changedRight).map((child) => child.props?.id ?? child.type);

		expect(keptLeft).toBe(left);
		expect(ids).toEqual(['share', 'Pip', 'download']);
	});

	test('wraps a single child button into a row', () => {
		const tree = el('Header', { children: el('Button', { id: 'share' }) });
		const next = insertBeforeLastButton(tree, isButton, el('Pip'), clone) as TreeElement;

		expect(kids(next).map((child) => child.type)).toEqual(['Pip', 'Button']);
	});

	test('returns undefined when no element holds a button', () => {
		expect(insertBeforeLastButton(el('Header'), isButton, el('Pip'), clone)).toBeUndefined();
	});
});
