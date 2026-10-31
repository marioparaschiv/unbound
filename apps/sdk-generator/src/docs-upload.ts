import {
	MAIN_DOCS_VERSION,
	docsManifestSchema,
	docsVersionSchema,
	getDocsKey,
	getDocsManifestKey,
	type DocsPackage,
	type DocsVersion,
} from '@unbound-app/contracts/docs';
import { createLogger } from '@unbound-app/logger';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

import { mergeDocsManifest } from './docs-manifest';
import { DOCS_OUT } from './docs';

const logger = createLogger('SDK', 'Docs Upload');

/** `main` and the manifest change on every push to main, so the CDN only holds them briefly. */
export const MUTABLE_CACHE_CONTROL = 'public, max-age=300';

/** A release tag's docs never change once published. */
export const IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable';

const DOCS_PACKAGE: DocsPackage = 'api';

export const bucketEnvSchema = z.object({
	S3_ENDPOINT: z.url(),
	S3_REGION: z.string().min(1),
	S3_ACCESS_KEY_ID: z.string().min(1),
	S3_SECRET_ACCESS_KEY: z.string().min(1),
	S3_PUBLIC_BUCKET: z.string().min(1),
});

export type BucketEnv = z.infer<typeof bucketEnvSchema>;

/** The public bucket operations the upload needs. */
export type DocsBucket = {
	/** The object's text, or `undefined` when it does not exist. */
	read: (key: string) => Promise<string | undefined>;
	exists: (key: string) => Promise<boolean>;
	write: (key: string, body: string, cacheControl: string) => Promise<void>;
};

/**
 * @description Publishes one docs version and lists it in the bucket's manifest. A release tag already
 * published is left as it is, and the manifest is only written when the version is new to it, so a rerun changes nothing.
 * @param dir The directory holding `docs/<package>/<version>.json`, {@link DOCS_OUT} by default.
 * @param version The version to publish.
 * @param bucket The public bucket.
 * @returns The keys written.
 */
export async function uploadDocs(
	dir: string,
	version: DocsVersion,
	bucket: DocsBucket,
): Promise<string[]> {
	const key = getDocsKey(DOCS_PACKAGE, version);
	const manifestKey = getDocsManifestKey(DOCS_PACKAGE);
	const written: string[] = [];
	const mutable = version === MAIN_DOCS_VERSION;

	if (mutable || !(await bucket.exists(key))) {
		const body = readFileSync(join(dir, key), 'utf8');

		await bucket.write(key, body, mutable ? MUTABLE_CACHE_CONTROL : IMMUTABLE_CACHE_CONTROL);
		written.push(key);
	}

	const remote = await bucket.read(manifestKey);
	const current = remote === undefined ? undefined : docsManifestSchema.parse(JSON.parse(remote));

	// The manifest is written after the version, so it never lists one readers cannot load.
	if (!current?.versions.includes(version)) {
		const manifest = mergeDocsManifest(current, DOCS_PACKAGE, version);

		await bucket.write(manifestKey, JSON.stringify(manifest), MUTABLE_CACHE_CONTROL);
		written.push(manifestKey);
	}

	return written;
}

/**
 * @description Parses the bucket credentials, failing with every missing or malformed variable named.
 * @param source The raw environment, `process.env` by default.
 * @returns The validated bucket environment.
 */
export function parseBucketEnv(
	source: Record<string, string | undefined> = process.env,
): BucketEnv {
	const result = bucketEnvSchema.safeParse(source);

	if (!result.success) {
		throw new Error(`Invalid bucket environment:\n${z.prettifyError(result.error)}`);
	}

	return result.data;
}

/**
 * @description Connects to the public bucket. Writes go through a presigned PUT, because `Bun.S3Client` cannot set `Cache-Control`.
 * @param env The validated bucket environment.
 * @returns The bucket operations the upload needs.
 */
export function createDocsBucket(env: BucketEnv): DocsBucket {
	const client = new Bun.S3Client({
		endpoint: env.S3_ENDPOINT,
		region: env.S3_REGION,
		accessKeyId: env.S3_ACCESS_KEY_ID,
		secretAccessKey: env.S3_SECRET_ACCESS_KEY,
		bucket: env.S3_PUBLIC_BUCKET,
	});

	return {
		read: async (key) => {
			const file = client.file(key);

			return (await file.exists()) ? file.text() : undefined;
		},
		exists: (key) => client.exists(key),
		write: async (key, body, cacheControl) => {
			const url = client.presign(key, { method: 'PUT', expiresIn: 300 });
			const response = await fetch(url, {
				method: 'PUT',
				body,
				headers: { 'content-type': 'application/json', 'cache-control': cacheControl },
			});

			if (!response.ok) {
				throw new Error(
					`Failed to write ${key}: ${response.status} ${await response.text()}`,
				);
			}
		},
	};
}

if (import.meta.main) {
	const version = docsVersionSchema.parse(process.argv[2]);

	try {
		const keys = await uploadDocs(DOCS_OUT, version, createDocsBucket(parseBucketEnv()));

		logger.success(
			keys.length
				? `Uploaded ${keys.join(', ')}.`
				: `The ${version} docs are already published; nothing changed.`,
		);
	} catch (error) {
		logger.error(`Failed to upload the ${version} docs:`, error);
		process.exit(1);
	}
}
