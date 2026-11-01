import { createFileRoute, redirect } from '@tanstack/react-router';

/** `/addons` opens its first tab, Plugins. */
export const Route = createFileRoute('/_site/addons/')({
	loader: () => {
		throw redirect({ to: '/addons/plugins' });
	},
});
