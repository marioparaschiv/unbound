import type { AuditEvent } from '@unbound-app/web/bot';
import { describe, expect, test } from 'bun:test';
import type { APIEmbed } from 'discord.js';

import { buildAuditEmbed } from '~/dispatchers/audit-embed';
import { COLOURS } from '~/lib/constants';

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };
type EventData = Record<string, Json>;

const SUBMISSION: EventData = {
	submissionId: '01a17591-27b7',
	submissionKind: 'update',
	version: '1.2.0',
};

// One valid `data` per kind of `moderationEventDataSchema` in @unbound-app/contracts/admin.
const SAMPLES: Record<string, EventData> = {
	'review.decided': { ...SUBMISSION, decision: 'approved' },
	'addon.delisted': {},
	'addon.relisted': {},
	'addon.maintainers_changed': {
		before: [{ userId: 'u1', role: 'owner' }],
		after: [{ userId: 'u1', role: 'owner' }],
	},
	'addon.edited': { changes: [] },
	'addon.rollback': { from: '1.2.0', to: '1.1.0', withdrawn: ['1.2.0'], restored: [] },
	'user.banned': { expiresAt: null },
	'user.unbanned': {},
	'user.role_set': { role: 'reviewer' },
	'user.deleted': { openSubmissions: 2, staffNotes: 0 },
	'note.added': { noteId: 1, body: 'Watch this one.' },
	'note.edited': { noteId: 1, before: 'Old.', body: 'New.' },
	'note.deleted': { noteId: 1, body: 'Gone.' },
	'submission.created': { ...SUBMISSION, supersededId: null },
	'submission.cancelled': SUBMISSION,
};

// A kind the bot's contracts do not know yet arrives as plain text from the database.
function event(kind: string, data: EventData, columns: Partial<AuditEvent> = {}): AuditEvent {
	return {
		id: 7,
		kind: kind as AuditEvent['kind'],
		subjectType: 'addon',
		subjectId: 'addon-1',
		subjectName: 'Silent Typing',
		actor: { id: 'staff-1', name: 'Mario', image: null },
		data,
		reason: null,
		createdAt: new Date('2026-10-01T00:00:00.000Z'),
		...columns,
	};
}

function totalLength(embed: APIEmbed) {
	return [embed.title, embed.description, embed.author?.name, embed.footer?.text].reduce(
		(sum, text) => sum + (text?.length ?? 0),
		0,
	);
}

describe('buildAuditEmbed', () => {
	for (const [kind, data] of Object.entries(SAMPLES)) {
		test(`${kind} names its subject in the title and keeps the recovery footer`, () => {
			const embed = buildAuditEmbed(event(kind, data));

			expect(embed.title).toContain('Silent Typing');
			expect(embed.description ?? '').not.toContain('```json');
			expect(embed.fields).toBeUndefined();
			expect(embed.footer?.text).toBe(`Event #7 · ${kind}`);
			expect(embed.timestamp).toBe('2026-10-01T00:00:00.000Z');
		});
	}

	test('a review shows who decided, their note as a quote, and a colour per decision', () => {
		const decided = (decision: string, reason: string | null = null) =>
			buildAuditEmbed(event('review.decided', { ...SUBMISSION, decision }, { reason }));
		const approved = decided('approved', 'Looks good.\nThanks!');

		expect(approved).toMatchObject({
			author: { name: 'Mario' },
			title: 'Approved Silent Typing 1.2.0',
			url: 'https://unbound.rip/admin/addons/addon-1',
			color: COLOURS.positive,
			description: '> Looks good.\n> Thanks!\n-# Update · Submission `01a17591`',
		});
		expect(
			buildAuditEmbed(
				event('submission.created', {
					...SUBMISSION,
					submissionKind: 'listing',
					supersededId: null,
				}),
			).description,
		).toBe('-# New listing · Submission `01a17591`');
		expect(decided('rejected')).toMatchObject({
			title: 'Rejected Silent Typing 1.2.0',
			color: COLOURS.danger,
		});
		expect(decided('changes_requested')).toMatchObject({
			title: 'Requested changes on Silent Typing 1.2.0',
			color: COLOURS.warning,
		});
	});

	test('a rollback shows the arrow, and lists only versions the arrow leaves out', () => {
		const rollback = (withdrawn: string[], restored: string[]) =>
			buildAuditEmbed(
				event(
					'addon.rollback',
					{ from: '1.2.0', to: '1.1.0', withdrawn, restored },
					{ reason: 'Crashes on launch.' },
				),
			);

		expect(rollback(['1.2.0'], ['1.1.0'])).toMatchObject({
			title: 'Rolled back Silent Typing to 1.1.0',
			color: COLOURS.warning,
			description: '> Crashes on launch.\n-# `1.2.0` → `1.1.0`',
		});
		expect(rollback(['1.2.0', '1.1.5'], ['1.1.0', '1.0.9']).description).toBe(
			'> Crashes on launch.\n-# `1.2.0` → `1.1.0`\n-# Also withdrew `1.1.5`\n-# Also restored `1.0.9`',
		);
	});

	test('a first-party deploy reads as a deploy linking its build commit, not as a review', () => {
		const sha = '481d82722e7733bf41f214d9222303b58881bb4b';
		const embed = buildAuditEmbed(
			event(
				'review.decided',
				{
					...SUBMISSION,
					decision: 'approved',
					build: { repository: 'owner/repo', commitSha: sha, ref: 'plugin-builds/abc' },
				},
				{ reason: `Published by CI from build commit ${sha} (plugin-builds/abc).` },
			),
		);

		expect(embed).toMatchObject({
			title: '🚀 Deployed Silent Typing 1.2.0',
			color: COLOURS.deploy,
			description: `-# First-party update · Build [\`481d827\`](https://github.com/owner/repo/commit/${sha})`,
		});
	});

	test('a system action without an actor reads as System, and a user links to its admin page', () => {
		const embed = buildAuditEmbed(
			event(
				'user.unbanned',
				{},
				{ actor: null, subjectType: 'user', subjectId: 'u1', subjectName: null },
			),
		);
		// A subject type newer than the bot's contracts arrives as plain text from the database.
		const other = buildAuditEmbed(
			event('user.unbanned', {}, { subjectType: 'tag' as AuditEvent['subjectType'] }),
		);

		expect(embed).toMatchObject({
			author: { name: 'System' },
			title: 'Unbanned u1',
			url: 'https://unbound.rip/admin/users/u1',
		});
		expect(embed.description).toBeUndefined();
		expect(other.url).toBeUndefined();
	});

	test("the author shows the actor's avatar, and only an http(s) one", () => {
		const avatar = (image: string | null) =>
			buildAuditEmbed(
				event('addon.delisted', {}, { actor: { id: 'staff-1', name: 'Mario', image } }),
			).author?.icon_url;

		expect(avatar('https://cdn.discordapp.com/avatars/1/a.png')).toBe(
			'https://cdn.discordapp.com/avatars/1/a.png',
		);
		expect(avatar('data:image/png;base64,AAAA')).toBeUndefined();
		expect(avatar(null)).toBeUndefined();
		expect(
			buildAuditEmbed(event('addon.delisted', {}, { actor: null })).author?.icon_url,
		).toBeUndefined();
	});

	test('kind specifics read from the data', () => {
		const line = (kind: string, data: EventData) =>
			buildAuditEmbed(event(kind, data)).description;

		expect(line('user.banned', { expiresAt: '2026-11-01T00:00:00Z' })).toBe(
			'-# Until <t:1793491200:F>',
		);
		expect(line('user.banned', { expiresAt: null })).toBe('-# Permanently');
		expect(buildAuditEmbed(event('user.role_set', { role: 'reviewer' })).title).toBe(
			'Set the role of Silent Typing to reviewer',
		);
		expect(
			line('addon.edited', {
				changes: [
					{ field: 'name', from: 'Old', to: 'New', pinned: true },
					{ field: 'repository', from: null, to: 'owner/repo', pinned: false },
				],
			}),
		).toBe('-# Name: Old → New (pinned)\n-# Repository: None → owner/repo');
		expect(
			line('addon.maintainers_changed', {
				before: [
					{ userId: 'u1', role: 'owner' },
					{ userId: 'u2', role: 'maintainer' },
				],
				after: [
					{ userId: 'u1', role: 'maintainer' },
					{ userId: 'u3', role: 'owner' },
				],
			}),
		).toBe(
			'-# Added `u3` as owner\n-# Removed `u2` (maintainer)\n-# Changed `u1` from owner to maintainer',
		);
		expect(line('note.edited', { noteId: 1, before: 'Old.', body: 'New.' })).toBe(
			'> New.\n-# Was: Old.',
		);
	});

	test('an unknown kind or malformed data renders the raw kind and data', () => {
		for (const [kind, data] of [
			['future.thing', { colour: 'teal' }],
			['user.deleted', { openSubmissions: -1, staffNotes: 0 }],
			['constructor', {}],
			['__proto__', {}],
		] as const) {
			const embed = buildAuditEmbed(event(kind, data));

			expect(embed).toMatchObject({ title: kind, color: COLOURS.muted });
			expect(embed.description).toBe(`\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``);
		}
	});

	test('never emits a blank author or title that Discord would reject', () => {
		const embed = buildAuditEmbed(
			event(
				'addon.delisted',
				{},
				{ subjectName: '', actor: { id: 'staff-1', name: ' ', image: null } },
			),
		);

		expect(embed.author?.name).toBe('None');
		expect(embed.title).toBe('Delisted addon-1');
	});

	test('a cut never leaves half of a surrogate pair', () => {
		const embed = buildAuditEmbed(
			event('note.added', { noteId: 1, body: `${'x'.repeat(4092)}😀😀` }),
		);

		expect(embed.description).toBe(`> ${'x'.repeat(4092)}…`);
	});

	test('stays within Discord limits for oversized notes, titles and data', () => {
		const body = 'x'.repeat(10_000);
		const kind = 'k'.repeat(3000);
		const embeds = [
			buildAuditEmbed(
				event('note.edited', { noteId: 1, before: body, body }, { reason: body }),
			),
			buildAuditEmbed(event('note.added', { noteId: 1, body }, { subjectName: body })),
			buildAuditEmbed(event(kind, { blob: 'y'.repeat(5000) })),
		];

		for (const embed of embeds) {
			expect(embed.title?.length ?? 0).toBeLessThanOrEqual(256);
			expect(embed.description?.length ?? 0).toBeLessThanOrEqual(4096);
			expect(embed.footer?.text.length ?? 0).toBeLessThanOrEqual(2048);
			expect(totalLength(embed)).toBeLessThanOrEqual(6000);
		}

		expect(embeds[2]?.description).toEndWith('…\n```');
	});
});
