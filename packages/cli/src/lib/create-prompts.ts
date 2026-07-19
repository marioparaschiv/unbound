import { intro, text, select, confirm, isCancel, cancel } from '@clack/prompts';

import type { ResolvedConfig } from '~/lib/config';
import { DOCS_BASE_URL } from '~/lib/templates';
import type { Kind } from '~/lib/templates';

/** Which structure `ubd create` scaffolds. `add` stamps a bare addon into an existing workspace. */
export type Shape = 'repository' | 'addon' | 'add';

/** The raw, possibly-partial input a `ubd create` invocation carries from its flags. */
export type CreateInput = {
	kind?: Kind;
	name?: string;
	dir?: string;
	displayName?: string;
	description?: string;
	authorName?: string;
	authorId?: string;
	id?: string;
	shape?: 'repository' | 'addon';
	gitInit?: boolean;
	install?: boolean;
};

/** Every value `ubd create` needs, resolved from flags and prompts. */
export type CreateOptions = {
	shape: Shape;
	kind: Kind;
	name: string;
	displayName: string;
	description: string;
	authorName: string;
	authorId: string;
	id: string;
	dir?: string;
	gitInit: boolean;
	install: boolean;
};

const KEBAB_CASE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * @description Runs the interactive `ubd create` flow, prompting only for values the flags left
 * unset so a fully-flagged invocation completes without a single prompt. Exits the process on
 * cancellation.
 * @param input The values supplied via flags.
 * @param workspace The config found in or above the cwd, or `undefined` when none exists.
 * @returns The fully-resolved options to scaffold from.
 */
export async function resolveOptions(
	input: CreateInput,
	workspace: ResolvedConfig | undefined,
): Promise<CreateOptions> {
	intro('ubd create');

	const shape = await resolveShape(input.shape, Boolean(workspace));
	const kind = await resolveKind(input.kind);

	const name = await resolveName(input.name);
	const displayName = await resolveText(input.displayName, 'Display name', titleCase(name));
	const description = await resolveText(input.description, 'Description', 'An Unbound addon.');
	const authorName = await resolveText(input.authorName, 'Author name', 'you');

	const authorId = await resolveOptionalText(input.authorId, 'Author Discord id (optional)', '0');

	const id = await resolveText(input.id, 'Addon id', `${authorName}.${name}`);

	const dir = shape === 'add' ? void 0 : await resolveDir(input.dir, name);

	const repository = shape === 'repository';
	const gitInit = repository
		? await resolveConfirm(input.gitInit, 'Initialize a git repository?')
		: false;
	const install = repository
		? await resolveConfirm(input.install, 'Install dependencies with bun?')
		: false;

	return {
		shape,
		kind,
		name,
		displayName,
		description,
		authorName,
		authorId,
		id,
		dir,
		gitInit,
		install,
	};
}

async function resolveShape(flag: CreateInput['shape'], hasWorkspace: boolean): Promise<Shape> {
	if (flag === 'repository') return 'repository';
	if (flag === 'addon') return hasWorkspace ? 'add' : 'addon';

	if (hasWorkspace) {
		const choice = await select({
			message: 'This directory is inside an Unbound workspace. What would you like to do?',
			options: [
				{ value: 'add' as const, label: 'Add an addon to this workspace' },
				{ value: 'repository' as const, label: 'New repository' },
			],
		});

		return unwrap(choice);
	}

	const choice = await select({
		message: 'What would you like to create?',
		options: [
			{ value: 'repository' as const, label: 'Repository', hint: 'recommended' },
			{ value: 'addon' as const, label: 'Single addon directory' },
		],
	});

	return unwrap(choice);
}

async function resolveKind(flag: Kind | undefined): Promise<Kind> {
	if (flag) return flag;

	const choice = await select({
		message: 'Which kind of addon?',
		options: [
			{
				value: 'plugin' as const,
				label: 'Plugin',
				hint: `patch the client. ${DOCS_BASE_URL}/plugins/introduction`,
			},
			{
				value: 'theme' as const,
				label: 'Theme',
				hint: `recolor the UI. ${DOCS_BASE_URL}/themes/introduction`,
			},
		],
	});

	return unwrap(choice);
}

async function resolveName(flag: string | undefined): Promise<string> {
	if (flag !== void 0) {
		if (!KEBAB_CASE.test(flag)) {
			cancel(`Invalid name "${flag}": must be kebab-case (lowercase, digits, hyphens).`);
			process.exit(2);
		}

		return flag;
	}

	const value = await text({
		message: 'Addon name',
		placeholder: 'my-addon',
		validate(input) {
			if (!input) return 'A name is required.';
			if (!KEBAB_CASE.test(input)) return 'Must be kebab-case (lowercase, digits, hyphens).';
		},
	});

	return unwrap(value);
}

async function resolveText(
	flag: string | undefined,
	message: string,
	initialValue: string,
): Promise<string> {
	if (flag !== void 0) return flag;

	const value = await text({ message, initialValue });

	return unwrap(value);
}

async function resolveOptionalText(
	flag: string | undefined,
	message: string,
	fallback: string,
): Promise<string> {
	if (flag !== void 0) return flag;

	const value = await text({ message, placeholder: fallback });
	const resolved = unwrap(value);

	return resolved === '' ? fallback : resolved;
}

async function resolveDir(flag: string | undefined, name: string): Promise<string> {
	if (flag !== void 0) return flag;

	const value = await text({ message: 'Target directory', initialValue: `./${name}` });

	return unwrap(value);
}

async function resolveConfirm(flag: boolean | undefined, message: string): Promise<boolean> {
	if (flag !== void 0) return flag;

	const value = await confirm({ message, initialValue: true });

	return unwrap(value);
}

function unwrap<T>(value: T | symbol): T {
	if (isCancel(value)) {
		cancel('Cancelled.');
		process.exit(0);
	}

	return value;
}

function titleCase(name: string): string {
	return name
		.split('-')
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(' ');
}

export default resolveOptions;
