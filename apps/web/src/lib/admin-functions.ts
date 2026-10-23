import {
	adminAddonsSearchSchema,
	adminUsersSearchSchema,
	moderationEventPageRequestSchema,
} from '@unbound-app/contracts/admin';
import { userSummarySchema } from '@unbound-app/contracts/account';
import type { UserSummary } from '@unbound-app/contracts/account';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { addonIdSchema } from '@unbound-app/contracts/manifest';
import { createServerFn } from '@tanstack/react-start';

import { getAdminUser, getUserSummary, listAdminUsers } from '~/lib/admin-users';
import type { AdminUserView, AdminUsersPage } from '~/lib/admin-users';
import type { EventTimeline } from '~/lib/moderation-events';
import { getEventTimeline } from '~/lib/moderation-events';
import type { AdminAddonsPage } from '~/lib/admin-addons';
import type { AdminAddonView } from '~/lib/admin-addon';
import { listAdminAddons } from '~/lib/admin-addons';
import { getAdminAddon } from '~/lib/admin-addon';
import { requireCaller } from '~/lib/api/caller';
import app from '~/lib/app';

export type AdminAddonsView = AdminAddonsPage & {
	/** The user the `maintainer` filter names, for the filter bar; `null` without one or for an unknown id. */
	maintainer: UserSummary | null;
};

/**
 * @description Loads one page of the admin users list for the signed-in staff member.
 * @returns The page and the cursors on either side of it.
 */
export const fetchAdminUsers = createServerFn({ method: 'GET' })
	.validator(adminUsersSearchSchema)
	.handler(async ({ data }): Promise<AdminUsersPage> => {
		const caller = await requireCaller(app, getRequestHeaders());

		return listAdminUsers(app, caller, data);
	});

/**
 * @description Loads one page of the admin addons list for the signed-in staff member, with the user
 * its maintainer filter names.
 * @returns The page, the cursors on either side of it and the filtered maintainer.
 */
export const fetchAdminAddons = createServerFn({ method: 'GET' })
	.validator(adminAddonsSearchSchema)
	.handler(async ({ data }): Promise<AdminAddonsView> => {
		const caller = await requireCaller(app, getRequestHeaders());
		const [page, maintainer] = await Promise.all([
			listAdminAddons(app, caller, data),
			data.maintainer ? getUserSummary(app, caller, data.maintainer) : undefined,
		]);

		return { ...page, maintainer: maintainer ?? null };
	});

/**
 * @description Loads the admin page of one addon for the signed-in staff member.
 * @returns The addon's view, or `null` when no approved addon has the id.
 */
export const fetchAdminAddon = createServerFn({ method: 'GET' })
	.validator(addonIdSchema)
	.handler(async ({ data }): Promise<AdminAddonView | null> => {
		const caller = await requireCaller(app, getRequestHeaders());

		return (await getAdminAddon(app, caller, data)) ?? null;
	});

/**
 * @description Loads the admin page of one user for the signed-in staff member.
 * @returns The user's view, or `null` when no user has the id.
 */
export const fetchAdminUser = createServerFn({ method: 'GET' })
	.validator(userSummarySchema.shape.id)
	.handler(async ({ data }): Promise<AdminUserView | null> => {
		const caller = await requireCaller(app, getRequestHeaders());

		return (await getAdminUser(app, caller, data)) ?? null;
	});

/**
 * @description Loads an older page of a subject's moderation events for the signed-in staff member.
 * @returns The page and the users it names.
 */
export const fetchEvents = createServerFn({ method: 'GET' })
	.validator(moderationEventPageRequestSchema)
	.handler(async ({ data }): Promise<EventTimeline> => {
		const caller = await requireCaller(app, getRequestHeaders());

		return getEventTimeline(app, caller, data.subject, data.before);
	});

export default { fetchAdminUsers, fetchAdminAddons, fetchAdminAddon, fetchAdminUser, fetchEvents };
