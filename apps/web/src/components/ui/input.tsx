import type { ComponentProps } from 'react';

import cn from '~/lib/cn';

function Input({ className, type, ...props }: ComponentProps<'input'>) {
	return (
		<input
			type={type}
			data-slot='input'
			className={cn(
				'field file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground h-11 w-full min-w-0 px-4 py-1 text-base outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
				'focus-visible:ring-[3px] focus-visible:ring-halo',
				'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
				className,
			)}
			{...props}
		/>
	);
}

export default Input;
