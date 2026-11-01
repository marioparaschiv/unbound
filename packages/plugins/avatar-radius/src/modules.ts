import { storage } from '@unbound-app/api';

export const SETTINGS_BUCKET = 'unbound.avatar-radius';

export const settings = storage.getBucket(SETTINGS_BUCKET);
