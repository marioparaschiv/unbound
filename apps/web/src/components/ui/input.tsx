import type { ComponentProps } from 'react';

import cn from '~/lib/cn';

function Input({ className, type, ...props }: ComponentProps<'input'>) {
	return (
		<input
			type={type}
			data-slot='input'
			className={cn(
				'file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-10 w-full min-w-0 rounded-control border bg-muted/50 px-3.5 py-1 text-base shadow-field transition-[color,box-shadow,border-color] duration-(--press-duration) outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
				'focus-visible:border-halo focus-visible:ring-4 focus-visible:ring-halo',
				'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
				className,
			)}
			{...props}
		/>
	);
}

export default Input;
