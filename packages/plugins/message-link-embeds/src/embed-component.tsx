import { useContext, type ComponentType } from 'react';

import { EmbeddedMediaContext } from '~/components/embedded-media';

type Component<P> = ComponentType<P> & {
	defaultProps?: Partial<P>;
	displayName?: string;
};

type ComponentHolder = Record<string, unknown>;

/**
 * @description Replaces a media component with one that changes its props inside an embed. The swap is by hand because the patcher calls the original as a function, and these can be class components.
 * @template P The component's props.
 * @param holder The object holding the component, such as a module or a `memo`.
 * @param key The property the component is stored under.
 * @param embeddedProps Maps the component's props inside an embed.
 * @returns A function that puts the original component back.
 */
export function embedComponent<P extends object>(
	holder: ComponentHolder,
	key: string,
	embeddedProps: (props: P) => P,
): () => void {
	const Original = holder[key] as Component<P>;

	function Embedded(props: P) {
		const embedded = useContext(EmbeddedMediaContext);

		return <Original {...(embedded ? embeddedProps(props) : props)} />;
	}

	Embedded.defaultProps = Original.defaultProps;
	Embedded.displayName = Original.displayName ?? Original.name;
	holder[key] = Embedded;

	return () => {
		if (holder[key] === Embedded) holder[key] = Original;
	};
}

export default embedComponent;
