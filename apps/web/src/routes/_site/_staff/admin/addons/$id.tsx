import { createFileRoute, notFound, redirect } from '@tanstack/react-router';

import { adminAddonQuery } from '~/queries/admin-addons/admin-addons';
import { STAFF_SECTIONS } from '~/lib/auth/staff-areas';
import AddonPage from '~/components/staff/addon-page';
import { hasPermission } from '~/lib/auth/access';

export const Route = createFileRoute('/_site/_staff/admin/addons/$id')({
	beforeLoad: ({ context }) => {
		if (!hasPermission(context.user.role, STAFF_SECTIONS.addons.permissions)) {
			throw redirect({ to: '/' });
		}
	},
	// `loader` comes before `head` so `head` can infer the loader data's type.
	loader: async ({ context, params }) => {
		const view = await context.queryClient.ensureQueryData(adminAddonQuery(params.id));

		if (!view) {
			throw notFound();
		}

		return view;
	},
	head: ({ loaderData }) => ({
		meta: [{ title: `Unbound | ${loaderData?.addon.name ?? 'Addon'}` }],
	}),
	component: AddonPage,
});
