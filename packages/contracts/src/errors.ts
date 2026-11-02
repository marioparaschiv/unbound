import { Type, type StaticDecode } from './schema';

export const apiErrorCodeSchema = Type.Enum([
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
]);

/** The body of every non-2xx JSON response from `/api/v1/*`. */
export const apiErrorResponseSchema = Type.Object({
	error: Type.Object({
		code: apiErrorCodeSchema,
		message: Type.String(),
	}),
});

export type ApiErrorCode = StaticDecode<typeof apiErrorCodeSchema>;
export type ApiErrorResponse = StaticDecode<typeof apiErrorResponseSchema>;

export default { apiErrorCodeSchema, apiErrorResponseSchema };
