const RETRY_DELAY_MS = 60;
const MAX_RETRIES = 5;

export type RewriteRetry = {
	retry(key: string, run: () => void): void;
	succeeded(key: string): void;
	clear(): void;
};

/**
 * @description Retries a text rewrite another plugin's rule declined, once the view shows that plugin's rewritten text to build on.
 * @returns `retry` schedules another attempt for a view, up to five; `succeeded` and `clear` forget the attempts.
 */
export function createRewriteRetry(): RewriteRetry {
	const attempts = new Map<string, number>();
	const timers = new Set<ReturnType<typeof setTimeout>>();

	return {
		retry(key, run) {
			const count = (attempts.get(key) ?? 0) + 1;

			if (count > MAX_RETRIES) return;

			attempts.set(key, count);

			const timer = setTimeout(() => {
				timers.delete(timer);
				run();
			}, RETRY_DELAY_MS);

			timers.add(timer);
		},
		succeeded(key) {
			attempts.delete(key);
		},
		clear() {
			for (const timer of timers) clearTimeout(timer);

			timers.clear();
			attempts.clear();
		},
	};
}

export default createRewriteRetry;
