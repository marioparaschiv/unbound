import { semverSchema } from '@unbound-app/contracts/manifest';
import { createLogger } from '@unbound-app/logger';
import { join } from 'node:path';
import { z } from 'zod';

const logger = createLogger('Build', 'Upload');

/** Uploaded last, so a version only looks complete to readers once every other file is in place. */
const COMPLETION_MARKER = 'manifest.json';

const releaseSchema = z.discriminatedUnion('UNBOUND_CHANNEL', [
	z.object({
		UNBOUND_CHANNEL: z.literal('stable'),
		UNBOUND_VERSION: semverSchema,
	}),
	z.object({
		UNBOUND_CHANNEL: z.literal('beta'),
		UNBOUND_VERSION: z
			.string()
			.regex(/^[0-9a-f]{7,40}$/, 'Beta versions are the commit SHA they were built from.'),
	}),
	z.object({
		UNBOUND_CHANNEL: z.literal('pr'),
		UNBOUND_VERSION: z
			.string()
			.regex(/^[1-9][0-9]*$/, 'Pull request builds are keyed by the pull request number.'),
	}),
]);

export const bucketEnvSchema = z.object({
	S3_ENDPOINT: z.url(),
	S3_REGION: z.string().min(1),
	S3_ACCESS_KEY_ID: z.string().min(1),
	S3_SECRET_ACCESS_KEY: z.string().min(1),
	S3_PUBLIC_BUCKET: z.string().min(1),
});

export const uploadEnvSchema = bucketEnvSchema.and(releaseSchema);

export type BucketEnv = z.infer<typeof bucketEnvSchema>;

export type UploadEnv = z.infer<typeof uploadEnvSchema>;

export type PublicBucket = Pick<Bun.S3Client, 'write' | 'list' | 'delete' | 'exists'>;

export type UploadTarget = {
	bucket: PublicBucket;
	channel: UploadEnv['UNBOUND_CHANNEL'];
	version: string;
};

/** Thrown when an earlier upload of a version stopped part-way; its objects need removing by hand. */
export class IncompleteVersionError extends Error {
	constructor(public readonly prefix: string) {
		super(
			`${prefix} holds objects but no ${COMPLETION_MARKER}; an earlier upload stopped part-way. ` +
				'Delete the prefix to publish this version.',
		);
		this.name = 'IncompleteVersionError';
	}
}

/**
 * @description The bucket prefix a client build version lives under.
 * @param target The channel and version.
 * @returns `unbound/{channel}/{version}/`.
 */
export function versionPrefix(target: UploadTarget): string {
	return `unbound/${target.channel}/${target.version}/`;
}

/**
 * @description Lists every object key under a prefix, following continuation tokens.
 * @param bucket The bucket to list.
 * @param prefix The key prefix.
 * @returns The keys under the prefix.
 */
export async function listKeys(bucket: PublicBucket, prefix: string): Promise<string[]> {
	const keys: string[] = [];
	let continuationToken: string | undefined;

	do {
		const page = await bucket.list({ prefix, continuationToken });

		for (const object of page.contents ?? []) keys.push(object.key);

		continuationToken = page.isTruncated ? page.nextContinuationToken : void 0;
	} while (continuationToken);

	return keys;
}

/**
 * @description Deletes the keys under a prefix, except the ones to keep.
 * @param bucket The bucket to delete from.
 * @param prefix The key prefix.
 * @param keep The keys to leave in place.
 * @returns The deleted keys.
 */
export async function deletePrefix(
	bucket: PublicBucket,
	prefix: string,
	keep: Iterable<string> = [],
): Promise<string[]> {
	const kept = new Set(keep);
	const stale = (await listKeys(bucket, prefix)).filter((key) => !kept.has(key));

	await Promise.all(stale.map((key) => bucket.delete(key)));

	return stale;
}

/**
 * @description Uploads every file but the source maps in a client build directory to `unbound/{channel}/{version}/`.
 * Release versions are immutable: an already published version is skipped, never overwritten. A pull
 * request's prefix always holds its latest build, so it is overwritten and its stale files removed.
 * @param dir The build output directory, e.g. `packages/client/dist`.
 * @param target The bucket, channel and version to upload to.
 * @returns The uploaded object keys, or `undefined` when the version was already published.
 */
export async function uploadBuild(
	dir: string,
	target: UploadTarget,
): Promise<string[] | undefined> {
	const prefix = versionPrefix(target);
	const mutable = target.channel === 'pr';

	if (!mutable && (await target.bucket.exists(`${prefix}${COMPLETION_MARKER}`))) return;

	if (!mutable && (await target.bucket.list({ prefix, maxKeys: 1 })).keyCount) {
		throw new IncompleteVersionError(prefix);
	}

	const files = [...new Bun.Glob('**/*').scanSync({ cwd: dir })].filter(
		(file) => !file.endsWith('.map'),
	);

	if (!files.includes(COMPLETION_MARKER)) {
		throw new Error(`${dir} has no ${COMPLETION_MARKER}; build the client first.`);
	}

	async function upload(file: string): Promise<string> {
		const source = Bun.file(join(dir, file));
		const key = `${prefix}${file}`;

		await target.bucket.write(key, source, { type: source.type });

		return key;
	}

	const keys = await Promise.all(
		files.filter((file) => file !== COMPLETION_MARKER).map((file) => upload(file)),
	);

	keys.push(await upload(COMPLETION_MARKER));

	if (mutable) {
		await deletePrefix(target.bucket, prefix, keys);
	}

	return keys;
}

/**
 * @description Parses the upload environment, failing with every missing or malformed variable named.
 * @param source The raw environment, `process.env` by default.
 * @returns The validated environment.
 */
export function parseUploadEnv(
	source: Record<string, string | undefined> = process.env,
): UploadEnv {
	const result = uploadEnvSchema.safeParse(source);

	if (!result.success) {
		throw new Error(`Invalid upload environment:\n${z.prettifyError(result.error)}`);
	}

	return result.data;
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
 * @description Connects to the public bucket described by the upload environment.
 * @param env The validated bucket environment.
 * @returns A client for the public bucket.
 */
export function createPublicBucket(env: BucketEnv): Bun.S3Client {
	return new Bun.S3Client({
		endpoint: env.S3_ENDPOINT,
		region: env.S3_REGION,
		accessKeyId: env.S3_ACCESS_KEY_ID,
		secretAccessKey: env.S3_SECRET_ACCESS_KEY,
		bucket: env.S3_PUBLIC_BUCKET,
	});
}

if (import.meta.main) {
	const env = parseUploadEnv();
	const bucket = createPublicBucket(env);
	const target = { bucket, channel: env.UNBOUND_CHANNEL, version: env.UNBOUND_VERSION };
	const keys = await uploadBuild(join(import.meta.dir, '..', '..', 'dist'), target);

	if (keys) {
		logger.success(`Uploaded ${keys.length} files to ${versionPrefix(target)}.`);
	} else {
		logger.warn(
			`${versionPrefix(target)} is already published; versions are never overwritten.`,
		);
	}
}
