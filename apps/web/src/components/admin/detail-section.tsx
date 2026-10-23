import type { ReactNode } from 'react';

import Text from '~/components/ui/text';

type DetailSectionProps = {
	title: string;
	children: ReactNode;
};

function DetailSection({ title, children }: DetailSectionProps) {
	return (
		<section className='flex flex-col gap-3'>
			<Text variant='heading-sm'>{title}</Text>
			{children}
		</section>
	);
}

export default DetailSection;
