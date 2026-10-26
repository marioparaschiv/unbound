import { sql } from 'drizzle-orm';

import type { AppContext } from '~/lib/context';
import { ApiError } from '~/lib/api/errors';
import { rateLimit } from '~/db/schema';
import one from '~/db/one';

export type RateLimitOptions = {
	/** Distinct from Better Auth's own keys, which start with the client IP. */
	key: string;
	windowSeconds: number;
	max: number;
};

/**
 * @description Counts a request against a fixed window in the `rate_limit` table Better Auth also
 * stores its limits in, failing with `rate_limited` once the window's budget is spent. One upsert.
 * @param ctx The application context.
 * @param options The bucket key, window length and request budget.
 * @returns Resolves when the request is within budget.
 */
export async function consumeRateLimit(ctx: AppContext, options: RateLimitOptions): Promise<void> {
	const now = ctx.now().getTime();
	const windowStart = now - options.windowSeconds * 1000;
	const expired = sql`${rateLimit.lastRequest} <= ${windowStart}`;

	// ON CONFLICT DO UPDATE locks the key's row, so concurrent requests count one after another.
	const { count } = one(
		await ctx.db
			.insert(rateLimit)
			.values({ id: Bun.randomUUIDv7(), key: options.key, count: 1, lastRequest: now })
			.onConflictDoUpdate({
				target: rateLimit.key,
				set: {
					count: sql`case when ${expired} then 1 else ${rateLimit.count} + 1 end`,
					lastRequest: sql`case when ${expired} then ${now} else ${rateLimit.lastRequest} end`,
				},
			})
			.returning({ count: rateLimit.count }),
	);

	if (count > options.max) {
		throw new ApiError('rate_limited', 'Too many requests. Try again later.');
	}
}

export default { consumeRateLimit };
