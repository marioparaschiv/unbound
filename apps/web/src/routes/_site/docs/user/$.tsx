import { createFileRoute } from '@tanstack/react-router';

import { getGuideHead, loadGuideRoute } from '~/lib/guides/guide-route';
import GuidePage from '~/components/guides/guide-page';

function UserGuidePage() {
	return <GuidePage {...Route.useLoaderData()} />;
}

export const Route = createFileRoute('/_site/docs/user/$')({
	loader: ({ params }) => loadGuideRoute('user', params._splat),
	head: ({ loaderData }) => getGuideHead(loaderData),
	component: UserGuidePage,
});
