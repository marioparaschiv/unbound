import { beforeEach, expect, mock, test } from 'bun:test';

type Element = { type: string; props: Record<string, any> };
type PatchContext = { args: unknown[]; result: Element };

let afterHandler: ((context: PatchContext) => Element) | null = null;
let requestedRoles: string[] = [];

const React = {
	cloneElement(element: Element, props: Record<string, unknown>): Element {
		return { ...element, props: { ...element.props, ...props } };
	},
};

mock.module('@unbound-app/api', () => ({
	metro: {
		common: { React, ReactNative: { Text: 'Text' } },
		findByFilePath: () => ({ UsersFastList: { render: () => null } }),
	},
	patcher: {
		after: (_holder: unknown, _method: string, handler: typeof afterHandler) => {
			afterHandler = handler;
			return () => {};
		},
	},
}));

const { installMemberListColors } = await import('@role-color-everywhere/member-list');

beforeEach(() => {
	afterHandler = null;
	requestedRoles = [];
	installMemberListColors(
		{
			getRole(_guildId: string, roleId: string) {
				requestedRoles.push(roleId);
				return roleId === 'role-2'
					? { name: 'Dev', colorString: '#2468ac' }
					: { name: 'Dev', colorString: '#cc0000' };
			},
		},
		{ getMember: () => ({ hoistRoleId: 'role-2' }) },
		() => true,
	);
});

test('colors the exact hoisted role when role names are duplicated', () => {
	const list: Element = {
		type: 'List',
		props: {
			renderSectionHeader: () => ({ type: 'Header', props: { title: 'Dev — 1' } }),
		},
	};
	const props = {
		getSectionProps: () => ({ props: { title: 'Dev — 1' } }),
		getItemProps: () => ({ props: { guildId: 'guild', user: { id: 'user' } } }),
	};
	const patched = afterHandler?.({ args: [props], result: list });
	const header = patched?.props.renderSectionHeader(0);

	expect(requestedRoles).toEqual(['role-2']);
	expect(header.props.title.props.style.color).toBe('#2468ac');
	expect(header.props.title.props.children).toBe('Dev — 1');
});

test('leaves non-role sections alone', () => {
	const list: Element = {
		type: 'List',
		props: {
			renderSectionHeader: () => ({ type: 'Header', props: { title: 'Online — 1' } }),
		},
	};
	const props = {
		getSectionProps: () => ({ props: { title: 'Online — 1' } }),
		getItemProps: () => ({ props: { guildId: 'guild', user: { id: 'user' } } }),
	};
	const patched = afterHandler?.({ args: [props], result: list });
	const header = patched?.props.renderSectionHeader(0);

	expect(header.props.title).toBe('Online — 1');
});
