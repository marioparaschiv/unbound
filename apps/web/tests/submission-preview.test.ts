import { submissionPreviewResponseSchema } from '@unbound-app/contracts/review';
import type { CreateSubmissionRequest } from '@unbound-app/contracts/publish';
import { afterAll, describe, expect, test } from 'bun:test';
import { count } from 'drizzle-orm';

import previewSubmissionEndpoint from '~/endpoints/preview-submission';
import { ApiRequestError, createApiClient } from '~/api/client';
import type { EnvSource } from '~/lib/env';
import { submission } from '~/db/schema';
import type { Api } from '~/api';

import { createTestContext, linkGitHub, signInWithDiscord, snowflakeAt } from './helpers/context';
import { manifest, seedApprovedAddon } from './helpers/addons';
import { failure, serveEndpoints } from './helpers/server';
import { serveGitHub } from './helpers/github';

const REPOSITORY = 'acme/addons';
const DAY_MS = 86_400_000;
const BUNDLE = 'module.exports = { hello: true };';

const CHANGELOG = [
	'# Changelog',
	'',
	'## [1.0.0] - 2026-10-01',
	'',
	'### Added',
	'',
	'- Says hello',
	'  to everyone.',
	'',
].join('\n');

const github = serveGitHub({
	repositories: { [REPOSITORY]: { topics: ['greeting'], homepage: 'https://acme.example' } },
	tokens: { owner: { push: [REPOSITORY] }, reader: { push: [] } },
});

const fixture = github.repository(REPOSITORY);

function manifestJson(id: string, version: string = '1.0.0') {
	return JSON.stringify({
		id,
		name: 'Hello',
		description: 'Says hello.',
		authors: [{ name: 'Acme', id: '1234' }],
		version,
		main: 'src/index.ts',
	});
}

function commitAddon(branch: string, id: string, files: Record<string, string | null> = {}) {
	const dir = `plugins/${branch}`;

	return {
		path: dir,
		commitSha: fixture.commit(
			{
				[`${dir}/manifest.json`]: manifestJson(id),
				[`${dir}/package.json`]: JSON.stringify({ scripts: { build: 'bun build' } }),
				[`${dir}/dist/index.js`]: BUNDLE,
				[`${dir}/ADDON.md`]: '# Hello\n\nSays hello.',
				[`${dir}/CHANGELOG.md`]: CHANGELOG,
				...Object.fromEntries(
					Object.entries(files).map(([name, content]) => [`${dir}/${name}`, content]),
				),
			},
			{ branch, parent: fixture.resolve('main') },
		),
	};
}

fixture.commit({ 'unbound.config.json': JSON.stringify({ addons: ['plugins/*'] }) });

async function setup(overrides: EnvSource = {}) {
	const test = await createTestContext({
		GITHUB_API_URL: github.url.href,
		GITHUB_RATE_LIMIT_MAX: '1000',
		...overrides,
	});
	const server = serveEndpoints(test.ctx, {
		'POST /api/v1/submissions/preview': previewSubmissionEndpoint,
	});

	return {
		ctx: test.ctx,
		client: createApiClient<Api>({ baseUrl: server.url.href }),
		async close() {
			await server.stop(true);
			await test.close();
		},
	};
}

const main = await setup();

afterAll(async () => {
	await main.close();
	await github.stop();
});

let users = 0;

async function signIn(target = main, token: string | null = 'owner', accountAgeDays = 365) {
	users += 1;

	const { userId, headers } = await signInWithDiscord(target.ctx, {
		id: snowflakeAt(new Date(Date.now() - accountAgeDays * DAY_MS)),
		name: `Author ${users}`,
		email: `author${users}@example.com`,
	});

	if (token) {
		await linkGitHub(target.ctx, userId, token);
	}

	return { userId, headers };
}

function preview(headers: Headers, body: CreateSubmissionRequest, target = main) {
	return target.client('POST /api/v1/submissions/preview', {
		headers,
		body,
		response: submissionPreviewResponseSchema,
	});
}

async function refusal(request: Promise<object>) {
	const error = await request.then(
		() => new Error('Expected the request to fail.'),
		(cause: unknown) => cause,
	);

	if (!(error instanceof ApiRequestError)) {
		throw error;
	}

	return { code: error.code, message: error.message };
}

describe('POST /api/v1/submissions/preview', () => {
	test('shows the kind, the pin and the content a submission would carry', async () => {
		const { headers } = await signIn();
		const { path, commitSha } = commitAddon('hello', 'acme.hello');
		const { preview: result } = await preview(headers, {
			repository: `https://github.com/${REPOSITORY}`,
			path,
			ref: 'hello',
			commitSha,
			details: { tags: ['hello'] },
		});

		const blobSha = new Bun.CryptoHasher('sha1')
			.update(`blob ${BUNDLE.length}\0${BUNDLE}`)
			.digest('hex');

		expect(result.kind).toBe('listing');
		expect(result.source).toEqual({
			repository: REPOSITORY,
			repositoryId: expect.any(Number),
			path: 'plugins/hello',
			ref: 'hello',
			commitSha,
			bundlePath: 'plugins/hello/dist/index.js',
			bundleBlobSha: blobSha,
		});
		expect(result.manifest).toMatchObject({ id: 'acme.hello', main: 'index.js' });
		expect(result.bundleSize).toBe(BUNDLE.length);
		expect(result.sha256).toBe(new Bun.CryptoHasher('sha256').update(BUNDLE).digest('hex'));
		expect(result.addonMd).toBe('# Hello\n\nSays hello.');
		expect(result.changelog).toEqual({
			date: '2026-10-01',
			sections: [{ type: 'added', items: ['Says hello to everyone.'] }],
		});
		expect(result.details).toMatchObject({
			homepage: 'https://acme.example/',
			tags: ['hello'],
		});
	});

	test('writes nothing', async () => {
		const { headers } = await signIn();
		const { path, commitSha } = commitAddon('readonly', 'acme.readonly');

		async function total() {
			const [row] = await main.ctx.db.select({ total: count() }).from(submission);

			return row?.total;
		}
		const before = await total();

		await preview(headers, { repository: REPOSITORY, path, ref: 'readonly', commitSha });

		expect(await total()).toBe(before);
	});

	test('runs the claim checks: updates, existing versions and maintainership', async () => {
		const owner = await signIn();
		const stranger = await signIn();
		const { path, commitSha } = commitAddon('claimed', 'acme.claimed');
		const body = { repository: REPOSITORY, path, ref: 'claimed', commitSha };

		await seedApprovedAddon(main.ctx, owner.userId, manifest('acme.claimed', '0.9.0'));

		expect((await preview(owner.headers, body)).preview.kind).toBe('update');
		expect(await failure(preview(stranger.headers, body))).toEqual({
			status: 403,
			code: 'not_maintainer',
		});

		const existing = commitAddon('existing', 'acme.existing');

		await seedApprovedAddon(main.ctx, owner.userId, manifest('acme.existing'));

		expect(
			await failure(
				preview(owner.headers, { repository: REPOSITORY, ref: 'existing', ...existing }),
			),
		).toEqual({ status: 409, code: 'version_exists' });
	});

	test('refuses a ref that moved since the preview', async () => {
		const { headers } = await signIn();
		const { path, commitSha } = commitAddon('moving', 'acme.moving');

		fixture.commit({ [`${path}/dist/index.js`]: 'module.exports = 2;' }, { branch: 'moving' });

		expect(
			await failure(
				preview(headers, { repository: REPOSITORY, path, ref: 'moving', commitSha }),
			),
		).toEqual({ status: 409, code: 'source_changed' });
	});

	test('refuses what cannot be submitted as it is', async () => {
		const { headers } = await signIn();
		const cases = [
			['unlisted', { path: 'elsewhere' }, 'addon_not_found'],
			['nodist', { files: { 'dist/index.js': null } }, 'artifact_missing'],
			[
				'badmanifest',
				{ files: { 'manifest.json': '{"id":"x","main":"a.js"}' } },
				'invalid_manifest',
			],
			[
				'nochangelog',
				{ files: { 'CHANGELOG.md': '## [0.1.0]\n\n### Fixed\n\n- Old.\n' } },
				'invalid_changelog',
			],
		] as const;

		for (const [branch, options, code] of cases) {
			const files: Record<string, string | null> = 'files' in options ? options.files : {};
			const { path, commitSha } = commitAddon(branch, `acme.${branch}`, files);
			const body = {
				repository: REPOSITORY,
				path: 'path' in options ? options.path : path,
				ref: branch,
				commitSha,
			};

			expect({ branch, ...(await refusal(preview(headers, body))) }).toMatchObject({
				branch,
				code,
			});
		}
	});

	test('names the changelog line at fault', async () => {
		const { headers } = await signIn();
		const changelog = '## [1.0.0]\n\n### Added\n\n- Hello.\n\n### Security\n\n- Patched.\n';
		const { path, commitSha } = commitAddon('security', 'acme.security', {
			'CHANGELOG.md': changelog,
		});

		expect(
			await refusal(
				preview(headers, { repository: REPOSITORY, path, ref: 'security', commitSha }),
			),
		).toEqual({
			code: 'invalid_changelog',
			message: 'plugins/security/CHANGELOG.md:7: List Security changes under ### Fixed.',
		});
	});

	test('refuses an oversize bundle and an oversize ADDON.md', async () => {
		const small = await setup({ ADDON_MAX_BYTES: String(BUNDLE.length - 1) });
		const smallText = await setup({ ADDON_TEXT_MAX_BYTES: '4' });

		try {
			const { path, commitSha } = commitAddon('oversize', 'acme.oversize');
			const body = { repository: REPOSITORY, path, ref: 'oversize', commitSha };

			expect(
				await refusal(preview((await signIn(small)).headers, body, small)),
			).toMatchObject({
				code: 'artifact_too_large',
				message: expect.stringContaining('plugins/oversize/dist/index.js'),
			});
			expect(
				await refusal(preview((await signIn(smallText)).headers, body, smallText)),
			).toMatchObject({
				code: 'artifact_too_large',
				message: expect.stringContaining('plugins/oversize/ADDON.md'),
			});
		} finally {
			await small.close();
			await smallText.close();
		}
	});

	test('refuses bytes that do not match their git blob id', async () => {
		const { headers } = await signIn();
		const { path, commitSha } = commitAddon('tampered', 'acme.tampered');

		github.tamper(true);

		try {
			expect(
				await failure(
					preview(headers, { repository: REPOSITORY, path, ref: 'tampered', commitSha }),
				),
			).toEqual({ status: 502, code: 'github_unavailable' });
		} finally {
			github.tamper(false);
		}
	});

	test('applies the account gates before reading GitHub', async () => {
		const { path, commitSha } = commitAddon('gates', 'acme.gates');
		const body = { repository: REPOSITORY, path, ref: 'gates', commitSha };
		const young = await signIn(main, 'owner', 1);
		const unlinked = await signIn(main, null);
		const reader = await signIn(main, 'reader');

		expect(await failure(preview(young.headers, body))).toEqual({
			status: 403,
			code: 'account_too_new',
		});
		expect(await failure(preview(unlinked.headers, body))).toEqual({
			status: 403,
			code: 'github_not_linked',
		});
		expect(await failure(preview(reader.headers, body))).toEqual({
			status: 403,
			code: 'github_no_push_access',
		});
	});
});
