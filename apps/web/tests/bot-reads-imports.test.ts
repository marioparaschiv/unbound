import { dirname, join, relative, resolve } from 'node:path';
import { expect, test } from 'bun:test';
import { existsSync } from 'node:fs';

const SRC = join(import.meta.dirname, '..', 'src');
const ENTRY = join(SRC, 'lib', 'bot', 'index.ts');

// The Discord bot loads this graph, so it must stay clear of better-auth, storage and the web env.
const ALLOWED = [
	/^~\/db\//,
	/^~\/lib\/bot\//,
	/^~\/lib\/sponsors\/standing$/,
	/^~\/lib\/live-versions$/,
	/^~\/lib\/calendar-date$/,
	/^@unbound-app\/contracts\//,
	/^drizzle-orm(\/|$)/,
	/^postgres$/,
	/^zod$/,
];

const transpiler = new Bun.Transpiler({ loader: 'ts' });

function toFile(specifier: string, from: string): string | undefined {
	const base = specifier.startsWith('~/')
		? join(SRC, specifier.slice(2))
		: specifier.startsWith('.')
			? resolve(dirname(from), specifier)
			: undefined;

	if (!base) return;

	return [`${base}.ts`, join(base, 'index.ts'), base].find((path) => existsSync(path));
}

function asAlias(file: string) {
	return `~/${relative(SRC, file).replace(/(\/index)?\.ts$/, '')}`;
}

test('the bot read model imports only the schema, its own files and leaf rules', async () => {
	const seen = new Set<string>();
	const outside: string[] = [];
	const queue = [ENTRY];

	for (let file = queue.pop(); file; file = queue.pop()) {
		if (seen.has(file)) {
			continue;
		}

		seen.add(file);

		for (const { path: specifier } of transpiler.scanImports(await Bun.file(file).text())) {
			const target = toFile(specifier, file);
			const name = target ? asAlias(target) : specifier;

			if (!ALLOWED.some((pattern) => pattern.test(name))) {
				outside.push(`${asAlias(file)} -> ${name}`);
			}

			if (target) {
				queue.push(target);
			}
		}
	}

	expect(outside).toEqual([]);
	expect(seen.size).toBeGreaterThan(5);
});
