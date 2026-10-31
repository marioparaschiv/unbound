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
 * @returns The banner: text beside the action, stacked over a full-width action on phones.
 */
function PreviewBanner({ children, action }: PreviewBannerProps) {
	// The action's body sits 16px from the top, right and bottom; its 4px ledge takes the space under it.
	return (
		<Card className='flex sm:flex-row flex-col sm:items-center gap-3 p-3 sm:pr-4 sm:pl-(--card-pad)'>
			<div className='flex flex-1 items-start sm:items-center gap-3 px-1 sm:px-0 pt-1 sm:pt-0 min-w-0'>
				<IconEye className='mt-0.5 sm:mt-0 size-5 text-muted-foreground shrink-0' />
				<Text variant='text-sm'>{children}</Text>
			</div>
			<div className='sm:pt-1 sm:w-auto [&>*]:w-full sm:[&>*]:w-auto shrink-0'>{action}</div>
		</Card>
	);
}

export default PreviewBanner;
