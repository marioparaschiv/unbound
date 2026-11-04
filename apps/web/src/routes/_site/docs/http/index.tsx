import { createFileRoute, redirect } from '@tanstack/react-router';

/** The HTTP reference's first home; it now lives at `/docs/api`. */
export const Route = createFileRoute('/_site/docs/http/')({
	loader: () => {
		throw redirect({ to: '/docs/api', statusCode: 301 });
	},
});
