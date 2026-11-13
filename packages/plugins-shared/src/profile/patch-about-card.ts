import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { metro, patcher } from '@unbound-app/api';

type AboutCardProps = { userId?: string; themeType?: string };

type CardProps = { children?: ReactNode };

type CardElement = ReactElement<CardProps>;

export type AboutCardContext = { userId: string; sections: string[] };

export type AboutCardSection = {
	key: string;
	render(context: AboutCardContext): ReactNode;
};

const TRAILING_SECTION = 'PolicyLinks';

function sectionName(node: ReactNode): string | undefined {
	if (!isValidElement(node)) {
		return undefined;
	}

	const type = node.type as { displayName?: string; name?: string } | string;

	return typeof type === 'string' ? type : type.displayName || type.name;
}

/**
 * @description Adds a section to every profile's About card, after Discord's own date sections and before its policy links.
 * @param section The section's key and renderer; the renderer gets the user and the names of the sections Discord drew, and returns nothing to skip.
 * @returns Whether Discord's About card was found.
 */
export function patchAboutCard(section: AboutCardSection): boolean {
	const AboutCard = metro.findByFilePath(
		'modules/user_profile/native/UserProfileAboutMeCard.tsx',
	);

	if (!AboutCard) {
		return false;
	}

	patcher.react.after(AboutCard, 'default', ({ props, result }) => {
		const userId = (props as AboutCardProps | undefined)?.userId;

		if (!userId || !isValidElement(result)) return;

		const card = result as CardElement;
		const children = [card.props.children].flat();
		const sections = children.map(sectionName).filter((name): name is string => Boolean(name));
		const added = section.render({ userId, sections });

		if (!added) return;

		const keyed = isValidElement(added) ? cloneElement(added, { key: section.key }) : added;
		const trailing = children.findIndex((child) => sectionName(child) === TRAILING_SECTION);
		const at = trailing === -1 ? children.length : trailing;

		return cloneElement(card, {
			children: [...children.slice(0, at), keyed, ...children.slice(at)],
		});
	});

	return true;
}

export default { patchAboutCard };
