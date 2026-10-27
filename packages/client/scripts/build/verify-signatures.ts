import { existsSync, readFileSync } from 'node:fs';
import Logger from '@unbound-app/logger';
import { join } from 'node:path';

import { findUnsignedBundles } from './sign';

const logger = Logger.create('Build', 'Verify');
const root = join(import.meta.dir, '..', '..');
const keyPath = join(root, '..', 'loader', 'core', 'keys', 'bundle-signing.pub');
const dist = join(root, 'dist');

if (!existsSync(keyPath)) {
	logger.warn(`No public key at ${keyPath}; loaders do not verify bundles, so nothing to check.`);
	process.exit(0);
}

const problems = findUnsignedBundles(dist, readFileSync(keyPath, 'utf8'));

if (problems.length) {
	for (const problem of problems) {
		logger.error(problem);
	}

	process.exit(1);
}

logger.success('Every bundle is signed with the committed key.');
