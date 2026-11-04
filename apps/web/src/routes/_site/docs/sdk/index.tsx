import { createFileRoute } from '@tanstack/react-router';

import { redirectToLatestDocs } from '~/lib/docs/latest-docs';
import { docsManifestQuery } from '~/queries/docs/docs';

/** `/docs/sdk` opens the newest release of the reference, or `main` before the first release. */
export const Route = createFileRoute('/_site/docs/sdk/')({
	loader: ({ context }) =>
		redirectToLatestDocs((pkg) => context.queryClient.ensureQueryData(docsManifestQuery(pkg))),
});
