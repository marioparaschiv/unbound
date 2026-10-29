import type { ComponentProps } from 'react';

import Text from '~/components/ui/text';
import cn from '~/lib/cn';

type DetailSectionProps = ComponentProps<'section'> & {
	title: string;
};

function DetailSection({ title, children, className, ...props }: DetailSectionProps) {
	return (
		<section className={cn('flex flex-col gap-3', className)} {...props}>
			<Text variant='heading-sm'>{title}</Text>
			{children}
		</section>
	);
}

export default DetailSection;
