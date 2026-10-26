import {
	S3_TEST_ENV,
	createTestContext,
	linkGitHub,
	schema,
	serveGitHub,
	signInWithDiscord,
} from '@unbound-app/web/testing';
import { afterAll, describe, expect, test } from 'bun:test';
import { join } from 'node:path';

import { createApiKey, pluginFiles, servePublishApi, useCheckout } from './helpers/publish';
import { createTempDir, runUbd } from './helpers/ubd';

const REPOSITORY = 'acme/addons';
const BUNDLE = 'export const greeting = "hello";\n';
const CHANGELOG = '## [1.0.0] - 2026-10-20\n\n### Added\n\n- First release.\n';

const github = serveGitHub({
	repositories: { [REPOSITORY]: {} },
	tokens: { owner: { push: [REPOSITORY] } },
});

const checkout = useCheckout(github.repository(REPOSITORY), REPOSITORY);
const { ctx, close } = await createTestContext({ ...S3_TEST_ENV, GITHUB_API_URL: github.url.href });
const server = servePublishApi(ctx);
const config = createTempDir();

afterAll(async () => {
	const rows = await ctx.db.select({ key: schema.submission.stagingKey }).from(schema.submission);

	await Promise.all(rows.map((row) => ctx.storage.staging.delete(row.key)));
	await server.stop(true);
	await github.stop();
	config.remove();
	await close();
});

describe('ubd publish', () => {
	test('with only an API key in env, submits the pushed commit and stages its bundle', async () => {
		const { userId, headers } = await signInWithDiscord(ctx, {
			id: '80351110224678912',
			name: 'Publisher',
			email: 'publisher@example.com',
		});

		await linkGitHub(ctx, userId, 'owner');

		const commitSha = checkout.commit(
			pluginFiles('publish.sample', BUNDLE, { 'CHANGELOG.md': CHANGELOG }),
		);

		const result = await runUbd(['publish'], join(checkout.dir, 'plugins', 'publish.sample'), {
			UNBOUND_API_URL: server.url.href,
			UNBOUND_API_KEY: await createApiKey(ctx, headers),
			XDG_CONFIG_HOME: config.path,
		});

		expect(result.stderr).toBe('');
		expect(result.exitCode).toBe(0);

		const row = await ctx.db.query.submission.findFirst({
			where: { addonId: 'publish.sample' },
			with: { source: true },
		});

		expect(row).toMatchObject({
			status: 'pending_review',
			kind: 'listing',
			repository: REPOSITORY,
			bundleSize: BUNDLE.length,
			sha256: new Bun.CryptoHasher('sha256').update(BUNDLE).digest('hex'),
			manifest: { id: 'publish.sample', main: 'index.js' },
			source: {
				path: 'plugins/publish.sample',
				ref: commitSha,
				commitSha,
				changelog: { sections: [{ type: 'added', items: ['First release.'] }] },
			},
		});
		expect(result.stdout).toEndWith(
			`Submitted publish.sample 1.0.0 (listing) from ${REPOSITORY}@${commitSha.slice(0, 7)}: pending_review.\n`,
		);
		expect(await ctx.storage.staging.file(row?.stagingKey ?? '').text()).toBe(BUNDLE);
	});
});
