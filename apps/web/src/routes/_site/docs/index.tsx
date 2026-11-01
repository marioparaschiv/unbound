import { createFileRoute, redirect } from '@tanstack/react-router';

/** `/docs` opens the user guide's first page. */
export const Route = createFileRoute('/_site/docs/')({
	loader: () => {
		throw redirect({ to: '/docs/user/$', params: { _splat: 'overview' } });
	},
});
