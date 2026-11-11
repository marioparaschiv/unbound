import type { AddonLogger } from '@unbound-app/types';
import { expect, test } from 'bun:test';

import { createStartLog } from '~/addons/start-log';

function fakeLogger() {
	const written: string[] = [];
	const write =
		(level: string) =>
		(...args: unknown[]) =>
			written.push(`${level}: ${args.map(String).join(' ')}`);
	const logger: AddonLogger = {
		log: write('log'),
		info: write('info'),
		success: write('success'),
		debug: write('debug'),
		warn: write('warn'),
		error: write('error'),
	};

	return { logger, written };
}

test('records warnings and errors until the start ends, and still writes every line', () => {
	const { logger, written } = fakeLogger();
	const log = createStartLog(logger);

	log.logger.info('starting');
	log.logger.warn('Member list skipped: Discord moved UserRow.');
	log.logger.error('Failed to patch profiles:', new Error('boom'));
	log.end();
	log.logger.warn('later');

	expect(log.issues).toEqual([
		'Member list skipped: Discord moved UserRow.',
		'Failed to patch profiles: boom',
	]);
	expect(written).toHaveLength(4);
});
