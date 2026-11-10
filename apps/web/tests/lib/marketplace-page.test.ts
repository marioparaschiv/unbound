import { afterAll, describe, expect, test } from 'bun:test';
import type { PublishedManifest } from '@unbound-app/contracts/manifest';
import type { SubmissionKind } from '@unbound-app/contracts/publish';

import type { MarketplaceAddonDetails } from '~/lib/marketplace-page';
import { loadAddonPage, toPendingVersion } from '~/lib/marketplace-page';
import { requireSourced } from '~/lib/submissions';

import { manifest, seedApprovedAddon, seedSubmission, seedVersion } from '../helpers/addons';
import { createTestContext, signInWithDiscord, snowflakeAt } from '../helpers/context';

const { ctx, close } = await createTestContext();

afterAll(close);

let users = 0;

async function signUp(): Promise<string> {
	users += 1;

	const { userId } = await signInWithDiscord(ctx, {
		id: snowflakeAt(new Date('2020-01-01T00:00:00.000Z')),
		name: `Page ${users}`,
		email: `page-${users}@example.com`,
	});

	return userId;
}

// What a reader sees at the top of the page: everything but the dates and pins that differ per submission.
function summaryOf(page: MarketplaceAddonDetails | undefined) {
	return (
		page && {
			type: page.type,
			name: page.name,
			description: page.description,
			version: page.version,
			authors: page.authors,
			platforms: page.platforms,
			minClientVersion: page.minClientVersion,
			versions: page.versions.map((entry) => entry.version),
		}
	);
}

async function previewOf(
	authorId: string,
	published: PublishedManifest,
	kind: SubmissionKind = 'listing',
) {
	const { id } = await seedSubmission(ctx, authorId, published, { kind });
	const row = await ctx.db.query.submission.findFirst({ where: { id }, with: { source: true } });

	if (!row) {
		throw new Error(`Submission ${id} was not stored.`);
	}

	return loadAddonPage(ctx, published.id, toPendingVersion(requireSourced(row)));
}

describe('loadAddonPage', () => {
	test('answers undefined for an addon that is not listed', async () => {
		expect(await loadAddonPage(ctx, 'page.missing')).toBeUndefined();
	});

	test('previews a theme without a type as the theme approving it publishes', async () => {
		const author = await signUp();
		const theme = manifest('page.theme', '1.0.0', { main: 'theme.json' });
		const preview = await previewOf(author, theme);

		await seedApprovedAddon(ctx, author, theme, {});

		const live = await loadAddonPage(ctx, theme.id);

		expect(preview?.type).toBe('theme');
		expect(summaryOf(preview)).toEqual(summaryOf(live));
	});

	test('previews an update on top of the served history', async () => {
		const author = await signUp();
		const first = manifest('page.update', '1.0.0');

		await seedApprovedAddon(ctx, author, first, {});

		const next = manifest('page.update', '1.1.0', { name: 'Hello again' });
		const preview = await previewOf(author, next, 'update');

		await seedVersion(ctx, author, next, undefined, {});

		expect(summaryOf(preview)).toEqual(summaryOf(await loadAddonPage(ctx, next.id)));
		expect(preview?.versions.map((entry) => entry.version)).toEqual(['1.1.0', '1.0.0']);
	});
});
