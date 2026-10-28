import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
import type { ComponentProps } from 'react';

import cn from '~/lib/cn';

const tagVariants = cva(
	'inline-flex items-center px-2 py-0.5 rounded-full font-semibold text-[10px] shrink-0',
	{
		variants: {
			variant: {
				default: 'bg-secondary text-muted-foreground',
				primary:
					'bg-primary/10 text-primary dark:bg-primary/15 dark:text-[oklch(0.8_0.09_17)]',
				destructive: 'bg-destructive/15 text-destructive',
				warning: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
			},
		},
		defaultVariants: {
			variant: 'default',
		},
	},
);

type TagProps = ComponentProps<'span'> & VariantProps<typeof tagVariants>;

function Tag({ className, variant, ...props }: TagProps) {
	return <span className={cn(tagVariants({ variant }), className)} {...props} />;
}

export default Tag;
