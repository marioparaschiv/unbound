import type { ReactNode } from 'react';

type BadgeTileProps = {
	/** The badge image; `undefined` shows `children` instead, such as a spinner. */
	imageUrl?: string;
	children?: ReactNode;
};

/** A badge image on a control-height tile, so badge rows line up with the inputs beside them. */
function BadgeTile({ imageUrl, children }: BadgeTileProps) {
	return (
		<span className='grid size-11 shrink-0 place-items-center rounded-control bg-muted text-muted-foreground'>
			{imageUrl ? (
				<img
					src={imageUrl}
					alt=''
					width={32}
					height={32}
					className='size-8 object-contain'
				/>
			) : (
				children
			)}
		</span>
	);
}

export default BadgeTile;
