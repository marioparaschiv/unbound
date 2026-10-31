import {
	createTestContext,
	linkGitHub,
	schema,
	serveGitHub,
	signInWithDiscord,
	snowflakeAt,
} from '@unbound-app/web/testing';
import { afterAll, describe, expect, test } from 'bun:test';
import { join } from 'node:path';

import { createApiKey, pluginFiles, servePublishApi, useCheckout } from './helpers/publish';
import { createTempDir, runUbd } from './helpers/ubd';

const ADDON_MAX_BYTES = 64;
const REPOSITORY = 'acme/addons';

const github = serveGitHub({
	repositories: { [REPOSITORY]: {} },
	tokens: { owner: { push: [REPOSITORY] } },
});

const checkout = useCheckout(github.repository(REPOSITORY), REPOSITORY);

const { ctx, close } = await createTestContext({
	ADDON_MAX_BYTES: String(ADDON_MAX_BYTES),
	GITHUB_API_URL: github.url.href,
});
const server = servePublishApi(ctx);
const config = createTempDir();

afterAll(async () => {
	await server.stop(true);
	await github.stop();
	config.remove();
	await close();
});

let users = 0;

async function publisher(discordId: string = '80351110224678912') {
	users += 1;

	const { userId, headers } = await signInWithDiscord(ctx, {
		id: discordId,
		name: `Publisher ${users}`,
		email: `publisher-${users}@example.com`,
	});

	await linkGitHub(ctx, userId, 'owner');

	return createApiKey(ctx, headers);
}

function publish(id: string, apiKey: string | undefined) {
	return runUbd(['publish', '--addon', id], join(checkout.dir, 'plugins', id), {
		UNBOUND_API_URL: server.url.href,
		UNBOUND_API_KEY: apiKey,
		XDG_CONFIG_HOME: config.path,
	});
}

async function submissionCount() {
	const rows = await ctx.db.select({ id: schema.submission.id }).from(schema.submission);

	return rows.length;
}

describe('ubd publish refusals', () => {
	test('uncommitted changes are refused before calling the API', async () => {
		const key = await publisher();

		checkout.commit(pluginFiles('publish.dirty', 'export {};'));
		checkout.write({ 'plugins/publish.dirty/dist/index.js': 'export const changed = 1;' });

		const result = await publish('publish.dirty', key);

		expect(result.exitCode).toBe(1);
		expect(result.stderr).toStartWith('plugins/publish.dirty has uncommitted changes.');
		expect(await submissionCount()).toBe(0);

		checkout.commit({});
	});

	test('an invalid CHANGELOG.md is refused with the server’s message', async () => {
		const key = await publisher();

		checkout.commit(
			pluginFiles('publish.changelog', 'export {};', {
				'CHANGELOG.md': '## [1.0.0]\n\n### Security\n\n- Patched.\n',
			}),
		);

		const result = await publish('publish.changelog', key);

		expect(result.exitCode).toBe(1);
		expect(result.stderr).toBe(
			'plugins/publish.changelog/CHANGELOG.md:3: List Security changes under ### Fixed.\n',
		);
		expect(await submissionCount()).toBe(0);
	});

	test('a CHANGELOG.md without the manifest version is refused', async () => {
		const key = await publisher();

		checkout.commit(
			pluginFiles('publish.no-entry', 'export {};', {
				'CHANGELOG.md': '## [0.9.0]\n\n### Fixed\n\n- Old.\n',
			}),
		);

		const result = await publish('publish.no-entry', key);

		expect(result.stderr).toBe(
			'plugins/publish.no-entry/CHANGELOG.md has no entry for 1.0.0.\n',
		);
		expect(await submissionCount()).toBe(0);
	});

	test('an oversize committed bundle is refused with the server limit', async () => {
		const key = await publisher();

		checkout.commit(pluginFiles('publish.oversize', 'x'.repeat(ADDON_MAX_BYTES + 1)));

		const result = await publish('publish.oversize', key);

		expect(result.exitCode).toBe(1);
		expect(result.stderr).toMatch(/\(artifact_too_large\)\n$/);
		expect(result.stderr).toContain('plugins/publish.oversize/dist/index.js');
		expect(result.stderr).toContain(`${ADDON_MAX_BYTES + 1} bytes`);
		expect(result.stderr).toContain(`${ADDON_MAX_BYTES} bytes`);
		expect(await submissionCount()).toBe(0);
	});

	test('a spam gate prints the server error code and message', async () => {
		const key = await publisher(snowflakeAt(new Date()));

		checkout.commit(pluginFiles('publish.too-new', 'export {};'));

		const result = await publish('publish.too-new', key);

		expect(result.exitCode).toBe(1);
		expect(result.stderr).toMatch(/^\S.+ \(account_too_new\)\n$/);
		expect(await submissionCount()).toBe(0);
	});

	test('publishing without a login or API key asks to log in', async () => {
		checkout.commit(pluginFiles('publish.anonymous', 'export {};'));

		const result = await publish('publish.anonymous', undefined);

		expect(result.exitCode).toBe(1);
		expect(result.stderr).toBe('Not logged in. Run `ubd login`, or set UNBOUND_API_KEY.\n');
	});
});
