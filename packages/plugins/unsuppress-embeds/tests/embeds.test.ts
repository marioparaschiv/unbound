import { describe, expect, test } from 'bun:test';

import {
	actionLabel,
	applyAction,
	getEmbedAction,
	hasEmbeds,
	insertionIndex,
	isDeleteLabel,
	isSuppressed,
	type ChannelAccess,
	type Message,
} from '~/unsuppress/embeds';

const ME = '1';
const OTHER = '2';

const guild: ChannelAccess = {
	currentUserId: ME,
	isPrivate: false,
	canEmbedLinks: true,
	canManageMessages: false,
};

const dm: ChannelAccess = { ...guild, isPrivate: true, canEmbedLinks: false };

function message(overrides: Partial<Message> = {}): Message {
	return { id: '10', channel_id: '20', flags: 0, author: { id: ME }, embeds: [{}], ...overrides };
}

describe('isSuppressed', () => {
	test('reads the suppress-embeds bit', () => {
		expect(isSuppressed(4)).toBe(true);
		expect(isSuppressed(4 | 1 | 16)).toBe(true);
		expect(isSuppressed(1 | 16)).toBe(false);
		expect(isSuppressed(0)).toBe(false);
		expect(isSuppressed(undefined)).toBe(false);
	});
});

describe('hasEmbeds', () => {
	test('finds embeds on the message', () => {
		expect(hasEmbeds({ embeds: [{}] })).toBe(true);
		expect(hasEmbeds({ embeds: [] })).toBe(false);
		expect(hasEmbeds({})).toBe(false);
	});

	test('finds embeds in forwarded snapshots', () => {
		expect(hasEmbeds({ embeds: [], messageSnapshots: [{ message: { embeds: [{}] } }] })).toBe(
			true,
		);
		expect(hasEmbeds({ embeds: [], messageSnapshots: [{ message: { embeds: [] } }, {}] })).toBe(
			false,
		);
	});
});

describe('applyAction', () => {
	test('sets the bit and keeps other flags', () => {
		expect(applyAction(1 | 16, 'suppress')).toBe(1 | 4 | 16);
		expect(applyAction(undefined, 'suppress')).toBe(4);
	});

	test('clears the bit and keeps other flags', () => {
		expect(applyAction(1 | 4 | 16, 'unsuppress')).toBe(1 | 16);
		expect(applyAction(0, 'unsuppress')).toBe(0);
	});
});

describe('getEmbedAction', () => {
	test('offers unsuppress on a suppressed message even with no embeds left', () => {
		expect(getEmbedAction(message({ flags: 4, embeds: [] }), guild)).toBe('unsuppress');
	});

	test('offers suppress on a message with embeds', () => {
		expect(getEmbedAction(message(), guild)).toBe('suppress');
	});

	test('offers suppress for a forward whose snapshot has embeds', () => {
		const forward = message({ embeds: [], messageSnapshots: [{ message: { embeds: [{}] } }] });

		expect(getEmbedAction(forward, guild)).toBe('suppress');
	});

	test('offers nothing without embeds or the flag', () => {
		expect(getEmbedAction(message({ embeds: [] }), guild)).toBeNull();
	});

	test('offers nothing without a message id', () => {
		expect(getEmbedAction(message({ id: undefined }), guild)).toBeNull();
	});

	test('hides the row on your own message without Embed Links, as Vencord does', () => {
		expect(getEmbedAction(message(), { ...guild, canEmbedLinks: false })).toBeNull();
	});

	test('allows your own message in a DM without Embed Links', () => {
		expect(getEmbedAction(message(), dm)).toBe('suppress');
	});

	test("needs Manage Messages for someone else's message in a server", () => {
		const theirs = message({ author: { id: OTHER } });

		expect(getEmbedAction(theirs, guild)).toBeNull();
		expect(getEmbedAction(theirs, { ...guild, canManageMessages: true })).toBe('suppress');
	});

	test("hides the row on someone else's message in a DM", () => {
		expect(getEmbedAction(message({ author: { id: OTHER } }), dm)).toBeNull();
	});

	test('treats an unknown current user as someone else', () => {
		expect(getEmbedAction(message(), { ...guild, currentUserId: undefined })).toBeNull();
	});
});

describe('actionLabel', () => {
	test('names both rows', () => {
		expect(actionLabel('suppress')).toBe('Suppress Embeds');
		expect(actionLabel('unsuppress')).toBe('Unsuppress Embeds');
	});
});

describe('insertionIndex', () => {
	test('goes right above Delete Message', () => {
		expect(insertionIndex(['Reply', 'Edit Message', 'Delete Message', 'Report'])).toBe(2);
	});

	test('goes at the end when there is no delete row', () => {
		expect(insertionIndex(['Reply', undefined, 'Copy Text'])).toBe(3);
	});

	test('does not match rows that only mention deleting', () => {
		expect(insertionIndex(['Undelete', 'Mark Unread'])).toBe(2);
	});
});

describe('isDeleteLabel', () => {
	test('matches Delete Message and plain Delete', () => {
		expect(isDeleteLabel('Delete Message')).toBe(true);
		expect(isDeleteLabel('delete')).toBe(true);
	});

	test('rejects other labels', () => {
		expect(isDeleteLabel('Undelete')).toBe(false);
		expect(isDeleteLabel('Deleted')).toBe(false);
		expect(isDeleteLabel(undefined)).toBe(false);
	});
});
