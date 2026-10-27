import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import Logger from '@unbound-app/logger';

import { findUnsignedBundles, parsePullRequest } from './sign';

const logger = Logger.create('Build', 'Verify');
const root = join(import.meta.dir, '..', '..');

export const KEYS_DIR = join(root, '..', 'loader', 'core', 'keys');

export type VerifyArguments = {
	dir: string;
	pullRequest: number;
};

export type VerifyResult =
	| { status: 'skipped'; keyPath: string }
	| { status: 'verified'; keyPath: string }
	| { status: 'failed'; keyPath: string; problems: string[] };

/**
 * @description Parses `verify-signatures` arguments: `--dir <dist>` and `--pr <n>`.
 * @param argv The arguments after the script name.
 * @param base The directory a relative `--dir` resolves against.
 * @returns The build directory and the pull request its signatures must be bound to.
 */
export function parseVerifyArguments(argv: string[], base = root): VerifyArguments {
	const parsed: VerifyArguments = { dir: join(base, 'dist'), pullRequest: 0 };

	for (let index = 0; index < argv.length; index++) {
		const flag = argv[index];
		const value = argv[++index];

		if (flag === '--dir' && value) {
			parsed.dir = resolve(base, value);
		} else if (flag === '--pr') {
			parsed.pullRequest = parsePullRequest(value);
		} else {
			throw new Error(
				`Unknown argument ${flag}. Usage: verify-signatures [--dir <dist>] [--pr <n>]`,
			);
		}
	}

	return parsed;
}

/**
 * @description Checks a build against the committed public key: the production key, or the pull request key bound to its number.
 * @param options The build directory and pull request.
 * @param keysDir The directory holding `bundle-signing.pub` and `pr-bundle-signing.pub`.
 * @returns Whether the build verified, failed, or was skipped because the key is not committed.
 */
export function verifyBuild(options: VerifyArguments, keysDir = KEYS_DIR): VerifyResult {
	const keyName = options.pullRequest ? 'pr-bundle-signing.pub' : 'bundle-signing.pub';
	const keyPath = join(keysDir, keyName);

	if (!existsSync(keyPath)) {
		return { status: 'skipped', keyPath };
	}

	const problems = findUnsignedBundles(
		options.dir,
		readFileSync(keyPath, 'utf8'),
		options.pullRequest,
	);

	return problems.length
		? { status: 'failed', keyPath, problems }
		: { status: 'verified', keyPath };
}

if (import.meta.main) {
	const options = parseVerifyArguments(process.argv.slice(2));
	const result = verifyBuild(options);

	if (result.status === 'skipped') {
		logger.warn(
			`No public key at ${result.keyPath}; loaders do not verify bundles, so nothing to check.`,
		);
		process.exit(0);
	}

	if (result.status === 'failed') {
		for (const problem of result.problems) {
			logger.error(problem);
		}

		process.exit(1);
	}

	logger.success(
		options.pullRequest
			? `Every bundle and the manifest are signed for pull request #${options.pullRequest}.`
			: 'Every bundle and the manifest are signed with the committed key.',
	);
}
