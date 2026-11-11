import { mkdirSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';

import { API_MANIFEST, API_SRC, ROOT, CLIENT } from './config';
import { generateSdk, sdkVersion } from './generate';
import { writeManifest } from './emit';
import { readJson } from './json';
import { logger } from './logger';

function format(paths: string[]) {
	execFileSync('oxfmt', ['--config', '.oxfmtrc.json', ...paths], { cwd: ROOT, stdio: 'inherit' });
}

function readClientVersion(): string {
	const path = join(CLIENT, 'package.json');
	const { version } = readJson(path);

	if (typeof version !== 'string' || version.length === 0) {
		throw new Error(`The client manifest at '${path}' has no version.`);
	}

	return version;
}

async function generate() {
	const start = performance.now();

	logger.debug('Generating plugin SDK...');

	rmSync(API_SRC, { recursive: true, force: true });
	mkdirSync(API_SRC, { recursive: true });

	const { files, modules } = await generateSdk();

	for (const [path, text] of files) {
		mkdirSync(dirname(path), { recursive: true });
		writeFileSync(path, text);
	}

	format([...files.keys()]);

	// The version hashes the formatted files, so read them back after the formatter ran.
	const formatted = new Map([...files.keys()].map((path) => [path, readFileSync(path, 'utf8')]));
	const version = sdkVersion(readClientVersion(), formatted);

	writeManifest(version, modules);

	format([API_MANIFEST]);

	const duration = (performance.now() - start).toFixed(2);

	logger.success(`Generated plugin SDK v${version} in ${duration}ms`);
}

if (import.meta.main) {
	generate().catch((error) => {
		logger.error('Failed to generate plugin SDK:', error);
		process.exit(1);
	});
}
