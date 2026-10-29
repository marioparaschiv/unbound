import { adminUsersSearchSchema } from '@unbound-app/contracts/admin';
import { createFileRoute, redirect } from '@tanstack/react-router';

import { adminUsersQuery } from '~/queries/admin-users/admin-users';
import { STAFF_SECTIONS } from '~/lib/auth/staff-areas';
import LAB_VARIANTS from '~/components/lab/variants';
import { hasPermission } from '~/lib/auth/access';

function LabUsers() {
	const { variant } = Route.useParams();
	const { UsersPage } = LAB_VARIANTS[variant];

	return <UsersPage />;
}

export const Route = createFileRoute('/_site/_staff/lab/$variant/users/')({
	head: () => ({ meta: [{ title: 'Unbound | Users' }] }),
	validateSearch: adminUsersSearchSchema,
	beforeLoad: ({ context }) => {
		if (!hasPermission(context.user.role, STAFF_SECTIONS.users.permissions)) {
			throw redirect({ to: '/' });
		}
	},
	loaderDeps: ({ search }) => search,
	loader: async ({ context, deps, cause }) => {
		if (cause === 'stay') return;

		await context.queryClient.ensureQueryData(adminUsersQuery(deps));
	},
	component: LabUsers,
});
