import type { VariantProps } from 'class-variance-authority';
import type { HTMLMotionProps } from 'motion/react';
import { cva } from 'class-variance-authority';
import { Slot } from '@radix-ui/react-slot';
import { motion } from 'motion/react';

import cn from '~/lib/cn';

const MotionSlot = motion.create(Slot);

const buttonVariants = cva(
	"inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-control text-sm font-semibold disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-4 focus-visible:ring-halo aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
	{
		variants: {
			variant: {
				default:
					'press [--ledge:var(--ledge-primary)] bg-primary text-primary-foreground hover:bg-primary/90',
				destructive:
					'press [--ledge:var(--ledge-destructive)] bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/30 dark:bg-destructive/60 dark:hover:bg-destructive/70',
				outline:
					'press [--ledge:var(--ledge-outline)] border bg-background hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50',
				secondary:
					'press [--ledge:var(--ledge-secondary)] bg-secondary text-secondary-foreground hover:bg-secondary/80',
				ghost: 'press-flat hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50',
				link: 'press-flat text-primary underline-offset-4 hover:underline',
			},
			size: {
				default: "h-11 px-5 has-[>svg]:px-4 [&_svg:not([class*='size-'])]:size-4.5",
				sm: 'h-9 gap-1.5 px-3.5 has-[>svg]:px-3',
				lg: "h-12 px-7 has-[>svg]:px-5 [&_svg:not([class*='size-'])]:size-4.5",
				icon: "size-11 [&_svg:not([class*='size-'])]:size-4.5",
				'icon-sm': 'size-9',
				'icon-lg': "size-12 [&_svg:not([class*='size-'])]:size-4.5",
			},
		},
		defaultVariants: {
			variant: 'default',
			size: 'default',
		},
	},
);

type ButtonProps = HTMLMotionProps<'button'> &
	VariantProps<typeof buttonVariants> & {
		asChild?: boolean;
	};

function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
	const Component = asChild ? MotionSlot : motion.button;

	return (
		<Component
			data-slot='button'
			className={cn(buttonVariants({ variant, size, className }))}
			{...props}
		/>
	);
}

export type { ButtonProps };

export { Button, buttonVariants };

export default { Button, buttonVariants };
