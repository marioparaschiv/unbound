import { Outlet, createFileRoute } from '@tanstack/react-router';

import LabSwitcher from '~/components/lab/lab-switcher';

function LabChrome() {
	return (
		<>
			<LabSwitcher />
			<Outlet />
		</>
	);
}

export const Route = createFileRoute('/_site/_staff/lab')({
	component: LabChrome,
});
