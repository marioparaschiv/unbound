import { createFileRoute, redirect } from '@tanstack/react-router';

import { marketplaceSearchSchema } from '~/lib/addon-filters';
import { schemaValidator } from '~/lib/schema-validator';

/** The old `/plugins` listing, now the Plugins tab of `/addons`; old links keep their search. */
export const Route = createFileRoute('/_site/plugins')({
	validateSearch: schemaValidator(marketplaceSearchSchema),
	beforeLoad: ({ search }) => {
		throw redirect({ to: '/addons/plugins', search, statusCode: 301 });
	},
});
