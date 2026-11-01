import { IconSparkle } from 'nucleo-micro-bold';
import type { ComponentProps } from 'react';

import cn from '~/lib/cn';

/** Two sparkles that twinkle out of step, set beside a sponsor's name. */
function SponsorSparkles({ className, ...props }: ComponentProps<'span'>) {
	return (
		<span
			aria-hidden
			className={cn('relative inline-block size-6 shrink-0 text-primary', className)}
			{...props}
		>
			<IconSparkle size={16} className='absolute bottom-0 left-0 animate-twinkle' />
			<IconSparkle
				size={10}
				className='absolute top-0 right-0 animate-twinkle [animation-delay:-1.2s]'
			/>
		</span>
	);
}

export default SponsorSparkles;
