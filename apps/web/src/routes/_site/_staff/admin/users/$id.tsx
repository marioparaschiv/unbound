import { createFileRoute, notFound, redirect } from '@tanstack/react-router';

import { adminUserQuery } from '~/queries/admin-users/admin-users';
import UserPage from '~/components/staff/user-page';
import { hasPermission } from '~/lib/auth/access';

export const Route = createFileRoute('/_site/_staff/admin/users/$id')({
	beforeLoad: ({ context }) => {
		if (!hasPermission(context.user.role, { user: ['get'] })) {
			throw redirect({ to: '/' });
		}
	},
	// `loader` comes before `head` so `head` can infer the loader data's type.
	loader: async ({ context, params }) => {
		const view = await context.queryClient.ensureQueryData(adminUserQuery(params.id));

		if (!view) {
			throw notFound();
		}

		return view;
	},
	head: ({ loaderData }) => ({
		meta: [{ title: `Unbound | ${loaderData?.user.name ?? 'User'}` }],
	}),
	component: UserPage,
});
