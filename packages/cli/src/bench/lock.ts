import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { join } from 'node:path';

/** The vphone's one-driver lock, shared by every agent on this machine: a folder with an `owner` file. */
export const LOCK_DIR = '/tmp/unbound-vphone.lock';

const POLL_MS = 5_000;
const REPORT_EVERY_MS = 60_000;
const BENCH_OWNER = /^unbound-bench pid=(\d+)/;
/** An agent's claim from the ubd-vphone skill's `claim.sh`: it lapses at `until`, in epoch seconds. */
const AGENT_CLAIM = /^agent .* until=(\d+)/;

function holder(dir: string): string {
	try {
		return readFileSync(join(dir, 'owner'), 'utf8').trim();
	} catch {
		return '';
	}
}

function alive(pid: number): boolean {
	try {
		process.kill(pid, 0);

		return true;
	} catch (error) {
		return (error as NodeJS.ErrnoException).code === 'EPERM';
	}
}

/**
 * @description Whether a lock is stale: a bench run whose process is gone, or an agent claim past its expiry.
 * Other locks are never judged stale: they are waited for.
 * @param owner The lock's owner text.
 * @param isAlive Whether a process id still runs.
 * @param now The current time in milliseconds.
 * @returns `true` when the lock can be taken over.
 */
export function isStaleBenchLock(
	owner: string,
	isAlive: (pid: number) => boolean = alive,
	now = Date.now(),
): boolean {
	const bench = BENCH_OWNER.exec(owner);
	const claim = AGENT_CLAIM.exec(owner);

	return Boolean(
		(bench && !isAlive(Number(bench[1]))) || (claim && Number(claim[1]) * 1000 < now),
	);
}

/**
 * @description Takes the vphone lock, waiting while another driver holds it.
 * @param signal Stops the wait.
 * @param report Told who holds the lock, now and then while waiting.
 * @param dir The lock folder.
 * @returns A function that releases the lock if this run still owns it.
 */
export async function acquireLock(
	signal: AbortSignal,
	report: (owner: string) => void,
	dir = LOCK_DIR,
): Promise<() => void> {
	const owner = `unbound-bench pid=${process.pid} ${new Date().toISOString()}`;
	let reportedAt = 0;

	for (;;) {
		try {
			mkdirSync(dir);
			writeFileSync(join(dir, 'owner'), owner + '\n');

			return () => {
				if (holder(dir) === owner) {
					rmSync(dir, { recursive: true, force: true });
				}
			};
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
				throw error;
			}
		}

		const current = holder(dir);

		if (isStaleBenchLock(current)) {
			report(`${current} (stale, taking it over)`);
			rmSync(dir, { recursive: true, force: true });
			continue;
		}

		if (Date.now() - reportedAt >= REPORT_EVERY_MS) {
			report(current || 'an unnamed driver');
			reportedAt = Date.now();
		}

		await sleep(POLL_MS, undefined, { signal });
	}
}

export default { LOCK_DIR, isStaleBenchLock, acquireLock };
