import cn from '~/lib/cn';

type AvatarGlowProps = {
	src: string;
	className?: string;
};

/**
 * A blur of an avatar that fills its `relative isolate overflow-hidden` parent. It reaches
 * 6rem past every edge so the blur's falloff is clipped and the parent's edges stay coloured.
 */
function AvatarGlow({ src, className }: AvatarGlowProps) {
	return (
		<img
			src={src}
			alt=''
			aria-hidden
			loading='lazy'
			decoding='async'
			className={cn(
				'absolute -inset-24 -z-10 size-[calc(100%+12rem)] max-w-none object-cover blur-2xl pointer-events-none select-none',
				className,
			)}
		/>
	);
}

export default AvatarGlow;
