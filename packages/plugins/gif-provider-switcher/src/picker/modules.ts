import createRunningFlag from '@unbound-plugins/shared/react/running-flag';
import { flux, metro } from '@unbound-app/api';

export type GifPickerViewStoreType = {
	getQuery?: () => unknown;
};

export const GIFPickerHeader = metro.findByFilePath(
	'modules/gif_picker/native/GIFPickerHeader.tsx',
);

export const GIFPickerViewStore = flux.getStore('GIFPickerView') as GifPickerViewStoreType;

export const PickerRunning = createRunningFlag(addon.id);
