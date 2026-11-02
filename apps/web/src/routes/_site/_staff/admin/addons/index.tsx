import { adminAddonsSearchSchema, type AdminAddonsSearch } from '@unbound-app/contracts/admin';
import { createFileRoute, redirect } from '@tanstack/react-router';

import { schemaValidator, type Validator } from '~/lib/schema-validator';
import { adminAddonsQuery } from '~/queries/admin-addons/admin-addons';
import AddonsPage from '~/components/staff/addons-page';
import { STAFF_SECTIONS } from '~/lib/auth/staff-areas';
import { hasPermission } from '~/lib/auth/access';

// Annotated, or the search type loops through the page that reads it back and collapses to `{}`.
const validateSearch: Validator<AdminAddonsSearch> = schemaValidator(adminAddonsSearchSchema);

export const Route = createFileRoute('/_site/_staff/admin/addons/')({
	head: () => ({ meta: [{ title: 'Unbound | Addons' }] }),
	validateSearch,
	beforeLoad: ({ context }) => {
		if (!hasPermission(context.user.role, STAFF_SECTIONS.addons.permissions)) {
			throw redirect({ to: '/' });
		}
	},
	loaderDeps: ({ search }) => search,
	loader: async ({ context, deps, cause }) => {
		// A search, filter or page change on the page keeps the old page up while the list fetches the new one.
		if (cause === 'stay') return;

		await context.queryClient.ensureQueryData(adminAddonsQuery(deps));
	},
	component: AddonsPage,
});
