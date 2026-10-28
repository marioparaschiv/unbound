import { Switch as SwitchPrimitive } from '@base-ui/react/switch';
import type { ComponentProps } from 'react';

import cn from '~/lib/cn';

function Switch({ className, ...props }: ComponentProps<typeof SwitchPrimitive.Root>) {
	return (
		<SwitchPrimitive.Root
			data-slot='switch'
			className={cn(
				'group/switch peer relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-transparent p-0.5 shadow-field transition-[color,background-color,box-shadow] duration-(--press-duration) outline-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
				'data-[checked]:bg-primary data-[unchecked]:bg-input dark:data-[unchecked]:bg-input/80',
				'focus-visible:ring-[3px] focus-visible:ring-halo',
				'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
				className,
			)}
			{...props}
		>
			{/* The thumb widens while held, then springs back, so the press reads as a squish. */}
			<SwitchPrimitive.Thumb
				data-slot='switch-thumb'
				className='bg-background dark:data-[unchecked]:bg-foreground dark:data-[checked]:bg-primary-foreground pointer-events-none block h-5 w-5 rounded-full shadow-thumb ring-0 transition-[translate,width] duration-(--press-duration) ease-spring data-[checked]:translate-x-5 data-[unchecked]:translate-x-0 group-active/switch:w-6 group-active/switch:data-[checked]:translate-x-4 motion-reduce:transition-none'
			/>
		</SwitchPrimitive.Root>
	);
}

export default Switch;
