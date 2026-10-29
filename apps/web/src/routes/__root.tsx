import { HeadContent, Scripts, createRootRouteWithContext } from '@tanstack/react-router';
import type { ReactNode } from 'react';

import PressSprings from '~/components/motion/press-springs';
import type { RouterContext } from '~/queries/query-client';
import { sessionQuery } from '~/queries/account/session';
import Toaster from '~/components/ui/sonner';
import stylesheet from '~/styles.css?url';

type RootDocumentProps = {
	children: ReactNode;
};

function RootDocument({ children }: RootDocumentProps) {
	return (
		<html className='dark' lang='en' suppressHydrationWarning>
			<head>
				<HeadContent />
			</head>
			<body className='flex flex-col min-h-dvh [view-transition-name:main-content]'>
				{children}
				<Toaster />
				<PressSprings />
				<Scripts />
			</body>
		</html>
	);
}

export const Route = createRootRouteWithContext<RouterContext>()({
	head: () => ({
		meta: [
			{ charSet: 'utf-8' },
			{ name: 'viewport', content: 'width=device-width, initial-scale=1' },
			{ title: 'Unbound' },
		],
		links: [
			{ rel: 'stylesheet', href: stylesheet },
			{ rel: 'icon', href: '/favicon-light.ico', media: '(prefers-color-scheme: light)' },
			{ rel: 'icon', href: '/favicon-dark.ico', media: '(prefers-color-scheme: dark)' },
			{
				rel: 'stylesheet',
				href: 'https://fonts.googleapis.com/css2?family=Geist:wght@400..700&family=Manrope:wght@600..700&display=swap',
			},
		],
	}),
	beforeLoad: async ({ context }) => ({
		session: await context.queryClient.fetchQuery(sessionQuery()),
	}),
	shellComponent: RootDocument,
});
