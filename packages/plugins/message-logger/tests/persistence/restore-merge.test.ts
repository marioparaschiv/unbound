import { test } from 'node:test';
import assert from 'node:assert/strict';
import { archivedMessage, compareIds, mergeHistory } from '../../src/restore/merge.ts';
import type { Entry } from '../../src/archive/core.ts';
const saved = (id: string, changes: Partial<Entry> = {}): Entry => ({
	accountId: '1',
	channelId: '20',
	guildId: '90',
	messageId: id,
	kind: 'deleted',
	capturedAt: Date.now(),
	before: { content: `Saved ${id}`, authorId: '30', authorName: 'Alice', attachments: [] },
	...changes,
});
const raw = (id: string) => ({ id, channel_id: '20', content: `Live ${id}` });
const prepare = (raw: any) => raw;
test('merges saved deletions in exact snowflake order without changing live messages or duplicates', () => {
	const existing = [raw('300'), raw('100')];
	const result = mergeHistory(
		{ channelId: '20', messages: existing },
		[saved('200'), saved('200'), saved('300')],
		prepare,
	);
	assert.deepEqual(
		result.messages.map((m) => m.id),
		['300', '200', '100'],
	);
	assert.equal(result.messages[0], existing[0]);
	assert.equal(result.messages[0].content, 'Live 300');
	assert.equal(result.restored.length, 1);
	assert.equal(existing.length, 2);
});
test('preserves ascending history order and compares large IDs without Number precision loss', () => {
	const result = mergeHistory(
		{ channelId: '20', messages: [raw('100'), raw('300')] },
		[saved('200')],
		prepare,
	);
	assert.deepEqual(
		result.messages.map((m) => m.id),
		['100', '200', '300'],
	);
	assert.equal(compareIds('123456789012345678', '123456789012345679'), -1);
});
test('respects page bounds, with recent-tail and exhausted-history handling', () => {
	const entries = [saved('50'), saved('200'), saved('400')];
	assert.deepEqual(
		mergeHistory(
			{
				channelId: '20',
				messages: [raw('300'), raw('100')],
				isBefore: false,
				isAfter: false,
			},
			entries,
			prepare,
		).restored.map((e) => e.messageId),
		['200', '400'],
	);
	assert.deepEqual(
		mergeHistory(
			{ channelId: '20', messages: [raw('300'), raw('100')] },
			entries,
			prepare,
		).restored.map((e) => e.messageId),
		['200'],
	);
	assert.deepEqual(
		mergeHistory(
			{ channelId: '20', messages: [raw('300'), raw('100')], isBefore: true },
			entries,
			prepare,
		).restored.map((e) => e.messageId),
		['200'],
	);
	assert.equal(
		mergeHistory(
			{
				channelId: '20',
				messages: [raw('300'), raw('100')],
				hasMoreBefore: false,
				isBefore: false,
				isAfter: false,
			},
			entries,
			prepare,
		).restored.length,
		3,
	);
});
test('only restores empty loads that identify a fully exhausted initial history page', () => {
	assert.equal(
		mergeHistory({ channelId: '20', messages: [] }, [saved('200')], prepare).supported,
		false,
	);
	const result = mergeHistory(
		{ channelId: '20', messages: [], isBefore: false, isAfter: false, hasMoreBefore: false },
		[saved('200')],
		prepare,
	);
	assert.equal(result.messages[0].id, '200');
});
test('rejects foreign-channel, edited and unsupported records without corrupting the original batch', () => {
	const action = { channelId: '20', messages: [raw('300'), raw('100')] };
	assert.equal(
		mergeHistory(
			action,
			[saved('200', { channelId: '21' }), saved('200', { kind: 'edited' })],
			prepare,
		).restored.length,
		0,
	);
	const failed = mergeHistory(action, [saved('200')], () => {
		throw new Error('No converter');
	});
	assert.equal(failed.messages, action.messages);
	assert.equal(failed.supported, false);
	assert.equal(
		mergeHistory({ channelId: '20', messages: [{ id: '2', channel_id: '21' }] }, [], prepare)
			.supported,
		false,
	);
});
test('reconstructed message contains bounded captured text and names, without remote attachment URLs', () => {
	const restored = archivedMessage(
		saved('200', {
			before: {
				content: 'Captured text',
				authorId: '30',
				authorName: 'Alice',
				attachments: ['a.txt'],
			},
		}),
	);
	assert.equal(restored.author.id, '30');
	assert.equal(restored.flags, 0);
	assert.deepEqual(restored.attachments, []);
	assert.match(restored.content, /Captured text/);
	assert.match(restored.content, /a.txt/);
	assert.equal(Number.isNaN(Date.parse(restored.timestamp)), false);
});
