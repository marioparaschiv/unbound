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

export const MUTABLE_CACHE_CONTROL = 'public, max-age=300';

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

export type DocsBucket = {
	read: (key: string) => Promise<string | undefined>;
	exists: (key: string) => Promise<boolean>;
	list: (prefix: string) => Promise<string[]>;
	write: (key: string, body: string, cacheControl: string) => Promise<void>;
};

/**
 * @description Publishes one docs version, then rebuilds the bucket's manifest from every version file the
 * bucket holds, so a run that failed before its manifest write is repaired by the next. A published
 * release tag is left as it is, and an unchanged manifest is not rewritten.
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
	const published = (await bucket.list(`docs/${DOCS_PACKAGE}/`)).flatMap((path) => {
		const parsed = docsVersionSchema.safeParse(path.match(/([^/]+)\.json$/)?.[1]);

		return parsed.success ? [parsed.data] : [];
	});
	const manifest = mergeDocsManifest(current, DOCS_PACKAGE, published);

	if (manifest.versions.join() !== current?.versions.join()) {
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
		list: async (prefix) => {
			const keys: string[] = [];
			let continuationToken: string | undefined;

			do {
				const page = await client.list({ prefix, continuationToken });

				keys.push(...(page.contents ?? []).map((object) => object.key));
				continuationToken = page.isTruncated ? page.nextContinuationToken : void 0;
			} while (continuationToken);

			return keys;
		},
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
