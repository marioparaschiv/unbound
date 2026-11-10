import { expect, test } from 'bun:test';

import { renderMenu } from '../src/lib/menu';

test('renderMenu lists commands with a summary first, keeping their order', () => {
	const menu = renderMenu([
		{ name: 'status' },
		{ name: 'create', summary: 'Scaffold.' },
		{ name: 'logs' },
		{ name: 'mcp', summary: 'Serve.' },
	]);
	const names = menu
		.split('\n')
		.map((line) => /^\s+\S*?(create|mcp|status|logs)\b/.exec(line)?.[1])
		.filter(Boolean);

	expect(names).toEqual(['create', 'mcp', 'status', 'logs']);
});
