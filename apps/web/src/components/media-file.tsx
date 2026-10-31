import type { CSSProperties } from 'react';

import type { ResolvedMedia } from '~/lib/page-media';
import cn from '~/lib/cn';

type MediaFileProps = {
	media: ResolvedMedia;
	alt: string;
	/** A video's poster image URL. */
	poster?: string;
	className?: string;
};

/**
 * @description Shows one measured image or video. Its box takes the measured aspect ratio before
 * anything loads, with the ThumbHash behind it, so the page never shifts.
 * @param props The media, its alt text, a video's poster and the classes sizing its box.
 * @returns An `img` or a `video`.
 */
function MediaFile({ media, alt, poster, className }: MediaFileProps) {
	const style: CSSProperties = {
		aspectRatio: `${media.width} / ${media.height}`,
		backgroundImage: `url(${media.placeholder})`,
	};
	const classes = cn('bg-cover bg-center bg-no-repeat rounded-control', className);

	if (media.kind === 'video') {
		return (
			<video
				src={media.src}
				poster={poster}
				width={media.width}
				height={media.height}
				aria-label={alt}
				controls
				playsInline
				preload='metadata'
				className={classes}
				style={style}
			/>
		);
	}

	return (
		<img
			src={media.src}
			alt={alt}
			width={media.width}
			height={media.height}
			loading='lazy'
			decoding='async'
			className={classes}
			style={style}
		/>
	);
}

export default MediaFile;
