import { expect, test } from 'bun:test';

import { catalogEntries, groupCommands, groups, rootCommands } from '../src/registry';
import { buildCatalog, CATALOG_VERSION } from '../src/lib/catalog';

test('buildCatalog lists every command with the words that run it', () => {
	const catalog = buildCatalog(catalogEntries());
	const all = [...rootCommands, ...groups.flatMap(groupCommands)];

	expect(catalog.version).toBe(CATALOG_VERSION);
	expect(catalog.commands.map((command) => command.name)).toEqual(
		all.map((command) => command.name),
	);
	expect(catalog.commands.find((command) => command.name === 'build')?.path).toEqual(['build']);
	expect(catalog.commands.find((command) => command.name === 'eval')?.path).toEqual([
		'debug',
		'eval',
	]);
	expect(catalog.commands.find((command) => command.name === 'logs')?.path).toEqual([
		'device',
		'logs',
	]);
});

test('buildCatalog keeps schema field order, required flags and positionals', () => {
	const hook = buildCatalog(catalogEntries()).commands.find((command) => command.name === 'hook');

	expect(hook?.positionals).toEqual(['className', 'method']);
	expect(hook?.fields.slice(0, 2)).toMatchObject([
		{ name: 'className', required: true, schema: { type: 'string' } },
		{ name: 'method', required: true, schema: { type: 'string' } },
	]);
	expect(hook?.fields.find((field) => field.name === 'duration')).toMatchObject({
		required: false,
		schema: { type: 'number', default: 3000 },
	});
});

test('the catalog survives a JSON round trip', () => {
	const json = JSON.parse(JSON.stringify(buildCatalog(catalogEntries()))) as ReturnType<
		typeof buildCatalog
	>;
	const create = json.commands.find((command) => command.name === 'create');

	expect(create?.fields.find((field) => field.name === 'kind')?.schema).toMatchObject({
		enum: ['plugin', 'theme'],
	});
});
