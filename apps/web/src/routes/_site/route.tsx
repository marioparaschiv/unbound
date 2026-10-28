import { Outlet, createFileRoute } from '@tanstack/react-router';

import Footer from '~/components/footer';
import Header from '~/components/header';

function SiteLayout() {
	return (
		<>
			<div className='flex flex-col flex-1 overflow-clip dotted-bg'>
				<Header />
				{/* The page rhythm: 48px below the header bar, 96px above the footer. */}
				<div className='flex flex-col flex-1 pt-12 pb-24'>
					<Outlet />
				</div>
			</div>
			<Footer />
		</>
	);
}

export const Route = createFileRoute('/_site')({
	component: SiteLayout,
});
