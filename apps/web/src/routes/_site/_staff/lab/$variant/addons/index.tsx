import { adminAddonsSearchSchema } from '@unbound-app/contracts/admin';
import { createFileRoute, redirect } from '@tanstack/react-router';

import { adminAddonsQuery } from '~/queries/admin-addons/admin-addons';
import { STAFF_SECTIONS } from '~/lib/auth/staff-areas';
import LAB_VARIANTS from '~/components/lab/variants';
import { hasPermission } from '~/lib/auth/access';

function LabAddons() {
	const { variant } = Route.useParams();
	const { AddonsPage } = LAB_VARIANTS[variant];

	return <AddonsPage />;
}

export const Route = createFileRoute('/_site/_staff/lab/$variant/addons/')({
	head: () => ({ meta: [{ title: 'Unbound | Addons' }] }),
	validateSearch: adminAddonsSearchSchema,
	beforeLoad: ({ context }) => {
		if (!hasPermission(context.user.role, STAFF_SECTIONS.addons.permissions)) {
			throw redirect({ to: '/' });
		}
	},
	loaderDeps: ({ search }) => search,
	loader: async ({ context, deps, cause }) => {
		if (cause === 'stay') return;

		await context.queryClient.ensureQueryData(adminAddonsQuery(deps));
	},
	component: LabAddons,
});
