import { flux, metro } from '@unbound-app/api';

export const SpotifyActions = metro.findByProps('play', 'sync', 'getMetadata');
export const ActivityButtons = metro.findByProps('PlayOnSpotifyButton');
export const SpotifyComponents = metro.findByProps('SpotifyPlayButton');

export const SpotifyStore = flux.getStore('Spotify');
export const SpotifyProtocolStore = flux.getStore('SpotifyProtocol');
export const UserStore = flux.getStore('User');
