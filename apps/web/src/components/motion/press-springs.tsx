import type { SpringConfig } from '@react-spring/web';
import { SpringValue } from '@react-spring/web';
import { useEffect } from 'react';

type PressKind = 'ledge' | 'flat';

type PressState = 'rest' | 'hover' | 'pressed';

type PressSpring = {
	kind: PressKind;
	value: SpringValue<number>;
};

// Ledge buttons travel in pixels down onto their ledge; flat ones scale. Both rest at their CSS fallback.
const TARGETS: Record<PressKind, Record<PressState, number>> = {
	ledge: { rest: 0, hover: -1, pressed: 4 },
	flat: { rest: 1, hover: 1, pressed: 0.96 },
};

const PROPERTY: Record<PressKind, string> = { ledge: '--press-y', flat: '--press-scale' };

// Down is quick and firm so the press registers under the finger; release overshoots a touch, like a key.
const PRESS: SpringConfig = { tension: 900, friction: 40 };
const RELEASE: SpringConfig = { tension: 520, friction: 22 };

const springs = new WeakMap<HTMLElement, PressSpring>();

function pressable(target: EventTarget | null): HTMLElement | null {
	if (!(target instanceof Element)) return null;

	const node = target.closest<HTMLElement>('.press, .press-flat');

	if (!node || node.matches(':disabled, [aria-disabled="true"]')) return null;

	return node;
}

function springFor(node: HTMLElement): PressSpring {
	// An element can carry both classes (a nav link that becomes a ledge button when active); the ledge wins.
	const kind: PressKind = node.classList.contains('press') ? 'ledge' : 'flat';
	const existing = springs.get(node);

	if (existing?.kind === kind) {
		return existing;
	}

	const value = new SpringValue(TARGETS[kind].rest, {
		onChange: ({ value: current }) => node.style.setProperty(PROPERTY[kind], String(current)),
	});
	const spring = { kind, value };

	springs.set(node, spring);

	return spring;
}

function animate(node: HTMLElement, state: PressState) {
	const { kind, value } = springFor(node);
	const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

	void value.start(TARGETS[kind][state], {
		config: state === 'pressed' ? PRESS : RELEASE,
		immediate: reduced,
	});
}

type PressFreeAnchor = {
	getBoundingClientRect: () => DOMRect;
	contextElement: Element;
};

/**
 * @description Wraps an element as a positioning anchor that reports its resting box, with its press offset and scale undone.
 * @param node A `.press` or `.press-flat` element, such as a popup trigger.
 * @returns A virtual element for Floating UI-based positioners.
 */
export function pressFreeAnchor(node: Element): PressFreeAnchor {
	return {
		contextElement: node,
		getBoundingClientRect: () => {
			const rect = node.getBoundingClientRect();
			const style = node instanceof HTMLElement ? node.style : null;
			const offset = Number.parseFloat(style?.getPropertyValue('--press-y') ?? '') || 0;
			const scale = Number.parseFloat(style?.getPropertyValue('--press-scale') ?? '') || 1;
			// Scale runs about the centre and translate moves the centre, so undo both from the centre out.
			const width = rect.width / scale;
			const height = rect.height / scale;
			const centreX = rect.x + rect.width / 2;
			const centreY = rect.y + rect.height / 2 - offset;

			return new DOMRect(centreX - width / 2, centreY - height / 2, width, height);
		},
	};
}

/**
 * @description Drives every `.press` and `.press-flat` element's press and hover motion with springs, from one set of listeners.
 * @returns Nothing; it renders no markup.
 */
function PressSprings() {
	useEffect(() => {
		let held: HTMLElement | null = null;

		function release() {
			if (!held) return;

			animate(held, held.matches(':hover') ? 'hover' : 'rest');
			held = null;
		}

		function onPointerDown(event: PointerEvent) {
			if (event.button !== 0) return;

			held = pressable(event.target);

			if (held) {
				animate(held, 'pressed');
			}
		}

		// Hover lift is for mice only: on touch it would stick after the tap.
		function onPointerOver(event: PointerEvent) {
			const node = pressable(event.target);

			if (!node || event.pointerType !== 'mouse' || node === held) return;

			if (!node.contains(event.relatedTarget as Node | null)) {
				animate(node, 'hover');
			}
		}

		function onPointerOut(event: PointerEvent) {
			const node = pressable(event.target);

			// A held press waits for pointerup: a modal menu opening on pointerdown turns off pointer events
			// on the page, which fires pointerout at the trigger mid-press and would cancel the sink at once.
			if (!node || node === held || node.contains(event.relatedTarget as Node | null)) return;

			animate(node, 'rest');
		}

		function onKeyDown(event: KeyboardEvent) {
			if ((event.key !== ' ' && event.key !== 'Enter') || event.repeat) return;

			const node = pressable(event.target);

			if (!node) return;

			held = node;
			animate(node, 'pressed');
		}

		const listeners = [
			['pointerdown', onPointerDown],
			['pointerup', release],
			['pointercancel', release],
			['pointerover', onPointerOver],
			['pointerout', onPointerOut],
			['keydown', onKeyDown],
			['keyup', release],
		] as const;

		for (const [type, listener] of listeners) {
			document.addEventListener(type, listener as EventListener, {
				capture: true,
				passive: true,
			});
		}

		return () => {
			for (const [type, listener] of listeners) {
				document.removeEventListener(type, listener as EventListener, { capture: true });
			}
		};
	}, []);

	return null;
}

export default PressSprings;
