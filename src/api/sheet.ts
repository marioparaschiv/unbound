import { Sheets } from '@api/metro/components';
import { uuid } from '@utilities';


interface SheetOptions<T extends React.ComponentType> {
	component: T | Promise<{ default: T; }>;
	key?: string;
	props?: React.ComponentProps<T>;
}

export function showSheet<T extends React.ComponentType>(options: T | SheetOptions<T>) {
	if (typeof options !== 'object') {
		options = { component: options };
	}

	options.key ??= uuid();

	if (!(options.component instanceof Promise)) {
		options.component = Promise.resolve({ default: options.component });
	}

	Sheets.openLazy(options.component, options.key, options.props ?? {});
}

export function closeSheet(key: string) {
	Sheets.hideActionSheet(key);
}