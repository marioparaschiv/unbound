import { metro } from '@unbound-app/api';

// The testing kit has no fake of `metro.api`, which the feature's modules read when they load.
Object.assign(metro, { api: { Messages: { fetchMessage: async () => null } } });
