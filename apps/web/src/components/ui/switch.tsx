import { Switch as SwitchPrimitive } from '@base-ui/react/switch';
import type { ComponentProps } from 'react';

import cn from '~/lib/cn';

function Switch({ className, ...props }: ComponentProps<typeof SwitchPrimitive.Root>) {
	return (
		<SwitchPrimitive.Root
			data-slot='switch'
			className={cn(
				'peer relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-transparent p-px shadow-xs transition-[color,background-color,box-shadow] outline-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
				'data-[checked]:bg-primary data-[unchecked]:bg-input dark:data-[unchecked]:bg-input/80',
				'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
				'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
				className,
			)}
			{...props}
		>
			<SwitchPrimitive.Thumb
				data-slot='switch-thumb'
				className='bg-background dark:data-[unchecked]:bg-foreground dark:data-[checked]:bg-primary-foreground pointer-events-none block size-4 rounded-full shadow-sm ring-0 transition-transform data-[checked]:translate-x-4 data-[unchecked]:translate-x-0'
			/>
		</SwitchPrimitive.Root>
	);
}

export default Switch;
