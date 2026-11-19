import { and, countDistinct, eq } from 'drizzle-orm';

import type { AppContext } from '~/lib/context';
import { crashReport } from '~/db/schema';

/** How many installs reported one crash, in all and on one client version. */
export type CrashSpread = { installs: number; versionInstalls: number };

/**
 * @description Counts the installs that reported a crash, by its fingerprint, so a reporter can tell a crash only they
 * hit from one many people hit. Reports without an install id are not counted.
 * @param ctx The app context.
 * @param fingerprint The crash's fingerprint.
 * @param clientVersion The reporting client's version.
 * @returns The installs in all and on that version.
 */
export async function crashSpread(
	ctx: AppContext,
	fingerprint: string,
	clientVersion: string,
): Promise<CrashSpread> {
	const [all] = await ctx.db
		.select({ installs: countDistinct(crashReport.installId) })
		.from(crashReport)
		.where(eq(crashReport.fingerprint, fingerprint));
	const [onVersion] = await ctx.db
		.select({ installs: countDistinct(crashReport.installId) })
		.from(crashReport)
		.where(
			and(
				eq(crashReport.fingerprint, fingerprint),
				eq(crashReport.clientVersion, clientVersion),
			),
		);

	return { installs: all?.installs ?? 0, versionInstalls: onVersion?.installs ?? 0 };
}
