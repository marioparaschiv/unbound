import { generateKeyPairSync } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { afterAll, beforeAll, expect, test } from 'bun:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { verifyPluginSignature } from './sign-plugin';

const SCRIPT = join(import.meta.dir, 'publish-plugins.ts');
const REPOSITORY = 'owner/plugins';

type Published = {
	version: string;
	commitSha: string | null;
};

type PublishCall = {
	apiKey: string | null;
	body: Record<string, string>;
};

type RunResult = {
	exitCode: number;
	output: string;
};

const state = {
	published: new Map<string, Published>(),
	calls: [] as PublishCall[],
};

let root: string;
let work: string;
let remote: string;
let server: ReturnType<typeof Bun.serve>;

function git(cwd: string, ...args: string[]): string {
	const proc = Bun.spawnSync(['git', ...args], { cwd, stdout: 'pipe', stderr: 'pipe' });

	if (proc.exitCode !== 0) {
		throw new Error(`git ${args.join(' ')}: ${proc.stderr.toString()}`);
	}

	return proc.stdout.toString().trim();
}

function write(path: string, contents: string) {
	mkdirSync(join(work, path, '..'), { recursive: true });
	writeFileSync(join(work, path), contents);
}

function writePlugin(dir: string, version: string) {
	write(
		`packages/plugins/${dir}/manifest.json`,
		`${JSON.stringify({ id: `unbound.${dir}`, version, main: 'index.tsx' }, null, '\t')}\n`,
	);
	write(`packages/plugins/${dir}/package.json`, '{ "scripts": { "build": "rollup" } }\n');
	write(`packages/plugins/${dir}/dist/index.js`, `export default '${dir} ${version}';\n`);
}

function commit(message: string): string {
	git(work, 'add', '-A');
	git(work, 'commit', '-q', '-m', message);

	return git(work, 'rev-parse', 'HEAD');
}

async function serve(request: Request): Promise<Response> {
	const url = new URL(request.url);

	if (request.method === 'GET' && url.pathname === '/api/v1/first-party/addons') {
		if (request.headers.get('x-api-key') !== 'test-key') {
			return Response.json(
				{ error: { code: 'unauthorized', message: 'No key.' } },
				{ status: 401 },
			);
		}

		const addons = [...state.published].map(([id, { version, commitSha }]) => ({
			id,
			version,
			commitSha,
		}));

		return Response.json({ addons });
	}

	if (request.method === 'POST' && url.pathname === '/api/v1/first-party/publish') {
		const body = (await request.json()) as Record<string, string>;
		const dir = body.path?.split('/').at(-1) ?? '';

		state.calls.push({ apiKey: request.headers.get('x-api-key'), body });

		return Response.json({
			status: 'published',
			addonId: `unbound.${dir}`,
			version: '0.0.0',
			sha256: 'a'.repeat(64),
		});
	}

	return new Response('not found', { status: 404 });
}

let extraEnv: Record<string, string> = {};

async function run(...args: string[]): Promise<RunResult> {
	const proc = Bun.spawn(['bun', SCRIPT, '--repository', REPOSITORY, ...args], {
		cwd: work,
		env: {
			...process.env,
			GITHUB_REPOSITORY: '',
			UNBOUND_API_URL: server.url.href,
			UNBOUND_API_KEY: 'test-key',
			UNBOUND_BUNDLE_SIGNING_KEY: '',
			...extraEnv,
		},
		stdout: 'pipe',
		stderr: 'pipe',
	});
	const [stdout, stderr, exitCode] = await Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
		proc.exited,
	]);

	return { exitCode, output: stdout + stderr };
}

function remoteTags(): string {
	return git(work, 'ls-remote', '--tags', 'origin');
}

beforeAll(() => {
	root = mkdtempSync(join(tmpdir(), 'publish-plugins-test-'));
	work = join(root, 'work');
	remote = join(root, 'remote.git');
	mkdirSync(work);
	git(root, 'init', '-q', '--bare', remote);
	git(work, 'init', '-q', '-b', 'main');
	git(work, 'config', 'user.name', 'Test');
	git(work, 'config', 'user.email', 'test@example.com');
	git(work, 'remote', 'add', 'origin', remote);
	write('.gitignore', 'dist\n');
	write('packages/plugins/unbound.config.json', '{ "addons": ["*"], "output": "dist" }\n');
	writePlugin('alpha', '0.9.0');
	commit('feat(alpha): add the first thing');
	writePlugin('alpha', '1.0.0');
	commit('feat(alpha): add a toggle');
	writePlugin('beta', '1.0.0');
	commit('fix(beta): stop the crash');
	git(work, 'push', '-q', 'origin', 'main');
	server = Bun.serve({ port: 0, fetch: serve });
});

afterAll(async () => {
	await server.stop(true);
	rmSync(root, { recursive: true, force: true });
});

test('a first run pushes the build tag and publishes every selected plugin', async () => {
	state.published = new Map([['unbound.alpha', { version: '0.9.0', commitSha: null }]]);
	state.calls = [];

	const head = git(work, 'rev-parse', 'HEAD');
	const tag = `plugin-builds/${head}`;
	const result = await run();

	expect(result.exitCode).toBe(0);

	const build = git(work, 'ls-remote', 'origin', `refs/tags/${tag}`).split('\t')[0];

	expect(build).toMatch(/^[0-9a-f]{40}$/);
	expect(git(work, 'rev-parse', `${build}^`)).toBe(head);
	expect(state.calls).toEqual([
		{
			apiKey: 'test-key',
			body: {
				repository: REPOSITORY,
				path: 'packages/plugins/alpha',
				ref: tag,
				commitSha: build ?? '',
			},
		},
		{
			apiKey: 'test-key',
			body: {
				repository: REPOSITORY,
				path: 'packages/plugins/beta',
				ref: tag,
				commitSha: build ?? '',
			},
		},
	]);

	const alphaLog = git(work, 'show', `${build}:packages/plugins/alpha/CHANGELOG.md`);
	const betaLog = git(work, 'show', `${build}:packages/plugins/beta/CHANGELOG.md`);
	const date = new Date(Number(git(work, 'show', '-s', '--format=%ct', head)) * 1000)
		.toISOString()
		.slice(0, 10);

	expect(alphaLog).toBe(`# Changelog\n\n## [1.0.0] - ${date}\n\n### Added\n\n- Add a toggle`);
	expect(betaLog).toBe(`# Changelog\n\n## [1.0.0] - ${date}\n\n### Fixed\n\n- Stop the crash`);
	expect(git(work, 'show', `${build}:packages/plugins/beta/dist/index.js`)).toBe(
		"export default 'beta 1.0.0';",
	);
	expect(git(work, 'rev-parse', 'HEAD')).toBe(head);
	expect(git(work, 'status', '--porcelain')).toBe('');
	expect(result.output).toMatch(/unbound\.alpha.*1\.0\.0/);
	state.published = new Map([
		['unbound.alpha', { version: '1.0.0', commitSha: build ?? null }],
		['unbound.beta', { version: '1.0.0', commitSha: build ?? null }],
	]);
});

test('a second run on the same commit does nothing', async () => {
	state.calls = [];

	const tags = remoteTags();
	const result = await run();

	expect(result.exitCode).toBe(0);
	expect(result.output).toMatch(/nothing to publish/i);
	expect(state.calls).toEqual([]);
	expect(remoteTags()).toBe(tags);
});

test('a build tag already on the remote is reused, not rebuilt', async () => {
	state.calls = [];
	writePlugin('beta', '1.1.0');

	const head = commit('feat(beta): add more');
	const tag = `plugin-builds/${head}`;

	git(work, 'push', '-q', 'origin', `${head}:refs/tags/${tag}`);

	const result = await run();

	expect(result.exitCode).toBe(0);
	expect(result.output).toContain('- Add more');
	expect(result.output).not.toContain('Stop the crash');
	expect(result.output).toMatch(/reused/);
	expect(state.calls.map((call) => call.body)).toEqual([
		{ repository: REPOSITORY, path: 'packages/plugins/beta', ref: tag, commitSha: head },
	]);
	expect(git(work, 'ls-remote', 'origin', `refs/tags/${tag}`).split('\t')[0]).toBe(head);
});

test('a version reviewed from a main commit starts the changelog after that commit', async () => {
	const reviewed = git(work, 'rev-parse', 'HEAD');

	state.published = new Map([['unbound.beta', { version: '1.1.0', commitSha: reviewed }]]);
	writePlugin('beta', '1.2.0');
	commit('fix(beta): keep the toggle');

	const result = await run('--dry-run');

	expect(result.exitCode).toBe(0);
	expect(result.output).toContain('- Keep the toggle');
	expect(result.output).not.toContain('- Add more');
});

test('signs each published bundle into its manifest when the signing key is set', async () => {
	const { privateKey, publicKey } = generateKeyPairSync('ed25519');
	const rawPublicKey = publicKey
		.export({ format: 'der', type: 'spki' })
		.subarray(12)
		.toString('base64');

	writePlugin('beta', '1.1.0');
	commit('feat(beta): sign the build');
	git(work, 'push', '-q', 'origin', 'main');
	state.published = new Map([
		['unbound.alpha', { version: '1.0.0', commitSha: null }],
		['unbound.beta', { version: '1.0.0', commitSha: null }],
	]);
	state.calls = [];
	extraEnv = {
		UNBOUND_BUNDLE_SIGNING_KEY: privateKey.export({ format: 'pem', type: 'pkcs8' }).toString(),
	};

	try {
		const result = await run();

		expect(result.exitCode).toBe(0);

		const build = state.calls[0]?.body.commitSha ?? '';
		const manifest = JSON.parse(
			git(work, 'show', `${build}:packages/plugins/beta/manifest.json`),
		);
		const bundle = new TextEncoder().encode(
			`${git(work, 'show', `${build}:packages/plugins/beta/dist/index.js`)}\n`,
		);

		expect(manifest.version).toBe('1.1.0');
		expect(manifest.main).toBe('index.tsx');
		expect(
			verifyPluginSignature(
				rawPublicKey,
				'unbound.beta',
				'1.1.0',
				bundle,
				manifest.signature,
			),
		).toBe(true);
	} finally {
		extraEnv = {};
	}
});
