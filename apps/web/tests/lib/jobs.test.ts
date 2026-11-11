import { describe, expect, test } from 'bun:test';

import { createJobs, startPeriodicJob } from '~/lib/jobs';

// An hour, so no interval tick fires during a test; runs come only from start and kicks.
const SECONDS = 3600;

function deferred() {
	let resolve = () => {};
	const promise = new Promise<void>((done) => {
		resolve = done;
	});

	return { promise, resolve };
}

describe('startPeriodicJob', () => {
	test('runs at once, and a kick reaches it through the registry', async () => {
		const jobs = createJobs();
		let runs = 0;
		const job = startPeriodicJob(jobs, 'team', SECONDS, async () => {
			runs += 1;
		});

		try {
			await Bun.sleep(0);
			jobs.kick('team');
			await Bun.sleep(0);

			expect(runs).toBe(2);
		} finally {
			job.stop();
		}
	});

	test('drops a kick while a run is still going', async () => {
		const jobs = createJobs();
		const gate = deferred();
		let runs = 0;
		const job = startPeriodicJob(jobs, 'team', SECONDS, async () => {
			runs += 1;
			await gate.promise;
		});

		try {
			jobs.kick('team');
			gate.resolve();
			await Bun.sleep(0);

			expect(runs).toBe(1);
		} finally {
			job.stop();
		}
	});

	test('keeps running after a failed run', async () => {
		const jobs = createJobs();
		let runs = 0;
		const job = startPeriodicJob(jobs, 'team', SECONDS, async () => {
			runs += 1;

			throw new Error('Run failed.');
		});

		try {
			await Bun.sleep(0);
			jobs.kick('team');
			await Bun.sleep(0);

			expect(runs).toBe(2);
		} finally {
			job.stop();
		}
	});

	test('stops for good, and a kick after stop does nothing', async () => {
		const jobs = createJobs();
		let runs = 0;
		const job = startPeriodicJob(jobs, 'team', SECONDS, async () => {
			runs += 1;
		});

		await Bun.sleep(0);
		job.stop();
		jobs.kick('team');
		job.kick();
		await Bun.sleep(0);

		expect(runs).toBe(1);
	});
});

describe('createJobs', () => {
	test('ignores a kick for a job never started', () => {
		expect(() => createJobs().kick('profiles')).not.toThrow();
	});

	test('stops the job a second start under the same name replaces', async () => {
		const jobs = createJobs();
		const runs = { first: 0, second: 0 };
		const first = startPeriodicJob(jobs, 'staging', SECONDS, async () => {
			runs.first += 1;
		});
		const second = startPeriodicJob(jobs, 'staging', SECONDS, async () => {
			runs.second += 1;
		});

		try {
			await Bun.sleep(0);
			jobs.kick('staging');
			first.kick();
			await Bun.sleep(0);

			expect(runs).toEqual({ first: 1, second: 2 });
		} finally {
			second.stop();
		}
	});
});
