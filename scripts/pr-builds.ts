import { basename } from 'node:path';

import type { PublicBucket } from '../packages/client/scripts/build/upload';

import {
	createPublicBucket,
	deletePrefix,
	parseBucketEnv,
	versionPrefix,
} from '../packages/client/scripts/build/upload';

const USAGE = [
	'usage: bun scripts/pr-builds.ts upload-loader <pull request> <file>...',
	'       bun scripts/pr-builds.ts delete <pull request>',
].join('\n');

/**
 * @description Validates a pull request number used as a bucket path segment.
 * @param value The raw pull request number.
 * @returns The number as a string.
 */
export function parsePullRequest(value: string | undefined): string {
	if (!value || !/^[1-9][0-9]*$/.test(value)) {
		throw new Error(`${value ?? 'Nothing'} is not a pull request number.\n${USAGE}`);
	}

	return value;
}

/**
 * @description The bucket prefix a pull request's latest loader builds live under.
 * @param pullRequest The pull request number.
 * @returns `loader/pr/{number}/`.
 */
export function loaderPrefix(pullRequest: string): string {
	return `loader/pr/${pullRequest}/`;
}

/**
 * @description The bucket prefix a pull request's latest client build lives under.
 * @param pullRequest The pull request number.
 * @returns `unbound/pr/{number}/`.
 */
export function clientPrefix(pullRequest: string): string {
	return versionPrefix({ channel: 'pr', version: pullRequest });
}

/**
 * @description Replaces a pull request's loader builds with the given files, keyed by file name.
 * @param bucket The public bucket.
 * @param pullRequest The pull request number.
 * @param files The loader artifacts to upload.
 * @returns The uploaded object keys.
 */
export async function uploadLoaderBuilds(
	bucket: PublicBucket,
	pullRequest: string,
	files: string[],
): Promise<string[]> {
	if (!files.length) {
		throw new Error(`No loader builds to upload.\n${USAGE}`);
	}

	const prefix = loaderPrefix(pullRequest);
	const keys = files.map((file) => `${prefix}${basename(file)}`);

	if (new Set(keys).size !== keys.length) {
		throw new Error('Two loader builds share a file name.');
	}

	await Promise.all(
		files.map((file, index) => {
			const source = Bun.file(file);

			return bucket.write(keys[index], source, { type: source.type });
		}),
	);
	await deletePrefix(bucket, prefix, keys);

	return keys;
}

/**
 * @description Deletes a pull request's client and loader builds.
 * @param bucket The public bucket.
 * @param pullRequest The pull request number.
 * @returns The deleted object keys.
 */
export async function deletePullRequestBuilds(
	bucket: PublicBucket,
	pullRequest: string,
): Promise<string[]> {
	const deleted = await Promise.all(
		[clientPrefix(pullRequest), loaderPrefix(pullRequest)].map((prefix) =>
			deletePrefix(bucket, prefix),
		),
	);

	return deleted.flat();
}

if (import.meta.main) {
	const [command, number, ...files] = process.argv.slice(2);
	const pullRequest = parsePullRequest(number);
	const bucket = createPublicBucket(parseBucketEnv());

	if (command === 'upload-loader') {
		const keys = await uploadLoaderBuilds(bucket, pullRequest, files);

		console.log(`Uploaded ${keys.length} loader builds to ${loaderPrefix(pullRequest)}.`);
	} else if (command === 'delete') {
		const keys = await deletePullRequestBuilds(bucket, pullRequest);

		console.log(`Deleted ${keys.length} objects of pull request #${pullRequest}.`);
	} else {
		throw new Error(USAGE);
	}
}
