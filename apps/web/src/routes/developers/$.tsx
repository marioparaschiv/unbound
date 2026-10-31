import { createFileRoute, redirect } from '@tanstack/react-router';

// Profiles lived under `/developers` before, so shared links still resolve.
export const Route = createFileRoute('/developers/$')({
	beforeLoad: ({ params, search }) => {
		if (params._splat) {
			throw redirect({
				to: '/profiles/$discordId',
				params: { discordId: params._splat },
				statusCode: 301,
			});
		}

		throw redirect({ to: '/team', search, statusCode: 301 });
	},
});
