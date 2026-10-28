import type { VariantProps } from 'class-variance-authority';
import type { ComponentProps, MouseEvent } from 'react';
import { cva } from 'class-variance-authority';

import { Button } from '~/components/ui/button';
import Textarea from '~/components/ui/textarea';
import Input from '~/components/ui/input';
import cn from '~/lib/cn';

const inputGroupAddonVariants = cva(
	"text-muted-foreground flex h-auto cursor-text items-center justify-center gap-2 py-1.5 text-sm font-medium select-none [&>svg:not([class*='size-'])]:size-4 [&>kbd]:rounded-item group-data-[disabled=true]/input-group:opacity-50",
	{
		variants: {
			align: {
				'inline-start':
					'order-first pl-3 has-[>button]:ml-[-0.45rem] has-[>kbd]:ml-[-0.35rem]',
				'inline-end':
					'order-last pr-3 has-[>button]:mr-[-0.45rem] has-[>kbd]:mr-[-0.35rem]',
				'block-start':
					'order-first w-full justify-start px-3 pt-3 [.border-b]:pb-3 group-has-[>input]/input-group:pt-2.5',
				'block-end':
					'order-last w-full justify-start px-3 pb-3 [.border-t]:pt-3 group-has-[>input]/input-group:pb-2.5',
			},
		},
		defaultVariants: {
			align: 'inline-start',
		},
	},
);

const inputGroupButtonVariants = cva('text-sm shadow-none flex gap-2 items-center', {
	variants: {
		size: {
			xs: "h-6 gap-1 px-2 rounded-item [&>svg:not([class*='size-'])]:size-3.5 has-[>svg]:px-2",
			sm: 'h-8 px-2.5 gap-1.5 rounded-item has-[>svg]:px-2.5',
			'icon-xs': 'size-6 rounded-item p-0 has-[>svg]:p-0',
			'icon-sm': 'size-8 rounded-item p-0 has-[>svg]:p-0',
		},
	},
	defaultVariants: {
		size: 'xs',
	},
});

type InputGroupAddonProps = ComponentProps<'div'> & VariantProps<typeof inputGroupAddonVariants>;

type InputGroupButtonProps = Omit<ComponentProps<typeof Button>, 'size'> &
	VariantProps<typeof inputGroupButtonVariants>;

function InputGroup({ className, ...props }: ComponentProps<'div'>) {
	return (
		<div
			data-slot='input-group'
			role='group'
			className={cn(
				'group/input-group border-input bg-muted/50 dark:bg-input/30 relative flex w-full items-center rounded-control border shadow-field transition-[color,box-shadow,border-color] duration-(--press-duration) outline-none',
				'h-10 min-w-0 has-[>textarea]:h-auto',
				'has-[>[data-align=inline-start]]:[&>input]:pl-2',
				'has-[>[data-align=inline-end]]:[&>input]:pr-2',
				'has-[>[data-align=block-start]]:h-auto has-[>[data-align=block-start]]:flex-col has-[>[data-align=block-start]]:[&>input]:pb-3',
				'has-[>[data-align=block-end]]:h-auto has-[>[data-align=block-end]]:flex-col has-[>[data-align=block-end]]:[&>input]:pt-3',
				'has-[[data-slot=input-group-control]:focus-visible]:border-halo has-[[data-slot=input-group-control]:focus-visible]:ring-halo has-[[data-slot=input-group-control]:focus-visible]:ring-4',
				'has-[[data-slot][aria-invalid=true]]:ring-destructive/20 has-[[data-slot][aria-invalid=true]]:border-destructive dark:has-[[data-slot][aria-invalid=true]]:ring-destructive/40',
				className,
			)}
			{...props}
		/>
	);
}

// Clicking the addon's padding focuses the input, unless the click landed on one of its buttons.
function focusSiblingInput(event: MouseEvent<HTMLDivElement>) {
	if (event.target instanceof Element && event.target.closest('button')) return;

	event.currentTarget.parentElement?.querySelector('input')?.focus();
}

function InputGroupAddon({ className, align = 'inline-start', ...props }: InputGroupAddonProps) {
	return (
		<div
			role='group'
			data-slot='input-group-addon'
			data-align={align}
			className={cn(inputGroupAddonVariants({ align }), className)}
			onClick={focusSiblingInput}
			{...props}
		/>
	);
}

function InputGroupButton({
	className,
	type = 'button',
	variant = 'ghost',
	size = 'xs',
	...props
}: InputGroupButtonProps) {
	return (
		<Button
			type={type}
			data-size={size}
			variant={variant}
			className={cn(inputGroupButtonVariants({ size }), className)}
			{...props}
		/>
	);
}

function InputGroupText({ className, ...props }: ComponentProps<'span'>) {
	return (
		<span
			className={cn(
				"text-muted-foreground flex items-center gap-2 text-sm [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4",
				className,
			)}
			{...props}
		/>
	);
}

function InputGroupInput({ className, ...props }: ComponentProps<'input'>) {
	return (
		<Input
			data-slot='input-group-control'
			className={cn(
				'flex-1 h-full rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent',
				className,
			)}
			{...props}
		/>
	);
}

function InputGroupTextarea({ className, ...props }: ComponentProps<'textarea'>) {
	return (
		<Textarea
			data-slot='input-group-control'
			className={cn(
				'flex-1 resize-none rounded-none border-0 bg-transparent py-3 shadow-none focus-visible:ring-0 dark:bg-transparent',
				className,
			)}
			{...props}
		/>
	);
}

export {
	InputGroup,
	InputGroupAddon,
	InputGroupButton,
	InputGroupText,
	InputGroupInput,
	InputGroupTextarea,
};

export default {
	InputGroup,
	InputGroupAddon,
	InputGroupButton,
	InputGroupText,
	InputGroupInput,
	InputGroupTextarea,
};
