import { adminAddonsSearchSchema, adminUsersSearchSchema } from '@unbound-app/contracts/admin';
import type { AdminAddonsSearch, AdminUsersSearch } from '@unbound-app/contracts/admin';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import type { SortOrder } from '@unbound-app/contracts/addons';
import { eq } from 'drizzle-orm';

import { listAdminAddons, queryAdminAddons } from '~/lib/admin-addons';
import { listAdminUsers, queryAdminUsers } from '~/lib/admin-users';
import type { KeysetPage, KeysetRequest } from '~/lib/keyset';
import { addon, addonMaintainer, user } from '~/db/schema';
import type { AppContext } from '~/lib/context';
import type { Caller } from '~/lib/api/caller';
import { encodeCursor } from '~/lib/keyset';

import { manifest, seedApprovedAddon, seedSubmission, seedVersion } from './helpers/addons';
import { authRequest, createTestContext, signInWithDiscord } from './helpers/context';
import { explain, planNodes, planPath, type PlanNode } from './helpers/database';

type CompiledQuery = {
	sql: string;
	params: unknown[];
};

type Statement = {
	toSQL: () => CompiledQuery;
};

type Lister<T> = (request: KeysetRequest) => Promise<KeysetPage<T>>;

type Walk = {
	forward: string[][];
	backward: string[][];
};

type SeededUser = {
	id: string;
	createdAt: number;
};

const { ctx, close } = await createTestContext({
	ADDON_LIST_PAGE_SIZE: '2',
	USER_LIST_PAGE_SIZE: '2',
});

afterAll(close);

const DAY = 24 * 60 * 60 * 1000;

const WALKERS = [
	{ name: 'Walker One', day: 1 },
	{ name: 'Walker Two', day: 2 },
	{ name: 'Walker Three', day: 2 },
	{ name: 'Walker Four', day: 3 },
	{ name: 'Walker Five', day: 4 },
];

const ADDONS = [
	{ id: 'walk.alpha', name: 'Night Owl', day: 1, type: 'plugin' },
	{ id: 'walk.bravo', name: 'Day Lark', day: 2, type: 'plugin' },
	{ id: 'walk.charlie', name: 'Morning Wren', day: 2, type: 'plugin' },
	{ id: 'walk.delta', name: 'Evening Finch', day: 3, type: 'theme' },
	{ id: 'walk.echo', name: 'Owl Hoot', day: 4, type: 'plugin' },
] as const;

let signUps = 0;
let moderator: Caller;
let owner = '';
let helper = '';
const walkers: SeededUser[] = [];

function onDay(day: number): AppContext {
	return { ...ctx, now: () => new Date(day * DAY + DAY / 2) };
}

async function signUp(name: string) {
	signUps += 1;

	return signInWithDiscord(ctx, {
		id: `8035111022470${String(signUps).padStart(4, '0')}`,
		name,
		email: `${name.toLowerCase().replaceAll(' ', '-')}@example.com`,
	});
}

beforeAll(async () => {
	const signedIn = await signUp('Lists Moderator');

	await ctx.db.update(user).set({ role: 'moderator' }).where(eq(user.id, signedIn.userId));

	const row = await ctx.db.query.user.findFirst({ where: { id: signedIn.userId } });

	if (!row) {
		throw new Error('The moderator was not stored.');
	}

	moderator = { user: row, via: 'session' };
	({ userId: owner } = await signUp('Lists Owner'));

	for (const { name, day } of WALKERS) {
		const { userId } = await signUp(name);
		const createdAt = day * DAY;

		await ctx.db
			.update(user)
			.set({ createdAt: new Date(createdAt) })
			.where(eq(user.id, userId));
		walkers.push({ id: userId, createdAt });
	}

	for (const { id, name, day, type } of ADDONS) {
		await seedApprovedAddon(onDay(day), owner, manifest(id, '1.0.0', { name, type }));
	}

	await ctx.db.update(addon).set({ delistedAt: new Date() }).where(eq(addon.id, 'walk.echo'));

	({ userId: helper } = await signUp('Lists Helper'));
	await ctx.db.insert(addonMaintainer).values([
		{ addonId: 'walk.bravo', userId: helper, role: 'maintainer' },
		{ addonId: 'walk.delta', userId: helper, role: 'maintainer' },
	]);

	const update = { kind: 'update' } as const;

	await seedSubmission(ctx, owner, manifest('walk.charlie', '1.1.0'), update);
	await seedSubmission(ctx, owner, manifest('walk.alpha', '1.1.0'), {
		...update,
		status: 'changes_requested',
	});
	await seedSubmission(ctx, owner, manifest('walk.foxtrot'));
});

function newestFirst(rows: SeededUser[]): string[] {
	return rows
		.toSorted((a, b) => b.createdAt - a.createdAt || (a.id < b.id ? 1 : -1))
		.map((row) => row.id);
}

function addonOrder(order: SortOrder): string[] {
	const ascending = ADDONS.toSorted((a, b) => a.day - b.day || (a.id < b.id ? -1 : 1)).map(
		(entry) => entry.id,
	);

	return order === 'asc' ? ascending : ascending.toReversed();
}

async function walk<T extends { id: string }>(list: Lister<T>): Promise<Walk> {
	let page = await list({});
	const forward = [page.items.map((item) => item.id)];

	while (page.next) {
		page = await list({ cursor: page.next });
		forward.push(page.items.map((item) => item.id));
	}

	const backward = [page.items.map((item) => item.id)];

	while (page.prev) {
		page = await list({ cursor: page.prev, dir: 'prev' });
		backward.push(page.items.map((item) => item.id));
	}

	return { forward, backward };
}

async function usersMatching(q: string): Promise<string[]> {
	const { forward } = await walk((request) => listAdminUsers(ctx, moderator, { q, ...request }));

	return forward.flat();
}

async function addonsMatching(search: AdminAddonsSearch): Promise<string[]> {
	const { forward } = await walk((request) =>
		listAdminAddons(ctx, moderator, { ...search, ...request }),
	);

	return forward.flat();
}

async function plan(statement: Statement): Promise<PlanNode[]> {
	return planNodes(await explain(ctx.db, statement.toSQL()));
}

// The nodes above the listed table's scan; a sort there would reorder the page.
async function outerPlan(statement: Statement): Promise<PlanNode[]> {
	return planPath(await explain(ctx.db, statement.toSQL()), 'd0');
}

function indexes(nodes: PlanNode[]): (string | undefined)[] {
	return nodes.map((node) => node['Index Name']);
}

function types(nodes: PlanNode[]): string[] {
	return nodes.map((node) => node['Node Type']);
}

describe('admin users list', () => {
	test('walking next then prev returns the same pages, newest first', async () => {
		const everyone = await ctx.db.select({ id: user.id, createdAt: user.createdAt }).from(user);
		const expected = newestFirst(
			everyone.map((row) => ({ id: row.id, createdAt: row.createdAt.getTime() })),
		);

		const { forward, backward } = await walk((request) =>
			listAdminUsers(ctx, moderator, request),
		);

		expect(forward.flat()).toEqual(expected);
		expect(forward.every((page) => page.length <= 2)).toBe(true);
		expect(backward).toEqual(forward.toReversed());
	});

	test('searches a substring of the name, email or id, case-insensitively', async () => {
		const [one, , , four] = walkers;

		if (!one || !four) {
			throw new Error('No walkers were seeded.');
		}

		expect(await usersMatching('WALKER')).toEqual(newestFirst(walkers));
		expect(await usersMatching('walker-four@exa')).toEqual([four.id]);
		expect(await usersMatching(one.id.slice(4, 16))).toEqual([one.id]);
		expect(await usersMatching('Wal"ker')).toEqual([]);
	});

	test('keeps search in sync with Better Auth sign-ups and name changes', async () => {
		const fresh = await signUp('Fresh Signup');

		expect(await usersMatching('fresh sign')).toEqual([fresh.userId]);

		const renamed = await authRequest(ctx, '/update-user', {
			method: 'POST',
			headers: fresh.headers,
			body: JSON.stringify({ name: 'Renamed Person' }),
		});

		expect(renamed.status).toBe(200);
		expect(await usersMatching('renamed per')).toEqual([fresh.userId]);
		expect(await usersMatching('fresh sign')).toEqual([]);
	});

	test('needs user:list', async () => {
		const plain = await signUp('Plain User');
		const row = await ctx.db.query.user.findFirst({ where: { id: plain.userId } });

		if (!row) {
			throw new Error('The user was not stored.');
		}

		const error = await listAdminUsers(ctx, { user: row, via: 'session' }, {}).catch(
			(caught) => caught,
		);

		expect(error).toMatchObject({ code: 'forbidden' });
	});

	test('rejects a malformed cursor', async () => {
		const error = await listAdminUsers(ctx, moderator, { cursor: 'not-a-cursor' }).catch(
			(caught) => caught,
		);

		expect(error).toMatchObject({ code: 'invalid_request' });
	});
});

describe('admin addons list', () => {
	test.each<SortOrder>(['desc', 'asc'])(
		'walks every addon, delisted included, by first approval %s and back',
		async (order) => {
			const { forward, backward } = await walk((request) =>
				listAdminAddons(ctx, moderator, { order, ...request }),
			);

			expect(forward.flat()).toEqual(addonOrder(order));
			expect(backward).toEqual(forward.toReversed());
		},
	);

	test('lists each addon with its newest version and owners', async () => {
		const { items } = await listAdminAddons(ctx, moderator, { q: 'walk.alpha' });

		expect(items).toMatchObject([
			{
				id: 'walk.alpha',
				name: 'Night Owl',
				latestVersion: '1.0.0',
				delistedAt: null,
				owners: [{ id: owner, name: 'Lists Owner' }],
			},
		]);
	});

	test('searches a substring of the id or name, case-insensitively and literally', async () => {
		expect(await addonsMatching({ q: 'OWL' })).toEqual(['walk.echo', 'walk.alpha']);
		expect(await addonsMatching({ q: 'walk.charlie' })).toEqual(['walk.charlie']);
		expect(await addonsMatching({ q: 'k.d' })).toEqual(['walk.delta']);
		expect(await addonsMatching({ q: 'wal%' })).toEqual([]);
	});

	test('keeps search in sync with the name a new version brings', async () => {
		await seedVersion(ctx, owner, manifest('walk.bravo', '1.1.0', { name: 'Dusk Lark' }));

		expect(await addonsMatching({ q: 'dusk' })).toEqual(['walk.bravo']);
		expect(await addonsMatching({ q: 'day lark' })).toEqual([]);
	});
});

describe('admin search text', () => {
	test.each([adminUsersSearchSchema, adminAddonsSearchSchema])(
		'is trimmed and needs 3 to 100 characters',
		(schema) => {
			expect(schema.safeParse({ q: 'ab' }).success).toBe(false);
			expect(schema.safeParse({ q: '  ab  ' }).success).toBe(false);
			expect(schema.safeParse({ q: 'x'.repeat(101) }).success).toBe(false);
			expect(schema.safeParse({ q: ' abc ' }).data).toEqual({ q: 'abc' });
		},
	);
});

describe('admin list plans', () => {
	async function userCursors() {
		const first = await listAdminUsers(ctx, moderator, {});
		const second = await listAdminUsers(ctx, moderator, { cursor: first.next ?? undefined });

		return { next: first.next ?? undefined, prev: second.prev ?? undefined };
	}

	async function addonCursors(order: SortOrder) {
		const first = await listAdminAddons(ctx, moderator, { order });
		const second = await listAdminAddons(ctx, moderator, {
			order,
			cursor: first.next ?? undefined,
		});

		return { next: first.next ?? undefined, prev: second.prev ?? undefined };
	}

	test('users: the first, a next and a prev page read user_createdAt_idx without sorting', async () => {
		const { next, prev } = await userCursors();
		const searches: AdminUsersSearch[] = [{}, { cursor: next }, { cursor: prev, dir: 'prev' }];

		for (const search of searches) {
			const statement = queryAdminUsers(ctx, search);

			expect(indexes(await plan(statement))).toContain('user_createdAt_idx');
			expect(types(await outerPlan(statement))).not.toContain('Sort');
		}
	});

	test.each<SortOrder>(['desc', 'asc'])(
		'addons %s: the first, a next and a prev page read addon_createdAt_idx without sorting',
		async (order) => {
			const { next, prev } = await addonCursors(order);
			const searches: AdminAddonsSearch[] = [
				{ order },
				{ order, cursor: next },
				{ order, cursor: prev, dir: 'prev' },
			];

			for (const search of searches) {
				const statement = queryAdminAddons(ctx, search);

				expect(indexes(await outerPlan(statement))).toContain('addon_createdAt_idx');
				expect(types(await outerPlan(statement))).not.toContain('Sort');
			}
		},
	);

	test('a search reads the trigram index', async () => {
		const { next } = await userCursors();
		const statements: [Statement, string][] = [
			[queryAdminUsers(ctx, { q: 'walker' }), 'user_search_idx'],
			[queryAdminUsers(ctx, { q: 'walker', cursor: next }), 'user_search_idx'],
			[queryAdminAddons(ctx, { q: 'walk.' }), 'addon_search_idx'],
		];

		for (const [statement, index] of statements) {
			// Matches are few, so reading them through the index and sorting beats walking the order.
			const nodes = planNodes(await explain(ctx.db, statement.toSQL(), true));

			expect(indexes(nodes)).toContain(index);
			expect(types(nodes)).not.toContain('Seq Scan');
		}
	});
});

describe('admin addon filters', () => {
	test('filters by type', async () => {
		expect(await addonsMatching({ type: 'theme' })).toEqual(['walk.delta']);
		expect(await addonsMatching({ type: 'plugin' })).toEqual([
			'walk.echo',
			'walk.charlie',
			'walk.bravo',
			'walk.alpha',
		]);
		expect(await addonsMatching({ type: 'font' })).toEqual([]);
	});

	test('filters by listed, delisted and open update status', async () => {
		expect(await addonsMatching({ status: 'listed' })).toEqual([
			'walk.delta',
			'walk.charlie',
			'walk.bravo',
			'walk.alpha',
		]);
		expect(await addonsMatching({ status: 'delisted' })).toEqual(['walk.echo']);
		expect(await addonsMatching({ status: 'pending_review' })).toEqual(['walk.charlie']);
		expect(await addonsMatching({ status: 'changes_requested' })).toEqual(['walk.alpha']);
	});

	test('filters by a maintainer, owners included', async () => {
		expect(await addonsMatching({ maintainer: helper })).toEqual(['walk.delta', 'walk.bravo']);
		expect(await addonsMatching({ maintainer: owner })).toEqual(addonOrder('desc'));
		expect(await addonsMatching({ maintainer: 'no-such-user' })).toEqual([]);
	});

	test('filters by an inclusive range of UTC days of first approval', async () => {
		expect(
			await addonsMatching({ publishedFrom: '1970-01-03', publishedTo: '1970-01-04' }),
		).toEqual(['walk.delta', 'walk.charlie', 'walk.bravo']);
		expect(await addonsMatching({ publishedFrom: '1970-01-04' })).toEqual([
			'walk.echo',
			'walk.delta',
		]);
		expect(await addonsMatching({ publishedTo: '1970-01-02' })).toEqual(['walk.alpha']);
		expect(
			await addonsMatching({ publishedFrom: '1970-01-05', publishedTo: '1970-01-02' }),
		).toEqual([]);
	});

	test.each<SortOrder>(['desc', 'asc'])(
		'walks a published range %s and back over the same pages',
		async (order) => {
			const search: AdminAddonsSearch = {
				order,
				publishedFrom: '1970-01-02',
				publishedTo: '1970-01-04',
			};
			const { forward, backward } = await walk((request) =>
				listAdminAddons(ctx, moderator, { ...search, ...request }),
			);
			const expected = addonOrder(order).filter((id) => id !== 'walk.echo');

			expect(forward.flat()).toEqual(expected);
			expect(backward).toEqual(forward.toReversed());
		},
	);

	test('combines every filter', async () => {
		expect(
			await addonsMatching({
				type: 'plugin',
				status: 'listed',
				maintainer: helper,
				publishedFrom: '1970-01-03',
				publishedTo: '1970-01-03',
				q: 'lark',
			}),
		).toEqual(['walk.bravo']);
		expect(
			await addonsMatching({ type: 'theme', status: 'delisted', maintainer: helper }),
		).toEqual([]);
		expect(await addonsMatching({ status: 'listed', maintainer: owner, order: 'asc' })).toEqual(
			['walk.alpha', 'walk.bravo', 'walk.charlie', 'walk.delta'],
		);
	});

	test('rejects an unknown status and a date that is not a day', () => {
		expect(adminAddonsSearchSchema.safeParse({ status: 'approved' }).success).toBe(false);
		expect(
			adminAddonsSearchSchema.safeParse({ publishedFrom: '1970-01-02T00:00' }).success,
		).toBe(false);
	});
});

describe('admin addon filter plans', () => {
	const middle = encodeCursor([2 * DAY + DAY / 2, 'walk.bravo']);
	const pages: AdminAddonsSearch[] = [{}, { cursor: middle }, { cursor: middle, dir: 'prev' }];

	test.each<[string, AdminAddonsSearch, RegExp]>([
		['listed', { status: 'listed' }, /^addon_listed_createdAt_idx$/],
		// On a few rows the planner may filter the general index past a cursor; both read in order.
		['delisted', { status: 'delisted' }, /^addon_(delisted_)?createdAt_idx$/],
		['type', { type: 'theme' }, /^addon_createdAt_idx$/],
		['listed type', { type: 'theme', status: 'listed' }, /^addon_listed_type_createdAt_idx$/],
		[
			'published range',
			{ publishedFrom: '1970-01-02', publishedTo: '1970-01-04', order: 'asc' },
			/^addon_createdAt_idx$/,
		],
	])('%s reads its index in order, without sorting', async (_name, filters, index) => {
		for (const page of pages) {
			const statement = queryAdminAddons(ctx, { ...filters, ...page });

			expect(indexes(await outerPlan(statement))).toContainEqual(
				expect.stringMatching(index),
			);
			expect(types(await outerPlan(statement))).not.toContain('Sort');
		}
	});

	test('a published range seeks to the cursor rather than to the range bound', async () => {
		const range: AdminAddonsSearch = { publishedFrom: '1970-01-02', publishedTo: '1970-01-04' };
		const cases: [AdminAddonsSearch, RegExp][] = [
			[range, /^\(\(created_at >= .+\) AND \(created_at < .+\)\)$/],
			[
				{ ...range, cursor: middle },
				/^\(\(created_at >= .+\) AND \(ROW\(created_at, id\) < ROW\(.+\)\)\)$/,
			],
			[
				{ ...range, cursor: middle, dir: 'prev' },
				/^\(\(created_at < .+\) AND \(ROW\(created_at, id\) > ROW\(.+\)\)\)$/,
			],
		];

		for (const [search, bounds] of cases) {
			const nodes = await plan(queryAdminAddons(ctx, search));
			const scan = nodes.find((node) => node['Index Name'] === 'addon_createdAt_idx');

			expect(scan?.['Index Cond']).toMatch(bounds);
		}
	});

	test.each<[string, AdminAddonsSearch, string]>([
		['maintainer', { maintainer: 'someone' }, 'addon_maintainer_userId_idx'],
		['pending review', { status: 'pending_review' }, 'submission_status_submittedAt_idx'],
		['changes requested', { status: 'changes_requested' }, 'submission_status_submittedAt_idx'],
		['search', { q: 'walk' }, 'addon_search_idx'],
	])('%s reads only the matching addons through its index', async (_name, filters, index) => {
		for (const page of pages) {
			const nodes = await plan(queryAdminAddons(ctx, { ...filters, ...page }));

			expect(indexes(nodes)).toContain(index);
			expect(types(nodes)).not.toContain('Seq Scan');
		}
	});
});
