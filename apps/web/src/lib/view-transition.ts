import { flushSync } from 'react-dom';

type MorphOptions = {
	/** The `view-transition-name` the two elements share for the length of the transition. */
	name: string;
	/** The element on screen now, that the transition starts from. */
	from: HTMLElement | null | undefined;
	/** Reads the element the transition ends on, once `update` has rendered. */
	to: () => HTMLElement | null | undefined;
	/** The state change, rendered synchronously inside the transition. */
	update: () => void;
	/** Lets clicks reach the page under the transition while it runs, as when a lightbox closes. */
	passThrough?: boolean;
	/** Set as `data-morph` on `<html>` while the transition runs, for CSS to style that kind of morph. */
	kind?: string;
};

// While a transition runs the browser hit-tests the whole page as `<html>`, whatever `pointer-events` says.
// A press ends the transition at once, and its click goes on to the element under the pointer.
function passClicksThrough(transition: ViewTransition): void {
	const root = document.documentElement;
	let pressed = false;

	function onPointerDown() {
		pressed = true;
		transition.skipTransition();
	}

	function onClick(event: MouseEvent) {
		removeEventListener('click', onClick, true);

		if (event.target !== root) return;

		const target = document.elementFromPoint(event.clientX, event.clientY);

		if (!target || target === root) return;

		event.stopPropagation();
		target.dispatchEvent(new MouseEvent('click', event));
	}

	addEventListener('pointerdown', onPointerDown, true);
	addEventListener('click', onClick, true);

	void transition.finished.then(() => {
		removeEventListener('pointerdown', onPointerDown, true);

		// A press during the transition still has its click to come.
		if (!pressed) {
			removeEventListener('click', onClick, true);
		}
	});
}

function canMorph(): boolean {
	return (
		typeof document.startViewTransition === 'function' &&
		!matchMedia('(prefers-reduced-motion: reduce)').matches
	);
}

/**
 * @description Runs a state change as a view transition that morphs one element into another, such as a
 * thumbnail into its lightbox. Without view transitions, or with reduced motion, the change is instant.
 * @param options The shared name, the element the morph starts from and ends on, the change, whether
 * clicks pass through it, and its kind.
 * @returns A promise that resolves once the morph has settled, or at once when there is none.
 */
export function morph({
	name,
	from,
	to,
	update,
	passThrough = false,
	kind,
}: MorphOptions): Promise<void> {
	if (!from || !canMorph()) {
		update();

		return Promise.resolve();
	}

	let target: HTMLElement | null | undefined;
	const root = document.documentElement;

	if (kind) {
		root.dataset.morph = kind;
	}

	// Only one element may hold the name in each snapshot, so it moves from `from` to `to` mid-transition.
	from.style.viewTransitionName = name;

	const transition = document.startViewTransition(() => {
		from.style.viewTransitionName = '';
		flushSync(update);
		target = to();

		if (target) {
			target.style.viewTransitionName = name;
		}
	});

	if (passThrough) {
		passClicksThrough(transition);
	}

	return transition.finished.then(() => {
		if (target) {
			target.style.viewTransitionName = '';
		}

		// A newer morph that started before this one finished owns the attribute now.
		if (kind && root.dataset.morph === kind) {
			delete root.dataset.morph;
		}
	});
}

export default { morph };
