import type { ComponentProps } from 'react';

import cn from '~/lib/cn';

function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
	return (
		<textarea
			data-slot='textarea'
			className={cn(
				'border-input placeholder:text-muted-foreground focus-visible:border-halo focus-visible:ring-halo aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 flex field-sizing-content min-h-16 w-full rounded-control border bg-muted/50 px-3.5 py-2.5 text-base shadow-field transition-[color,box-shadow,border-color] duration-(--press-duration) outline-none focus-visible:ring-4 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
				className,
			)}
			{...props}
		/>
	);
}

export default Textarea;
