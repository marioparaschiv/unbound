// The published `@unbound-app/web/testing` entry: the fixtures other packages' tests build on.
// Everything else in `tests/helpers` stays private to the web tests.
export {
	authRequest,
	createTestContext,
	linkGitHub,
	S3_TEST_ENV,
	signInWithDiscord,
	snowflakeAt,
	type TestContext,
} from '../tests/helpers/context';
export {
	createTestDatabase,
	dropDatabase,
	MAINTENANCE_URL,
	type TestDatabase,
	withDatabase,
} from '../tests/helpers/database';
export { manifest, seedApprovedAddon, seedSubmission, seedVersion } from '../tests/helpers/addons';
export { serveGitHub, type GitFixture } from '../tests/helpers/github';
export { recordReviewDecision } from '~/lib/moderation-events';
export { seedSponsorship } from '../tests/helpers/sponsors';
export { createStaffNote } from '~/lib/staff-notes';
export { serveApi } from '../tests/helpers/server';
export type { AppContext } from '~/lib/context';
export * as schema from '~/db/schema';
