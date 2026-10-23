import {
	copyFileSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';

type Outcome = 'holds' | 'violated';

type Job = {
	config: string;
	invariants: string[];
	expected: Outcome;
};

type Result = Job & {
	actual: Outcome | 'error';
	violated: string | undefined;
	output: string;
	seconds: number;
	states: string;
};

type TraceState = {
	action: string;
	vars: Map<string, string>;
};

const TLA_VERSION = '1.7.4';
const TLA_SHA256 = '936a262061c914694dfd669a543be24573c45d5aa0ff20a8b96b23d01e050e88';
const TLA_URL = `https://github.com/tlaplus/tlaplus/releases/download/v${TLA_VERSION}/tla2tools.jar`;
const JAR = join(homedir(), '.cache', 'tlaplus', TLA_VERSION, 'tla2tools.jar');
const SPEC_DIR = join(import.meta.dir, '..', 'spec');

// The host shares memory with other services: one TLC at a time, a capped heap, two workers.
const JAVA_FLAGS = ['-Xmx3g', '-XX:+UseParallelGC'];
const TLC_WORKERS = '2';
const MIN_FREE_GB = 8;
const JOB_TIMEOUT_MS = 300_000;

const INVARIANTS = [
	'PublicOnlyIfLive',
	'PublicOnlyIfLiveAtRest',
	'PublicMatchesLive',
	'LiveIsReviewed',
	'DecidedOnce',
	'RejectedNeverPublic',
];

// Invariants each config is expected to violate; every other one must hold. `current*` describe the
// code at the sync commit, so a violation there is a known finding (see ../SKILL.md).
const EXPECTED: Record<string, string[]> = {
	current: [
		'PublicOnlyIfLive',
		'PublicOnlyIfLiveAtRest',
		'PublicMatchesLive',
		'RejectedNeverPublic',
	],
	'current-pending-updates': [
		'PublicOnlyIfLive',
		'PublicOnlyIfLiveAtRest',
		'PublicMatchesLive',
		'RejectedNeverPublic',
	],
	reordered: [],
	'reordered-pending-updates': [],
	// Without the CAS a late reject also overwrites an approval whose files are already public.
	'broken-no-cas': ['DecidedOnce', 'RejectedNeverPublic'],
	'broken-no-hash-check': ['LiveIsReviewed'],
};

const LABELS: Record<string, string> = {
	Create: 'createSubmission -> reserve() opens a submission',
	Put: 'author PUTs to the presigned upload URL',
	Finalize: 'finalizeSubmission records sha256, status pending_review',
	Expire: 'sweepStaging expires the reservation',
	Purge: 'purgeUserSubmissions (ban) cancels',
	Orphan: 'sweepStaging deletes an orphaned staged object',
	Start: 'reviewSubmission -> requirePendingReview passes',
	ReadStaged: 'publishArtifact reads and re-hashes the staged bundle',
	WriteBundle: 'publishArtifact writes the public bundle',
	WriteManifest: 'publishArtifact writes the public manifest.json',
	Decide: 'decide() transaction',
	Cleanup: 'staging.delete(row.stagingKey)',
};

const HIDDEN = new Set(['rowSha', 'wroteB', 'wroteM']);

async function ensureJar() {
	if (!existsSync(JAR)) {
		mkdirSync(join(JAR, '..'), { recursive: true });

		const response = await fetch(TLA_URL);

		if (!response.ok) {
			throw new Error(`Failed to download ${TLA_URL}: ${response.status}`);
		}

		await Bun.write(JAR, await response.arrayBuffer());
	}

	const digest = new Bun.CryptoHasher('sha256').update(await Bun.file(JAR).bytes()).digest('hex');

	if (digest !== TLA_SHA256) {
		throw new Error(
			`${JAR} has sha256 ${digest}, expected ${TLA_SHA256}. Delete it and rerun.`,
		);
	}
}

function freeGigabytes(): number {
	const line = readFileSync('/proc/meminfo', 'utf8')
		.split('\n')
		.find((entry) => entry.startsWith('MemAvailable:'));

	return line ? Number(line.split(/\s+/)[1]) / 1024 / 1024 : Infinity;
}

async function run(job: Job, scratch: string): Promise<Result> {
	const free = freeGigabytes();

	if (free < MIN_FREE_GB) {
		throw new Error(
			`Only ${free.toFixed(1)} GB available; TLC needs ${MIN_FREE_GB} GB headroom.`,
		);
	}

	const dir = join(scratch, `${job.config}-${job.invariants.join('-') || 'none'}`);
	const base = readFileSync(join(SPEC_DIR, `${job.config}.cfg`), 'utf8');

	// TLC resolves -config against the spec's directory, so each job runs on its own copy.
	mkdirSync(dir, { recursive: true });
	writeFileSync(join(dir, 'model.cfg'), `${base}INVARIANT ${job.invariants.join(' ')}\n`);
	copyFileSync(join(SPEC_DIR, 'ReviewPublish.tla'), join(dir, 'ReviewPublish.tla'));

	const started = performance.now();
	const child = Bun.spawn(
		[
			'java',
			...JAVA_FLAGS,
			'-cp',
			JAR,
			'tlc2.TLC',
			'-workers',
			TLC_WORKERS,
			'-metadir',
			'states',
			'-config',
			'model.cfg',
			'ReviewPublish.tla',
		],
		{ stdout: 'pipe', stderr: 'pipe', cwd: dir, timeout: JOB_TIMEOUT_MS },
	);
	const [stdout, stderr] = await Promise.all([
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
	]);

	await child.exited;

	const output = stdout + stderr;
	const violated = /Invariant (\w+) is violated/.exec(output)?.[1];
	const states = /([\d,]+) distinct states found/.exec(output)?.[1] ?? '?';
	let actual: Result['actual'] = 'error';

	if (violated) {
		actual = 'violated';
	} else if (output.includes('No error has been found')) {
		actual = 'holds';
	}

	return {
		...job,
		actual,
		violated,
		output,
		states,
		seconds: (performance.now() - started) / 1000,
	};
}

function parseTrace(output: string): TraceState[] {
	const states: TraceState[] = [];
	let last: string | undefined;

	for (const line of output.split('\n')) {
		const header = /^State \d+: <(\w+)/.exec(line);

		if (header) {
			states.push({ action: header[1] === 'Initial' ? 'Init' : header[1], vars: new Map() });
			last = undefined;
			continue;
		}

		const state = states.at(-1);

		if (!state) {
			continue;
		}

		const assignment = /^\/\\ (\w+) = (.*)$/.exec(line);

		if (assignment) {
			last = assignment[1];
			state.vars.set(last, assignment[2]);
		} else if (last && line.startsWith(' ')) {
			state.vars.set(last, `${state.vars.get(last)} ${line.trim()}`);
		} else if (line.trim() === '') {
			last = undefined;
		}
	}

	return states;
}

function printTrace(result: Result) {
	const states = parseTrace(result.output);

	console.log(`\nCounterexample for ${result.violated} in ${result.config}.cfg:`);

	for (let i = 1; i < states.length; i++) {
		const previous = states[i - 1];
		const state = states[i];
		const changed = [...state.vars].filter(
			([name, value]) => !HIDDEN.has(name) && previous.vars.get(name) !== value,
		);

		console.log(`  ${i}. ${LABELS[state.action] ?? state.action}`);

		for (const [name, value] of changed) {
			console.log(`       ${name} = ${value}`);
		}
	}
}

function plan(): Job[] {
	return Object.entries(EXPECTED).flatMap(([config, violated]) => {
		const holding = INVARIANTS.filter((invariant) => !violated.includes(invariant));
		const jobs: Job[] = violated.map((invariant) => ({
			config,
			invariants: [invariant],
			expected: 'violated',
		}));

		return [...jobs, { config, invariants: holding, expected: 'holds' }];
	});
}

async function main() {
	const traceArg = process.argv.indexOf('--trace');
	const wanted = traceArg === -1 ? undefined : process.argv[traceArg + 1];
	const jobs = wanted
		? [
				{
					config: wanted.split(':')[0],
					invariants: [wanted.split(':')[1]],
					expected: 'violated' as const,
				},
			]
		: plan();

	if (wanted && !(jobs[0].config in EXPECTED && INVARIANTS.includes(jobs[0].invariants[0]))) {
		throw new Error(
			`No job ${wanted}; use <config>:<Invariant>, e.g. current:RejectedNeverPublic.`,
		);
	}

	await ensureJar();

	const scratch = mkdtempSync(join(tmpdir(), 'verify-review-publish-'));
	const started = performance.now();
	let unexpected = 0;

	if (!wanted) {
		console.log('Replaying the counterexamples on the real code (scripts/replay.ts):');

		const replay = Bun.spawnSync(['bun', join(import.meta.dir, 'replay.ts')], {
			stdout: 'inherit',
			stderr: 'inherit',
		});

		unexpected += replay.exitCode === 0 ? 0 : 1;
		console.log('Model checking spec/ReviewPublish.tla with TLC:');
	}

	for (const job of jobs) {
		const result = await run(job, scratch);
		const ok =
			result.actual === result.expected &&
			(result.expected === 'holds' || result.violated === job.invariants[0]);

		unexpected += ok ? 0 : 1;
		console.log(
			`${ok ? 'ok  ' : 'FAIL'} ${job.config.padEnd(26)} ${(result.violated ?? job.invariants.join(',')).padEnd(24)} ${result.actual.padEnd(9)} (expected ${job.expected}, ${result.states} states, ${result.seconds.toFixed(1)}s)`,
		);

		if (result.actual === 'error') {
			console.log(result.output);
		} else if (result.actual === 'violated' && (wanted || !ok)) {
			printTrace(result);
		}
	}

	rmSync(scratch, { recursive: true, force: true });
	console.log(
		`\n${unexpected === 0 ? 'All outcomes match EXPECTED' : `${unexpected} unexpected outcome(s)`} in ${((performance.now() - started) / 1000).toFixed(1)}s.`,
	);
	process.exit(unexpected === 0 ? 0 : 1);
}

await main();
