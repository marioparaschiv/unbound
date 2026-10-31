import type { ComponentProps, ReactElement, ReactNode, RefObject } from 'react';
import { createContext, isValidElement, useContext, useRef } from 'react';
import { IconCheck, IconShapeCircleFilled } from 'nucleo-micro-bold';
import { Menu as MenuPrimitive } from '@base-ui/react/menu';

import { pressFreeAnchor } from '~/components/motion/press-springs';
import cn from '~/lib/cn';

type DropdownMenuItemVariant = 'default' | 'destructive';

type AsChildProps = {
	/** Renders the single child element in place of the default one, merging this part's props onto it. */
	asChild?: boolean;
	children?: ReactNode;
};

type DropdownMenuTriggerProps = Omit<ComponentProps<typeof MenuPrimitive.Trigger>, 'children'> &
	AsChildProps;

type DropdownMenuContentProps = ComponentProps<typeof MenuPrimitive.Popup> &
	Pick<
		ComponentProps<typeof MenuPrimitive.Positioner>,
		'align' | 'alignOffset' | 'side' | 'sideOffset'
	>;

type DropdownMenuItemProps = Omit<ComponentProps<typeof MenuPrimitive.Item>, 'children'> &
	AsChildProps & {
		inset?: boolean;
		variant?: DropdownMenuItemVariant;
	};

type DropdownMenuCheckboxItemProps = ComponentProps<typeof MenuPrimitive.CheckboxItem> & {
	variant?: DropdownMenuItemVariant;
};

type DropdownMenuRadioItemProps = ComponentProps<typeof MenuPrimitive.RadioItem> & {
	variant?: DropdownMenuItemVariant;
};

type DropdownMenuLabelProps = ComponentProps<'div'> & {
	inset?: boolean;
};

const ITEM =
	'data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[variant=destructive]:text-destructive data-[variant=destructive]:data-[highlighted]:bg-destructive/10 dark:data-[variant=destructive]:data-[highlighted]:bg-destructive/20 data-[variant=destructive]:data-[highlighted]:text-destructive data-[variant=destructive]:*:[svg]:!text-destructive relative flex cursor-default items-center gap-2 rounded-menu-item corner-continuous py-1.5 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*="size-"])]:size-4';

// The trigger the menu hangs from, so the positioner can measure it without its press motion.
const TriggerContext = createContext<RefObject<HTMLElement | null> | null>(null);

function asRender(asChild: boolean | undefined, children: ReactNode): ReactElement | undefined {
	return asChild && isValidElement(children) ? children : undefined;
}

// Non-modal, like the popovers: a modal menu turns off pointer events on the page, so clicking its own
// trigger to close it (or any button behind it) would land on nothing and get no press.
function DropdownMenu({ modal = false, ...props }: ComponentProps<typeof MenuPrimitive.Root>) {
	const trigger = useRef<HTMLElement | null>(null);

	return (
		<TriggerContext.Provider value={trigger}>
			<MenuPrimitive.Root data-slot='dropdown-menu' modal={modal} {...props} />
		</TriggerContext.Provider>
	);
}

function DropdownMenuTrigger({ asChild, children, ref, ...props }: DropdownMenuTriggerProps) {
	const trigger = useContext(TriggerContext);

	return (
		<MenuPrimitive.Trigger
			data-slot='dropdown-menu-trigger'
			ref={(node: HTMLButtonElement | null) => {
				if (trigger) {
					trigger.current = node;
				}

				if (typeof ref === 'function') {
					ref(node);
				} else if (ref) {
					ref.current = node;
				}
			}}
			render={asRender(asChild, children)}
			{...props}
		>
			{asChild ? undefined : children}
		</MenuPrimitive.Trigger>
	);
}

function DropdownMenuContent({
	className,
	side = 'bottom',
	// Clears the 4px ledge under raised triggers, then leaves a visible gap.
	sideOffset = 10,
	align = 'center',
	alignOffset = 0,
	...props
}: DropdownMenuContentProps) {
	const trigger = useContext(TriggerContext);

	return (
		<MenuPrimitive.Portal>
			{/* Anchored to where the trigger rests, so its press never drags the menu along. */}
			<MenuPrimitive.Positioner
				anchor={() => (trigger?.current ? pressFreeAnchor(trigger.current) : null)}
				side={side}
				sideOffset={sideOffset}
				align={align}
				alignOffset={alignOffset}
				className='isolate z-50 outline-none'
			>
				<MenuPrimitive.Popup
					data-slot='dropdown-menu-content'
					className={cn(
						'bg-popover text-popover-foreground data-[open]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[open]:fade-in-0 data-[closed]:zoom-out-95 data-[open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 max-h-(--available-height) min-w-[8rem] origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-menu corner-continuous border p-1.5 shadow-float outline-none duration-100',
						className,
					)}
					{...props}
				/>
			</MenuPrimitive.Positioner>
		</MenuPrimitive.Portal>
	);
}

function DropdownMenuItem({
	asChild,
	children,
	className,
	inset,
	variant = 'default',
	...props
}: DropdownMenuItemProps) {
	return (
		<MenuPrimitive.Item
			data-slot='dropdown-menu-item'
			data-inset={inset}
			data-variant={variant}
			render={asRender(asChild, children)}
			className={cn(
				ITEM,
				'[&_svg:not([class*="text-"])]:text-muted-foreground px-2 data-[inset]:pl-8',
				className,
			)}
			{...props}
		>
			{asChild ? undefined : children}
		</MenuPrimitive.Item>
	);
}

function DropdownMenuCheckboxItem({
	className,
	children,
	variant = 'default',
	...props
}: DropdownMenuCheckboxItemProps) {
	return (
		<MenuPrimitive.CheckboxItem
			data-slot='dropdown-menu-checkbox-item'
			data-variant={variant}
			className={cn(ITEM, 'pr-2 pl-8', className)}
			{...props}
		>
			<span className='pointer-events-none absolute left-2 flex size-3.5 items-center justify-center'>
				<MenuPrimitive.CheckboxItemIndicator>
					<IconCheck className='size-4' />
				</MenuPrimitive.CheckboxItemIndicator>
			</span>
			{children}
		</MenuPrimitive.CheckboxItem>
	);
}

function DropdownMenuRadioGroup(props: ComponentProps<typeof MenuPrimitive.RadioGroup>) {
	return <MenuPrimitive.RadioGroup data-slot='dropdown-menu-radio-group' {...props} />;
}

// Picking an option closes the menu, as a native select does.
function DropdownMenuRadioItem({
	className,
	children,
	variant = 'default',
	closeOnClick = true,
	...props
}: DropdownMenuRadioItemProps) {
	return (
		<MenuPrimitive.RadioItem
			data-slot='dropdown-menu-radio-item'
			data-variant={variant}
			closeOnClick={closeOnClick}
			className={cn(ITEM, 'pr-2 pl-8', className)}
			{...props}
		>
			<span className='pointer-events-none absolute left-2 flex size-3.5 items-center justify-center'>
				<MenuPrimitive.RadioItemIndicator>
					<IconShapeCircleFilled className='size-2 fill-current' />
				</MenuPrimitive.RadioItemIndicator>
			</span>
			{children}
		</MenuPrimitive.RadioItem>
	);
}

function DropdownMenuLabel({ className, inset, ...props }: DropdownMenuLabelProps) {
	return (
		<div
			data-slot='dropdown-menu-label'
			data-inset={inset}
			className={cn('px-2 py-1.5 text-sm font-medium data-[inset]:pl-8', className)}
			{...props}
		/>
	);
}

function DropdownMenuSeparator({
	className,
	...props
}: ComponentProps<typeof MenuPrimitive.Separator>) {
	return (
		<MenuPrimitive.Separator
			data-slot='dropdown-menu-separator'
			className={cn('bg-border -mx-1 my-1 h-px', className)}
			{...props}
		/>
	);
}

export {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
};

export default {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
};
