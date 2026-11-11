import { MAINTENANCE_URL } from '@unbound-app/web/testing';
import { test } from 'bun:test';

if (MAINTENANCE_URL) {
	await import('./login.suite');
} else {
	test.skip('ubd auth login and logout needs Postgres: set DATABASE_DIRECT_URL in apps/web/.env', () => {});
}
