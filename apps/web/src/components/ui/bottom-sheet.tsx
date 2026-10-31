import { Drawer as DrawerPrimitive } from '@base-ui/react/drawer';
import type { ComponentProps } from 'react';

import cn from '~/lib/cn';

// iOS's sheet curve: a quick start that settles slowly, so a flick and a tap both feel physical.
const SHEET_EASE = 'ease-[cubic-bezier(0.32,0.72,0,1)] duration-[450ms]';

function BottomSheet(props: ComponentProps<typeof DrawerPrimitive.Root>) {
	return <DrawerPrimitive.Root data-slot='bottom-sheet' {...props} />;
}

function BottomSheetTrigger(props: ComponentProps<typeof DrawerPrimitive.Trigger>) {
	return <DrawerPrimitive.Trigger data-slot='bottom-sheet-trigger' {...props} />;
}

function BottomSheetClose(props: ComponentProps<typeof DrawerPrimitive.Close>) {
	return <DrawerPrimitive.Close data-slot='bottom-sheet-close' {...props} />;
}

function BottomSheetTitle({ className, ...props }: ComponentProps<typeof DrawerPrimitive.Title>) {
	return (
		<DrawerPrimitive.Title
			data-slot='bottom-sheet-title'
			className={cn('font-semibold text-lg tracking-tight', className)}
			{...props}
		/>
	);
}

/**
 * @description A plump bottom sheet: rounded continuous top corners, a grab handle, and swipe down to dismiss.
 * @param props The popup's props; its children go under the handle.
 * @returns The portalled sheet with its backdrop.
 */
function BottomSheetContent({
	className,
	children,
	...props
}: ComponentProps<typeof DrawerPrimitive.Popup>) {
	return (
		<DrawerPrimitive.Portal>
			<DrawerPrimitive.Backdrop
				className={cn(
					'z-50 fixed inset-0 bg-black opacity-[calc(0.6*(1-var(--drawer-swipe-progress)))] data-ending-style:opacity-0 data-starting-style:opacity-0 min-h-dvh transition-opacity data-swiping:duration-0 data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)]',
					SHEET_EASE,
				)}
			/>
			<DrawerPrimitive.Viewport className='z-50 fixed inset-0 flex justify-center items-end'>
				{/* The popup runs 3rem past the screen's bottom so an upward overswipe never shows a gap. */}
				<DrawerPrimitive.Popup
					data-slot='bottom-sheet-content'
					className={cn(
						'flex flex-col bg-popover shadow-float -mb-12 pb-[calc(env(safe-area-inset-bottom,0px)+3rem)] border-border border-t rounded-t-surface outline-none w-full max-h-[calc(85dvh+3rem)] overflow-hidden text-popover-foreground corner-continuous',
						'[transform:translateY(var(--drawer-swipe-movement-y))] transition-transform data-swiping:select-none data-ending-style:[transform:translateY(calc(100%-3rem+2px))] data-starting-style:[transform:translateY(calc(100%-3rem+2px))] data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)]',
						SHEET_EASE,
						className,
					)}
					{...props}
				>
					<div
						aria-hidden
						className='bg-muted-foreground/30 mx-auto mt-2.5 mb-1 rounded-full w-10 h-1.5 shrink-0'
					/>
					<DrawerPrimitive.Content className='flex flex-col min-h-0'>
						{children}
					</DrawerPrimitive.Content>
				</DrawerPrimitive.Popup>
			</DrawerPrimitive.Viewport>
		</DrawerPrimitive.Portal>
	);
}

export { BottomSheet, BottomSheetClose, BottomSheetContent, BottomSheetTitle, BottomSheetTrigger };

export default {
	BottomSheet,
	BottomSheetClose,
	BottomSheetContent,
	BottomSheetTitle,
	BottomSheetTrigger,
};
