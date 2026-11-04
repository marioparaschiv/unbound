export const PIP_REQUEST = 'unboundPictureInPicture';
export const PIP_RESULT = 'unboundPictureInPictureResult';
export const PIP_ENDED = 'ended';

const FRAME_SCRIPT = `(function () {
	if (window.__unboundPictureInPicture) return;
	window.__unboundPictureInPicture = true;

	function largestVideo() {
		var videos = Array.prototype.slice.call(document.querySelectorAll('video'));
		videos.sort(function (a, b) { return b.clientWidth * b.clientHeight - a.clientWidth * a.clientHeight; });
		return videos[0];
	}

	function report(result) {
		try { window.top.postMessage({ ${PIP_RESULT}: result }, '*'); } catch (error) {}
	}

	function watchEnd(video) {
		if (video.__unboundPictureInPictureWatched) return;
		video.__unboundPictureInPictureWatched = true;
		function ended() { report('${PIP_ENDED}'); }
		video.addEventListener('webkitpresentationmodechanged', function () {
			if (video.webkitPresentationMode !== 'picture-in-picture') ended();
		});
		video.addEventListener('leavepictureinpicture', ended);
	}

	function enter(video) {
		watchEnd(video);
		if (video.webkitSupportsPresentationMode && video.webkitSupportsPresentationMode('picture-in-picture')) {
			video.webkitSetPresentationMode('picture-in-picture');
		} else if (video.requestPictureInPicture) {
			video.requestPictureInPicture();
		} else {
			return false;
		}
		var playing = video.play && video.play();
		if (playing && playing.catch) playing.catch(function () {});
		return true;
	}

	function leave(video) {
		if (video.webkitSetPresentationMode) video.webkitSetPresentationMode('inline');
		else if (document.exitPictureInPicture) document.exitPictureInPicture();
	}

	window.addEventListener('message', function (event) {
		var request = event.data && event.data.${PIP_REQUEST};
		if (!request) return;
		var video = largestVideo();
		if (!video) return;
		if (request === 'leave') return leave(video);
		report(enter(video));
	});
})();
true;`;

/**
 * @description The script every frame of a web player runs before its content: it answers a picture in picture request by putting the frame's largest video into the system window and playing it, tells the page whether it could, and tells it again when the window closes.
 * @returns The script, which ends in `true` as `react-native-webview` expects.
 */
export function frameScript(): string {
	return FRAME_SCRIPT;
}

/**
 * @description Builds the script the page runs to ask each of its frames, itself included, to open or close the picture in picture window. Their answers come back to the app through `ReactNativeWebView.postMessage`.
 * @param request `enter` to open the window, `leave` to close it.
 * @returns The script, which ends in `true` as `injectJavaScript` expects.
 */
export function requestScript(request: 'enter' | 'leave'): string {
	return `(function () {
	if (!window.__unboundPictureInPictureRelay) {
		window.__unboundPictureInPictureRelay = true;
		window.addEventListener('message', function (event) {
			if (event.data && Object.prototype.hasOwnProperty.call(event.data, '${PIP_RESULT}') && window.ReactNativeWebView) {
				window.ReactNativeWebView.postMessage(JSON.stringify(event.data));
			}
		});
	}
	var message = { ${PIP_REQUEST}: '${request}' };
	window.postMessage(message, '*');
	var frames = document.querySelectorAll('iframe');
	for (var index = 0; index < frames.length; index += 1) {
		try { frames[index].contentWindow.postMessage(message, '*'); } catch (error) {}
	}
})();
true;`;
}

export type PipResult = boolean | typeof PIP_ENDED;

/**
 * @description Reads a frame's picture in picture report from a web player's message.
 * @param data The message's data.
 * @returns Whether the frame opened the window, `ended` once it closed, or `undefined` when the message is something else.
 */
export function readPipResult(data: unknown): PipResult | undefined {
	if (typeof data !== 'string' || !data.includes(PIP_RESULT)) return;

	try {
		const parsed = JSON.parse(data) as Record<string, unknown>;
		const result = parsed[PIP_RESULT];

		return typeof result === 'boolean' || result === PIP_ENDED ? result : undefined;
	} catch {
		return;
	}
}
