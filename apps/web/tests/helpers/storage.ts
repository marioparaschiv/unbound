import type { AppContext } from '~/lib/context';

type WriteArgs = Parameters<Bun.S3Client['write']>;

type PathArgs = Parameters<Bun.S3Client['delete']>;

/** A bucket kept in memory, for `*.test.ts` code that only writes, checks and deletes objects. */
export class MemoryBucket extends Bun.S3Client {
	objects = new Map<string, Uint8Array>();

	override async write(...[path, data]: WriteArgs): Promise<number> {
		const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;

		if (!(bytes instanceof Uint8Array)) {
			throw new TypeError('A MemoryBucket stores strings and bytes only.');
		}

		this.objects.set(path, bytes);

		return bytes.byteLength;
	}

	override async exists(...[path]: PathArgs): Promise<boolean> {
		return this.objects.has(path);
	}

	override async delete(...[path]: PathArgs): Promise<void> {
		this.objects.delete(path);
	}
}

/**
 * @description Swaps a context's staging bucket for a {@link MemoryBucket}, so code that stages files
 * runs without object storage.
 * @param ctx The application context.
 * @returns The context using the memory bucket, and the bucket.
 */
export function withMemoryStaging(ctx: AppContext) {
	const staging = new MemoryBucket({ bucket: 'memory' });

	return { ctx: { ...ctx, storage: { ...ctx.storage, staging } }, staging };
}

/**
 * @description Swaps a context's public bucket for a {@link MemoryBucket}, so code that publishes small
 * files runs without object storage.
 * @param ctx The application context.
 * @returns The context using the memory bucket, and the bucket.
 */
export function withMemoryPublic(ctx: AppContext) {
	const bucket = new MemoryBucket({ bucket: 'memory' });

	return { ctx: { ...ctx, storage: { ...ctx.storage, public: bucket } }, bucket };
}
