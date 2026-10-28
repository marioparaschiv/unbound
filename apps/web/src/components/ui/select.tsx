import { IconCheck, IconChevronDown, IconChevronExpandY, IconChevronUp } from 'nucleo-micro-bold';
import { Select as SelectPrimitive } from '@base-ui/react/select';
import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
import type { ComponentProps } from 'react';

import cn from '~/lib/cn';

const selectTriggerVariants = cva(
	[
		"field data-[placeholder]:text-muted-foreground flex w-fit items-center justify-between gap-2 px-4 text-base md:text-sm whitespace-nowrap outline-none select-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
		'focus-visible:ring-[3px] focus-visible:ring-halo',
		'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
	],
	{
		variants: {
			size: {
				default: 'h-11',
				sm: 'h-9 px-3 text-sm md:text-sm',
			},
		},
		defaultVariants: {
			size: 'default',
		},
	},
);

type SelectTriggerProps = ComponentProps<typeof SelectPrimitive.Trigger> &
	VariantProps<typeof selectTriggerVariants>;

type SelectContentProps = ComponentProps<typeof SelectPrimitive.Popup> &
	Pick<
		ComponentProps<typeof SelectPrimitive.Positioner>,
		'align' | 'alignOffset' | 'side' | 'sideOffset' | 'alignItemWithTrigger'
	>;

const Select = SelectPrimitive.Root;

function SelectGroup({ className, ...props }: ComponentProps<typeof SelectPrimitive.Group>) {
	return (
		<SelectPrimitive.Group
			data-slot='select-group'
			className={cn('scroll-my-1', className)}
			{...props}
		/>
	);
}

function SelectValue({ className, ...props }: ComponentProps<typeof SelectPrimitive.Value>) {
	return (
		<SelectPrimitive.Value
			data-slot='select-value'
			className={cn('single-line min-w-0 flex-1 text-left', className)}
			{...props}
		/>
	);
}

function SelectTrigger({ className, size = 'default', children, ...props }: SelectTriggerProps) {
	return (
		<SelectPrimitive.Trigger
			data-slot='select-trigger'
			data-size={size}
			className={cn(selectTriggerVariants({ size }), className)}
			{...props}
		>
			{children}
			<SelectPrimitive.Icon
				render={<IconChevronExpandY className='text-muted-foreground -mr-1 size-4' />}
			/>
		</SelectPrimitive.Trigger>
	);
}

function SelectScrollUpButton({
	className,
	...props
}: ComponentProps<typeof SelectPrimitive.ScrollUpArrow>) {
	return (
		<SelectPrimitive.ScrollUpArrow
			data-slot='select-scroll-up-button'
			className={cn(
				'bg-popover top-0 z-10 flex w-full cursor-default items-center justify-center py-1 [&_svg]:size-4',
				className,
			)}
			{...props}
		>
			<IconChevronUp size={24} />
		</SelectPrimitive.ScrollUpArrow>
	);
}

function SelectScrollDownButton({
	className,
	...props
}: ComponentProps<typeof SelectPrimitive.ScrollDownArrow>) {
	return (
		<SelectPrimitive.ScrollDownArrow
			data-slot='select-scroll-down-button'
			className={cn(
				'bg-popover bottom-0 z-10 flex w-full cursor-default items-center justify-center py-1 [&_svg]:size-4',
				className,
			)}
			{...props}
		>
			<IconChevronDown size={24} />
		</SelectPrimitive.ScrollDownArrow>
	);
}

function SelectContent({
	className,
	children,
	side = 'bottom',
	sideOffset = 4,
	align = 'center',
	alignOffset = 0,
	alignItemWithTrigger = true,
	...props
}: SelectContentProps) {
	return (
		<SelectPrimitive.Portal>
			<SelectPrimitive.Positioner
				side={side}
				sideOffset={sideOffset}
				align={align}
				alignOffset={alignOffset}
				alignItemWithTrigger={alignItemWithTrigger}
				className='isolate z-50'
			>
				<SelectPrimitive.Popup
					data-slot='select-content'
					className={cn(
						'bg-popover text-popover-foreground data-[open]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[open]:fade-in-0 data-[closed]:zoom-out-95 data-[open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 relative max-h-(--available-height) w-(--anchor-width) min-w-[8rem] origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-control border shadow-float duration-100 data-[side=none]:animate-none!',
						className,
					)}
					{...props}
				>
					<SelectScrollUpButton />
					<SelectPrimitive.List className='p-1.5'>{children}</SelectPrimitive.List>
					<SelectScrollDownButton />
				</SelectPrimitive.Popup>
			</SelectPrimitive.Positioner>
		</SelectPrimitive.Portal>
	);
}

function SelectLabel({ className, ...props }: ComponentProps<typeof SelectPrimitive.GroupLabel>) {
	return (
		<SelectPrimitive.GroupLabel
			data-slot='select-label'
			className={cn('text-muted-foreground px-2 py-1.5 text-xs', className)}
			{...props}
		/>
	);
}

function SelectItem({
	className,
	children,
	...props
}: ComponentProps<typeof SelectPrimitive.Item>) {
	return (
		<SelectPrimitive.Item
			data-slot='select-item'
			className={cn(
				"data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground [&_svg:not([class*='text-'])]:text-muted-foreground relative flex min-h-8 w-full cursor-default items-center gap-2 rounded-item py-1 pr-8 pl-2 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
				className,
			)}
			{...props}
		>
			<SelectPrimitive.ItemText className='single-line min-w-0 flex-1'>
				{children}
			</SelectPrimitive.ItemText>
			<SelectPrimitive.ItemIndicator
				render={
					<span className='pointer-events-none absolute right-2 flex size-4 items-center justify-center' />
				}
			>
				<IconCheck size={24} />
			</SelectPrimitive.ItemIndicator>
		</SelectPrimitive.Item>
	);
}

function SelectSeparator({
	className,
	...props
}: ComponentProps<typeof SelectPrimitive.Separator>) {
	return (
		<SelectPrimitive.Separator
			data-slot='select-separator'
			className={cn('bg-border pointer-events-none -mx-1 my-1 h-px', className)}
			{...props}
		/>
	);
}

export {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectScrollDownButton,
	SelectScrollUpButton,
	SelectSeparator,
	SelectTrigger,
	selectTriggerVariants,
	SelectValue,
};

export default {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectScrollDownButton,
	SelectScrollUpButton,
	SelectSeparator,
	SelectTrigger,
	selectTriggerVariants,
	SelectValue,
};
