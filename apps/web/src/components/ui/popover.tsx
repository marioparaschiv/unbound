import { Popover as PopoverPrimitive } from '@base-ui/react/popover';
import { createContext, useContext, useRef } from 'react';
import type { ComponentProps, RefObject } from 'react';

import { pressFreeAnchor } from '~/components/motion/press-springs';
import cn from '~/lib/cn';

type PopoverContentProps = ComponentProps<typeof PopoverPrimitive.Popup> &
	Pick<
		ComponentProps<typeof PopoverPrimitive.Positioner>,
		'align' | 'alignOffset' | 'side' | 'sideOffset'
	>;

// The trigger the popup hangs from, so the positioner can measure it without its press motion.
const TriggerContext = createContext<RefObject<HTMLElement | null> | null>(null);

function Popover(props: ComponentProps<typeof PopoverPrimitive.Root>) {
	const trigger = useRef<HTMLElement | null>(null);

	return (
		<TriggerContext.Provider value={trigger}>
			<PopoverPrimitive.Root data-slot='popover' {...props} />
		</TriggerContext.Provider>
	);
}

function PopoverTrigger({ ref, ...props }: ComponentProps<typeof PopoverPrimitive.Trigger>) {
	const trigger = useContext(TriggerContext);

	return (
		<PopoverPrimitive.Trigger
			data-slot='popover-trigger'
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
			{...props}
		/>
	);
}

function PopoverContent({
	className,
	side = 'bottom',
	// Clears the 4px ledge under raised triggers, then leaves a visible gap.
	sideOffset = 10,
	align = 'center',
	alignOffset = 0,
	...props
}: PopoverContentProps) {
	const trigger = useContext(TriggerContext);

	return (
		<PopoverPrimitive.Portal>
			{/* Anchored to where the trigger rests, so a press springing its trigger never drags the popup along. */}
			<PopoverPrimitive.Positioner
				anchor={() => (trigger?.current ? pressFreeAnchor(trigger.current) : null)}
				side={side}
				sideOffset={sideOffset}
				align={align}
				alignOffset={alignOffset}
				className='isolate z-50'
			>
				<PopoverPrimitive.Popup
					data-slot='popover-content'
					className={cn(
						'bg-popover text-popover-foreground data-[open]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[open]:fade-in-0 data-[closed]:zoom-out-95 data-[open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 relative w-72 max-w-(--available-width) origin-(--transform-origin) rounded-surface border p-4 shadow-float outline-hidden duration-100',
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
