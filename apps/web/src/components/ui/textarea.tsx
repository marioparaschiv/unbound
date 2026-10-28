import type { ComponentProps } from 'react';

import cn from '~/lib/cn';

function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
	return (
		<textarea
			data-slot='textarea'
			className={cn(
				'field placeholder:text-muted-foreground focus-visible:ring-halo aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive flex field-sizing-content min-h-24 w-full px-4 py-3 text-base outline-none focus-visible:ring-4 disabled:cursor-not-allowed disabled:opacity-50 md:text-[15px]',
				className,
			)}
			{...props}
		/>
	);
}

export default Textarea;
