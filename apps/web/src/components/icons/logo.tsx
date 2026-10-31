import type { ComponentProps } from 'react';

import cn from '~/lib/cn';

/**
 * @description The Unbound logo exactly as drawn in unbound-app/assets (`vector/logo.svg`), dither and glitch included.
 * @param props Image props; size it with a class, and it keeps its proportions.
 * @returns The logo image.
 */
function Logo({ alt = 'Unbound', className, ...props }: ComponentProps<'img'>) {
	return (
		<img
			src='/logo.svg'
			alt={alt}
			width={765}
			height={612}
			draggable={false}
			className={cn('object-contain select-none', className)}
			{...props}
		/>
	);
}

export default Logo;
