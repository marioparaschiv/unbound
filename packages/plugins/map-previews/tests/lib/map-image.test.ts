import { expect, test } from 'bun:test';

import { mapImage } from '~/lib/map-image';

test('pins the place on a static map', () => {
	expect(mapImage({ latitude: 48.8584, longitude: 2.2945, zoom: 15 })).toEqual({
		url: 'https://static-maps.yandex.ru/1.x/?ll=2.2945,48.8584&z=15&l=map&size=600,300&pt=2.2945,48.8584,pm2rdm&lang=en_US',
		width: 600,
		height: 300,
	});
});
