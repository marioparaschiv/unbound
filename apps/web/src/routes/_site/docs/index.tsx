import { createFileRoute, notFound, redirect } from '@tanstack/react-router';
import { getLatestDocsVersion } from '@unbound-app/contracts/docs';

import { docsManifestQuery } from '~/queries/docs/docs';

/** `/docs` opens the newest release of the API reference, or `main` before the first release. */
export const Route = createFileRoute('/_site/docs/')({
	loader: async ({ context }) => {
		const manifest = await context.queryClient.ensureQueryData(docsManifestQuery('api'));

		if (!manifest) {
			throw notFound();
		}

		throw redirect({
			to: '/docs/$package/$version',
			params: { package: manifest.package, version: getLatestDocsVersion(manifest) },
		});
	},
});
