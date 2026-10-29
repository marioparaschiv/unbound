import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_site/_staff/lab/')({
	beforeLoad: () => {
		throw redirect({ to: '/lab/$variant/review', params: { variant: 'a' } });
	},
});
