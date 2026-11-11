import { IconDownload } from 'nucleo-micro-bold';

import { formatInstalls } from '~/components/addon/format';
import cn from '~/lib/cn';

type InstallCountProps = {
	count: number;
	/** Abbreviates thousands and millions, for a card's tight line. */
	short?: boolean;
	className?: string;
};

/** An addon's marketplace install count: the download icon beside the number. Screen readers hear "installs". */
function InstallCount({ count, short = false, className }: InstallCountProps) {
	const installs = count === 1 ? 'install' : 'installs';

	return (
		<span
			className={cn('inline-flex items-center gap-1 shrink-0', className)}
			title={`${formatInstalls(count)} ${installs}`}
		>
			{/* Digits sit above the line's centre, so the icon rises half a pixel to centre on them. */}
			<IconDownload aria-hidden className='size-3 -translate-y-[0.5px]' />
			{formatInstalls(count, short)}
			<span className='sr-only'> {installs}</span>
		</span>
	);
}

export default InstallCount;
