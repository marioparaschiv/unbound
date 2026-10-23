import { defaultStatements } from 'better-auth/plugins/admin/access';
import { createAccessControl } from 'better-auth/plugins/access';

/**
 * Every permission statement the platform checks. Authorization always goes through these, never
 * through role names, so a role's capabilities change here and nowhere else.
 */
export const statements = {
	...defaultStatements,
	submission: ['create', 'review'],
	update: ['create', 'review'],
	addon: ['delist', 'transfer', 'rollback', 'edit'],
	loader: ['publish'],
	perk: ['revoke'],
} as const;

export const ac = createAccessControl(statements);

/** Can apply for a first listing. */
export const user = ac.newRole({
	submission: ['create'],
});

/** Granted automatically when a user's first listing is approved; publishes updates to maintained addons. */
export const developer = ac.newRole({
	submission: ['create'],
	update: ['create'],
});

export const moderator = ac.newRole({
	submission: ['create', 'review'],
	update: ['create', 'review'],
	addon: ['delist'],
	perk: ['revoke'],
	user: ['list', 'get', 'ban'],
	session: ['list', 'revoke'],
});

/** A CI account's role; its API key can publish native loader releases and nothing else. */
export const ci = ac.newRole({
	loader: ['publish'],
});

export const admin = ac.newRole(statements);

export const roles = { user, developer, moderator, ci, admin };

export type Role = keyof typeof roles;

export const DEFAULT_ROLE: Role = 'user';

export type Permissions = { [K in keyof typeof statements]?: (typeof statements)[K][number][] };

/**
 * @description Narrows a string to a defined role name.
 * @param name The candidate role name.
 * @returns Whether `name` is a defined role.
 */
export function isRole(name: string): name is Role {
	return Object.hasOwn(roles, name);
}

/**
 * @description Checks whether a role string grants every listed permission. Mirrors the admin
 * plugin's own check, so a comma-separated multi-role value passes if any one role grants all of them.
 * @param role The user's `role` column, possibly comma-separated or unset.
 * @param permissions The permissions required, e.g. `{ submission: ['review'] }`.
 * @returns Whether the role grants the permissions.
 */
export function hasPermission(role: string | null | undefined, permissions: Permissions): boolean {
	const names = (role || DEFAULT_ROLE).split(',').map((name) => name.trim());

	return names.some((name) => isRole(name) && roles[name].authorize(permissions).success);
}

export default { statements, ac, roles, DEFAULT_ROLE, isRole, hasPermission };
