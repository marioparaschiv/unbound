import { describe, expect, mock, test } from 'bun:test';
import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';

type AvatarProps = { user: { id: string }; guildId?: string };

const cached = new Set(['a', 'b', 'c', 'd']);

function Avatar(_props: AvatarProps) {
	return null;
}

mock.module('react-native', () => ({ View: 'View' }));

mock.module('~/modules', () => ({
	Avatars: { Avatar, AvatarSizes: { SIZE_16: 'SIZE_16' } },
	UserStore: { getUser: (id: string) => (cached.has(id) ? { id } : undefined) },
}));

const { withTypingAvatars } = await import('./typing-avatars');

type Rendered = ReactElement<{ children?: ReactNode; users?: { id: string }[]; guildId?: string }>;

function avatarsOf(wrapped: unknown): AvatarProps[] {
	const [avatars] = Children.toArray((wrapped as Rendered).props.children) as Rendered[];
	const render = avatars.type as (props: Rendered['props']) => Rendered;
	const tree = render(avatars.props);

	return (Children.toArray(tree.props.children) as Rendered[]).map((slot) => {
		const avatar = Children.only(slot.props.children) as ReactElement<AvatarProps>;

		return avatar.props;
	});
}

describe('withTypingAvatars', () => {
	test('returns the row unchanged when no typing user is cached', () => {
		const row = <span>typing</span>;

		expect(withTypingAvatars(row, ['x', 'y'])).toBe(row);
	});

	test('shows the cached typing users in front of the row', () => {
		const row = <span>typing</span>;
		const wrapped = withTypingAvatars(row, ['a', 'x', 'b'], 'g1');

		expect(isValidElement(wrapped)).toBe(true);
		expect(avatarsOf(wrapped).map((props) => props.user.id)).toEqual(['a', 'b']);
		expect(avatarsOf(wrapped).every((props) => props.guildId === 'g1')).toBe(true);
	});

	test('shows at most three avatars', () => {
		const wrapped = withTypingAvatars(<span />, ['a', 'b', 'c', 'd']);

		expect(avatarsOf(wrapped).map((props) => props.user.id)).toEqual(['a', 'b', 'c']);
	});
});
