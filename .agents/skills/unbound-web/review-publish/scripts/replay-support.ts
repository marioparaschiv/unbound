import type { PublishedManifest } from '@unbound-app/contracts/manifest';

import type { SourceSeed } from '../../../../../apps/web/tests/helpers/addons.ts';
import type { Caller } from '../../../../../apps/web/src/lib/api/caller.ts';
import type { AppContext } from '../../../../../apps/web/testing/index.ts';
import type { EnvSource } from '../../../../../apps/web/src/lib/env.ts';

import {
	createTestContext,
	manifest,
	seedSubmission,
	signInWithDiscord,
} from '../../../../../apps/web/testing/index.ts';

// Replays TLC counterexamples on the real reviewSubmission, real Postgres and an in-memory object
// store that can hold public writes open. Invariant names match spec/ReviewPublishProperties.tla.
export type Checks = Record<string, boolean>;

export type Replay = {
	name: string;
	violated: string[];
	run: () => Promise<Checks>;
};

export type Seeded = {
	ctx: AppContext;
	staging: MemoryBucket;
	public: MemoryBucket;
	author: string;
	reviewers: Caller[];
	close: () => Promise<void>;
};

export const ADDON = 'replay.addon';
export const REPOSITORY = 'acme/addons';
export const PAGE_DIR = 'plugins/replay';

export class MemoryBucket {
	objects = new Map<string, Uint8Array>();
	held: Promise<void> | undefined;
	onWrite: (() => void) | undefined;
	heldRead: Promise<void> | undefined;
	onRead: (() => void) | undefined;
	failWrites = 0;

	file(key: string) {
		const objects = this.objects;

		return {
			exists: async () => objects.has(key),
			bytes: async () => {
				const bytes = objects.get(key);

				if (!bytes) {
					throw new Error(`No object ${key}.`);
				}

				this.onRead?.();
				await this.heldRead;

				return bytes;
			},
		};
	}

	async write(key: string, data: Uint8Array | string) {
		if (this.failWrites > 0) {
			this.failWrites--;

			throw new Error('Simulated storage outage.');
		}

		this.onWrite?.();
		await this.held;
		this.objects.set(key, typeof data === 'string' ? new TextEncoder().encode(data) : data);
	}

	async delete(key: string) {
		this.objects.delete(key);
	}

	// The review queue presigns a download of the staged bundle; the replay never fetches it.
	presign(key: string) {
		return `memory:///${key}`;
	}
}

/**
 * @description Hashes bytes as the web app does.
 * @returns The result.
 */
export function sha256(bytes: Uint8Array | string): string {
	return new Bun.CryptoHasher('sha256').update(bytes).digest('hex');
}

export const LOCALE = JSON.stringify({ greeting: 'Hallo' });
export const IMAGE = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);

/**
 * @description Lists one locale and one image in a manifest, with their files as committed beside the bundle.
 * @returns The result.
 */
export function extraFiles(dir: string, locale: string = LOCALE) {
	const image = `assets/${sha256(IMAGE)}.png`;

	return {
		listing: {
			locales: { de: sha256(LOCALE) },
			assets: {
				star: { type: 'png' as const, width: 1, height: 1, scales: { '1': sha256(IMAGE) } },
			},
		},
		committed: { [`${dir}/dist/i18n/de.json`]: locale, [`${dir}/dist/${image}`]: IMAGE },
		paths: { 'i18n/de.json': LOCALE, [image]: IMAGE },
	};
}

/**
 * @description Tells whether a public key is an extra file (assets/ or i18n/).
 * @returns The result.
 */
export function isExtraFile(key: string): boolean {
	return key.includes('/assets/') || key.includes('/i18n/');
}

/**
 * @description Starts a throwaway database, in-memory buckets, an author and two moderators.
 * @returns The result.
 */
export async function setup(env: EnvSource = {}): Promise<Seeded> {
	const { ctx, close } = await createTestContext(env);
	const staging = new MemoryBucket();
	const bucket = new MemoryBucket();

	// reviewSubmission only calls file/exists/bytes/write/delete; the fake covers exactly those.
	ctx.storage = { staging: staging as never, public: bucket as never };

	const ids: string[] = [];

	for (const name of ['author', 'reviewer-a', 'reviewer-b']) {
		const { userId } = await signInWithDiscord(ctx, {
			id: '80351110224678912',
			name,
			email: `${name}@example.com`,
		});

		ids.push(userId);
	}

	const [author = '', ...reviewerIds] = ids;
	const reviewers: Caller[] = [];

	for (const id of reviewerIds) {
		// drizzle-orm resolves only inside apps/web, so the role is set with the raw client.
		await ctx.db.$client`update "user" set role = 'moderator' where id = ${id}`;

		const user = await ctx.db.query.user.findFirst({ where: { id } });

		if (!user) {
			throw new Error(`User ${id} was not stored.`);
		}

		reviewers.push({ user, via: 'session' });
	}

	return { ctx, staging, public: bucket, author, reviewers, close };
}

/**
 * @description Seeds a submission and its staged bundle.
 * @returns The result.
 */
export async function stage(
	seeded: Seeded,
	version: string,
	bundle: string,
	kind: 'listing' | 'update',
	source: SourceSeed = {},
	listing: Partial<PublishedManifest> = {},
) {
	const row = await seedSubmission(
		seeded.ctx,
		seeded.author,
		manifest(ADDON, version, listing),
		{ kind, bundleSize: Buffer.byteLength(bundle), sha256: sha256(bundle) },
		source,
	);

	seeded.staging.objects.set(row.stagingKey, new TextEncoder().encode(bundle));

	return row;
}

/**
 * @description Awaits a promise and returns "ok" or its first error line.
 * @returns The result.
 */
export async function settle(promise: Promise<unknown>): Promise<string> {
	try {
		await promise;

		return 'ok';
	} catch (error) {
		return error instanceof Error ? (error.message.split('\n')[0] ?? '') : String(error);
	}
}

/**
 * @description Holds the next staged read open and returns when it waits and how to release it.
 * @returns The result.
 */
export function holdApprovalRead(seeded: Seeded) {
	let release = () => {};

	seeded.staging.heldRead = new Promise((resolve) => (release = resolve));

	const waiting = new Promise<void>((resolve) => (seeded.staging.onRead = resolve));

	return { waiting, release };
}
