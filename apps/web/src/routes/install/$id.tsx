import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { createUnboundLink } from '@unbound-app/contracts/links';
import { useEffect } from 'react';

import { canOpenUnboundLinks } from '~/lib/unbound-links';

/** Hands an addon to the client from an https link, which Discord buttons allow, then shows its page. */
function InstallRedirect() {
	const { id } = Route.useParams();
	const navigate = useNavigate();

	useEffect(() => {
		// Only iOS registers `unbound://`; elsewhere the addon page's install button explains the way in.
		if (canOpenUnboundLinks(navigator)) {
			window.location.href = createUnboundLink({ action: 'install', id });
		}

		void navigate({ to: '/addons/$id', params: { id }, search: {}, replace: true });
	}, [id, navigate]);

	return null;
}

export const Route = createFileRoute('/install/$id')({
	head: () => ({
		meta: [{ title: 'Unbound | Install' }, { name: 'robots', content: 'noindex' }],
	}),
	component: InstallRedirect,
});
