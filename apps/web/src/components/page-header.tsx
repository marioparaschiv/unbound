import type { ReactNode } from 'react';

import BlurReveal from '~/components/motion/blur-reveal';
import Text from '~/components/ui/text';

type PageHeaderProps = {
	title: ReactNode;
	description?: ReactNode;
	children?: ReactNode;
};

/**
 * @description A page's title and subtitle, with optional actions on the right.
 * @param props The title, the subtitle and the actions.
 * @returns The page header.
 */
function PageHeader({ title, description, children }: PageHeaderProps) {
	// The bottom margin adds to the page's 24px sibling gap, so the content starts 32px below.
	return (
		<div className='flex flex-wrap justify-between items-end gap-4 mb-2'>
			<div className='flex flex-col gap-2'>
				<Text variant='heading-lg'>
					{typeof title === 'string' ? <BlurReveal text={title} /> : title}
				</Text>
				{description ? (
					<Text variant='text-md' color='muted'>
						{description}
					</Text>
				) : null}
			</div>
			{children}
		</div>
	);
}

export default PageHeader;
