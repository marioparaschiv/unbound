import { useEffect, useRef, useState } from 'react';
import type { ComponentProps } from 'react';

import { revealStyle } from '~/components/motion/reveal-style';
import type { CssVariables } from '~/lib/css-variables';
import cn from '~/lib/cn';

type RevealProps = ComponentProps<'div'> & {
	/** Seconds to wait after the element scrolls into view. */
	delay?: number;
};

// The `scroll` preset's starting frame, held until the element scrolls into view.
const HIDDEN: CssVariables = { opacity: 0, transform: 'translateY(16px)', filter: 'blur(4px)' };

// The share of the element that must be on screen before it enters.
const VISIBLE_SHARE = 0.3;

function Reveal({ delay = 0, className, style, ...props }: RevealProps) {
	const ref = useRef<HTMLDivElement>(null);
	const [shown, setShown] = useState(false);

	useEffect(() => {
		const element = ref.current;

		if (!element) return;

		const observer = new IntersectionObserver(
			([entry]) => {
				if (!entry?.isIntersecting) return;

				setShown(true);
				observer.disconnect();
			},
			{ threshold: VISIBLE_SHARE },
		);

		observer.observe(element);

		return () => observer.disconnect();
	}, []);

	// `animate-reveal` drops its styles once it ends, so no transform or filter is left to break the backdrop blurs inside.
	return (
		<div
			ref={ref}
			data-reveal
			className={cn(shown && 'animate-reveal', className)}
			style={{ ...(shown ? revealStyle('scroll', delay * 1000) : HIDDEN), ...style }}
			{...props}
		/>
	);
}

export default Reveal;
