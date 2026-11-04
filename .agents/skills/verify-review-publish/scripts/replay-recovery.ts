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
import { schema, serveGitHub } from '../../../../apps/web/tests/helpers/index.ts';
import { reviewSubmission } from '../../../../apps/web/src/lib/review.ts';

/**
 * @description Replays a public write failing after `decide`: only the same reviewer repeating the approval republishes the files.
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
		const stranger = await settle(
			reviewSubmission(seeded.ctx, b, row.id, { decision: 'approved' }),
		);
		const rejection = await settle(
			reviewSubmission(seeded.ctx, a, row.id, { decision: 'rejected', note: 'No.' }),
		);
		const recovered = await settle(
			reviewSubmission(seeded.ctx, a, row.id, { decision: 'approved' }),
		);

		// The success deleted the staged bundle and the seeded blob is not served, so stage it again.
		seeded.staging.objects.set(row.stagingKey, new TextEncoder().encode('export default 1;'));

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
		console.log(`    other reviewer repeats:     ${stranger}`);
		console.log(`    reject after approval:      ${rejection}`);
		console.log(`    same reviewer repeats:      ${recovered}, then ${again}`);
		console.log(`    addon_version sha256        = ${live?.sha256}`);
		console.log(`    public bundle sha256        = ${bundle ? sha256(bundle) : '(none)'}`);

		return {
			DecidedOnce: versions.length === 1 && stranger !== 'ok' && rejection !== 'ok',
			LiveEventuallyPublic:
				failed !== 'ok' &&
				Boolean(afterFailure) &&
				incomplete &&
				recovered === 'ok' &&
				complete(),
			PublicMatchesLive: Boolean(bundle) && sha256(bundle ?? '') === live?.sha256 && extra,
			RecoveryIdempotent: again === 'ok' && versions.length === 1,
		};
	} finally {
		await seeded.close();
		await github.stop();
	}
}
