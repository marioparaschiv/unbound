import { adminAddonsSearchSchema, adminUsersSearchSchema } from '@unbound-app/contracts/admin';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { createServerFn } from '@tanstack/react-start';

import type { AdminAddonsPage } from '~/lib/admin-addons';
import type { AdminUsersPage } from '~/lib/admin-users';
import { listAdminAddons } from '~/lib/admin-addons';
import { listAdminUsers } from '~/lib/admin-users';
import { requireCaller } from '~/lib/api/caller';
import app from '~/lib/app';

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
 * @description Loads one page of the admin addons list for the signed-in staff member.
 * @returns The page and the cursors on either side of it.
 */
export const fetchAdminAddons = createServerFn({ method: 'GET' })
	.validator(adminAddonsSearchSchema)
	.handler(async ({ data }): Promise<AdminAddonsPage> => {
		const caller = await requireCaller(app, getRequestHeaders());

		return listAdminAddons(app, caller, data);
	});

export default { fetchAdminUsers, fetchAdminAddons };
