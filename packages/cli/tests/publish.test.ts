import { MAINTENANCE_URL } from '@unbound-app/web/testing';
import { test } from 'bun:test';

if (MAINTENANCE_URL) {
	await import('./publish.suite');
} else {
	test.skip('ubd publish needs Postgres: set DATABASE_DIRECT_URL in apps/web/.env', () => {});
}
