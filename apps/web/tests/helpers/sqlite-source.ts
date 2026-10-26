import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { Database } from 'bun:sqlite';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export type SqliteSource = {
	path: string;
	/** Runs SQL on the source, e.g. to add a column the Postgres schema does not know. */
	exec: (statement: string) => void;
	remove: () => void;
};

const SCHEMA = readFileSync(
	join(import.meta.dirname, '..', 'fixtures', 'sqlite-schema.sql'),
	'utf8',
);

/** JSON whose key order, spacing and unicode a reformatting copy would lose. */
export const MANIFEST_JSON =
	'{"version":"1.0.0", "name":"Zoë 😀",  "id":"acme.one","authors":[{"name":"ü","id":"1"}],"z":{"b":1,"a":2.50}}';
export const DETAILS_JSON = '{ "stars" : 7, "description":"日本語", "a":null }';
export const DOCUMENT_JSON = '{"plugins":{"z.last":{"enabled":true},"a.first":{"enabled":false}}}';

export const INT64_MAX = '9223372036854775807';
export const MAX_SAFE_ID = Number.MAX_SAFE_INTEGER;
/** A GitHub repository id past 2^31 and 2^32. */
export const REPOSITORY_ID = 2 ** 40 + 7;
export const FEED_SEQ = 3_000_000_000;
/** `moderation_event`'s AUTOINCREMENT high-water mark, past its largest surviving id 40. */
export const EVENT_SEQUENCE = 50;

// Rows invented to cover every column type and edge; production data never goes here.
const ROWS = `
INSERT INTO user (id, name, email, email_verified, image, created_at, updated_at, role, banned, ban_reason, ban_expires) VALUES
	('u1', 'Zoë 😀', 'u1@example.com', 1, NULL, 1700000000123, 1700000000999, NULL, 0, NULL, NULL),
	('u2', 'Banned', 'u2@example.com', 0, 'https://example.com/a.png', 1600000000000, 1600000000001, 'admin', 1, 'spam', 4102444800000),
	('u3', 'Nulls', 'u3@example.com', 0, NULL, 0, -1, NULL, NULL, NULL, NULL);
INSERT INTO account (id, account_id, provider_id, user_id, access_token, refresh_token, id_token, access_token_expires_at, refresh_token_expires_at, scope, password, created_at, updated_at) VALUES
	('a1', '12345', 'github', 'u1', 'token', NULL, NULL, NULL, 1800000000000, 'read:user', NULL, 1700000000000, 1700000000001);
INSERT INTO session (id, expires_at, token, created_at, updated_at, ip_address, user_agent, user_id, impersonated_by) VALUES
	('s1', 1800000000000, 'session-token', 1700000000000, 1700000000002, '127.0.0.1', 'bun', 'u1', NULL);
INSERT INTO verification (id, identifier, value, expires_at, created_at, updated_at) VALUES
	('v1', 'state', '{"b":1,"a":2}', 1800000000000, 1700000000000, 1700000000000);
INSERT INTO device_code (id, device_code, user_code, user_id, expires_at, status, last_polled_at, polling_interval, client_id, scope) VALUES
	('d1', 'device', 'USER-CODE', NULL, 1800000000000, 'pending', NULL, 5000, 'cli', NULL);
INSERT INTO apikey (id, config_id, name, start, reference_id, prefix, key, refill_interval, refill_amount, last_refill_at, enabled, rate_limit_enabled, rate_limit_time_window, rate_limit_max, request_count, remaining, last_request, expires_at, created_at, updated_at, permissions, metadata) VALUES
	('k1', 'default', 'bot', 'ub_', 'u1', 'ub', 'hashed', 3000000000, 10, NULL, 1, 0, 86400000, 1000, 0, NULL, 1700000000500, NULL, 1700000000000, 1700000000000, NULL, '{"b":1,"a":2}');
INSERT INTO rate_limit (id, key, count, last_request) VALUES ('r1', 'ip:1', 2147483647, ${INT64_MAX});
INSERT INTO addon (id, created_at, delisted_at, type, name, description, updated_at, pinned_fields, repository) VALUES
	('acme.one', 1700000000000, NULL, 'plugin', 'One', 'First', 0, 2147483647, 'acme/addons'),
	('acme.two', 1700000001000, 1700000005000, 'theme', 'Two', 'Second', -1, -2147483648, NULL);
INSERT INTO addon_maintainer (addon_id, user_id, role, created_at) VALUES ('acme.one', 'u1', 'owner', 1700000000000);
INSERT INTO submission (id, addon_id, author_id, kind, status, version, manifest, changelog, repository, bundle_size, staging_key, sha256, created_at, submitted_at, reviewer_id, review_decision, reviewed_at, review_note) VALUES
	('sub1', 'acme.one', 'u1', 'listing', 'approved', '1.0.0', '${MANIFEST_JSON}', NULL, 'acme/addons', 42, 'staging/sub1', 'abc', 1700000000000, 1700000000100, 'u2', 'approve', 1700000000200, NULL);
INSERT INTO moderation_event (id, subject_type, subject_id, actor_id, kind, data, reason, created_at) VALUES
	(1, 'addon', 'acme.one', 'u2', 'review.decided', '{"z":1,"a":[]}', NULL, 1700000000200),
	(40, 'addon', 'acme.one', NULL, 'addon.rollback', '{}', 'bad build', 1700000000300),
	(${EVENT_SEQUENCE}, 'user', 'u3', NULL, 'user.banned', '{}', NULL, 1700000000400);
DELETE FROM moderation_event WHERE id = ${EVENT_SEQUENCE};
INSERT INTO addon_version (addon_id, version, version_key, min_client_key, submission_id, manifest, changelog, bundle_size, sha256, published_at, withdrawn_by) VALUES
	('acme.one', '1.0.0', 'k1.0.0', '', 'sub1', '${MANIFEST_JSON}', 'First.', 42, 'abc', 1700000000200, 40);
INSERT INTO submission_source (submission_id, repository_id, path, ref, commit_sha, bundle_path, bundle_blob_sha, addon_md, changelog, details) VALUES
	('sub1', ${REPOSITORY_ID}, '', 'main', 'c0ffee', 'dist/one.js', 'b10b', NULL, NULL, '${DETAILS_JSON}');
INSERT INTO loader_release (platform, version, version_key, url, changelog, published_by, published_at) VALUES
	('ios', '1.0.0', 'k1.0.0', 'https://example.com/ios.zip', NULL, 'u1', 1700000000000);
INSERT INTO staff_note (id, user_id, addon_id, author_id, body, created_at, edited_at) VALUES
	(${MAX_SAFE_ID}, 'u2', NULL, 'u1', 'Watch this one ✔', 1700000000000, NULL);
INSERT INTO sponsorship (github_id, github_login, state, tier_name, monthly_price_cents, one_time, since, ends_at, updated_at) VALUES
	('12345', 'zoe', 'active', 'Gold', 500, 1, 1700000000000, NULL, 1700000000000);
INSERT INTO sponsor_webhook_delivery (id, action, received_at) VALUES ('w1', 'created', 1700000000000);
INSERT INTO perk_claim (user_id, perk_id, config, created_at, updated_at, revoked_at, revoked_by, revoke_reason) VALUES
	('u1', 'badge', '{"colour":"#fff","a":1}', 1700000000000, 1700000000000, NULL, NULL, NULL);
INSERT INTO sync_document (user_id, revision, document, updated_at) VALUES ('u1', 3, '${DOCUMENT_JSON}', 1700000000000);
INSERT INTO discord_profile (discord_id, username, global_name, avatar_hash, fetched_at) VALUES
	('111', 'zoe', NULL, NULL, 1700000000000);
INSERT INTO bot_feed_change (feed, key, seq, changed_at) VALUES ('releases', 'android:9.9.9', ${FEED_SEQ}, 1700000000000);
`;

/**
 * @description Writes a SQLite file with the app's final SQLite schema and a row set covering every
 * column type, with its triggers left to fill `bot_feed_change` and the FTS5 mirrors as the app did.
 * @returns The file's path, `exec` for further SQL, and `remove()`.
 */
export function createSqliteSource(): SqliteSource {
	const directory = mkdtempSync(join(tmpdir(), 'unbound-sqlite-copy-'));
	const path = join(directory, 'web.db');
	const db = new Database(path, { create: true });

	db.exec(SCHEMA);
	db.exec(
		'CREATE TABLE "__drizzle_migrations" (id INTEGER PRIMARY KEY, hash text NOT NULL, created_at numeric, name text, applied_at TEXT)',
	);
	db.exec(ROWS);
	db.close();

	return {
		path,
		exec: (statement) => {
			const handle = new Database(path);

			handle.exec(statement);
			handle.close();
		},
		remove: () => rmSync(directory, { recursive: true, force: true }),
	};
}
