/**
 * Every check id `--only` accepts, in run order, for `ubd check --help` to list without loading the
 * checks. Matches `listCheckIds()`; a test fails when they drift.
 */
export const CHECK_IDS: readonly string[] = [
	'naming',
	'capabilities',
	'layout',
	'page',
	'i18n',
	'messages',
	'lint',
	'bundle',
	'manifest',
	'text-input-props',
	'types',
	'locales',
	'filters',
	'assets',
	'commands',
	'entry',
	'settings',
];

export default CHECK_IDS;
