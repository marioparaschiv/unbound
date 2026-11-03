import { useEffect, useState } from 'react';

// A heading counts as read once its top passes this far down the viewport, just under its `scroll-mt-6` landing spot.
const READ_LINE = 96;

/**
 * @description Tracks which of a page's headings the reader is in: the last one scrolled past the top,
 * the first before any, and the last once the page bottoms out, so short final sections still light up.
 * @param slugs The headings' ids, in page order.
 * @returns The id of the heading in view, or `undefined` for a page without headings.
 */
function useActiveHeading(slugs: string[]): string | undefined {
	const [active, setActive] = useState(slugs[0]);

	useEffect(() => {
		let frame = 0;

		function update() {
			frame = 0;

			const root = document.documentElement;
			const bottomedOut = window.innerHeight + window.scrollY >= root.scrollHeight - 2;
			const passed = slugs.filter((slug) => {
				const heading = document.getElementById(slug);

				return heading && heading.getBoundingClientRect().top <= READ_LINE;
			});

			setActive(bottomedOut ? slugs.at(-1) : (passed.at(-1) ?? slugs[0]));
		}

		function schedule() {
			frame ||= requestAnimationFrame(update);
		}

		// The body can mount after hydration, so a layout change re-reads the headings too.
		const observer = new ResizeObserver(schedule);

		observer.observe(document.body);
		window.addEventListener('scroll', schedule, { passive: true });
		update();

		return () => {
			cancelAnimationFrame(frame);
			observer.disconnect();
			window.removeEventListener('scroll', schedule);
		};
	}, [slugs]);

	return active;
}

export default useActiveHeading;
