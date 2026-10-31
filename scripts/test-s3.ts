import { execFileSync, spawnSync } from 'node:child_process';
import { join } from 'node:path';

// Runs the `*.s3.ts` integration tests against a throwaway MinIO container. They are kept out of
// the default `bun test` run because they need podman.

const ROOT = join(import.meta.dir, '..');
const IMAGE = process.env.MINIO_IMAGE ?? 'cgr.dev/chainguard/minio';
const CONTAINER = `unbound-test-minio-${process.pid}`;
const USER = 'unbound-test';
const PASSWORD = 'unbound-test-password';
const BUCKETS = { S3_STAGING_BUCKET: 'unbound-staging', S3_PUBLIC_BUCKET: 'unbound-addons' };

function podman(...args: string[]): string {
	return execFileSync('podman', args, { encoding: 'utf8' }).trim();
}

function findTests(): string[] {
	const tests = new Bun.Glob('{apps,packages}/**/*.s3.ts').scanSync({ cwd: ROOT });

	return [...tests].filter((path) => !path.includes('node_modules')).map((path) => `./${path}`);
}

function run(tests: string[]): number {
	podman(
		'run',
		'--detach',
		'--rm',
		'--name',
		CONTAINER,
		'--publish',
		'127.0.0.1::9000',
		'--env',
		`MINIO_ROOT_USER=${USER}`,
		'--env',
		`MINIO_ROOT_PASSWORD=${PASSWORD}`,
		'--env',
		`MC_HOST_local=http://${USER}:${PASSWORD}@127.0.0.1:9000`,
		IMAGE,
		'server',
		'/data',
	);

	try {
		// `mc ready` blocks until the server answers its health check.
		podman('exec', CONTAINER, 'mc', 'ready', 'local');
		podman(
			'exec',
			CONTAINER,
			'mc',
			'mb',
			...Object.values(BUCKETS).map((name) => `local/${name}`),
		);
		podman(
			'exec',
			CONTAINER,
			'mc',
			'anonymous',
			'set',
			'download',
			`local/${BUCKETS.S3_PUBLIC_BUCKET}`,
		);

		const address = podman('port', CONTAINER, '9000/tcp');

		const result = spawnSync('bun', ['test', ...tests], {
			cwd: ROOT,
			stdio: 'inherit',
			env: {
				...process.env,
				...BUCKETS,
				S3_ENDPOINT: `http://${address}`,
				S3_REGION: 'us-east-1',
				S3_ACCESS_KEY_ID: USER,
				S3_SECRET_ACCESS_KEY: PASSWORD,
			},
		});

		return result.status ?? 1;
	} finally {
		podman('stop', '--time', '0', CONTAINER);
	}
}

const requested = process.argv.slice(2);
const tests = requested.length > 0 ? requested : findTests();

if (tests.length === 0) {
	throw new Error('No *.s3.ts tests found.');
}

process.exitCode = run(tests);
