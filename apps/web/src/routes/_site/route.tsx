import { Outlet, createFileRoute } from '@tanstack/react-router';

import Footer from '~/components/footer';
import Header from '~/components/header';

function SiteLayout() {
	return (
		<>
			<div className='flex flex-col flex-1 overflow-clip dotted-bg'>
				<Header />
				<div className='mb-4' />
				<Outlet />
			</div>
			<Footer />
		</>
	);
}

export const Route = createFileRoute('/_site')({
	component: SiteLayout,
});
