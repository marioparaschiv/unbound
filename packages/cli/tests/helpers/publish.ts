import { authRequest, createSubmissionEndpoint, serveEndpoints } from '@unbound-app/web/testing';
import type { AppContext, GitFixture } from '@unbound-app/web/testing';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { parse, Type } from '~/lib/schema';

const createdApiKeySchema = Type.Object({ key: Type.String() });

const GIT_IDENTITY = {
	GIT_AUTHOR_NAME: 'Publisher',
	GIT_AUTHOR_EMAIL: 'publisher@example.com',
	GIT_COMMITTER_NAME: 'Publisher',
	GIT_COMMITTER_EMAIL: 'publisher@example.com',
};

/** A working tree whose `origin` is a fake GitHub repository, as an author's clone is. */
export type Checkout = {
	dir: string;
	/** Writes files, by path from the repository root, without committing them. */
	write(files: Record<string, string>): void;
	/** Writes files and commits them on the default branch; returns the commit SHA. */
	commit(files: Record<string, string>): string;
};

function git(dir: string, args: string[]): string {
	const result = Bun.spawnSync({
		cmd: ['git', ...args],
		cwd: dir,
		env: { ...process.env, ...GIT_IDENTITY },
		stdout: 'pipe',
		stderr: 'pipe',
	});

	if (result.exitCode !== 0) {
		throw new Error(`git ${args.join(' ')} failed: ${result.stderr.toString()}`);
	}

	return result.stdout.toString().trim();
}

/**
 * @description Serves the submission endpoint `ubd publish` calls, plus Better Auth.
 * @param ctx The application context.
 * @returns The running server.
 */
export function servePublishApi(ctx: AppContext) {
	return serveEndpoints(ctx, { 'POST /api/v1/submissions': createSubmissionEndpoint });
}

/**
 * @description Creates an API key for a signed-in user, as the account page does.
 * @param ctx The application context.
 * @param headers The user's session headers.
 * @returns The API key.
 */
export async function createApiKey(ctx: AppContext, headers: Headers): Promise<string> {
	const response = await authRequest(ctx, '/api-key/create', {
		method: 'POST',
		headers,
		body: JSON.stringify({ name: 'ci' }),
	});

	const { key } = parse(createdApiKeySchema, await response.json());

	return key;
}

/**
 * @description Uses the working tree of a fake GitHub repository as the author's clone: commits there
 * land on the branch the fake serves, so what `ubd publish` reads locally is what the server reads.
 * @param fixture The fake repository's git fixture.
 * @param repository The repository as `owner/name`, which `origin` points at.
 * @returns The checkout.
 */
export function useCheckout(fixture: GitFixture, repository: string): Checkout {
	const { dir } = fixture;

	git(dir, ['remote', 'add', 'origin', `https://github.com/${repository}.git`]);

	function write(files: Record<string, string>) {
		for (const [name, content] of Object.entries(files)) {
			mkdirSync(dirname(join(dir, name)), { recursive: true });
			writeFileSync(join(dir, name), content);
		}
	}

	return {
		dir,
		write,
		commit(files) {
			write(files);
			git(dir, ['add', '--all']);
			git(dir, ['commit', '--quiet', '--allow-empty', '--message', 'Release']);

			return git(dir, ['rev-parse', 'HEAD']);
		},
	};
}

/**
 * @description Builds the files of a built plugin at `plugins/{id}` of a workspace listing `plugins/*`.
 * @param id The addon id.
 * @param bundle The committed `dist/index.js`.
 * @param files More files under the plugin directory, by relative path.
 * @returns The files by path from the repository root, including `unbound.config.json`.
 */
export function pluginFiles(
	id: string,
	bundle: string,
	files: Record<string, string> = {},
): Record<string, string> {
	const manifest = {
		id,
		name: 'Hello',
		description: 'Says hello.',
		authors: [{ name: 'Mario', id: '1234567890' }],
		version: '1.0.0',
		main: 'index.ts',
	};

	const plugin = {
		'manifest.json': JSON.stringify(manifest),
		'package.json': JSON.stringify({ scripts: { build: 'bun build index.ts --outdir dist' } }),
		'dist/index.js': bundle,
		...files,
	};

	return {
		'unbound.config.json': JSON.stringify({ addons: ['plugins/*'] }),
		...Object.fromEntries(
			Object.entries(plugin).map(([name, content]) => [`plugins/${id}/${name}`, content]),
		),
	};
}
