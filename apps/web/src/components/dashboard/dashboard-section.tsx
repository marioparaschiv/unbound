import type { ReactNode } from 'react';

import Text from '~/components/ui/text';

type DashboardSectionProps = {
	title: string;
	children: ReactNode;
};

function DashboardSection({ title, children }: DashboardSectionProps) {
	return (
		<section className='flex flex-col gap-2 min-w-0'>
			<Text as='h2' variant='text-sm' color='muted' className='font-medium'>
				{title}
			</Text>
			{children}
		</section>
	);
}

export default DashboardSection;
