import { useEffect, useState } from 'react';

/**
 * @description Tracks which of the page's sections sits in the reading band near the top of the viewport.
 * @param ids The section element ids, in page order.
 * @returns The active id and a setter, so a nav click can claim a section too short to reach the band.
 */
function useScrollSpy(ids: string[]) {
	const [active, setActive] = useState(ids[0]);
	const key = ids.join();

	useEffect(() => {
		const order = key.split(',');
		const visible = new Map<string, boolean>();
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					visible.set(entry.target.id, entry.isIntersecting);
				}

				const first = order.find((id) => visible.get(id));

				if (first) {
					setActive(first);
				}
			},
			{ rootMargin: '-15% 0px -65% 0px' },
		);

		for (const id of order) {
			const element = document.getElementById(id);

			if (element) {
				observer.observe(element);
			}
		}

		return () => observer.disconnect();
	}, [key]);

	return [active, setActive] as const;
}

export default useScrollSpy;
