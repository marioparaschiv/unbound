import { adminUsersSearchSchema, type AdminUsersSearch } from '@unbound-app/contracts/admin';
import { createFileRoute, redirect } from '@tanstack/react-router';

import { schemaValidator, type Validator } from '~/lib/schema-validator';
import { adminUsersQuery } from '~/queries/admin-users/admin-users';
import { STAFF_SECTIONS } from '~/lib/auth/staff-areas';
import UsersPage from '~/components/staff/users-page';
import { hasPermission } from '~/lib/auth/access';

// Annotated, or the search type loops through the page that reads it back and collapses to `{}`.
const validateSearch: Validator<AdminUsersSearch> = schemaValidator(adminUsersSearchSchema);

export const Route = createFileRoute('/_site/_staff/admin/users/')({
	head: () => ({ meta: [{ title: 'Unbound | Users' }] }),
	validateSearch,
	beforeLoad: ({ context }) => {
		if (!hasPermission(context.user.role, STAFF_SECTIONS.users.permissions)) {
			throw redirect({ to: '/' });
		}
	},
	loaderDeps: ({ search }) => search,
	loader: async ({ context, deps, cause }) => {
		// A search or page change on the page keeps the old page up while the list fetches the new one.
		if (cause === 'stay') return;

		await context.queryClient.ensureQueryData(adminUsersQuery(deps));
	},
	component: UsersPage,
});
