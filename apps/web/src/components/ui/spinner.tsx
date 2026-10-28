import { IconLoader } from 'nucleo-micro-bold';
import type { ComponentProps } from 'react';

import cn from '~/lib/cn';

function Spinner({ className, ...props }: ComponentProps<typeof IconLoader>) {
	return (
		<IconLoader
			role='status'
			aria-label='Loading'
			className={cn('size-4 animate-spin', className)}
			{...props}
		/>
	);
}

export default Spinner;
