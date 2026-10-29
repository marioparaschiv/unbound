import type { AddonIconResponse } from '@unbound-app/contracts/addons';
import { eq } from 'drizzle-orm';

import { isAddonIcon } from '~/lib/addon-icons';
import type { AppContext } from '~/lib/context';
import type { Caller } from '~/lib/api/caller';
import { ApiError } from '~/lib/api/errors';
import { addon } from '~/db/schema';

/**
 * @description Sets the icon the website shows for an addon the caller maintains. The app keeps the
 * manifest's icon; this one is only drawn on the website.
 * @param ctx The application context.
 * @param caller A maintainer of the addon.
 * @param addonId The addon id.
 * @param icon The Nucleo Micro Bold export name, or `null` for the type's default.
 * @returns The icon after the change.
 */
export async function setAddonIcon(
	ctx: AppContext,
	caller: Caller,
	addonId: string,
	icon: string | null,
): Promise<AddonIconResponse> {
	if (icon !== null && !isAddonIcon(icon)) {
		throw new ApiError('invalid_request', `${icon} is not an icon you can pick.`);
	}

	const membership = await ctx.db.query.addonMaintainer.findFirst({
		where: { addonId, userId: caller.user.id },
		columns: { role: true },
	});

	if (!membership) {
		const row = await ctx.db.query.addon.findFirst({
			where: { id: addonId },
			columns: { id: true },
		});

		if (!row) {
			throw new ApiError('not_found', `Addon ${addonId} does not exist.`);
		}

		throw new ApiError('not_maintainer', `You are not a maintainer of ${addonId}.`);
	}

	await ctx.db.update(addon).set({ icon }).where(eq(addon.id, addonId));

	return { icon };
}

export default { setAddonIcon };
