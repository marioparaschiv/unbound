import { createFileRoute } from '@tanstack/react-router';

import { crashIssueUrl } from '~/lib/crash-issues/issue-link';
import { getApp } from '~/lib/app';

export const Route = createFileRoute('/c/$number')({
	server: {
		handlers: {
			GET: ({ params }) => {
				const url = crashIssueUrl(getApp().env.CRASH_ISSUES_REPOSITORY, params.number);

				return url
					? Response.redirect(url, 302)
					: new Response('No such crash issue.', { status: 404 });
			},
		},
	},
});
