import { expect, test } from 'bun:test';
import { join } from 'node:path';

import { SRC, asAlias, walkImports } from '../../helpers/imports';

const ENTRY = join(SRC, 'lib', 'bot', 'index.ts');

// The Discord bot loads this graph, so it must stay clear of better-auth, storage and the web env.
const ALLOWED = [
	/^~\/db\//,
	/^~\/lib\/bot\//,
	/^~\/lib\/sponsors\/standing$/,
	// Which addons and versions are live, listed and served, the rules the site reads by.
	/^~\/lib\/addon-visibility$/,
	// A leaf error class `requireAddon` throws.
	/^~\/lib\/api\/errors$/,
	/^~\/lib\/calendar-date$/,
	/^~\/lib\/github-urls$/,
	// The website icon's markup, rendered as the site renders it.
	/^~\/lib\/addon-icons$/,
	/^react(-dom\/server)?$/,
	/^nucleo-micro-bold$/,
	/^@unbound-app\/contracts\//,
	/^drizzle-orm(\/|$)/,
	/^postgres$/,
];

test('the bot read model imports only the schema, its own files and leaf rules', async () => {
	const outside: string[] = [];
	const seen = await walkImports([ENTRY], ({ from, specifier, target }) => {
		const name = target ? asAlias(target) : specifier;

		if (!ALLOWED.some((pattern) => pattern.test(name))) {
			outside.push(`${asAlias(from)} -> ${name}`);
		}
	});

	expect(outside).toEqual([]);
	expect(seen.size).toBeGreaterThan(5);
});
