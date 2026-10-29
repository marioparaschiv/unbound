Avatar Radius draws avatars as rounded squares instead of circles. You choose how round the corners are. When you turn the plugin off, the avatars become circles again.

## Settings

- **Corner radius** sets how round the corners are, from 0 (square) to 64. A radius past half of an avatar's size keeps that avatar a circle. The default is 8.

## Platforms

The plugin runs on iOS and Android. It changes Discord's native avatar views, so it needs the native bridge of the Unbound loader. On iOS it uses the Objective-C bridge. On Android it uses the Java bridge. If the loader does not offer every bridge feature the plugin needs, the plugin does not start.
