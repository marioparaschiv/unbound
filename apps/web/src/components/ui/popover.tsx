import { Popover as PopoverPrimitive } from '@base-ui/react/popover';
import type { ComponentProps } from 'react';

import cn from '~/lib/cn';

type PopoverContentProps = ComponentProps<typeof PopoverPrimitive.Popup> &
	Pick<
		ComponentProps<typeof PopoverPrimitive.Positioner>,
		'align' | 'alignOffset' | 'side' | 'sideOffset'
	>;

function Popover(props: ComponentProps<typeof PopoverPrimitive.Root>) {
	return <PopoverPrimitive.Root data-slot='popover' {...props} />;
}

function PopoverTrigger(props: ComponentProps<typeof PopoverPrimitive.Trigger>) {
	return <PopoverPrimitive.Trigger data-slot='popover-trigger' {...props} />;
}

function PopoverContent({
	className,
	side = 'bottom',
	sideOffset = 4,
	align = 'center',
	alignOffset = 0,
	...props
}: PopoverContentProps) {
	return (
		<PopoverPrimitive.Portal>
			<PopoverPrimitive.Positioner
				side={side}
				sideOffset={sideOffset}
				align={align}
				alignOffset={alignOffset}
				className='isolate z-50'
			>
				<PopoverPrimitive.Popup
					data-slot='popover-content'
					className={cn(
						'bg-popover text-popover-foreground data-[open]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[open]:fade-in-0 data-[closed]:zoom-out-95 data-[open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 relative w-72 max-w-(--available-width) origin-(--transform-origin) rounded-md border p-4 shadow-md outline-hidden duration-100',
						className,
					)}
					{...props}
				/>
			</PopoverPrimitive.Positioner>
		</PopoverPrimitive.Portal>
	);
}

export { Popover, PopoverContent, PopoverTrigger };

export default { Popover, PopoverContent, PopoverTrigger };
