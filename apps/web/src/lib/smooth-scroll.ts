// Any of these from the reader takes the scroll back from the animation.
const INTERRUPTS = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const;

let stopCurrent: (() => void) | undefined;

// Fast start, long settle: the page moves at once and lands softly.
const easeOutQuart = (t: number) => 1 - (1 - t) ** 4;

/**
 * @description Scrolls the window so an element sits at its `scroll-margin-top`, animated and interruptible:
 * the reader's wheel, touch, pointer or key stops it where it is, and a new call starts from the current
 * position. Jumps at once when the reader prefers reduced motion.
 * @param element The element to bring into view.
 */
export function smoothScrollTo(element: Element): void {
	stopCurrent?.();

	const margin = Number.parseFloat(getComputedStyle(element).scrollMarginTop) || 0;
	const max = document.documentElement.scrollHeight - window.innerHeight;
	const to = Math.min(
		Math.max(element.getBoundingClientRect().top + window.scrollY - margin, 0),
		max,
	);
	const from = window.scrollY;
	const distance = to - from;

	if (!distance) return;

	if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
		window.scrollTo({ top: to });

		return;
	}

	// Longer trips take longer, within bounds, so a near section never drags and a far one never snaps.
	const duration = Math.min(Math.max(240 + Math.abs(distance) * 0.12, 320), 720);
	const start = performance.now();
	let frame = 0;

	function stop() {
		cancelAnimationFrame(frame);

		for (const type of INTERRUPTS) window.removeEventListener(type, stop);

		stopCurrent = undefined;
	}

	function step(now: number) {
		const progress = Math.min((now - start) / duration, 1);

		window.scrollTo({ top: from + distance * easeOutQuart(progress) });

		if (progress < 1) {
			frame = requestAnimationFrame(step);
		} else {
			stop();
		}
	}

	for (const type of INTERRUPTS) window.addEventListener(type, stop, { passive: true });

	stopCurrent = stop;
	frame = requestAnimationFrame(step);
}

export default smoothScrollTo;
