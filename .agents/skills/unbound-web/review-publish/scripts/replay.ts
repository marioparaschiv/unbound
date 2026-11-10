import type { PublishedManifest } from '@unbound-app/contracts/manifest';

import {
	ADDON,
	PAGE_DIR,
	REPOSITORY,
	extraFiles,
	holdApprovalRead,
	isExtraFile,
	setup,
	settle,
	sha256,
	stage,
	type Checks,
	type Replay,
} from './replay-support.ts';
// Replays the TLC counterexamples against the real reviewSubmission (see replay-support.ts).
import {
	manifest,
	schema,
	seedApprovedAddon,
	seedSubmission,
	serveGitHub,
} from '../../../../../apps/web/tests/helpers/index.ts';
import {
	COMMITTED_ADDON_MD,
	committedPage,
	committedPageFiles,
} from '../../../../../apps/web/tests/helpers/addon-page.ts';
import { purgeUserSubmissions } from '../../../../../apps/web/src/lib/staging.ts';
import { reviewSubmission } from '../../../../../apps/web/src/lib/review.ts';
import { gitBlobSha } from '../../../../../apps/web/src/lib/github.ts';
import { failedPublishRecovers } from './replay-recovery.ts';

// current.cfg RejectedNeverPublic: an approval is held in its read phase while a rejection of the
// same submission commits. The submission has a store page and extra files.
async function approveRacesReject(): Promise<Checks> {
	const github = serveGitHub({ repositories: { [REPOSITORY]: {} }, tokens: {} });
	const seeded = await setup({ GITHUB_API_URL: github.url.href });
	const [a, b] = seeded.reviewers;
	const extras = extraFiles(PAGE_DIR);
	const files = Object.entries(committedPageFiles()).map(([name, content]) => [
		`${PAGE_DIR}/${name}`,
		content,
	]);

	try {
		const commitSha = github
			.repository(REPOSITORY)
			.commit({ ...Object.fromEntries(files), ...extras.committed });
		const row = await stage(
			seeded,
			'1.0.0',
			'export default 1;',
			'listing',
			{
				repository: REPOSITORY,
				commitSha,
				path: PAGE_DIR,
				addonMd: COMMITTED_ADDON_MD,
				page: committedPage(64),
			},
			extras.listing,
		);
		const { waiting, release } = holdApprovalRead(seeded);
		const approving = settle(reviewSubmission(seeded.ctx, a, row.id, { decision: 'approved' }));

		await waiting;

		const rejected = await settle(
			reviewSubmission(seeded.ctx, b, row.id, { decision: 'rejected', note: 'No.' }),
		);

		release();

		const approved = await approving;
		const status = (await seeded.ctx.db.query.submission.findFirst({ where: { id: row.id } }))
			?.status;
		const versions = await seeded.ctx.db.select().from(schema.addonVersion);
		const keys = [...seeded.public.objects.keys()];
		const media = keys.filter((key) => key.includes('/media/'));

		console.log(`    approve (A): ${approved}`);
		console.log(`    reject (B):  ${rejected}`);
		console.log(`    submission.status = ${status}, addon_version rows = ${versions.length}`);
		console.log(`    public bucket = ${keys.join(', ') || '(empty)'}`);
		console.log(`    of which store page media = ${media.length}`);
		console.log(`    of which extra files = ${keys.filter(isExtraFile).length}`);

		return {
			DecidedOnce: [approved, rejected].filter((result) => result === 'ok').length <= 1,
			PublicOnlyIfLiveAtRest: keys.length === 0 || versions.length > 0,
			RejectedNeverPublic: keys.length === 0 || status !== 'rejected',
		};
	} finally {
		await seeded.close();
		await github.stop();
	}
}

// current.cfg PublicMatchesLive: s1's approval is held in its read phase, s1's author is banned, s2
// for the same version is approved and goes live; then s1's approval resumes.
async function staleApprovalOverwrites(): Promise<Checks> {
	const seeded = await setup();
	const [a, b] = seeded.reviewers;

	try {
		const first = await stage(seeded, '1.0.0', 'export default "first";', 'listing');
		const { waiting, release } = holdApprovalRead(seeded);
		const stale = settle(reviewSubmission(seeded.ctx, a, first.id, { decision: 'approved' }));

		await waiting;
		await purgeUserSubmissions(seeded.ctx, seeded.author);

		seeded.staging.heldRead = undefined;
		seeded.staging.onRead = undefined;

		const second = await stage(seeded, '1.0.0', 'export default "second";', 'listing');
		const approved = await settle(
			reviewSubmission(seeded.ctx, b, second.id, { decision: 'approved' }),
		);

		release();

		const resumed = await stale;
		const live = await seeded.ctx.db.query.addonVersion.findFirst({
			where: { addonId: ADDON, version: '1.0.0' },
		});
		const bundle = seeded.public.objects.get(`addons/${ADDON}/1.0.0/index.js`);
		const served = bundle ? sha256(bundle) : '(none)';

		console.log(`    approve s2 (B):         ${approved}`);
		console.log(`    stale approve s1 (A):   ${resumed}`);
		console.log(`    addon_version sha256    = ${live?.sha256}`);
		console.log(`    public bundle sha256    = ${served}`);

		return { PublicMatchesLive: !live || !bundle || served === live.sha256 };
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

// ReadStaged's extra-file branch: readPinnedFiles checks each listed file against its SHA-256 (and a
// locale against a JSON object of strings) before any write, so a bad file publishes nothing.
async function checkExtraFiles(): Promise<Checks> {
	const github = serveGitHub({ repositories: { [REPOSITORY]: {} }, tokens: {} });
	const seeded = await setup({ GITHUB_API_URL: github.url.href });
	const [a] = seeded.reviewers;
	const altered = extraFiles('plugins/altered', JSON.stringify({ greeting: 'Bonjour' }));
	const shape = extraFiles('plugins/shape', JSON.stringify({ greeting: 1 }));
	const honest = extraFiles('plugins/honest');

	// A locale that is not a string table still needs its digest listed, so the check under test is the shape.
	shape.listing.locales.de = sha256(JSON.stringify({ greeting: 1 }));

	try {
		const commitSha = github
			.repository(REPOSITORY)
			.commit({ ...altered.committed, ...shape.committed, ...honest.committed });

		async function approve(version: string, dir: string, listing: Partial<PublishedManifest>) {
			const source = { repository: REPOSITORY, commitSha, path: dir, addonMd: null };
			const row = await stage(
				seeded,
				version,
				`export default "${version}";`,
				'update',
				source,
				listing,
			);

			return settle(reviewSubmission(seeded.ctx, a, row.id, { decision: 'approved' }));
		}

		await seedApprovedAddon(seeded.ctx, seeded.author, manifest(ADDON, '0.1.0'));

		const results = [
			await approve('1.0.0', 'plugins/altered', altered.listing),
			await approve('1.0.1', 'plugins/shape', shape.listing),
			await approve('1.0.2', 'plugins/honest', honest.listing),
		];
		const keys = [...seeded.public.objects.keys()];
		const served = Object.entries(honest.paths).map(([path, bytes]) => {
			const object = seeded.public.objects.get(`addons/${ADDON}/1.0.2/${path}`);

			return Boolean(object) && sha256(object ?? '') === sha256(bytes);
		});

		console.log(`    approve altered locale:    ${results[0]}`);
		console.log(`    approve non-string locale: ${results[1]}`);
		console.log(`    approve honest files:      ${results[2]}`);
		console.log(`    public bucket = ${keys.join(', ') || '(empty)'}`);

		return {
			PublicOnlyIfLiveAtRest: !keys.some((key) => /\/1\.0\.[01]\//.test(key)),
			PublicMatchesLive: results[2] === 'ok' && served.every(Boolean),
		};
	} finally {
		await seeded.close();
		await github.stop();
	}
}

// `violated` is what the code at the sync commit does; change it only with ../SKILL.md's findings.
// Every replay failed on the code before the public writes moved after decide (FINDINGS.md).
const REPLAYS: Replay[] = [
	{
		name: 'approve races reject',
		violated: [],
		run: approveRacesReject,
	},
	{
		name: 'stale approval overwrites a live version',
		violated: [],
		run: staleApprovalOverwrites,
	},
	{
		name: 'second pending update overwrites',
		violated: [],
		run: secondUpdateOverwrites,
	},
	{
		name: 'approval refetches a lost bundle',
		violated: [],
		run: refetchLostBundle,
	},
	{
		name: 'approval checks extra files',
		violated: [],
		run: checkExtraFiles,
	},
	{
		name: 'failed publish recovers',
		violated: [],
		run: failedPublishRecovers,
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
