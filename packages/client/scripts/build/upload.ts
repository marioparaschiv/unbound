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
]);

export const uploadEnvSchema = z
	.object({
		S3_ENDPOINT: z.url(),
		S3_REGION: z.string().min(1),
		S3_ACCESS_KEY_ID: z.string().min(1),
		S3_SECRET_ACCESS_KEY: z.string().min(1),
		S3_PUBLIC_BUCKET: z.string().min(1),
	})
	.and(releaseSchema);

export type UploadEnv = z.infer<typeof uploadEnvSchema>;

export type UploadTarget = {
	bucket: Bun.S3Client;
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
 * @description Uploads every file but the source maps in a client build directory to `unbound/{channel}/{version}/`.
 * Version paths are immutable: an already published version is skipped, never overwritten.
 * @param dir The build output directory, e.g. `packages/client/dist`.
 * @param target The bucket, channel and version to upload to.
 * @returns The uploaded object keys, or `undefined` when the version was already published.
 */
export async function uploadBuild(
	dir: string,
	target: UploadTarget,
): Promise<string[] | undefined> {
	const prefix = versionPrefix(target);

	if (await target.bucket.exists(`${prefix}${COMPLETION_MARKER}`)) return;

	const existing = await target.bucket.list({ prefix, maxKeys: 1 });

	if (existing.keyCount) {
		throw new IncompleteVersionError(prefix);
	}

	// Source maps stay private; CI keeps them as a workflow artifact for `bun run symbolicate`.
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
 * @description Connects to the public bucket described by the upload environment.
 * @param env The validated upload environment.
 * @returns A client for the public bucket.
 */
export function createPublicBucket(env: UploadEnv): Bun.S3Client {
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
