import type { ApiErrorCode, ApiErrorResponse } from '@unbound-app/contracts/errors';

const API_ERROR_STATUS: Record<ApiErrorCode, number> = {
	invalid_request: 400,
	invalid_manifest: 400,
	unauthorized: 401,
	forbidden: 403,
	not_found: 404,
	rate_limited: 429,
	addon_id_taken: 409,
	not_maintainer: 403,
	version_exists: 409,
	pending_update_exists: 409,
	pending_listing_cap: 409,
	account_too_new: 403,
	artifact_too_large: 413,
	upload_missing: 409,
	upload_expired: 410,
	upload_size_mismatch: 400,
	submission_not_awaiting_upload: 409,
	submission_not_pending: 409,
	self_review: 403,
	artifact_mismatch: 409,
	last_owner: 409,
	github_not_linked: 403,
	github_no_push_access: 403,
	sync_conflict: 409,
	sync_document_too_large: 413,
	edit_conflict: 409,
	sponsorship_required: 403,
	badge_rejected: 400,
	perk_revoked: 403,
	internal_error: 500,
};

/** A failure a `/api/v1` handler reports to the caller; its HTTP status is derived from the code. */
export class ApiError extends Error {
	constructor(
		public readonly code: ApiErrorCode,
		message: string,
	) {
		super(message);
		this.name = 'ApiError';
	}

	get status(): number {
		return API_ERROR_STATUS[this.code];
	}

	toResponse(): Response {
		const body: ApiErrorResponse = { error: { code: this.code, message: this.message } };

		return Response.json(body, { status: this.status });
	}
}

export default { ApiError };
