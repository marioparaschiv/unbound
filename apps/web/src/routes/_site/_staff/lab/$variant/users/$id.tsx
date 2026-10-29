import { createFileRoute, notFound, redirect } from '@tanstack/react-router';

import { adminUserQuery } from '~/queries/admin-users/admin-users';
import LAB_VARIANTS from '~/components/lab/variants';
import { hasPermission } from '~/lib/auth/access';

function LabUser() {
	const { variant } = Route.useParams();
	const { UserPage } = LAB_VARIANTS[variant];

	return <UserPage />;
}

export const Route = createFileRoute('/_site/_staff/lab/$variant/users/$id')({
	beforeLoad: ({ context }) => {
		if (!hasPermission(context.user.role, { user: ['get'] })) {
			throw redirect({ to: '/' });
		}
	},
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
	component: LabUser,
});
