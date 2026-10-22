import { describe, expect, test } from 'bun:test';

import {
	createSubmissionRequestSchema,
	createSubmissionResponseSchema,
	finalizeSubmissionResponseSchema,
} from '../src/publish';
import { updatesRequestSchema, updatesResponseSchema } from '../src/updates';
import { addonManifestSchema, semverSchema } from '../src/manifest';
import { reviewSubmissionRequestSchema } from '../src/review';
import { apiErrorResponseSchema } from '../src/errors';
import { apiUrlSchema } from '../src/api';

const manifest = {
	id: 'mario.hello-world',
	name: 'Hello World',
	description: 'Says hello.',
	authors: [{ name: 'Mario', id: '1234567890' }],
	version: '1.0.0',
	main: 'index.js',
};

const sha256 = 'a'.repeat(64);

describe('apiUrlSchema', () => {
	test('reduces an http(s) URL to its origin and defaults to production', () => {
		expect(apiUrlSchema.parse('http://localhost:3000/api/v1/')).toBe('http://localhost:3000');
		expect(apiUrlSchema.parse(undefined)).toBe('https://unbound.rip');
	});

	test('rejects other protocols and non-URLs', () => {
		for (const url of ['ftp://unbound.rip', 'unbound.rip', '']) {
			expect(apiUrlSchema.safeParse(url).success).toBe(false);
		}
	});
});

describe('semverSchema', () => {
	test('accepts release, prerelease and build versions', () => {
		for (const version of ['0.0.0', '1.2.3', '1.0.0-beta.1', '1.0.0+abc.1']) {
			expect(semverSchema.safeParse(version).success).toBe(true);
		}
	});

	test('rejects partial, ranged, prefixed, zero-padded and non-version strings', () => {
		for (const version of ['1.2', '1.x', '^1.2.3', 'v1.2.3', '=1.2.3', '01.2.3', 'latest', 3]) {
			expect(semverSchema.safeParse(version).success).toBe(false);
		}
	});
});

describe('addonManifestSchema', () => {
	test('parses a manifest with and without unbound.min', () => {
		expect(addonManifestSchema.parse(manifest).unbound).toBeUndefined();
		expect(
			addonManifestSchema.parse({ ...manifest, unbound: { min: '2.1.0' } }).unbound?.min,
		).toBe('2.1.0');
	});

	test('keeps fields it does not validate', () => {
		const parsed = addonManifestSchema.parse({ ...manifest, updates: 'https://example.test' });

		expect(parsed.updates).toBe('https://example.test');
	});

	test('rejects a missing id, a bad unbound.min and a path-unsafe id', () => {
		const { id, ...withoutId } = manifest;

		expect(addonManifestSchema.safeParse(withoutId).success).toBe(false);
		expect(addonManifestSchema.safeParse({ ...manifest, unbound: { min: '2' } }).success).toBe(
			false,
		);
		expect(addonManifestSchema.safeParse({ ...manifest, id: '../escape' }).success).toBe(false);
	});

	test('accepts a main inside the addon and rejects one that leaves it', () => {
		expect(addonManifestSchema.safeParse({ ...manifest, main: 'dist/index.js' }).success).toBe(
			true,
		);

		for (const main of ['../other/index.js', '/index.js', 'https://example.test/index.js']) {
			expect(addonManifestSchema.safeParse({ ...manifest, main }).success).toBe(false);
		}
	});

	test('rejects non-numeric author ids and empty author lists', () => {
		expect(
			addonManifestSchema.safeParse({ ...manifest, authors: [{ name: 'M', id: 'abc' }] })
				.success,
		).toBe(false);
		expect(addonManifestSchema.safeParse({ ...manifest, authors: [] }).success).toBe(false);
	});
});

describe('updatesRequestSchema', () => {
	test('parses a client version and installed addons', () => {
		const request = {
			clientVersion: '1.4.0',
			addons: [{ id: 'mario.hello-world', version: '1.0.0' }],
		};

		expect(updatesRequestSchema.parse(request)).toEqual(request);
	});

	test('rejects a bad client version, a bad addon version and a missing addon id', () => {
		const addons = [{ id: 'a', version: '1.0.0' }];

		expect(updatesRequestSchema.safeParse({ clientVersion: 'latest', addons }).success).toBe(
			false,
		);
		expect(
			updatesRequestSchema.safeParse({
				clientVersion: '1.0.0',
				addons: [{ id: 'a', version: '1.0' }],
			}).success,
		).toBe(false);
		expect(
			updatesRequestSchema.safeParse({
				clientVersion: '1.0.0',
				addons: [{ version: '1.0.0' }],
			}).success,
		).toBe(false);
	});

	test('caps the batch at 500 addons', () => {
		const addons = Array.from({ length: 501 }, (_, index) => ({
			id: `addon-${index}`,
			version: '1.0.0',
		}));

		expect(updatesRequestSchema.safeParse({ clientVersion: '1.0.0', addons }).success).toBe(
			false,
		);
		expect(
			updatesRequestSchema.safeParse({
				clientVersion: '1.0.0',
				addons: addons.slice(0, 500),
			}).success,
		).toBe(true);
	});

	test('rejects duplicate addon ids', () => {
		const addon = { id: 'a', version: '1.0.0' };

		expect(
			updatesRequestSchema.safeParse({ clientVersion: '1.0.0', addons: [addon, addon] })
				.success,
		).toBe(false);
	});
});

describe('updatesResponseSchema', () => {
	const update = {
		id: 'a',
		version: '1.1.0',
		manifestUrl: 'https://cdn.example.test/addons/a/1.1.0/manifest.json',
		bundleUrl: 'https://cdn.example.test/addons/a/1.1.0/index.js',
		sha256,
		changelog: null,
		changelogs: [],
	};

	test('parses an update entry', () => {
		expect(updatesResponseSchema.parse({ updates: [update] })).toEqual({ updates: [update] });
	});

	test('rejects an uppercase or short digest', () => {
		for (const digest of ['A'.repeat(64), 'a'.repeat(63)]) {
			expect(
				updatesResponseSchema.safeParse({ updates: [{ ...update, sha256: digest }] })
					.success,
			).toBe(false);
		}
	});
});

describe('publish contract', () => {
	const submission = {
		id: 'sub_1',
		addonId: manifest.id,
		version: manifest.version,
		kind: 'listing',
		status: 'awaiting_upload',
		repository: null,
		unverifiedSource: true,
		review: null,
	};

	test('parses a create request with an optional repository', () => {
		const request = { manifest, bundleSize: 1024, repository: 'marioparaschiv/unbound' };

		expect(createSubmissionRequestSchema.parse(request).repository).toBe(request.repository);
		expect(createSubmissionRequestSchema.parse({ manifest, bundleSize: 1 }).repository).toBe(
			undefined,
		);
	});

	test('rejects a non-positive bundle size, an invalid manifest and a malformed repository', () => {
		expect(createSubmissionRequestSchema.safeParse({ manifest, bundleSize: 0 }).success).toBe(
			false,
		);
		expect(
			createSubmissionRequestSchema.safeParse({
				manifest: { ...manifest, version: 'one' },
				bundleSize: 1,
			}).success,
		).toBe(false);
		expect(
			createSubmissionRequestSchema.safeParse({
				manifest,
				bundleSize: 1,
				repository: 'https://github.com/a/b',
			}).success,
		).toBe(false);
	});

	test('parses create and finalize responses', () => {
		const created = {
			submission,
			upload: {
				url: 'https://s3.example.test/staging/sub_1?X-Amz-Signature=x',
				method: 'PUT',
				headers: { 'content-type': 'application/javascript' },
				expiresAt: '2026-10-17T10:00:00.000Z',
			},
		};

		expect<unknown>(createSubmissionResponseSchema.parse(created)).toEqual(created);
		expect(
			finalizeSubmissionResponseSchema.parse({
				submission: { ...submission, status: 'pending_review' },
			}).submission.status,
		).toBe('pending_review');
		expect(
			finalizeSubmissionResponseSchema.safeParse({
				submission: { ...submission, status: 'queued' },
			}).success,
		).toBe(false);
	});
});

describe('reviewSubmissionRequestSchema', () => {
	test('approval takes an optional note; rejection and requested changes need one', () => {
		expect(reviewSubmissionRequestSchema.safeParse({ decision: 'approved' }).success).toBe(
			true,
		);

		for (const decision of ['rejected', 'changes_requested']) {
			expect(reviewSubmissionRequestSchema.safeParse({ decision }).success).toBe(false);
			expect(reviewSubmissionRequestSchema.safeParse({ decision, note: '  ' }).success).toBe(
				false,
			);
			expect(reviewSubmissionRequestSchema.parse({ decision, note: ' Why. ' }).note).toBe(
				'Why.',
			);
		}
	});

	test('rejects a decision that is not a review outcome', () => {
		expect(
			reviewSubmissionRequestSchema.safeParse({ decision: 'superseded', note: 'x' }).success,
		).toBe(false);
	});
});

describe('apiErrorResponseSchema', () => {
	test('parses a known error code and rejects an unknown one', () => {
		const body = { error: { code: 'addon_id_taken', message: 'Taken.' } };

		expect<unknown>(apiErrorResponseSchema.parse(body)).toEqual(body);
		expect(
			apiErrorResponseSchema.safeParse({ error: { code: 'teapot', message: '' } }).success,
		).toBe(false);
	});
});
