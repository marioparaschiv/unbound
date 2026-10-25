import { describe, expect, test } from 'bun:test';
import type { APIEmbed } from 'discord.js';

import { buildAuditEmbed, type AuditEventRow } from '~/dispatchers/audit-embed';
import { COLOURS } from '~/lib/constants';

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };
type EventData = Record<string, Json>;

const SUBMISSION: EventData = { submissionId: 'sub-1', submissionKind: 'update', version: '1.2.0' };

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

function event(kind: string, data: EventData, columns: Partial<AuditEventRow> = {}): AuditEventRow {
	return {
		id: 7,
		kind,
		subjectType: 'addon',
		subjectId: 'addon-1',
		subjectName: 'Silent Typing',
		actor: { id: 'staff-1', name: 'Mario' },
		data,
		reason: null,
		createdAt: new Date('2026-10-01T00:00:00.000Z'),
		channelId: null,
		messageId: null,
		...columns,
	};
}

function field(embed: APIEmbed, name: string) {
	return embed.fields?.find((entry) => entry.name === name)?.value;
}

function totalLength(embed: APIEmbed) {
	const fields = embed.fields ?? [];

	return [
		embed.title,
		embed.description,
		embed.author?.name,
		embed.footer?.text,
		...fields.flatMap((entry) => [entry.name, entry.value]),
	].reduce((sum, text) => sum + (text?.length ?? 0), 0);
}

describe('buildAuditEmbed', () => {
	for (const [kind, data] of Object.entries(SAMPLES)) {
		test(`${kind} renders its own embed, not the generic one`, () => {
			const embed = buildAuditEmbed(event(kind, data));

			expect(embed.title).not.toBe(kind);
			expect(field(embed, 'Data')).toBeUndefined();
			expect(embed.footer?.text).toBe(`Event #7 · ${kind}`);
		});
	}

	test('carries the actor, subject link, reason and creation time', () => {
		const embed = buildAuditEmbed(
			event('addon.delisted', {}, { reason: 'Malware.', actor: null }),
		);

		expect(embed).toMatchObject({
			author: { name: 'System' },
			url: 'https://unbound.rip/admin/addons/addon-1',
			description: 'Malware.',
			timestamp: '2026-10-01T00:00:00.000Z',
		});
		expect(field(embed, 'Subject')).toBe(
			'[Silent Typing](https://unbound.rip/admin/addons/addon-1)',
		);
	});

	test('links users to their admin page and leaves other subjects unlinked', () => {
		const user = buildAuditEmbed(
			event('user.unbanned', {}, { subjectType: 'user', subjectId: 'u1', subjectName: null }),
		);
		const other = buildAuditEmbed(event('user.unbanned', {}, { subjectType: 'tag' }));

		expect(user.url).toBe('https://unbound.rip/admin/users/u1');
		expect(field(user, 'Subject')).toBe('[u1](https://unbound.rip/admin/users/u1)');
		expect(other.url).toBeUndefined();
		expect(field(other, 'Subject')).toBe('Silent Typing');
	});

	test('escapes brackets in the subject name so the link text stays whole', () => {
		const embed = buildAuditEmbed(
			event('addon.delisted', {}, { subjectName: 'Evil](https://example.com) [x' }),
		);

		expect(field(embed, 'Subject')).toBe(
			'[Evil\\](https://example.com) \\[x](https://unbound.rip/admin/addons/addon-1)',
		);
	});

	test('never emits a blank field that Discord would reject', () => {
		const edited = buildAuditEmbed(
			event('note.edited', { noteId: 1, before: ' ', body: '\n' }, { subjectName: '' }),
		);
		const role = buildAuditEmbed(
			event('user.role_set', { role: ' ' }, { actor: { id: 'staff-1', name: ' ' } }),
		);

		expect(field(edited, 'Before')).toBe('None');
		expect(field(edited, 'After')).toBe('None');
		expect(field(edited, 'Subject')).toBe(
			'[addon-1](https://unbound.rip/admin/addons/addon-1)',
		);
		expect(field(role, 'Role')).toBe('None');
		expect(role.author?.name).toBe('None');
	});

	test('kinds named after object builtins render the generic embed', () => {
		for (const kind of ['constructor', 'toString', '__proto__']) {
			const embed = buildAuditEmbed(event(kind, {}));

			expect(embed.title).toBe(kind);
			expect(field(embed, 'Data')).toBe('```json\n{}\n```');
		}
	});

	test('a cut never leaves half of a surrogate pair', () => {
		const embed = buildAuditEmbed(
			event('note.added', { noteId: 1, body: `${'x'.repeat(4094)}😀😀` }),
		);

		expect(embed.description).toBe(`${'x'.repeat(4094)}…`);
	});

	test('review decisions pick their title and colour from the decision', () => {
		const rejected = buildAuditEmbed(
			event('review.decided', { ...SUBMISSION, decision: 'rejected' }),
		);

		expect(rejected).toMatchObject({ title: 'Submission rejected', color: COLOURS.danger });
		expect(field(rejected, 'Version')).toBe('1.2.0');
		expect(field(rejected, 'Kind')).toBe('update');
	});

	test('kind specifics read from the data', () => {
		const banned = buildAuditEmbed(event('user.banned', { expiresAt: '2026-11-01T00:00:00Z' }));
		const permanent = buildAuditEmbed(event('user.banned', { expiresAt: null }));
		const edited = buildAuditEmbed(
			event('addon.edited', {
				changes: [
					{ field: 'name', from: 'Old', to: 'New', pinned: true },
					{ field: 'repository', from: null, to: 'owner/repo', pinned: false },
				],
			}),
		);
		const maintainers = buildAuditEmbed(
			event('addon.maintainers_changed', {
				before: [
					{ userId: 'u1', role: 'owner' },
					{ userId: 'u2', role: 'maintainer' },
				],
				after: [
					{ userId: 'u1', role: 'maintainer' },
					{ userId: 'u3', role: 'owner' },
				],
			}),
		);

		const deleted = buildAuditEmbed(
			event('user.deleted', { openSubmissions: 2, staffNotes: 0 }, { subjectType: 'user' }),
		);
		const negative = buildAuditEmbed(
			event('user.deleted', { openSubmissions: -1, staffNotes: 0 }),
		);

		expect(deleted).toMatchObject({ title: 'User deleted', color: COLOURS.danger });
		expect(field(deleted, 'Open submissions removed')).toBe('2');
		expect(field(deleted, 'Staff notes removed')).toBe('0');
		expect(negative.title).toBe('user.deleted');
		expect(field(banned, 'Expires')).toBe('<t:1793491200:F>');
		expect(field(permanent, 'Expires')).toBe('Permanent');
		expect(field(edited, 'name (pinned)')).toBe('Old -> New');
		expect(field(edited, 'repository')).toBe('None -> owner/repo');
		expect(field(maintainers, 'Added')).toBe('u3 (owner)');
		expect(field(maintainers, 'Removed')).toBe('u2 (maintainer)');
		expect(field(maintainers, 'Role changed')).toBe('u1: owner -> maintainer');
	});

	test('a note puts its body in the description and its reason in a field', () => {
		const embed = buildAuditEmbed(
			event('note.added', { noteId: 1, body: 'Body.' }, { reason: 'Why.' }),
		);

		expect(embed.description).toBe('Body.');
		expect(field(embed, 'Reason')).toBe('Why.');
	});

	test('stays within Discord limits for a 10 000 character note', () => {
		const body = 'x'.repeat(10_000);
		const embed = buildAuditEmbed(
			event('note.edited', { noteId: 1, before: body, body }, { reason: body }),
		);
		const added = buildAuditEmbed(event('note.added', { noteId: 1, body }, { reason: body }));

		for (const fitted of [embed, added]) {
			expect(fitted.description?.length ?? 0).toBeLessThanOrEqual(4096);
			expect(totalLength(fitted)).toBeLessThanOrEqual(6000);

			for (const entry of fitted.fields ?? []) {
				expect(entry.value.length).toBeLessThanOrEqual(1024);
			}
		}

		expect(added.description).toEndWith('…');
	});

	test('stays within Discord limits for oversized titles, footers and field counts', () => {
		const kind = 'k'.repeat(3000);
		const generic = buildAuditEmbed(event(kind, { blob: 'y'.repeat(5000) }));
		const changes = Array.from({ length: 40 }, (_, index) => ({
			field: `f${index}`.repeat(100),
			from: 'a'.repeat(2000),
			to: 'b',
			pinned: false,
		}));
		const edited = buildAuditEmbed(event('addon.edited', { changes }));

		expect(generic.title?.length).toBe(256);
		expect(generic.footer?.text.length).toBeLessThanOrEqual(2048);
		expect(field(generic, 'Data')).toEndWith('…\n```');
		expect(totalLength(generic)).toBeLessThanOrEqual(6000);
		expect(edited.fields?.length).toBeLessThanOrEqual(25);
		expect(totalLength(edited)).toBeLessThanOrEqual(6000);

		for (const entry of edited.fields ?? []) {
			expect(entry.name.length).toBeLessThanOrEqual(256);
			expect(entry.value.length).toBeLessThanOrEqual(1024);
		}
	});
});
