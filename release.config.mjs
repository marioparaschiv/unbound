const config = {
	branches: ['main'],
	plugins: [
		[
			'@semantic-release/commit-analyzer',
			{
				// Defaults cover breaking (major), feat (minor), and fix/perf/revert (patch);
				// these make the remaining commitlint types release a patch too.
				releaseRules: [
					{ type: 'build', release: 'patch' },
					{ type: 'ci', release: 'patch' },
					{ type: 'docs', release: 'patch' },
					{ type: 'refactor', release: 'patch' },
					{ type: 'style', release: 'patch' },
					{ type: 'test', release: 'patch' },
				],
			},
		],
		'@semantic-release/release-notes-generator',
		[
			'@semantic-release/exec',
			{
				verifyConditionsCmd: 'test -n "$NPM_CONFIG_TOKEN"',
				prepareCmd:
					"bun scripts/prepare-release.ts ${nextRelease.version} '${lastRelease.gitTag}'",
				publishCmd:
					'bun scripts/publish-package.ts packages/debugger-protocol && bun scripts/publish-package.ts packages/cli && cd packages/api && bun publish --access public',
			},
		],
		[
			'@semantic-release/git',
			{
				assets: [
					'bun.lock',
					'apps/*/package.json',
					'packages/*/package.json',
					'packages/client/scripts/*/package.json',
					'packages/api/src/**',
				],
			},
		],
		'@semantic-release/github',
	],
};

export default config;
