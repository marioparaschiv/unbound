import type { GenericEndpointContext, User } from 'better-auth';
import { APIError } from 'better-auth/api';

// The admin plugin endpoints the site uses. The others could set roles, create or impersonate users
// or read emails, so an endpoint a Better Auth upgrade adds stays closed too.
const ADMIN_ENDPOINTS = new Set([
	'/admin/set-role',
	'/admin/ban-user',
	'/admin/unban-user',
	'/admin/remove-user',
	'/admin/list-user-sessions',
	'/admin/revoke-user-session',
	'/admin/revoke-user-sessions',
	'/admin/has-permission',
]);

/**
 * @description Rejects a request to an admin plugin endpoint the site does not use.
 * @param path The endpoint's path, e.g. `/admin/set-role`.
 */
export function guardAdminEndpoint(path: string | undefined) {
	if (!path?.startsWith('/admin/') || ADMIN_ENDPOINTS.has(path)) return;

	throw new APIError('FORBIDDEN', { message: 'This admin action is disabled.' });
}

/**
 * @description Rejects a write that changes the signed-in user's own role, whichever endpoint makes it.
 * Runs inside the endpoint, after the session is resolved from its cookie or bearer token.
 * @param data The user fields being written.
 * @param ctx The endpoint making the write; `null` outside a request, as for the team sync.
 */
export function guardOwnRoleChange(data: Partial<User>, ctx: GenericEndpointContext | null) {
	const actorId = ctx?.context.session?.user.id;

	if (!actorId || !('role' in data)) return;

	// Admin endpoints name the user they change; the rest change the caller.
	const targetId = ctx.body?.userId ?? actorId;

	if (String(targetId) !== actorId) return;

	throw new APIError('FORBIDDEN', { message: 'You cannot change your own role.' });
}

export default { guardAdminEndpoint, guardOwnRoleChange };
