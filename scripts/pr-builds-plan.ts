import { appendFileSync } from 'node:fs';

export type PlanEnv = Record<string, string | undefined>;

export type PullRequestPlan = {
	enabled: boolean;
	stage: boolean;
	bundleUrl: string;
	loaderUrl: string;
	reason: string;
};

export type CommentInput = {
	enabled: boolean;
	uploaded: boolean;
	bundleUrl: string;
	loaderUrl: string;
	reason: string;
	files: string[];
};

const REQUIRED_VARIABLES = ['S3_ENDPOINT', 'S3_REGION', 'S3_PUBLIC_BUCKET', 'CDN_URL'] as const;

const BUCKET_SECRETS = ['S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'] as const;

const SIGNING_SECRET = 'UNBOUND_PR_BUNDLE_SIGNING_KEY';

const SAFE_URL = /^https:\/\/[A-Za-z0-9.-]+(:[0-9]+)?\/[A-Za-z0-9._~/-]*\/$/;

/**
 * @description Decides whether a pull request's builds go to the bucket and where they will live.
 * @param env The pull request number, whether it comes from a fork, the bucket variables, and which secrets are set.
 * @returns Whether uploads run, the bundle and loader base URLs, and why uploads are off.
 */
export function planPullRequestBuilds(env: PlanEnv): PullRequestPlan {
	const off = (reason: string): PullRequestPlan => ({
		enabled: false,
		stage: false,
		bundleUrl: '',
		loaderUrl: '',
		reason,
	});
	const pullRequest = env.PR_NUMBER ?? '';

	if (!/^[1-9][0-9]*$/.test(pullRequest)) {
		return off('S3 uploads only run for pull requests.');
	}

	const urls = pullRequestUrls(env.CDN_URL, pullRequest);

	if (env.IS_FORK === 'true') {
		if (!urls) {
			return off(
				'This fork build is not staged for S3 because the CDN_URL variable is not available to it. Test it from the artifacts above.',
			);
		}

		return {
			enabled: false,
			stage: true,
			...urls,
			reason: 'This fork build runs without secrets, so the trusted Pull Request Builds Publish workflow signs its bundles with the pull request key and uploads them once this run succeeds.',
		};
	}

	const missing = [
		...REQUIRED_VARIABLES.filter((name) => !env[name]?.trim()).map(
			(name) => `variable ${name}`,
		),
		...[...BUCKET_SECRETS, SIGNING_SECRET]
			.filter((name) => env[`HAS_${name}`] !== 'true')
			.map((name) => `secret ${name}`),
	];

	if (missing.length) {
		return off(`S3 uploads are off until these are configured: ${missing.join(', ')}.`);
	}

	if (!urls) {
		return off('S3 uploads are off because CDN_URL is not a plain https URL.');
	}

	return { enabled: true, stage: false, ...urls, reason: '' };
}

/**
 * @description The bundle and loader base URLs of a pull request, when the CDN URL is usable in a loader build.
 * @param cdnUrl The public base URL of the bucket.
 * @param pullRequest The pull request number.
 * @returns Both base URLs, or `undefined` when the CDN URL is missing or not a plain https URL.
 */
export function pullRequestUrls(
	cdnUrl: string | undefined,
	pullRequest: string,
): Pick<PullRequestPlan, 'bundleUrl' | 'loaderUrl'> | undefined {
	const base = cdnUrl?.trim().replace(/\/+$/, '');

	if (!base || !/^[1-9][0-9]*$/.test(pullRequest)) {
		return;
	}

	const bundleUrl = `${base}/unbound/pr/${pullRequest}/`;

	return SAFE_URL.test(bundleUrl)
		? { bundleUrl, loaderUrl: `${base}/loader/pr/${pullRequest}/` }
		: void 0;
}

/**
 * @description Decides whether a closed pull request's builds can be deleted from the bucket.
 * @param env The pull request number, the bucket variables, and which secrets are set.
 * @returns An empty string when the cleanup runs, otherwise why it is skipped.
 */
export function cleanupSkipReason(env: PlanEnv): string {
	if (!/^[1-9][0-9]*$/.test(env.PR_NUMBER ?? '')) {
		return 'Cleanup only runs for pull requests.';
	}

	const missing = [
		...REQUIRED_VARIABLES.filter((name) => name !== 'CDN_URL' && !env[name]?.trim()).map(
			(name) => `variable ${name}`,
		),
		...BUCKET_SECRETS.filter((name) => env[`HAS_${name}`] !== 'true').map(
			(name) => `secret ${name}`,
		),
	];

	return missing.length
		? `S3 cleanup is off until these are configured: ${missing.join(', ')}.`
		: '';
}

/**
 * @description Renders the S3 section of the pull request comment.
 * @param input The plan, whether the upload succeeded, and the uploaded loader file names.
 * @returns The markdown section.
 */
export function renderCommentSection(input: CommentInput): string {
	if (!input.enabled) {
		return `#### S3\n${input.reason}`;
	}

	if (!input.uploaded) {
		return '#### S3\nThe upload to S3 failed, so the links below may still point at an earlier push. See the workflow run.';
	}

	const links = input.files.map((file) => `- [**${file}**](${input.loaderUrl}${file})`);

	return [
		'#### S3',
		`- Client bundle: ${input.bundleUrl}`,
		...links,
		'',
		"These loader builds load this pull request's bundle from that URL by default, so they need no settings changes. Every push replaces them at the same links.",
	].join('\n');
}

/**
 * @description Writes `key=value` lines, or a heredoc for multi-line values, to a GitHub Actions file.
 * @param path The `GITHUB_OUTPUT` file, or nothing to print instead.
 * @param values The outputs to write.
 */
export function writeOutputs(path: string | undefined, values: Record<string, string>) {
	const lines = Object.entries(values).map(([key, value]) => {
		if (!value.includes('\n')) {
			return `${key}=${value}\n`;
		}

		const delimiter = `EOF_${crypto.randomUUID().replaceAll('-', '')}`;

		return `${key}<<${delimiter}\n${value}\n${delimiter}\n`;
	});

	if (path) {
		appendFileSync(path, lines.join(''));
	} else {
		process.stdout.write(lines.join(''));
	}
}

if (import.meta.main) {
	const command = process.argv[2];

	if (command === 'plan') {
		const plan = planPullRequestBuilds(process.env);

		writeOutputs(process.env.GITHUB_OUTPUT, {
			enabled: String(plan.enabled),
			stage: String(plan.stage),
			bundle_url: plan.bundleUrl,
			loader_url: plan.loaderUrl,
			reason: plan.reason,
		});

		if (process.env.GITHUB_STEP_SUMMARY) {
			appendFileSync(
				process.env.GITHUB_STEP_SUMMARY,
				plan.enabled
					? `PR builds upload to ${plan.bundleUrl} and ${plan.loaderUrl}.\n`
					: `${plan.reason}\n`,
			);
		}
	} else if (command === 'cleanup') {
		const reason = cleanupSkipReason(process.env);

		writeOutputs(process.env.GITHUB_OUTPUT, { enabled: String(!reason), reason });

		if (reason && process.env.GITHUB_STEP_SUMMARY) {
			appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${reason}\n`);
		}
	} else if (command === 'comment') {
		const section = renderCommentSection({
			enabled: process.env.ENABLED === 'true',
			uploaded: process.env.UPLOAD_RESULT === 'success',
			bundleUrl: process.env.BUNDLE_URL ?? '',
			loaderUrl: process.env.LOADER_URL ?? '',
			reason: process.env.REASON ?? '',
			files: (process.env.FILES ?? '')
				.split('\n')
				.map((file) => file.trim())
				.filter(Boolean),
		});

		writeOutputs(process.env.GITHUB_OUTPUT, { section });
	} else {
		throw new Error('usage: bun scripts/pr-builds-plan.ts <plan|cleanup|comment>');
	}
}
