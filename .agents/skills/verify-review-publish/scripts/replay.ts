import type { AppContext } from '../../../../apps/web/tests/helpers/index.ts';
import type { Caller } from '../../../../apps/web/src/lib/api/caller.ts';
import type { EnvSource } from '../../../../apps/web/src/lib/env.ts';

import {
	createTestContext,
	manifest,
	schema,
	seedApprovedAddon,
	seedSubmission,
	serveGitHub,
	signInWithDiscord,
} from '../../../../apps/web/tests/helpers/index.ts';
import { reviewSubmission } from '../../../../apps/web/src/lib/review.ts';
import { gitBlobSha } from '../../../../apps/web/src/lib/github.ts';

// Replays the TLC counterexamples against the real reviewSubmission, real Postgres and an in-memory
// object store whose public writes can be held open. Invariant names match spec/ReviewPublish.tla.
type Checks = Record<string, boolean>;

type Replay = {
	name: string;
	violated: string[];
	run: () => Promise<Checks>;
};

type Seeded = {
	ctx: AppContext;
	staging: MemoryBucket;
	public: MemoryBucket;
	author: string;
	reviewers: Caller[];
	close: () => Promise<void>;
};

const ADDON = 'replay.addon';

class MemoryBucket {
	objects = new Map<string, Uint8Array>();
	held: Promise<void> | undefined;
	onWrite: (() => void) | undefined;

	file(key: string) {
		const objects = this.objects;

		return {
			exists: async () => objects.has(key),
			bytes: async () => {
				const bytes = objects.get(key);

				if (!bytes) {
					throw new Error(`No object ${key}.`);
				}

				return bytes;
			},
		};
	}

	async write(key: string, data: Uint8Array | string) {
		this.onWrite?.();
		await this.held;
		this.objects.set(key, typeof data === 'string' ? new TextEncoder().encode(data) : data);
	}

	async delete(key: string) {
		this.objects.delete(key);
	}
}

function sha256(bytes: Uint8Array | string): string {
	return new Bun.CryptoHasher('sha256').update(bytes).digest('hex');
}

async function setup(env: EnvSource = {}): Promise<Seeded> {
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

async function stage(seeded: Seeded, version: string, bundle: string, kind: 'listing' | 'update') {
	const row = await seedSubmission(seeded.ctx, seeded.author, manifest(ADDON, version), {
		kind,
		bundleSize: Buffer.byteLength(bundle),
		sha256: sha256(bundle),
	});

	seeded.staging.objects.set(row.stagingKey, new TextEncoder().encode(bundle));

	return row;
}

async function settle(promise: Promise<unknown>): Promise<string> {
	try {
		await promise;

		return 'ok';
	} catch (error) {
		return error instanceof Error ? (error.message.split('\n')[0] ?? '') : String(error);
	}
}

// current.cfg RejectedNeverPublic: an approval is held inside publishArtifact's writes while a
// rejection of the same submission commits.
async function approveRacesReject(): Promise<Checks> {
	const seeded = await setup();
	const [a, b] = seeded.reviewers;

	try {
		const row = await stage(seeded, '1.0.0', 'export default 1;', 'listing');
		let release = () => {};

		seeded.public.held = new Promise((resolve) => (release = resolve));

		const writing = new Promise<void>((resolve) => (seeded.public.onWrite = resolve));
		const approving = settle(reviewSubmission(seeded.ctx, a, row.id, { decision: 'approved' }));

		await writing;

		const rejected = await settle(
			reviewSubmission(seeded.ctx, b, row.id, { decision: 'rejected', note: 'No.' }),
		);

		release();

		const approved = await approving;
		const status = (await seeded.ctx.db.query.submission.findFirst({ where: { id: row.id } }))
			?.status;
		const versions = await seeded.ctx.db.select().from(schema.addonVersion);
		const keys = [...seeded.public.objects.keys()];

		console.log(`    approve (A): ${approved}`);
		console.log(`    reject (B):  ${rejected}`);
		console.log(`    submission.status = ${status}, addon_version rows = ${versions.length}`);
		console.log(`    public bucket = ${keys.join(', ') || '(empty)'}`);

		return {
			DecidedOnce: [approved, rejected].filter((result) => result === 'ok').length <= 1,
			PublicOnlyIfLiveAtRest: keys.length === 0 || versions.length > 0,
			RejectedNeverPublic: keys.length === 0 || status !== 'rejected',
		};
	} finally {
		await seeded.close();
	}
}

// current-pending-updates.cfg PublicMatchesLive: two open updates for one version, approved in turn
// (reachable once SUBMISSION_MAX_PENDING_UPDATES >= 2).
async function secondUpdateOverwrites(): Promise<Checks> {
	const seeded = await setup();
	const [a] = seeded.reviewers;

	try {
		await seedApprovedAddon(seeded.ctx, seeded.author, manifest(ADDON, '1.0.0'));

		const first = await stage(seeded, '1.1.0', 'export default "first";', 'update');
		const second = await stage(seeded, '1.1.0', 'export default "second";', 'update');
		const results = [
			await settle(reviewSubmission(seeded.ctx, a, first.id, { decision: 'approved' })),
			await settle(reviewSubmission(seeded.ctx, a, second.id, { decision: 'approved' })),
		];
		const live = await seeded.ctx.db.query.addonVersion.findFirst({
			where: { addonId: ADDON, version: '1.1.0' },
		});
		const bundle = seeded.public.objects.get(`addons/${ADDON}/1.1.0/index.js`);
		const served = bundle ? sha256(bundle) : '(none)';

		console.log(`    approve first:  ${results[0]}`);
		console.log(`    approve second: ${results[1]}`);
		console.log(`    addon_version 1.1.0 sha256 = ${live?.sha256}`);
		console.log(`    public bundle sha256       = ${served}`);

		return { PublicMatchesLive: !live || !bundle || served === live.sha256 };
	} finally {
		await seeded.close();
	}
}

// ReadStaged's refetch: the staged object is gone (B2 hides it after 14 days), so approval reads the
// pinned blob again. Honest bytes go live under the recorded sha256; altered bytes publish nothing.
async function refetchLostBundle(): Promise<Checks> {
	const repository = 'acme/addons';
	const github = serveGitHub({ repositories: { [repository]: {} }, tokens: {} });
	const seeded = await setup({ GITHUB_API_URL: github.url.href });
	const [a] = seeded.reviewers;

	async function lost(version: string, bundle: string, kind: 'listing' | 'update') {
		const bytes = new TextEncoder().encode(bundle);

		github.repository(repository).commit({ [`plugins/${version}/dist/index.js`]: bundle });

		return seedSubmission(
			seeded.ctx,
			seeded.author,
			manifest(ADDON, version),
			{ kind, bundleSize: bytes.length, sha256: sha256(bytes) },
			{ repository, bundleBlobSha: gitBlobSha(bytes) },
		);
	}

	try {
		const honest = await lost('1.0.0', 'export default "pinned";', 'listing');
		const approved = await settle(
			reviewSubmission(seeded.ctx, a, honest.id, { decision: 'approved' }),
		);

		const altered = await lost('2.0.0', 'export default "altered";', 'update');

		github.tamper(true);

		const refused = await settle(
			reviewSubmission(seeded.ctx, a, altered.id, { decision: 'approved' }),
		);
		const live = await seeded.ctx.db.query.addonVersion.findFirst({
			where: { addonId: ADDON, version: '1.0.0' },
		});
		const bundle = seeded.public.objects.get(`addons/${ADDON}/1.0.0/index.js`);
		const keys = [...seeded.public.objects.keys()];

		console.log(`    approve honest refetch:  ${approved}`);
		console.log(`    approve altered refetch: ${refused}`);
		console.log(`    public bucket = ${keys.join(', ') || '(empty)'}`);

		return {
			LiveIsReviewed: live?.sha256 === honest.sha256,
			PublicMatchesLive: Boolean(bundle) && sha256(bundle ?? '') === live?.sha256,
			PublicOnlyIfLiveAtRest: !keys.some((key) => key.includes('/2.0.0/')),
		};
	} finally {
		await seeded.close();
		await github.stop();
	}
}

// `violated` is what the code at the sync commit does; change it only with ../SKILL.md's findings.
const REPLAYS: Replay[] = [
	{
		name: 'approve races reject',
		violated: ['PublicOnlyIfLiveAtRest', 'RejectedNeverPublic'],
		run: approveRacesReject,
	},
	{
		name: 'second pending update overwrites',
		violated: ['PublicMatchesLive'],
		run: secondUpdateOverwrites,
	},
	{
		name: 'approval refetches a lost bundle',
		violated: [],
		run: refetchLostBundle,
	},
];

let unexpected = 0;

for (const replay of REPLAYS) {
	console.log(`${replay.name}:`);

	const checks = await replay.run();

	for (const [invariant, holds] of Object.entries(checks)) {
		const expected = !replay.violated.includes(invariant);
		const ok = holds === expected;

		unexpected += ok ? 0 : 1;
		console.log(
			`${ok ? 'ok  ' : 'FAIL'} ${invariant.padEnd(24)} ${holds ? 'holds' : 'violated'} (expected ${expected ? 'holds' : 'violated'})`,
		);
	}

	console.log('');
}

console.log(unexpected === 0 ? 'All replays match.' : `${unexpected} unexpected outcome(s).`);
process.exit(unexpected === 0 ? 0 : 1);
