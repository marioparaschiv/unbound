import { describe, expect, test } from 'bun:test';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';

const src = join(import.meta.dir, '..', '..', 'src');
const transpilers = {
	ts: new Bun.Transpiler({ loader: 'ts' }),
	tsx: new Bun.Transpiler({ loader: 'tsx' }),
};

// Every client module a file loads when it is evaluated: static imports only, type-only ones stripped.
function staticImports(entry: string) {
	const seen = new Set<string>();
	const pending = [entry];

	for (let file = pending.pop(); file; file = pending.pop()) {
		if (seen.has(file)) {
			continue;
		}

		seen.add(file);

		const transpiler = file.endsWith('.tsx') ? transpilers.tsx : transpilers.ts;

		for (const { path, kind } of transpiler.scanImports(readFileSync(file, 'utf8'))) {
			if (kind !== 'import-statement') {
				continue;
			}

			const resolved = Bun.resolveSync(path, dirname(file));

			if (resolved.startsWith(src)) {
				pending.push(resolved);
			}
		}
	}

	return seen;
}

describe('hot runtime', () => {
	// A hot build imports the runtime into every module it transforms, including the ones `~/metro/cache` loads, and
	// the search reads that cache as it loads.
	test('loads without loading the metro search', () => {
		const loaded = staticImports(join(src, 'hot-refresh', 'runtime.ts'));

		expect(loaded).not.toContain(join(src, 'metro', 'search.ts'));
	});
});
