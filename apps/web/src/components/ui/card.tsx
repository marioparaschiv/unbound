import type { ComponentProps } from 'react';

import type { TextProps } from '~/components/ui/text';
import Text from '~/components/ui/text';
import cn from '~/lib/cn';

function Card({ className, ...props }: ComponentProps<'div'>) {
	return (
		<div
			data-slot='card'
			className={cn(
				'bg-card text-card-foreground flex flex-col gap-(--card-pad) rounded-surface border py-(--card-pad) shadow-surface',
				className,
			)}
			{...props}
		/>
	);
}

function CardHeader({ className, ...props }: ComponentProps<'div'>) {
	return (
		<div
			data-slot='card-header'
			className={cn(
				'@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-2 px-(--card-pad) has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-(--card-pad)',
				className,
			)}
			{...props}
		/>
	);
}

function CardTitle({ className, ...props }: TextProps<'h3'>) {
	return (
		<Text
			variant='heading-md'
			data-slot='card-title'
			className={cn('leading-none font-semibold', className)}
			{...props}
		/>
	);
}

function CardDescription({ className, ...props }: ComponentProps<'div'>) {
	return (
		<div
			data-slot='card-description'
			className={cn('text-muted-foreground text-sm', className)}
			{...props}
		/>
	);
}

function CardAction({ className, ...props }: ComponentProps<'div'>) {
	return (
		<div
			data-slot='card-action'
			className={cn(
				'col-start-2 row-span-2 row-start-1 self-start justify-self-end',
				className,
			)}
			{...props}
		/>
	);
}

function CardContent({ className, ...props }: ComponentProps<'div'>) {
	return <div data-slot='card-content' className={cn('px-(--card-pad)', className)} {...props} />;
}

function CardFooter({ className, ...props }: ComponentProps<'div'>) {
	return (
		<div
			data-slot='card-footer'
			className={cn(
				'flex items-center px-(--card-pad) [.border-t]:pt-(--card-pad)',
				className,
			)}
			{...props}
		/>
	);
}

export { Card, CardHeader, CardFooter, CardTitle, CardAction, CardDescription, CardContent };

export default {
	Card,
	CardHeader,
	CardFooter,
	CardTitle,
	CardAction,
	CardDescription,
	CardContent,
};
