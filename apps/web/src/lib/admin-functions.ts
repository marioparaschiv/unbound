import { adminAddonsSearchSchema, adminUsersSearchSchema } from '@unbound-app/contracts/admin';
import type { UserSummary } from '@unbound-app/contracts/account';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { createServerFn } from '@tanstack/react-start';

import { getUserSummary, listAdminUsers } from '~/lib/admin-users';
import type { AdminAddonsPage } from '~/lib/admin-addons';
import type { AdminUsersPage } from '~/lib/admin-users';
import { listAdminAddons } from '~/lib/admin-addons';
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

export default { fetchAdminUsers, fetchAdminAddons };
