import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
import type { ComponentProps } from 'react';

import cn from '~/lib/cn';

const emptyMediaVariants = cva(
	'flex shrink-0 items-center justify-center mb-2 [&_svg]:pointer-events-none [&_svg]:shrink-0',
	{
		variants: {
			variant: {
				default: 'bg-transparent',
				icon: "bg-muted text-foreground flex size-10 shrink-0 items-center justify-center rounded-control [&_svg:not([class*='size-'])]:size-6",
			},
		},
		defaultVariants: {
			variant: 'default',
		},
	},
);

type EmptyMediaProps = ComponentProps<'div'> & VariantProps<typeof emptyMediaVariants>;

function Empty({ className, ...props }: ComponentProps<'div'>) {
	return (
		<div
			data-slot='empty'
			className={cn(
				'flex min-w-0 flex-1 flex-col items-center justify-center gap-6 rounded-surface border-dashed p-6 text-center text-balance md:p-12',
				className,
			)}
			{...props}
		/>
	);
}

function EmptyHeader({ className, ...props }: ComponentProps<'div'>) {
	return (
		<div
			data-slot='empty-header'
			className={cn('flex max-w-sm flex-col items-center gap-2 text-center', className)}
			{...props}
		/>
	);
}

function EmptyMedia({ className, variant = 'default', ...props }: EmptyMediaProps) {
	return (
		<div
			data-slot='empty-icon'
			data-variant={variant}
			className={cn(emptyMediaVariants({ variant, className }))}
			{...props}
		/>
	);
}

function EmptyTitle({ className, ...props }: ComponentProps<'div'>) {
	return (
		<div
			data-slot='empty-title'
			className={cn('text-lg font-medium tracking-tight', className)}
			{...props}
		/>
	);
}

function EmptyDescription({ className, ...props }: ComponentProps<'div'>) {
	return (
		<div
			data-slot='empty-description'
			className={cn(
				'text-muted-foreground [&>a:hover]:text-primary text-sm/relaxed [&>a]:underline [&>a]:underline-offset-4',
				className,
			)}
			{...props}
		/>
	);
}

function EmptyContent({ className, ...props }: ComponentProps<'div'>) {
	return (
		<div
			data-slot='empty-content'
			className={cn(
				'flex w-full max-w-sm min-w-0 flex-col items-center gap-4 text-sm text-balance',
				className,
			)}
			{...props}
		/>
	);
}

export { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyContent, EmptyMedia };

export default { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyContent, EmptyMedia };
