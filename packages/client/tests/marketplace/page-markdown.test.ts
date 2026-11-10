import { describe, expect, test } from 'bun:test';

import { groupRuns, splitLeadingIcon, type PageNode } from '~/marketplace/page-markdown';

const text = (content: string): PageNode => ({ type: 'text', content });
const image: PageNode = { type: 'image', alt: 'Shot', target: 'media/shot.png' };
const list: PageNode = { type: 'list', ordered: false, items: [[text('nested')]] };

describe('groupRuns', () => {
	test('lays blocks and chosen inline nodes out between runs of inline text', () => {
		const nodes = [text('Intro '), image, text(' after'), list];

		expect(groupRuns(nodes, (node) => node.type === 'image')).toEqual([
			{ kind: 'inline', nodes: [text('Intro ')] },
			{ kind: 'block', node: image },
			{ kind: 'inline', nodes: [text(' after')] },
			{ kind: 'block', node: list },
		]);
	});

	test('drops runs of only whitespace', () => {
		expect(groupRuns([text('two\n'), list, text('\n')], () => false)).toEqual([
			{ kind: 'inline', nodes: [text('two\n')] },
			{ kind: 'block', node: list },
		]);
	});
});

describe('splitLeadingIcon', () => {
	test('takes the icon an item opens with and trims the space after it', () => {
		const nodes: PageNode[] = [{ type: 'pageIcon', name: 'gear' }, text(' Settings')];

		expect(splitLeadingIcon(nodes)).toEqual({ icon: 'gear', rest: [text('Settings')] });
	});

	test('looks inside the paragraph a loose item wraps its text in', () => {
		const nodes: PageNode[] = [
			{ type: 'paragraph', content: [{ type: 'pageIcon', name: 'music' }, text(' Plays')] },
			list,
		];

		expect(splitLeadingIcon(nodes)).toEqual({
			icon: 'music',
			rest: [{ type: 'paragraph', content: [text('Plays')] }, list],
		});
	});

	test('leaves content whose icon sits mid-sentence as it is', () => {
		const nodes: PageNode[] = [text('Tap '), { type: 'pageIcon', name: 'gear' }];

		expect(splitLeadingIcon(nodes)).toEqual({ rest: nodes });
	});
});
