import { createFileRoute } from '@tanstack/react-router';

import { redirectToLatestDocs } from '~/lib/docs/latest-docs';
import { docsManifestQuery } from '~/queries/docs/docs';

/** `/docs/api` opens the newest release of the reference, or `main` before the first release. */
export const Route = createFileRoute('/_site/docs/$package/')({
	loader: ({ context, params }) =>
		redirectToLatestDocs(
			(pkg) => context.queryClient.ensureQueryData(docsManifestQuery(pkg)),
			params.package,
		),
});
