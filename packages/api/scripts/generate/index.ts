import { mkdirSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';

import { logger, API_SRC, UTILITIES_OUT, BANNER, ROOT, CLIENT, type ModuleEntry } from './paths';
import { buildRoot, buildGlobal, writeManifest, normalizeForHash } from './emit';
import { buildHoistFiles, bundle } from './bundle';
import { buildEntries } from './entries';
import { strip } from './transform';

async function generate() {
	const start = performance.now();

	logger.debug('Generating plugin SDK...');

	rmSync(API_SRC, { recursive: true, force: true });
	mkdirSync(API_SRC, { recursive: true });

	const entries = buildEntries();

	const { files: hoistFiles, ownerByName } = buildHoistFiles();

	const usedOwners = new Set<string>();
	const outputs = new Map<string, string>();

	for (const entry of entries) {
		if (entry.name === '.') continue;

		// A folder module's direct children (`metro/common` under `metro`) become `export * as` imports
		// instead of inlined namespaces.
		const children = new Map<string, ModuleEntry>();
		for (const candidate of entries) {
			if (dirname(candidate.name) === entry.name) {
				children.set(candidate.name.slice(entry.name.length + 1), candidate);
			}
		}

		outputs.set(
			entry.out,
			strip(bundle(entry.source), entry.out, children, ownerByName, usedOwners),
		);
	}

	const root = entries.find((entry) => entry.name === '.')!;
	outputs.set(root.out, buildRoot(entries));

	// The utilities file is always emitted (`global.d.ts` re-exports it); any other hoist file is kept
	// only when a module actually imports from it, so unreferenced ones (e.g. `logger`) are dropped.
	const utilities = hoistFiles.find((file) => file.out === UTILITIES_OUT)!;
	for (const file of hoistFiles) {
		if (file.out === UTILITIES_OUT || usedOwners.has(file.out))
			outputs.set(file.out, file.text);
	}

	outputs.set(join(API_SRC, 'global.d.ts'), buildGlobal(entries, utilities.names));

	for (const [path, text] of outputs) {
		mkdirSync(dirname(path), { recursive: true });
		writeFileSync(path, `${BANNER}\n\n${text.trimStart()}`);
	}

	execSync(
		`oxfmt --config .oxfmtrc.json ${[...outputs.keys()].map((path) => `"${path}"`).join(' ')}`,
		{
			cwd: ROOT,
			stdio: 'inherit',
		},
	);

	const hash = createHash('sha256');
	for (const path of [...outputs.keys()].sort()) {
		hash.update(normalizeForHash(readFileSync(path, 'utf8')));
	}

	const clientVersion = JSON.parse(readFileSync(join(CLIENT, 'package.json'), 'utf8')).version;
	const version = `${clientVersion}-${hash.digest('hex')}`;

	writeManifest(version, entries);

	execSync(`oxfmt --config .oxfmtrc.json "${join(ROOT, 'packages', 'api', 'package.json')}"`, {
		cwd: ROOT,
		stdio: 'inherit',
	});

	const duration = (performance.now() - start).toFixed(2);

	logger.success(`Generated plugin SDK v${version} in ${duration}ms`);
}

if (import.meta.main) {
	generate().catch((error) => {
		logger.error('Failed to generate plugin SDK:', error);
		process.exit(1);
	});
}
