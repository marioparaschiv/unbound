import { z } from './zod';

export const apiErrorCodeSchema = z.enum([
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
	'upload_missing',
	'upload_expired',
	'upload_size_mismatch',
	'submission_not_awaiting_upload',
	'submission_not_pending',
	'self_review',
	'artifact_mismatch',
	'last_owner',
	'github_not_linked',
	'github_no_push_access',
	'sync_conflict',
	'sync_document_too_large',
	'edit_conflict',
	'sponsorship_required',
	'badge_rejected',
	'perk_revoked',
	'internal_error',
]);

/** The body of every non-2xx JSON response from `/api/v1/*`. */
export const apiErrorResponseSchema = z.object({
	error: z.object({
		code: apiErrorCodeSchema,
		message: z.string(),
	}),
});

export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;
export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>;

export default { apiErrorCodeSchema, apiErrorResponseSchema };
