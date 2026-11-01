import type { ReviewNotice } from '@unbound-app/web/bot';
import { describe, expect, test } from 'bun:test';

import { renderReviewNotice } from '~/dispatchers/review-notices';
import { EMBED_LIMITS } from '~/dispatchers/audit-embed';
import { COLOURS } from '~/lib/constants';

const SITE = 'https://unbound.rip';

const NOTICE: ReviewNotice = {
	eventId: 7,
	addonId: 'silent.typing',
	addonName: 'Silent Typing',
	version: '1.2.0',
	submissionKind: 'update',
	decision: 'approved',
	note: null,
	createdAt: new Date('2026-10-01T00:00:00.000Z'),
	discordId: '42',
};

describe('renderReviewNotice', () => {
	test('an approval links to the addon page', () => {
		expect(renderReviewNotice(NOTICE, SITE)).toEqual({
			title: 'Your update to Silent Typing 1.2.0 was approved',
			url: 'https://unbound.rip/addons/silent.typing',
			description: '[View the addon](https://unbound.rip/addons/silent.typing)',
			color: COLOURS.positive,
			timestamp: '2026-10-01T00:00:00.000Z',
		});
	});

	test('a request for changes on a new listing quotes the note and links to the dashboard', () => {
		const embed = renderReviewNotice(
			{
				...NOTICE,
				submissionKind: 'listing',
				decision: 'changes_requested',
				note: 'Add a README.\nAnd an icon.',
			},
			SITE,
		);

		expect(embed).toMatchObject({
			title: 'Your new addon Silent Typing 1.2.0 needs changes',
			url: 'https://unbound.rip/dashboard',
			description:
				'> Add a README.\n> And an icon.\n\n[Open your dashboard](https://unbound.rip/dashboard)',
			color: COLOURS.warning,
		});
	});

	test('a rejection with an overlong note stays within Discord limits and keeps its link', () => {
		const embed = renderReviewNotice(
			{
				...NOTICE,
				decision: 'rejected',
				addonName: 'N'.repeat(300),
				note: 'x'.repeat(5000),
			},
			SITE,
		);

		expect(embed.color).toBe(COLOURS.danger);
		expect(embed.title?.length).toBe(EMBED_LIMITS.title);
		expect(embed.description?.length).toBeLessThanOrEqual(EMBED_LIMITS.description);
		expect(embed.description).toEndWith('[Open your dashboard](https://unbound.rip/dashboard)');
	});
});
