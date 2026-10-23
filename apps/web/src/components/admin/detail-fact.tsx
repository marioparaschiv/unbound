import type { ReactNode } from 'react';

import Text from '~/components/ui/text';

type DetailFactProps = {
	label: string;
	children: ReactNode;
};

function DetailFact({ label, children }: DetailFactProps) {
	return (
		<div className='flex flex-col gap-0.5'>
			<Text variant='text-xs' color='muted'>
				{label}
			</Text>
			<Text as='div' variant='text-sm'>
				{children}
			</Text>
		</div>
	);
}

export default DetailFact;
