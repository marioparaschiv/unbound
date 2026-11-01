import { createFileRoute } from '@tanstack/react-router';

import { getGuideHead, loadGuideRoute } from '~/lib/guides/guide-route';
import GuidePage from '~/components/guides/guide-page';

function DeveloperGuidePage() {
	return <GuidePage {...Route.useLoaderData()} />;
}

export const Route = createFileRoute('/_site/docs/developer/$')({
	loader: ({ params }) => loadGuideRoute('developer', params._splat),
	head: ({ loaderData }) => getGuideHead(loaderData),
	component: DeveloperGuidePage,
});
