import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
	capture,
	emptyArchive,
	parseArchive,
	prune,
	search,
	snapshot,
} from '../../src/archive/core.ts';
import { Disk, paths, type Files } from '../../src/archive/disk.ts';

const now = Date.now();
const message = {
	id: '10',
	channel_id: '20',
	content: 'Original secret',
	author: { id: '30', username: 'Alice' },
	attachments: [{ filename: 'notes.txt', url: 'https://private.example' }],
};
function archive() {
	const a = emptyArchive();
	a.options.enabled = true;
	return a;
}
function memory() {
	const files = new Map<string, string>();
	const io: Files = {
		exists: async (p) => files.has(p),
		readFile: async (p) => files.get(p)!,
		writeFile: async (p, data) => {
			files.set(p, data);
		},
	};
	return { files, io };
}
test('deleted and edited snapshots survive a new disk instance / restart', async () => {
	const { io } = memory();
	const a = archive();
	assert.ok(capture(a, '1', 'edited', message, { content: 'Replacement' }, {}, now));
	assert.ok(
		capture(a, '1', 'deleted', { ...message, content: 'Replacement' }, undefined, {}, now + 1),
	);
	await new Disk(io).save(a);
	const reloaded = (await new Disk(io).load()).archive;
	assert.equal(search(reloaded, '1', 'original')[0]?.after?.content, 'Replacement');
	assert.equal(search(reloaded, '1', 'deleted')[0]?.before.content, 'Replacement');
	assert.equal(search(reloaded, '2', '').length, 0);
	assert.equal(search(reloaded, '1', '', '999').length, 0);
	assert.equal(JSON.stringify(reloaded).includes('private.example'), false);
});
test('does not invent uncaptured content; ignores bot, ephemeral, self and excluded messages', () => {
	const a = archive();
	assert.equal(capture(a, '1', 'deleted', undefined, undefined, {}, now), false);
	assert.equal(capture(a, '', 'deleted', message, undefined, {}, now), false);
	assert.equal(capture(a, '1', 'deleted', { ...message, flags: 64 }, undefined, {}, now), false);
	assert.equal(
		capture(
			a,
			'1',
			'deleted',
			{ ...message, author: { ...message.author, bot: true } },
			undefined,
			{},
			now,
		),
		false,
	);
	a.options.ignoreSelf = true;
	assert.equal(capture(a, '30', 'deleted', message, undefined, {}, now), false);
	a.options.channels = '999';
	assert.equal(capture(a, '1', 'deleted', message, undefined, {}, now), false);
	a.options.channels = '20';
	a.options.ignoredUsers = '30';
	assert.equal(capture(a, '1', 'deleted', message, undefined, {}, now), false);
	a.options.ignoredUsers = '';
	a.options.ignoredGuilds = '99';
	assert.equal(capture(a, '1', 'deleted', message, undefined, { guild_id: '99' }, now), false);
});
test('ignores unchanged/embed updates, records attachment removals and bounds snapshot fields', () => {
	const a = archive();
	assert.equal(capture(a, '1', 'edited', message, { embeds: [] }, {}, now), false);
	assert.ok(capture(a, '1', 'edited', message, { attachments: [] }, {}, now));
	assert.equal(a.entries[0]?.after?.attachments.length, 0);
	assert.equal(snapshot({ ...message, content: 'x'.repeat(20000) })?.content.length, 16000);
});
test('age, count and total text limits apply across accounts', () => {
	const a = archive();
	a.options.limit = 50;
	for (let i = 0; i < 70; i++)
		capture(a, '1', 'deleted', { ...message, id: String(i + 1) }, undefined, {}, now + i);
	assert.equal(a.entries.length, 50);
	prune(a, now + 8 * 86400000);
	assert.equal(a.entries.length, 0);
	for (let i = 0; i < 100; i++)
		capture(
			a,
			'1',
			'deleted',
			{ ...message, id: String(i + 1), content: 'x'.repeat(16000) },
			undefined,
			{},
			now,
		);
	assert.ok(JSON.stringify(a).length < 910000);
});
test('clear is serialized behind writes and cannot resurrect data on restart', async () => {
	const { io, files } = memory();
	const a = archive();
	const disk = new Disk(io);
	capture(a, '1', 'deleted', message, undefined, {}, now);
	const writes = [disk.save(a)];
	a.entries = [];
	writes.push(disk.save(a));
	await Promise.all(writes);
	assert.equal((await new Disk(io).load()).archive.entries.length, 0);
	assert.ok(paths.every((p) => parseArchive(files.get(p)!).entries.length === 0));
});
test('backup recovery, both-corrupt failure, unknown version and failed writes', async () => {
	const { io, files } = memory();
	const a = archive();
	const disk = new Disk(io);
	await disk.save(a);
	files.set(paths[0]!, '{truncated');
	assert.equal((await new Disk(io).load()).recovered, true);
	files.set(paths[1]!, '{truncated');
	await assert.rejects(new Disk(io).load(), /unreadable/);
	assert.throws(() => parseArchive(JSON.stringify({ ...a, version: 2 })));
	await assert.rejects(
		new Disk({
			...io,
			writeFile: async () => {
				throw new Error('Full');
			},
		}).save(a),
		/Full/,
	);
});
test('burst writes coalesce and final clear wins', async () => {
	const { io } = memory();
	let writes = 0;
	const slow = {
		...io,
		writeFile: async (p: string, s: string) => {
			writes++;
			await new Promise((r) => setTimeout(r, 1));
			await io.writeFile(p, s);
		},
	};
	const disk = new Disk(slow);
	const a = archive();
	const pending: Promise<void>[] = [];
	for (let i = 0; i < 100; i++) {
		capture(a, '1', 'deleted', { ...message, id: String(i + 1) }, undefined, {}, now);
		pending.push(disk.save(a));
	}
	a.entries = [];
	pending.push(disk.save(a));
	await Promise.all(pending);
	assert.ok(writes <= 4);
	assert.equal((await new Disk(io).load()).archive.entries.length, 0);
});
