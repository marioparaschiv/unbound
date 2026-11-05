/** Every `code` a non-2xx `/api/v1` response carries in its `{ error: { code, message } }` body. */
export const API_ERROR_CODES = [
	'invalid_request',
	'invalid_manifest',
	'unauthorized',
	'forbidden',
	'not_found',
	'rate_limited',
	'addon_id_taken',
	'not_maintainer',
	'version_exists',
	'pending_update_exists',
	'pending_listing_cap',
	'account_too_new',
	'artifact_too_large',
	'submission_not_pending',
	'self_review',
	'artifact_mismatch',
	'last_owner',
	'github_not_linked',
	'github_no_push_access',
	'github_unavailable',
	'font_source_unavailable',
	'repository_not_found',
	'ref_not_found',
	'source_changed',
	'addon_not_found',
	'artifact_missing',
	'invalid_changelog',
	'sync_conflict',
	'sync_document_too_large',
	'edit_conflict',
	'sponsorship_required',
	'badge_rejected',
	'perk_revoked',
	'internal_error',
] as const;

const CODES: ReadonlySet<string> = new Set(API_ERROR_CODES);

/**
 * @description Tells whether `value` is one of the API's error codes.
 * @param value The untrusted value, such as an error body's `error.code`.
 * @returns Whether it is a known code.
 */
// UNKNOWN: any value read from an untrusted error body.
export function isApiErrorCode(value: unknown): value is (typeof API_ERROR_CODES)[number] {
	return typeof value === 'string' && CODES.has(value);
}

export default { API_ERROR_CODES, isApiErrorCode };
