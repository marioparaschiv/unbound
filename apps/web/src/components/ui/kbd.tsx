import type { ComponentProps } from 'react';

import cn from '~/lib/cn';

/**
 * @description A keyboard key, raised like the segmented pill so a shortcut reads as something to press.
 * @param props The key's label and any `kbd` props.
 * @returns The key.
 */
function Kbd({ className, ...props }: ComponentProps<'kbd'>) {
	return (
		<kbd
			data-slot='kbd'
			className={cn(
				'inline-flex justify-center items-center gap-0.5 bg-accent shadow-key px-1.5 rounded-item corner-continuous min-w-6 h-6 font-medium font-sans text-[11px] text-muted-foreground leading-none select-none shrink-0',
				className,
			)}
			{...props}
		/>
	);
}

export default Kbd;
