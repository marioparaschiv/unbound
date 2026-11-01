import { createFileRoute, redirect } from '@tanstack/react-router';

import { marketplaceSearchSchema } from '~/lib/addon-filters';

/** The old `/themes` listing, now the Themes tab of `/addons`; old links keep their search. */
export const Route = createFileRoute('/_site/themes')({
	validateSearch: marketplaceSearchSchema,
	beforeLoad: ({ search }) => {
		throw redirect({ to: '/addons/themes', search, statusCode: 301 });
	},
});
