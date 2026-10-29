import { describe, expect, test } from 'bun:test';

import { createFlatRecovery } from './flat-recovery';

function foreground() {
	const listeners = new Set<() => void>();

	return {
		subscribe(listener: () => void) {
			listeners.add(listener);

			return () => listeners.delete(listener);
		},
		emit: () => listeners.forEach((listener) => listener()),
		count: () => listeners.size,
	};
}

describe('createFlatRecovery', () => {
	test('repaints flat cards when the app returns to the foreground', () => {
		const app = foreground();
		const repainted: string[] = [];
		const recovery = createFlatRecovery((item: string) => repainted.push(item), app.subscribe);

		recovery.mark('a', true);
		recovery.mark('b', true);
		recovery.mark('b', false);
		app.emit();

		expect(repainted).toEqual(['a']);
		recovery.dispose();
	});

	test('stops listening once every card highlights', () => {
		const app = foreground();
		const recovery = createFlatRecovery(() => undefined, app.subscribe);

		recovery.mark('a', true);
		expect(app.count()).toBe(1);

		recovery.mark('a', false);
		expect(app.count()).toBe(0);
	});

	test('repaints flat cards on the interval', async () => {
		const app = foreground();
		const repainted: string[] = [];
		const recovery = createFlatRecovery(
			(item: string) => repainted.push(item),
			app.subscribe,
			5,
		);

		recovery.mark('a', true);
		await new Promise((resolve) => setTimeout(resolve, 30));
		recovery.dispose();

		expect(repainted.length).toBeGreaterThan(1);
		expect(app.count()).toBe(0);
	});
});
