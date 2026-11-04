import {
	ADDON,
	PAGE_DIR,
	REPOSITORY,
	extraFiles,
	setup,
	settle,
	sha256,
	stage,
	type Checks,
} from './replay-support.ts';
import {
	COMMITTED_ADDON_MD,
	committedPage,
	committedPageFiles,
} from '../../../../apps/web/tests/helpers/addon-page.ts';
import { listReviewQueue, reviewSubmission } from '../../../../apps/web/src/lib/review.ts';
import { schema, serveGitHub } from '../../../../apps/web/tests/helpers/index.ts';

/**
 * @description Replays a public write failing after `decide`: the review queue still lists the approval after a reload, and any reviewer's repeat republishes the files.
 * @returns The invariants and whether each held.
 */
export async function failedPublishRecovers(): Promise<Checks> {
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
		const expected = [
			`addons/${ADDON}/1.0.0/index.js`,
			`addons/${ADDON}/1.0.0/manifest.json`,
			`addons/${ADDON}/1.0.0/ADDON.md`,
			`addons/${ADDON}/1.0.0/page.json`,
			...Object.keys(extras.paths).map((path) => `addons/${ADDON}/1.0.0/${path}`),
		];
		const complete = () => expected.every((key) => seeded.public.objects.has(key));

		seeded.public.failWrites = 1;

		const failed = await settle(
			reviewSubmission(seeded.ctx, a, row.id, { decision: 'approved' }),
		);
		const afterFailure = await seeded.ctx.db.query.addonVersion.findFirst({
			where: { addonId: ADDON, version: '1.0.0' },
		});
		const incomplete = !complete();
		// A reload: a fresh request reads the queue with no dialog state.
		const queue = await listReviewQueue(seeded.ctx, b);
		const queued = queue.submissions.some(
			(entry) => entry.submission.id === row.id && entry.submission.status === 'approved',
		);
		const rejection = await settle(
			reviewSubmission(seeded.ctx, a, row.id, { decision: 'rejected', note: 'No.' }),
		);
		const recovered = await settle(
			reviewSubmission(seeded.ctx, b, row.id, { decision: 'approved' }),
		);
		const requeued = (await listReviewQueue(seeded.ctx, b)).submissions.some(
			(entry) => entry.submission.id === row.id,
		);
		const again = await settle(
			reviewSubmission(seeded.ctx, a, row.id, { decision: 'approved' }),
		);
		const live = await seeded.ctx.db.query.addonVersion.findFirst({
			where: { addonId: ADDON, version: '1.0.0' },
		});
		const versions = await seeded.ctx.db.select().from(schema.addonVersion);
		const bundle = seeded.public.objects.get(`addons/${ADDON}/1.0.0/index.js`);
		const extra = Object.entries(extras.paths).every(([path, bytes]) => {
			const object = seeded.public.objects.get(`addons/${ADDON}/1.0.0/${path}`);

			return Boolean(object) && sha256(object ?? '') === sha256(bytes);
		});

		console.log(`    approve, first write fails: ${failed}`);
		console.log(`    live row, files incomplete: ${Boolean(afterFailure)}, ${incomplete}`);
		console.log(`    queued after reload:        ${queued}`);
		console.log(`    reject after approval:      ${rejection}`);
		console.log(`    other reviewer retries:     ${recovered}, then ${again}`);
		console.log(`    addon_version sha256        = ${live?.sha256}`);
		console.log(`    public bundle sha256        = ${bundle ? sha256(bundle) : '(none)'}`);

		return {
			DecidedOnce: versions.length === 1 && rejection !== 'ok',
			LiveEventuallyPublic:
				failed !== 'ok' &&
				Boolean(afterFailure) &&
				incomplete &&
				queued &&
				recovered === 'ok' &&
				!requeued &&
				complete(),
			PublicMatchesLive: Boolean(bundle) && sha256(bundle ?? '') === live?.sha256 && extra,
			RecoveryIdempotent: again !== 'ok' && versions.length === 1,
		};
	} finally {
		await seeded.close();
		await github.stop();
	}
}
