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
	// Set for a liveness job: checked as a PROPERTY and named in `violated` when it fails.
	property?: string;
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
// code at the sync commit, so a violation there is a bug; `before-fix*` keep the old order as witnesses.
const EXPECTED: Record<string, string[]> = {
	current: [],
	'current-pending-updates': [],
	// The code before approval published after `decide`: the same findings the replays showed on it.
	'before-fix': [
		'PublicOnlyIfLive',
		'PublicOnlyIfLiveAtRest',
		'PublicMatchesLive',
		'RejectedNeverPublic',
	],
	'before-fix-pending-updates': [
		'PublicOnlyIfLive',
		'PublicOnlyIfLiveAtRest',
		'PublicMatchesLive',
		'RejectedNeverPublic',
	],
	// Without the CAS a late reject also overwrites an approval whose files are already public.
	'broken-no-cas': ['DecidedOnce', 'RejectedNeverPublic'],
	// A repeated approval also publishes whatever the staged object holds, so a tampered one goes public.
	'broken-no-hash-check': ['LiveIsReviewed', 'PublicMatchesLive'],
};

// Liveness jobs: configs run under fairness, each checking LiveEventuallyPublic.
const LIVENESS = 'LiveEventuallyPublic';
const EXPECTED_LIVENESS: Record<string, Outcome> = {
	'current-liveness': 'holds',
	// Without the recovery step a failed public write leaves a live version without its files for good.
	'broken-no-recovery': 'violated',
};

const LABELS: Record<string, string> = {
	Stage: 'createSubmission stages the bundle read at the pin',
	Create: 'createSubmission -> reserve() records it pending_review with its sha256',
	Tamper: 'a write to the staging bucket outside the app',
	Purge: 'purgeUserSubmissions (ban) cancels',
	Orphan: 'sweepStaging deletes an orphaned staged object',
	Start: 'reviewSubmission -> requireReviewable passes',
	RetryStart:
		'the approval is repeated: commitReview sees the live version pending and republishes',
	ReadFail: 'readVerified fails (staging, GitHub)',
	ReadOk: 'readVerified reads (or refetches from the pin) and re-hashes the bundle',
	WriteFail: 'a public write fails after decide committed; the request errors with no cleanup',
	ReadStaged:
		'readVerified reads (or refetches from the pin) and re-hashes the bundle, and reads the pinned media and extra files',
	WriteBundle: 'writeFiles (after decide) writes the public bundle',
	WriteManifest: 'writeFiles (after decide) writes the public manifest.json',
	WritePage: 'writeFiles (after decide) writes the public ADDON.md, page.json and media/',
	WriteFiles: 'writeFiles (after decide) writes the public extra files and compiled bundles',
	Decide: 'commitReview transaction (decideSubmission, makeLive)',
	Cleanup: 'staging.delete(row.stagingKey)',
};

const HIDDEN = new Set(['rowSha', 'wroteB', 'wroteM', 'wroteP', 'wroteF']);

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

	const dir = join(scratch, `${job.config}-${checked(job).join('-') || 'none'}`);
	const base = readFileSync(join(SPEC_DIR, `${job.config}.cfg`), 'utf8');

	// TLC resolves -config against the spec's directory, so each job runs on its own copy.
	mkdirSync(dir, { recursive: true });
	writeFileSync(
		join(dir, 'model.cfg'),
		`${base}${job.property ? 'PROPERTY' : 'INVARIANT'} ${checked(job).join(' ')}\n`,
	);
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
	const violated =
		/Invariant (\w+) is violated/.exec(output)?.[1] ??
		(output.includes('Temporal properties were violated') ? job.property : undefined);
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

function checked(job: Job): string[] {
	return job.property ? [job.property] : job.invariants;
}

function plan(): Job[] {
	return Object.entries(EXPECTED)
		.flatMap(([config, violated]) => {
			const holding = INVARIANTS.filter((invariant) => !violated.includes(invariant));
			const jobs: Job[] = violated.map((invariant) => ({
				config,
				invariants: [invariant],
				expected: 'violated',
			}));

			return [...jobs, { config, invariants: holding, expected: 'holds' }];
		})
		.concat(
			Object.entries(EXPECTED_LIVENESS).map(([config, expected]) => ({
				config,
				invariants: [],
				property: LIVENESS,
				expected,
			})),
		);
}

async function main() {
	const traceArg = process.argv.indexOf('--trace');
	const wanted = traceArg === -1 ? undefined : process.argv[traceArg + 1];
	const jobs = wanted
		? [
				wanted.endsWith(`:${LIVENESS}`)
					? {
							config: wanted.split(':')[0],
							invariants: [],
							property: LIVENESS,
							expected: 'violated' as const,
						}
					: {
							config: wanted.split(':')[0],
							invariants: [wanted.split(':')[1]],
							expected: 'violated' as const,
						},
			]
		: plan();

	const known = jobs[0].property
		? jobs[0].config in EXPECTED_LIVENESS
		: jobs[0].config in EXPECTED && INVARIANTS.includes(jobs[0].invariants[0]);

	if (wanted && !known) {
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
			(result.expected === 'holds' || result.violated === checked(job)[0]);

		unexpected += ok ? 0 : 1;
		console.log(
			`${ok ? 'ok  ' : 'FAIL'} ${job.config.padEnd(26)} ${(result.violated ?? checked(job).join(',')).padEnd(24)} ${result.actual.padEnd(9)} (expected ${job.expected}, ${result.states} states, ${result.seconds.toFixed(1)}s)`,
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
