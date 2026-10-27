import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
	cleanupSkipReason,
	planPullRequestBuilds,
	renderCommentSection,
	writeOutputs,
} from './pr-builds-plan';

const configured = {
	PR_NUMBER: '42',
	IS_FORK: 'false',
	S3_ENDPOINT: 'https://s3.example.test',
	S3_REGION: 'auto',
	S3_PUBLIC_BUCKET: 'unbound-public',
	CDN_URL: 'https://cdn.example.test/',
	HAS_S3_ACCESS_KEY_ID: 'true',
	HAS_S3_SECRET_ACCESS_KEY: 'true',
	HAS_UNBOUND_BUNDLE_SIGNING_KEY: 'true',
};

describe('planPullRequestBuilds', () => {
	test('uploads a same-repository pull request under stable per-PR paths', () => {
		expect(planPullRequestBuilds(configured)).toEqual({
			enabled: true,
			bundleUrl: 'https://cdn.example.test/unbound/pr/42/',
			loaderUrl: 'https://cdn.example.test/loader/pr/42/',
			reason: '',
		});
	});

	test('skips forks, which get no secrets to sign with', () => {
		const plan = planPullRequestBuilds({ ...configured, IS_FORK: 'true' });

		expect(plan.enabled).toBe(false);
		expect(plan.bundleUrl).toBe('');
		expect(plan.reason).toContain('forks');
	});

	test('names everything that still has to be configured', () => {
		const plan = planPullRequestBuilds({
			PR_NUMBER: '42',
			IS_FORK: 'false',
			HAS_S3_ACCESS_KEY_ID: 'false',
			HAS_S3_SECRET_ACCESS_KEY: '',
		});

		expect(plan.enabled).toBe(false);
		expect(plan.reason).toBe(
			'S3 uploads are off until these are configured: variable S3_ENDPOINT, variable S3_REGION, variable S3_PUBLIC_BUCKET, variable CDN_URL, secret S3_ACCESS_KEY_ID, secret S3_SECRET_ACCESS_KEY, secret UNBOUND_BUNDLE_SIGNING_KEY.',
		);
	});

	test('needs the signing key, since keyed loaders reject unsigned bundles', () => {
		const plan = planPullRequestBuilds({
			...configured,
			HAS_UNBOUND_BUNDLE_SIGNING_KEY: 'false',
		});

		expect(plan.enabled).toBe(false);
		expect(plan.reason).toContain('secret UNBOUND_BUNDLE_SIGNING_KEY');
	});

	test('refuses a CDN URL that could not be compiled into a loader', () => {
		for (const CDN_URL of [
			'http://cdn.example.test',
			'https://cdn.example.test/a"b',
			'cdn.example.test',
		]) {
			expect(planPullRequestBuilds({ ...configured, CDN_URL }).enabled).toBe(false);
		}
	});

	test('runs only for pull requests', () => {
		expect(planPullRequestBuilds({ ...configured, PR_NUMBER: '' }).enabled).toBe(false);
	});
});

describe('cleanupSkipReason', () => {
	test('needs only the bucket credentials', () => {
		expect(
			cleanupSkipReason({
				...configured,
				CDN_URL: '',
				HAS_UNBOUND_BUNDLE_SIGNING_KEY: 'false',
			}),
		).toBe('');
		expect(cleanupSkipReason({ ...configured, S3_REGION: '' })).toBe(
			'S3 cleanup is off until these are configured: variable S3_REGION.',
		);
		expect(cleanupSkipReason({ ...configured, IS_FORK: 'true' })).toContain('forks');
	});
});

describe('renderCommentSection', () => {
	test('links the bundle base and every loader build', () => {
		const section = renderCommentSection({
			enabled: true,
			uploaded: true,
			bundleUrl: 'https://cdn.example.test/unbound/pr/42/',
			loaderUrl: 'https://cdn.example.test/loader/pr/42/',
			reason: '',
			files: ['Unbound.ipa', 'Unbound.apks'],
		});

		expect(section).toContain('- Client bundle: https://cdn.example.test/unbound/pr/42/');
		expect(section).toContain(
			'- [**Unbound.ipa**](https://cdn.example.test/loader/pr/42/Unbound.ipa)',
		);
		expect(section).toContain(
			'- [**Unbound.apks**](https://cdn.example.test/loader/pr/42/Unbound.apks)',
		);
		expect(section).toContain("load this pull request's bundle");
	});

	test('explains why nothing was uploaded', () => {
		expect(
			renderCommentSection({
				enabled: false,
				uploaded: false,
				bundleUrl: '',
				loaderUrl: '',
				reason: 'S3 uploads are off.',
				files: [],
			}),
		).toBe('#### S3\nS3 uploads are off.');
		expect(
			renderCommentSection({
				enabled: true,
				uploaded: false,
				bundleUrl: 'x',
				loaderUrl: 'y',
				reason: '',
				files: ['Unbound.ipa'],
			}),
		).toContain('failed');
	});
});

describe('writeOutputs', () => {
	test('writes multi-line values as a heredoc', () => {
		const dir = mkdtempSync(join(tmpdir(), 'unbound-outputs-'));
		const path = join(dir, 'output');

		try {
			writeOutputs(path, { enabled: 'true', section: 'a\nb' });

			const written = readFileSync(path, 'utf8');
			const delimiter = /section<<(EOF_[0-9a-f]+)\n/.exec(written)?.[1];

			expect(written.startsWith('enabled=true\n')).toBe(true);
			expect(written).toContain(`section<<${delimiter}\na\nb\n${delimiter}\n`);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});
