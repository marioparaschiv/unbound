import { Combobox as ComboboxPrimitive } from '@base-ui/react/combobox';
import type { ComponentProps, ReactNode } from 'react';
import { IconCheck } from '@tabler/icons-react';

import { InputGroup, InputGroupInput } from '~/components/ui/input-group';
import cn from '~/lib/cn';

type ComboboxInputProps = ComponentProps<typeof ComboboxPrimitive.Input> & {
	/** `InputGroupAddon`s rendered beside the input, inside its border. */
	children?: ReactNode;
};

type ComboboxContentProps = ComponentProps<typeof ComboboxPrimitive.Popup> &
	Pick<
		ComponentProps<typeof ComboboxPrimitive.Positioner>,
		'align' | 'alignOffset' | 'side' | 'sideOffset' | 'anchor'
	>;

const Combobox = ComboboxPrimitive.Root;

function ComboboxInput({ className, children, disabled = false, ...props }: ComboboxInputProps) {
	return (
		<ComboboxPrimitive.InputGroup
			data-slot='combobox-input-group'
			render={<InputGroup className={cn('w-auto', className)} />}
		>
			<ComboboxPrimitive.Input
				disabled={disabled}
				render={<InputGroupInput disabled={disabled} />}
				{...props}
			/>
			{children}
		</ComboboxPrimitive.InputGroup>
	);
}

function ComboboxContent({
	className,
	side = 'bottom',
	sideOffset = 4,
	align = 'start',
	alignOffset = 0,
	anchor,
	...props
}: ComboboxContentProps) {
	return (
		<ComboboxPrimitive.Portal>
			<ComboboxPrimitive.Positioner
				side={side}
				sideOffset={sideOffset}
				align={align}
				alignOffset={alignOffset}
				anchor={anchor}
				className='isolate z-50'
			>
				<ComboboxPrimitive.Popup
					data-slot='combobox-content'
					className={cn(
						'group/combobox-content bg-popover text-popover-foreground data-[open]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[open]:fade-in-0 data-[closed]:zoom-out-95 data-[open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 relative max-h-(--available-height) w-(--anchor-width) max-w-(--available-width) min-w-[8rem] origin-(--transform-origin) overflow-hidden rounded-control border shadow-float duration-100',
						className,
					)}
					{...props}
				/>
			</ComboboxPrimitive.Positioner>
		</ComboboxPrimitive.Portal>
	);
}

function ComboboxList({ className, ...props }: ComponentProps<typeof ComboboxPrimitive.List>) {
	return (
		<ComboboxPrimitive.List
			data-slot='combobox-list'
			className={cn(
				'max-h-[min(--spacing(72),var(--available-height))] scroll-py-1 overflow-y-auto overscroll-contain p-1.5 data-[empty]:p-0',
				className,
			)}
			{...props}
		/>
	);
}

function ComboboxItem({
	className,
	children,
	...props
}: ComponentProps<typeof ComboboxPrimitive.Item>) {
	return (
		<ComboboxPrimitive.Item
			data-slot='combobox-item'
			className={cn(
				"data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground [&_svg:not([class*='text-'])]:text-muted-foreground relative flex w-full cursor-default items-center gap-2 rounded-item py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
				className,
			)}
			{...props}
		>
			{children}
			<ComboboxPrimitive.ItemIndicator
				render={
					<span className='pointer-events-none absolute right-2 flex size-4 items-center justify-center' />
				}
			>
				<IconCheck />
			</ComboboxPrimitive.ItemIndicator>
		</ComboboxPrimitive.Item>
	);
}

function ComboboxGroup({ className, ...props }: ComponentProps<typeof ComboboxPrimitive.Group>) {
	return <ComboboxPrimitive.Group data-slot='combobox-group' className={className} {...props} />;
}

function ComboboxLabel({
	className,
	...props
}: ComponentProps<typeof ComboboxPrimitive.GroupLabel>) {
	return (
		<ComboboxPrimitive.GroupLabel
			data-slot='combobox-label'
			className={cn('text-muted-foreground px-2 py-1.5 text-xs', className)}
			{...props}
		/>
	);
}

function ComboboxEmpty({ className, ...props }: ComponentProps<typeof ComboboxPrimitive.Empty>) {
	return (
		<ComboboxPrimitive.Empty
			data-slot='combobox-empty'
			className={cn(
				'text-muted-foreground hidden w-full justify-center py-2 text-center text-sm group-data-[empty]/combobox-content:flex',
				className,
			)}
			{...props}
		/>
	);
}

function ComboboxStatus({ className, ...props }: ComponentProps<typeof ComboboxPrimitive.Status>) {
	return (
		<ComboboxPrimitive.Status
			data-slot='combobox-status'
			className={cn('text-muted-foreground px-2 py-1.5 text-sm empty:p-0', className)}
			{...props}
		/>
	);
}

function ComboboxSeparator({
	className,
	...props
}: ComponentProps<typeof ComboboxPrimitive.Separator>) {
	return (
		<ComboboxPrimitive.Separator
			data-slot='combobox-separator'
			className={cn('bg-border -mx-1 my-1 h-px', className)}
			{...props}
		/>
	);
}

export {
	Combobox,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxGroup,
	ComboboxInput,
	ComboboxItem,
	ComboboxLabel,
	ComboboxList,
	ComboboxSeparator,
	ComboboxStatus,
};

export default {
	Combobox,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxGroup,
	ComboboxInput,
	ComboboxItem,
	ComboboxLabel,
	ComboboxList,
	ComboboxSeparator,
	ComboboxStatus,
};
