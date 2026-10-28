import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
import type { ComponentProps } from 'react';

import cn from '~/lib/cn';

const tagVariants = cva(
	'inline-flex items-center px-2 py-0.5 rounded-full font-semibold text-[10px] shrink-0',
	{
		variants: {
			variant: {
				default: 'bg-muted text-muted-foreground',
				primary: 'bg-primary/15 text-primary',
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
