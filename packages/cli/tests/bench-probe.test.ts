import { describe, expect, test } from 'bun:test';
import { runInNewContext } from 'node:vm';

import { gcProbe, hermesSampleSchema } from '../src/bench/probe';

const MB = 1024 * 1024;

type FakeRuntime = {
	__unboundBenchLaunch: string;
	HermesInternal: { getInstrumentedStats: () => Record<string, number | string> };
	gc?: () => void;
	globalThis?: FakeRuntime;
};

function runtime(withGc: boolean): FakeRuntime {
	const heap = { allocated: 52 * MB, live: 43 * MB };
	const globals: FakeRuntime = {
		__unboundBenchLaunch: 'launch-1',
		HermesInternal: {
			getInstrumentedStats: () => ({
				js_allocatedBytes: heap.allocated,
				js_gcCPUTime: 'n/a',
			}),
		},
	};

	if (withGc) {
		globals.gc = () => {
			heap.allocated = heap.live;
		};
	}

	globals.globalThis = globals;

	return globals;
}

describe('bench gc probe', () => {
	test('reads the heap counters after a forced GC, so allocations count only live objects', () => {
		const answer = hermesSampleSchema.parse(
			JSON.parse(runInNewContext(gcProbe(), runtime(true))),
		);

		expect(answer).toEqual({ launch: 'launch-1', hermes: { js_allocatedBytes: 43 * MB } });
	});

	test('returns no counters when the runtime has no gc', () => {
		const answer = hermesSampleSchema.parse(
			JSON.parse(runInNewContext(gcProbe(), runtime(false))),
		);

		expect(answer).toEqual({ launch: 'launch-1', hermes: null });
	});
});
