import { IconEye } from 'nucleo-micro-bold';
import type { ReactNode } from 'react';

import { Card } from '~/components/ui/card';
import Text from '~/components/ui/text';

type PreviewBannerProps = {
	children: ReactNode;
	/** The way out of the preview. */
	action: ReactNode;
};

/**
 * @description The strip above an addon page that says it is a preview, not the published page.
 * @param props What is being previewed and the way out.
 * @returns The banner.
 */
function PreviewBanner({ children, action }: PreviewBannerProps) {
	return (
		<Card className='flex-row items-center gap-3 px-(--card-pad) py-3'>
			<IconEye className='size-5 text-muted-foreground shrink-0' />
			<Text variant='text-sm' className='flex-1'>
				{children}
			</Text>
			{action}
		</Card>
	);
}

export default PreviewBanner;
