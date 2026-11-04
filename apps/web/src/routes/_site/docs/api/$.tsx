import { createFileRoute, redirect } from '@tanstack/react-router';

/** The SDK reference lived under `/docs/api` before the HTTP reference took it; old links keep working. */
export const Route = createFileRoute('/_site/docs/api/$')({
	loader: ({ params }) => {
		throw redirect({ href: `/docs/sdk/${params._splat ?? ''}`, statusCode: 301 });
	},
});
