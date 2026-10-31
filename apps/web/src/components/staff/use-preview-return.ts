import { useEffect } from 'react';
import { z } from 'zod/mini';

const RETURN_STATE = z.object({ id: z.string(), open: z.boolean(), y: z.number() });

type ReturnState = z.infer<typeof RETURN_STATE>;

const KEY = 'review-preview-return';

// The page is short until the details panel finishes opening, so the scroll is retried for this long.
const SETTLE_MS = 1000;

/**
 * @description Remembers the queue's scroll and the card's open state before leaving for a preview.
 * @param id The submission being previewed.
 * @param open Whether its details are open.
 */
export function savePreviewReturn(id: string, open: boolean) {
	const state: ReturnState = { id, open, y: scrollY };

	sessionStorage.setItem(KEY, JSON.stringify(state));
}

function readSaved(): ReturnState | null {
	const raw = sessionStorage.getItem(KEY);

	if (!raw) return null;

	try {
		const result = RETURN_STATE.safeParse(JSON.parse(raw));

		return result.success ? result.data : null;
	} catch {
		// Not JSON: another version of the page wrote it, so there is nothing to restore.
		return null;
	}
}

/**
 * @description Restores a card left for a preview when Back reloaded the queue instead of restoring it
 * from the back/forward cache.
 * @param id This card's submission id.
 * @param setOpen Opens the card's details.
 */
export function usePreviewReturn(id: string, setOpen: (open: boolean) => void) {
	useEffect(() => {
		// A cached restore already kept everything, so the saved state is stale from then on.
		function onPageShow(event: PageTransitionEvent) {
			if (event.persisted) {
				sessionStorage.removeItem(KEY);
			}
		}

		addEventListener('pageshow', onPageShow);

		const saved = readSaved();

		if (saved?.id === id) {
			setOpen(saved.open);

			const start = performance.now();
			let frame = 0;

			// The state is cleared only once the scroll lands: a dev double-mount cancels the first loop.
			function settle() {
				scrollTo(0, saved?.y ?? 0);

				if (
					Math.abs(scrollY - (saved?.y ?? 0)) <= 1 ||
					performance.now() - start > SETTLE_MS
				) {
					sessionStorage.removeItem(KEY);

					return;
				}

				frame = requestAnimationFrame(settle);
			}

			frame = requestAnimationFrame(settle);

			return () => {
				cancelAnimationFrame(frame);
				removeEventListener('pageshow', onPageShow);
			};
		}

		return () => removeEventListener('pageshow', onPageShow);
	}, [id, setOpen]);
}

export default { savePreviewReturn, usePreviewReturn };
