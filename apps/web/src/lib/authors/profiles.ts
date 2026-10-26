import { createLogger } from '@unbound-app/logger';
import { inArray } from 'drizzle-orm';

import type { DiscordId, DiscordLookup, DiscordUser } from '~/lib/authors/discord-users';
import { fetchDiscordUser } from '~/lib/authors/discord-users';
import { listListedAddons } from '~/lib/addons';
import type { AppContext } from '~/lib/context';
import { discordProfile } from '~/db/schema';

const logger = createLogger('Web', 'Authors');

/** One cached row as the domain sees it. */
export type CachedProfile =
	| { kind: 'found'; user: DiscordUser; fetchedAt: Date }
	| { kind: 'missing'; discordId: DiscordId; fetchedAt: Date };

export type SweepResult = {
	refreshed: number;
	/** Set when the sweep stopped early: how long to wait before the next one. */
	retryAfterMs: number | null;
};

export type ProfileRefresher = {
	/** Asks for a sweep. Returns at once; merged into a running sweep; ignored while paused. */
	kick(): void;
	stop(): void;
};

type StoredLookup = Extract<DiscordLookup, { kind: 'found' | 'missing' }>;

type RefresherState =
	| { kind: 'idle' }
	| { kind: 'running'; again: boolean }
	| { kind: 'paused' }
	| { kind: 'stopped' };

/** How many lookups in a row may fail before a sweep gives up and backs off. */
const MAX_CONSECUTIVE_FAILURES = 3;

const FAILURE_BACKOFF_MS = 5 * 60_000;

let active: ProfileRefresher | undefined;

/**
 * @description Reads cached Discord profiles, fresh or stale. Never touches the network.
 * @param ctx The application context.
 * @param ids The Discord ids.
 * @returns Each cached profile by id; ids never fetched are absent.
 */
export async function readProfiles(
	ctx: AppContext,
	ids: DiscordId[],
): Promise<Map<DiscordId, CachedProfile>> {
	const profiles = new Map<DiscordId, CachedProfile>();

	if (ids.length === 0) {
		return profiles;
	}

	const rows = await ctx.db
		.select()
		.from(discordProfile)
		.where(inArray(discordProfile.discordId, ids));
	const byId = new Map(rows.map((row) => [row.discordId, row]));

	for (const id of ids) {
		const row = byId.get(id);

		if (!row) {
			continue;
		}

		profiles.set(
			id,
			row.username === null
				? { kind: 'missing', discordId: id, fetchedAt: row.fetchedAt }
				: {
						kind: 'found',
						user: {
							id,
							username: row.username,
							globalName: row.globalName,
							avatarHash: row.avatarHash,
						},
						fetchedAt: row.fetchedAt,
					},
		);
	}

	return profiles;
}

/**
 * @description Decides whether a profile needs fetching: never fetched, or older than
 * `DISCORD_PROFILE_TTL_SECONDS`.
 * @param ctx The application context.
 * @param profile The cached profile, if any.
 * @returns Whether a sweep should fetch it.
 */
export function isStale(ctx: AppContext, profile: CachedProfile | undefined): boolean {
	if (!profile) {
		return true;
	}

	const age = ctx.now().getTime() - profile.fetchedAt.getTime();

	return age >= ctx.env.DISCORD_PROFILE_TTL_SECONDS * 1000;
}

async function listAuthorIds(ctx: AppContext): Promise<DiscordId[]> {
	const addons = await listListedAddons(ctx);
	const ids = new Set<DiscordId>();

	for (const entry of addons) {
		for (const author of entry.latestVersion.manifest.authors) {
			if (author.id !== '0') {
				ids.add(author.id);
			}
		}
	}

	return [...ids];
}

async function writeProfile(ctx: AppContext, id: DiscordId, lookup: StoredLookup) {
	const columns = {
		username: lookup.kind === 'found' ? lookup.user.username : null,
		globalName: lookup.kind === 'found' ? lookup.user.globalName : null,
		avatarHash: lookup.kind === 'found' ? lookup.user.avatarHash : null,
		fetchedAt: ctx.now(),
	};

	await ctx.db
		.insert(discordProfile)
		.values({ discordId: id, ...columns })
		.onConflictDoUpdate({ target: discordProfile.discordId, set: columns });
}

/**
 * @description Runs one sweep: fetches every listed author whose profile is missing or stale, missing
 * ones first, then the oldest. Each row is written on its own, so a stop halfway loses nothing.
 * @param ctx The application context.
 * @returns How many profiles were written, and how long to wait when Discord rate-limited or failed.
 */
export async function refreshDiscordProfiles(ctx: AppContext): Promise<SweepResult> {
	const ids = await listAuthorIds(ctx);
	const cached = await readProfiles(ctx, ids);
	const due = ids
		.filter((id) => isStale(ctx, cached.get(id)))
		.sort(
			(a, b) =>
				(cached.get(a)?.fetchedAt.getTime() ?? 0) -
				(cached.get(b)?.fetchedAt.getTime() ?? 0),
		);

	let refreshed = 0;
	let failures = 0;

	for (const id of due) {
		const lookup = await fetchDiscordUser(ctx.env, id);

		if (lookup.kind === 'rate_limited') {
			return { refreshed, retryAfterMs: lookup.retryAfterMs };
		}

		if (lookup.kind === 'failed') {
			failures += 1;

			if (failures === MAX_CONSECUTIVE_FAILURES) {
				return { refreshed, retryAfterMs: FAILURE_BACKOFF_MS };
			}

			continue;
		}

		await writeProfile(ctx, id, lookup);
		failures = 0;
		refreshed += 1;
	}

	return { refreshed, retryAfterMs: null };
}

function createProfileRefresher(ctx: AppContext): ProfileRefresher {
	let state: RefresherState = { kind: 'idle' };
	let resumeTimer: Timer | undefined;

	function pause(ms: number) {
		if (state.kind === 'stopped') return;

		state = { kind: 'paused' };
		resumeTimer = setTimeout(() => {
			if (state.kind !== 'paused') return;

			state = { kind: 'idle' };
			kick();
		}, ms);
	}

	async function run() {
		state = { kind: 'running', again: false };

		try {
			while (state.kind === 'running') {
				state.again = false;

				const { refreshed, retryAfterMs } = await refreshDiscordProfiles(ctx);

				if (refreshed > 0) {
					logger.info(`Refreshed ${refreshed} Discord profiles.`);
				}

				if (retryAfterMs !== null) {
					pause(retryAfterMs);
				} else if (state.kind === 'running' && !state.again) {
					state = { kind: 'idle' };
				}
			}
		} catch (error) {
			logger.error('Failed to refresh Discord profiles:', error);
			pause(FAILURE_BACKOFF_MS);
		}
	}

	function kick() {
		if (state.kind === 'running') {
			state.again = true;

			return;
		}

		if (state.kind === 'idle') {
			void run();
		}
	}

	return {
		kick,
		stop() {
			state = { kind: 'stopped' };
			clearTimeout(resumeTimer);
		},
	};
}

/**
 * @description Starts the process's Discord profile refresher: sweeps now, every
 * `DISCORD_PROFILE_SWEEP_INTERVAL_SECONDS`, and whenever {@link requestProfileRefresh} asks.
 * @param ctx The application context.
 * @returns The refresher, whose `stop` also ends the periodic sweep.
 */
export function startProfileRefresher(ctx: AppContext): ProfileRefresher {
	active?.stop();

	const refresher = createProfileRefresher(ctx);
	const interval = setInterval(
		() => refresher.kick(),
		ctx.env.DISCORD_PROFILE_SWEEP_INTERVAL_SECONDS * 1000,
	);

	const handle: ProfileRefresher = {
		kick: refresher.kick,
		stop() {
			clearInterval(interval);
			refresher.stop();

			if (active === handle) {
				active = undefined;
			}
		},
	};

	active = handle;
	handle.kick();

	return handle;
}

/**
 * @description Asks the running refresher for a sweep without waiting for it. Does nothing when none
 * was started, so tests and scripts never reach Discord.
 */
export function requestProfileRefresh() {
	active?.kick();
}

export default {
	readProfiles,
	isStale,
	refreshDiscordProfiles,
	startProfileRefresher,
	requestProfileRefresh,
};
