import { useEffect, useRef, useState } from 'react';

import type { HeroTone } from './describe-hero';

/** How long a replaced badge stays mounted while it pops out; matches `EXIT_MS` in `use-badge-motion`. */
const EXIT_MS = 240;

/** What one badge shows: its colour, icon and whether it spins. */
export type BadgeLook = {
	tone: HeroTone;
	icon: string;
	spinning: boolean;
};

export type BadgeLayer = BadgeLook & {
	id: number;
	/** False for the first badge, which shows without animating in. */
	entering: boolean;
	leaving: boolean;
};

function sameLook(a: BadgeLook, b: BadgeLook) {
	return a.tone === b.tone && a.icon === b.icon && a.spinning === b.spinning;
}

/**
 * @description Keeps the hero badge's layers: the current look, and each replaced one until it has popped out.
 * @param look What the badge shows now.
 * @returns The layers to stack, oldest first.
 */
function useBadgeLayers(look: BadgeLook): BadgeLayer[] {
	const next = useRef(1);
	const [layers, setLayers] = useState<BadgeLayer[]>([
		{ ...look, id: 0, entering: false, leaving: false },
	]);

	useEffect(() => {
		const current = layers.find((layer) => !layer.leaving);

		if (current && sameLook(current, look)) return;

		const id = next.current++;

		setLayers((previous) => [
			...previous.map((layer) => ({ ...layer, leaving: true })),
			{ ...look, id, entering: true, leaving: false },
		]);

		// A later change clears this timer and sets its own, which drops these layers too.
		const timer = setTimeout(
			() => setLayers((previous) => previous.filter((layer) => !layer.leaving)),
			EXIT_MS,
		);

		return () => clearTimeout(timer);
	}, [look.tone, look.icon, look.spinning]);

	return layers;
}

export default useBadgeLayers;
