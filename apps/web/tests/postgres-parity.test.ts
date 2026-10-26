import { and, asc, eq, inArray, sql, type SQL } from 'drizzle-orm';
import { afterAll, describe, expect, test } from 'bun:test';
import { z } from 'zod';

import {
	rateLimit,
	staffNote,
	submission,
	submissionSource,
	user,
	userSearchText,
} from '~/db/schema';
import { afterKey, cursorTime, decodeCursor, encodeCursor } from '~/lib/keyset';
import { matchesSearch } from '~/lib/admin-search';
import { likeContains } from '~/lib/like-contains';

import { manifest, seedSubmission } from './helpers/addons';
import { createTestContext } from './helpers/context';

const { ctx, close } = await createTestContext();

afterAll(close);

let users = 0;

async function seedUser(name: string, email: string = `parity-${users + 1}@example.com`) {
	users += 1;

	const id = `parity-${users}`;

	await ctx.db.insert(user).values({ id, name, email });

	return id;
}

async function namesMatching(q: string, ids: string[]) {
	const rows = await ctx.db
		.select({ name: user.name })
		.from(user)
		.where(and(inArray(user.id, ids), matchesSearch(userSearchText(user), q)))
		.orderBy(asc(user.name));

	return rows.map((row) => row.name);
}

describe('round trips', () => {
	test('a JSON column keeps its key order and is stored as a JSON object', async () => {
		const published = { ...manifest('parity.json'), zeta: 1, alpha: { b: 2, a: [1, 'x'] } };
		const row = await seedSubmission(ctx, await seedUser('Json'), published);
		const [stored] = await ctx.db
			.select({
				manifest: submission.manifest,
				kind: sql<string>`json_typeof(${submission.manifest})`,
			})
			.from(submission)
			.where(eq(submission.id, row.id));

		expect(JSON.stringify(stored?.manifest)).toBe(JSON.stringify(published));
		expect(stored?.kind).toBe('object');
	});

	test('a JSON column stores its text verbatim', async () => {
		const text = '{"b": 1.0, "a": [true, null], "b2": "é"}';
		const [row] = await ctx.db.$client<
			{ text: string }[]
		>`select ${text}::text::json::text as text`;

		expect(row?.text).toBe(text);
	});

	test('a timestamp keeps its milliseconds', async () => {
		const at = new Date('2026-10-26T12:34:56.789Z');
		const row = await seedSubmission(ctx, await seedUser('Clock'), manifest('parity.clock'), {
			createdAt: at,
		});
		const [stored] = await ctx.db
			.select({ createdAt: submission.createdAt })
			.from(submission)
			.where(eq(submission.id, row.id));

		expect(stored?.createdAt.getTime()).toBe(at.getTime());
	});

	test('a default timestamp used as a keyset cursor neither repeats nor skips its row', async () => {
		const ids = [await seedUser('First'), await seedUser('Second'), await seedUser('Third')];
		const page = (after?: SQL) =>
			ctx.db
				.select({ id: user.id, createdAt: user.createdAt })
				.from(user)
				.where(and(inArray(user.id, ids), after))
				.orderBy(asc(user.createdAt), asc(user.id));
		const [first, ...rest] = await page();

		if (!first) {
			throw new Error('The seeded users were not stored.');
		}

		const cursor = encodeCursor([first.createdAt.getTime(), first.id]);
		const position = decodeCursor(cursor, z.tuple([cursorTime, z.string()]));
		const after = await page(afterKey([user.createdAt, user.id], position, 'asc'));

		expect(after).toEqual(rest);
	});

	test('booleans, identity ids and 64-bit integers come back as JS values', async () => {
		const verified = await seedUser('Verified');

		await ctx.db.update(user).set({ emailVerified: true }).where(eq(user.id, verified));

		const [flags] = await ctx.db
			.select({ emailVerified: user.emailVerified, banned: user.banned })
			.from(user)
			.where(eq(user.id, verified));

		expect(flags).toEqual({ emailVerified: true, banned: false });

		const [note] = await ctx.db
			.insert(staffNote)
			.values({ userId: verified, authorId: null, body: 'Hi.', createdAt: new Date() })
			.returning({ id: staffNote.id });

		expect(typeof note?.id).toBe('number');

		const lastRequest = Date.UTC(2026, 9, 26);

		await ctx.db
			.insert(rateLimit)
			.values({ id: 'parity', key: 'parity', count: 3, lastRequest });

		const [limit] = await ctx.db
			.select({ count: rateLimit.count, lastRequest: rateLimit.lastRequest })
			.from(rateLimit)
			.where(eq(rateLimit.key, 'parity'));

		expect(limit).toEqual({ count: 3, lastRequest });

		const row = await seedSubmission(
			ctx,
			verified,
			manifest('parity.github'),
			{},
			{
				repositoryId: 2 ** 40 + 1,
			},
		);
		const [source] = await ctx.db
			.select({ repositoryId: submissionSource.repositoryId })
			.from(submissionSource)
			.where(eq(submissionSource.submissionId, row.id));

		expect(source?.repositoryId).toBe(2 ** 40 + 1);
	});
});

describe('text', () => {
	test('text sorts in byte order, as version keys need', async () => {
		const values = ['b', 'B', '~', '1', 'a-b', 'a~', 'a', 'Z', 'é', '_', '0.10', '0.9'];
		const [row] = await ctx.db.$client<{ sorted: string[] }[]>`
			select array_agg(value order by value) as sorted from unnest(${values}::text[]) value`;

		expect(row?.sorted).toEqual(
			values.toSorted((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b))),
		);
	});

	test('a contains filter folds ASCII case only and matches wildcards literally', async () => {
		const ids = [
			await seedUser('xABCx'),
			await seedUser('É'),
			await seedUser('100%'),
			await seedUser('a_b'),
			await seedUser('axb'),
		];

		async function matching(search: string) {
			const rows = await ctx.db
				.select({ name: user.name })
				.from(user)
				.where(and(inArray(user.id, ids), likeContains(user.name, search)))
				.orderBy(asc(user.name));

			return rows.map((row) => row.name);
		}

		expect(await matching('abc')).toEqual(['xABCx']);
		expect(await matching('é')).toEqual([]);
		expect(await matching('0%')).toEqual(['100%']);
		expect(await matching('a_b')).toEqual(['a_b']);
	});
});

describe('admin search', () => {
	test('matches a case-insensitive substring of id, name and email, across their joins', async () => {
		const ids = [
			await seedUser('Alice Walker', 'alice@example.com'),
			await seedUser('Émile Zola', 'emile@example.com'),
			await seedUser('Bob', 'bob@walker.test'),
		];

		expect(await namesMatching('LICE W', ids)).toEqual(['Alice Walker']);
		expect(await namesMatching('walker', ids)).toEqual(['Alice Walker', 'Bob']);
		expect(await namesMatching('ÉMI', ids)).toEqual(['Émile Zola']);
		expect(await namesMatching(ids[2] ?? '', ids)).toEqual(['Bob']);
	});

	test('matches wildcards literally and nothing under three characters', async () => {
		const ids = [
			await seedUser('Under_score', 'under@example.com'),
			await seedUser('Underxscore', 'underx@example.com'),
			await seedUser('Half 50%', 'half@example.com'),
		];

		expect(await namesMatching('r_s', ids)).toEqual(['Under_score']);
		expect(await namesMatching('50%', ids)).toEqual(['Half 50%']);
		expect(await namesMatching('Un', ids)).toEqual([]);
		expect(await namesMatching('%%%', ids)).toEqual([]);
	});
});
