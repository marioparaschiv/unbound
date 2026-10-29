({__plugin:null,__load(){if(this.__plugin)return this.__plugin;this.__plugin=(function () {
'use strict';
function isPending(result) {
    return typeof (result === null || result === void 0 ? void 0 : result.then) === 'function';
}
/**
 * @description Applies a plugin's features in order and returns one cleanup that removes them in reverse.
 * If a feature throws, the features already applied are removed, so a plugin is never left half-applied.
 * @param plugin The plugin's display name, used in the log lines.
 * @param features Functions that each apply one feature and return the function that removes it; a removal may return a promise for native work that must finish before the plugin's native scope closes.
 * @returns A function that removes every applied feature; return its result from `stop`, since it is a promise while any removal is still finishing.
 */ function applyFeatures(plugin, features) {
    var cleanups = [];
    function dispose() {
        var pending = cleanups.splice(0).reverse().map(function(cleanup) {
            return cleanup();
        }).filter(isPending);
        if (!pending.length) return;
        return Promise.allSettled(pending).then(function(results) {
            var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
            try {
                for(var _iterator = results[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                    var result = _step.value;
                    if (result.status === 'rejected') {
                        console.error("[".concat(plugin, "] Failed to clean up:"), result.reason);
                    }
                }
            } catch (err) {
                _didIteratorError = true;
                _iteratorError = err;
            } finally{
                try {
                    if (!_iteratorNormalCompletion && _iterator.return != null) {
                        _iterator.return();
                    }
                } finally{
                    if (_didIteratorError) {
                        throw _iteratorError;
                    }
                }
            }
        });
    }
    try {
        var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
        try {
            for(var _iterator = features[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                var feature = _step.value;
                cleanups.push(feature());
            }
        } catch (err) {
            _didIteratorError = true;
            _iteratorError = err;
        } finally{
            try {
                if (!_iteratorNormalCompletion && _iterator.return != null) {
                    _iterator.return();
                }
            } finally{
                if (_didIteratorError) {
                    throw _iteratorError;
                }
            }
        }
    } catch (error) {
        void dispose();
        console.error("[".concat(plugin, "] Failed to start, reverted:"), error);
    }
    return dispose;
}var MediaTypes = window.unbound.metro.findByProps('GIF_RE_IOS', 'MediaType', {
    lazy: true
});
var MediaTypesFile = window.unbound.metro.findByFilePath('modules/media/MediaTypes.tsx', {
    lazy: true,
    interop: false
});
var Patcher = window.unbound.patcher.createPatcher('unbound.fix-gif-download');
// Discord's media manager, which saves media to the photo library, preferring the module with both download methods.
var MediaManagerFilters = [
    window.unbound.metro.filters.byProps('downloadMediaAsset', 'downloadMediaAssetWithContentType'),
    window.unbound.metro.filters.byProps('downloadMediaAsset')
];
/**
 * @description Finds every copy of the media viewer's share actions. A lazy handle holds only one module.
 * @returns Each module exporting `useMediaShareActions`, possibly none.
 */ function findMediaShareActions() {
    return window.unbound.metro.findByProps('useMediaShareActions', {
        all: true
    });
}function _array_like_to_array$4(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_without_holes$4(arr) {
    if (Array.isArray(arr)) return _array_like_to_array$4(arr);
}
function _iterable_to_array$4(iter) {
    if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) {
        return Array.from(iter);
    }
}
function _non_iterable_spread$4() {
    throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _to_consumable_array$4(arr) {
    return _array_without_holes$4(arr) || _iterable_to_array$4(arr) || _unsupported_iterable_to_array$4(arr) || _non_iterable_spread$4();
}
function _type_of(obj) {
    "@swc/helpers - typeof";
    return obj && typeof Symbol !== "undefined" && obj.constructor === Symbol ? "symbol" : typeof obj;
}
function _unsupported_iterable_to_array$4(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _array_like_to_array$4(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(n);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _array_like_to_array$4(o, minLen);
}
/**
 * @description Checks whether a value is an object (or array) whose keys can be searched.
 * @param value Any value from a Discord media record.
 * @returns `true` for any non-null object.
 */ function isRecord(value) {
    return (typeof value === "undefined" ? "undefined" : _type_of(value)) === 'object' && value !== null;
}
/**
 * @description Searches a media record depth-first for the first value `match` accepts.
 * @param value The record, or a nested value of it.
 * @param match Returns a result for a value it accepts, otherwise `null`.
 * @param maxDepth How many levels below `value` to search.
 * @param priorityKeys Keys searched before the record's own keys, in order.
 * @param depth The current depth.
 * @returns The first accepted result, or `null`.
 */ function findDeep(value, match, maxDepth) {
    var priorityKeys = arguments.length > 3 && arguments[3] !== void 0 ? arguments[3] : [], depth = arguments.length > 4 && arguments[4] !== void 0 ? arguments[4] : 0;
    if (depth > maxDepth) return null;
    var matched = match(value);
    if (matched || !isRecord(value)) return matched;
    var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
    try {
        for(var _iterator = _to_consumable_array$4(priorityKeys).concat(_to_consumable_array$4(Object.keys(value)))[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
            var key = _step.value;
            var found = findDeep(value[key], match, maxDepth, priorityKeys, depth + 1);
            if (found) return found;
        }
    } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
    } finally{
        try {
            if (!_iteratorNormalCompletion && _iterator.return != null) {
                _iterator.return();
            }
        } finally{
            if (_didIteratorError) {
                throw _iteratorError;
            }
        }
    }
    return null;
}/**
 * @description Checks whether a URL is Discord's proxy for external media (`images-ext-N` or `media.discordapp.net`).
 * @param value Any URL.
 * @returns `true` for an `/external/` path on a Discord media proxy host.
 */ function isDiscordExternalProxy(value) {
    try {
        var url = new URL(value);
        return /^(?:images-ext-\d+|media)\.discordapp\.net$/i.test(url.hostname) && /\/external\//i.test(url.pathname);
    } catch (unused) {
        return false;
    }
}
/**
 * @description Recovers the original HTTPS URL that a Discord external media proxy URL wraps.
 * @param value A Discord external proxy URL.
 * @returns The wrapped URL, with its query string when the proxy kept one, or `null`.
 */ function getDiscordProxyTarget(value) {
    if (!isDiscordExternalProxy(value)) return null;
    try {
        var path = decodeURIComponent(new URL(value).pathname);
        var targetIndex = path.indexOf('/https/');
        if (targetIndex < 0) return null;
        var prefix = path.slice('/external/'.length, targetIndex);
        var target = "https://".concat(path.slice(targetIndex + '/https/'.length));
        return prefix.startsWith('?') ? "".concat(target).concat(prefix) : target;
    } catch (unused) {
        return null;
    }
}var KLIPY_API_KEY = '685pfsUU3EODe5rjG3li8rLUdfyydxxfh8fPym7wM5dvr0jklulSi6g5BSWlL3zG';
/** Keys of a Discord media record that hold a URL, most direct first. */ var SOURCE_KEYS = [
    'sourceURI',
    'sourceUri',
    'sourceUrl',
    'originalURI',
    'originalUri',
    'originalUrl',
    'proxyUrl',
    'proxyURL',
    'mediaUrl',
    'mediaURL',
    'videoURI',
    'videoUrl',
    'imageUrl',
    'src',
    'source',
    'thumbnail',
    'uri',
    'url'
];
/** Keys of a Discord media record that hold a nested media record. */ var NESTED_KEYS = [
    'media',
    'source',
    'original',
    'attachment',
    'gif',
    'result',
    'data',
    'image',
    'thumbnail',
    'video',
    'embed'
];function _array_like_to_array$3(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_without_holes$3(arr) {
    if (Array.isArray(arr)) return _array_like_to_array$3(arr);
}
function _iterable_to_array$3(iter) {
    if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) {
        return Array.from(iter);
    }
}
function _non_iterable_spread$3() {
    throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _to_consumable_array$3(arr) {
    return _array_without_holes$3(arr) || _iterable_to_array$3(arr) || _unsupported_iterable_to_array$3(arr) || _non_iterable_spread$3();
}
function _unsupported_iterable_to_array$3(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _array_like_to_array$3(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(n);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _array_like_to_array$3(o, minLen);
}
function isGifProvider(value) {
    return /(?:klipy|tenor|giphy)/i.test(value);
}
function isGifContentType(value) {
    return typeof value === 'string' && value.toLowerCase().startsWith('image/gif');
}
function hasGifExtension(value) {
    try {
        var _url_searchParams_get;
        var url = new URL(value);
        return url.pathname.toLowerCase().endsWith('.gif') || ((_url_searchParams_get = url.searchParams.get('format')) === null || _url_searchParams_get === void 0 ? void 0 : _url_searchParams_get.toLowerCase()) === 'gif';
    } catch (unused) {
        return /(?:^|[/?_.-])gif(?:$|[/?_.-])/i.test(value);
    }
}
function isGifProviderVideo(value) {
    try {
        var _url_searchParams_get;
        var url = new URL(value);
        var pathname = url.pathname.toLowerCase();
        var format = (_url_searchParams_get = url.searchParams.get('format')) === null || _url_searchParams_get === void 0 ? void 0 : _url_searchParams_get.toLowerCase();
        return isGifProvider("".concat(url.hostname).concat(pathname).concat(url.search)) && (/\.(?:mp4|webm|webp)$/.test(pathname) || format === 'mp4' || format === 'video' || format === 'webp');
    } catch (unused) {
        return isGifProvider(value) && /\.(?:mp4|webm|webp)(?:$|[?#])/i.test(value);
    }
}
function canonicalGiphyUrl(url) {
    var _ref;
    var _url_pathname_match, _url_pathname_match1;
    var id = (_ref = (_url_pathname_match = url.pathname.match(/\/media\/([^/]+)/i)) === null || _url_pathname_match === void 0 ? void 0 : _url_pathname_match[1]) !== null && _ref !== void 0 ? _ref : (_url_pathname_match1 = url.pathname.match(/\/gifs\/[^/]*?([a-z0-9]{6,})$/i)) === null || _url_pathname_match1 === void 0 ? void 0 : _url_pathname_match1[1];
    return id ? "https://media.giphy.com/media/".concat(id, "/giphy.gif") : url.toString();
}
// The URL of the GIF itself when `value` already names one, or names one in a form Discord, Giphy or Tenor can serve as GIF.
function directGifUrl(value) {
    try {
        var url = new URL(value);
        var pathname = url.pathname.toLowerCase();
        if (isDiscordExternalProxy(value)) {
            var target = getDiscordProxyTarget(value);
            if (target) return directGifUrl(target);
            return pathname.endsWith('.gif') ? url.toString() : null;
        }
        if (pathname.endsWith('.gif')) {
            var _url_searchParams_get;
            var format = (_url_searchParams_get = url.searchParams.get('format')) === null || _url_searchParams_get === void 0 ? void 0 : _url_searchParams_get.toLowerCase();
            if (format && format !== 'gif') url.searchParams.set('format', 'gif');
            return url.toString();
        }
        if (url.searchParams.get('animated') === 'true' && /\.(?:webp|avif|mp4)$/.test(pathname)) {
            url.pathname = url.pathname.replace(/\.(?:webp|avif|mp4)$/i, '.gif');
            url.searchParams.set('format', 'gif');
            return url.toString();
        }
        var host = url.hostname.toLowerCase();
        if (host.includes('giphy.com') && /\/gifs?\//i.test(url.pathname)) {
            var canonical = canonicalGiphyUrl(url);
            if (canonical !== url.toString()) return canonical;
        }
        if (host === 'tenor.com') {
            url.pathname = "".concat(url.pathname, ".gif");
            return url.toString();
        }
    } catch (unused) {
    // Not a URL.
    }
    return null;
}
// Like `directGifUrl`, but also derives the GIF URL from a GIF provider's video rendition.
function asGifUrl(value) {
    if (isDiscordExternalProxy(value)) {
        var target = getDiscordProxyTarget(value);
        if (target) return asGifUrl(target);
        return hasGifExtension(value) ? value : null;
    }
    var direct = directGifUrl(value);
    if (direct) return direct;
    if (!isGifProviderVideo(value)) return null;
    try {
        var url = new URL(value);
        var host = url.hostname.toLowerCase();
        if (host.includes('giphy.com')) return canonicalGiphyUrl(url);
        // Klipy's video and GIF paths differ, so its GIF is resolved through the Klipy API instead.
        if (host.includes('klipy.com')) return null;
        if (url.searchParams.has('format')) url.searchParams.set('format', 'gif');
        url.pathname = url.pathname.replace(/\.(?:mp4|webm|webp)$/i, '.gif');
        return url.toString();
    } catch (unused) {
        return value.replace(/\.(?:mp4|webm)(?=$|[?#])/i, '.gif');
    }
}
/**
 * @description Finds the best GIF URL for a media source, preferring a URL that already points at a GIF over one derived from a video.
 * @param value A URL, or a Discord media record holding one.
 * @param depth How deep into nested media records the search already is.
 * @returns The GIF URL, or `null` when none can be derived without a network request.
 */ function getPreferredGifUrl(value) {
    var depth = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : 0;
    if (depth > 3) return null;
    if (typeof value === 'string') return asGifUrl(value);
    if (!isRecord(value)) return null;
    var derived = null;
    var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
    try {
        for(var _iterator = SOURCE_KEYS[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
            var key = _step.value;
            var candidate = value[key];
            if (typeof candidate !== 'string') {
                continue;
            }
            var direct = directGifUrl(candidate);
            if (direct) return direct;
            derived !== null && derived !== void 0 ? derived : derived = asGifUrl(candidate);
        }
    } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
    } finally{
        try {
            if (!_iteratorNormalCompletion && _iterator.return != null) {
                _iterator.return();
            }
        } finally{
            if (_didIteratorError) {
                throw _iteratorError;
            }
        }
    }
    if (derived) return derived;
    var _iteratorNormalCompletion1 = true, _didIteratorError1 = false, _iteratorError1 = undefined;
    try {
        for(var _iterator1 = NESTED_KEYS[Symbol.iterator](), _step1; !(_iteratorNormalCompletion1 = (_step1 = _iterator1.next()).done); _iteratorNormalCompletion1 = true){
            var key1 = _step1.value;
            var nested = getPreferredGifUrl(value[key1], depth + 1);
            if (nested) return nested;
        }
    } catch (err) {
        _didIteratorError1 = true;
        _iteratorError1 = err;
    } finally{
        try {
            if (!_iteratorNormalCompletion1 && _iterator1.return != null) {
                _iterator1.return();
            }
        } finally{
            if (_didIteratorError1) {
                throw _iteratorError1;
            }
        }
    }
    return null;
}
/**
 * @description Checks whether a media source is a GIF, including GIFs Discord serves as video.
 * @param value A URL, or a Discord media record holding one.
 * @param contentType The content type Discord reported for the source.
 * @param depth How deep into nested media records the search already is.
 * @returns `true` when the source or its content type marks a GIF or a GIF provider's video.
 */ function isGifSource(value, contentType) {
    var depth = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : 0;
    var _ref, _value_contentType;
    if (depth > 3) return false;
    if (isGifContentType(contentType)) return true;
    if (typeof value === 'string') return hasGifExtension(value) || isGifProviderVideo(value);
    if (!isRecord(value)) return false;
    if (typeof value.providerName === 'string' && isGifProvider(value.providerName)) return true;
    if (isGifContentType((_ref = (_value_contentType = value.contentType) !== null && _value_contentType !== void 0 ? _value_contentType : value.mimeType) !== null && _ref !== void 0 ? _ref : value.type)) return true;
    return _to_consumable_array$3(SOURCE_KEYS).concat(_to_consumable_array$3(NESTED_KEYS)).some(function(key) {
        return isGifSource(value[key], undefined, depth + 1);
    });
}function _array_like_to_array$2(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_without_holes$2(arr) {
    if (Array.isArray(arr)) return _array_like_to_array$2(arr);
}
function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) {
    try {
        var info = gen[key](arg);
        var value = info.value;
    } catch (error) {
        reject(error);
        return;
    }
    if (info.done) resolve(value);
    else Promise.resolve(value).then(_next, _throw);
}
function _async_to_generator(fn) {
    return function() {
        var self = this, args = arguments;
        return new Promise(function(resolve, reject) {
            var gen = fn.apply(self, args);
            function _next(value) {
                asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value);
            }
            function _throw(err) {
                asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err);
            }
            _next(undefined);
        });
    };
}
function _iterable_to_array$2(iter) {
    if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) {
        return Array.from(iter);
    }
}
function _non_iterable_spread$2() {
    throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _to_consumable_array$2(arr) {
    return _array_without_holes$2(arr) || _iterable_to_array$2(arr) || _unsupported_iterable_to_array$2(arr) || _non_iterable_spread$2();
}
function _ts_generator(thisArg, body) {
    var f, y, t, _ = {
        label: 0,
        sent: function() {
            if (t[0] & 1) throw t[1];
            return t[1];
        },
        trys: [],
        ops: []
    }, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype), d = Object.defineProperty;
    return d(g, "next", {
        value: verb(0)
    }), d(g, "throw", {
        value: verb(1)
    }), d(g, "return", {
        value: verb(2)
    }), typeof Symbol === "function" && d(g, Symbol.iterator, {
        value: function() {
            return this;
        }
    }), g;
    function verb(n) {
        return function(v) {
            return step([
                n,
                v
            ]);
        };
    }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while(g && (g = 0, op[0] && (_ = 0)), _)try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [
                op[0] & 2,
                t.value
            ];
            switch(op[0]){
                case 0:
                case 1:
                    t = op;
                    break;
                case 4:
                    _.label++;
                    return {
                        value: op[1],
                        done: false
                    };
                case 5:
                    _.label++;
                    y = op[1];
                    op = [
                        0
                    ];
                    continue;
                case 7:
                    op = _.ops.pop();
                    _.trys.pop();
                    continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) {
                        _ = 0;
                        continue;
                    }
                    if (op[0] === 3 && (!t || op[1] > t[0] && op[1] < t[3])) {
                        _.label = op[1];
                        break;
                    }
                    if (op[0] === 6 && _.label < t[1]) {
                        _.label = t[1];
                        t = op;
                        break;
                    }
                    if (t && _.label < t[2]) {
                        _.label = t[2];
                        _.ops.push(op);
                        break;
                    }
                    if (t[2]) _.ops.pop();
                    _.trys.pop();
                    continue;
            }
            op = body.call(thisArg, _);
        } catch (e) {
            op = [
                6,
                e
            ];
            y = 0;
        } finally{
            f = t = 0;
        }
        if (op[0] & 5) throw op[1];
        return {
            value: op[0] ? op[1] : void 0,
            done: true
        };
    }
}
function _unsupported_iterable_to_array$2(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _array_like_to_array$2(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(n);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _array_like_to_array$2(o, minLen);
}
var resolved = new Map();
var requests = new Map();
function mediaFolder(value) {
    try {
        var _getDiscordProxyTarget, _ref;
        var _url_pathname_match;
        var url = new URL((_getDiscordProxyTarget = getDiscordProxyTarget(value)) !== null && _getDiscordProxyTarget !== void 0 ? _getDiscordProxyTarget : value);
        return (_ref = (_url_pathname_match = url.pathname.match(/\/ii\/(.+)\/[^/]+$/i)) === null || _url_pathname_match === void 0 ? void 0 : _url_pathname_match[1]) !== null && _ref !== void 0 ? _ref : null;
    } catch (unused) {
        return null;
    }
}
function pageSlug(value) {
    if (typeof value !== 'string') return null;
    try {
        var _url_pathname_match;
        var url = new URL(value);
        if (!url.hostname.toLowerCase().endsWith('klipy.com')) return null;
        var slug = (_url_pathname_match = url.pathname.match(/^\/gifs\/([^/?#]+)/i)) === null || _url_pathname_match === void 0 ? void 0 : _url_pathname_match[1];
        return slug ? decodeURIComponent(slug) : null;
    } catch (unused) {
        return null;
    }
}
function title(value) {
    if (!isRecord(value)) return null;
    for(var _i = 0, _iter = [
        'title',
        'description',
        'slug'
    ]; _i < _iter.length; _i++){
        var key = _iter[_i];
        var candidate = value[key];
        if (typeof candidate === 'string' && candidate) return candidate;
    }
    return null;
}
function klipyFolder(value) {
    return typeof value === 'string' && /klipy/i.test(value) ? mediaFolder(value) : null;
}
function klipyGifUrl(value) {
    return typeof value === 'string' && /\.gif(?:$|[?#])/i.test(value) && /klipy/i.test(value) ? value : null;
}
function findGifUrl(value) {
    return findDeep(value, klipyGifUrl, 7, [
        'gif',
        'url',
        'sourceURI',
        'sourceUri',
        'sourceUrl',
        'originalUrl',
        'mediaUrl'
    ]);
}
function resultSlug(result) {
    return isRecord(result) && typeof result.slug === 'string' ? result.slug : null;
}
function isSlugMatch(result, slug) {
    var candidate = resultSlug(result);
    return !!slug && !!candidate && (candidate === slug || candidate.startsWith("".concat(slug, "--")));
}
function isFolderMatch(url, folder) {
    return !!folder && mediaFolder(url) === folder;
}
/**
 * @description Picks the GIF for Klipy media from search results: the result whose media folder matches, then the result whose slug matches, never an unrelated result.
 * @param results Klipy search results.
 * @param slug The media's page slug, when known.
 * @param folder The media's folder under `/ii/`, when known.
 * @returns The matching GIF URL, or `null`.
 */ function pickKlipyGif(results, slug, folder) {
    var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
    try {
        for(var _iterator = results[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
            var result = _step.value;
            var url = findGifUrl(result);
            if (url && isFolderMatch(url, folder)) return url;
        }
    } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
    } finally{
        try {
            if (!_iteratorNormalCompletion && _iterator.return != null) {
                _iterator.return();
            }
        } finally{
            if (_didIteratorError) {
                throw _iteratorError;
            }
        }
    }
    var _iteratorNormalCompletion1 = true, _didIteratorError1 = false, _iteratorError1 = undefined;
    try {
        for(var _iterator1 = results[Symbol.iterator](), _step1; !(_iteratorNormalCompletion1 = (_step1 = _iterator1.next()).done); _iteratorNormalCompletion1 = true){
            var result1 = _step1.value;
            var url1 = findGifUrl(result1);
            if (url1 && isSlugMatch(result1, slug)) return url1;
        }
    } catch (err) {
        _didIteratorError1 = true;
        _iteratorError1 = err;
    } finally{
        try {
            if (!_iteratorNormalCompletion1 && _iterator1.return != null) {
                _iterator1.return();
            }
        } finally{
            if (_didIteratorError1) {
                throw _iteratorError1;
            }
        }
    }
    return null;
}
function search(slug, folder) {
    return _async_to_generator(function() {
        var query, response, payload, results;
        return _ts_generator(this, function(_state) {
            switch(_state.label){
                case 0:
                    _state.trys.push([
                        0,
                        3,
                        ,
                        4
                    ]);
                    query = encodeURIComponent(slug.replace(/[-_]+/g, ' '));
                    return [
                        4,
                        fetch("https://api.klipy.com/api/v1/".concat(KLIPY_API_KEY, "/gifs/search?per_page=30&q=").concat(query, "&page=1&customer_id=unbound"))
                    ];
                case 1:
                    response = _state.sent();
                    if (!response.ok) return [
                        2,
                        null
                    ];
                    return [
                        4,
                        response.json()
                    ];
                case 2:
                    payload = _state.sent();
                    results = isRecord(payload) && isRecord(payload.data) ? payload.data.data : null;
                    if (!Array.isArray(results)) return [
                        2,
                        null
                    ];
                    return [
                        2,
                        pickKlipyGif(results, slug, folder)
                    ];
                case 3:
                    _state.sent();
                    return [
                        3,
                        4
                    ];
                case 4:
                    return [
                        2,
                        null
                    ];
            }
        });
    })();
}
/**
 * @description Finds the GIF rendition of Klipy media, which Discord only keeps as video, by searching Klipy for its slug or title.
 * @param value A Discord media record or URL for the Klipy media.
 * @returns The GIF URL, or `null` when the media is not Klipy's or no search result matches.
 */ function resolveKlipyGifUrl(value) {
    return _async_to_generator(function() {
        var _findDeep, _resolved_get, folder, slug, key, cached, request, url;
        return _ts_generator(this, function(_state) {
            switch(_state.label){
                case 0:
                    folder = findDeep(value, klipyFolder, 5, _to_consumable_array$2(SOURCE_KEYS).concat(_to_consumable_array$2(NESTED_KEYS)));
                    slug = (_findDeep = findDeep(value, pageSlug, 5, [
                        'url',
                        'uri',
                        'sourceURI',
                        'sourceUri',
                        'sourceUrl',
                        'embed',
                        'original',
                        'source',
                        'media'
                    ])) !== null && _findDeep !== void 0 ? _findDeep : findDeep(value, title, 5, [
                        'media',
                        'source',
                        'original',
                        'attachment',
                        'gif',
                        'result',
                        'data',
                        'embed'
                    ]);
                    key = folder !== null && folder !== void 0 ? folder : slug;
                    if (!key) return [
                        2,
                        null
                    ];
                    cached = (_resolved_get = resolved.get(key)) !== null && _resolved_get !== void 0 ? _resolved_get : requests.get(key);
                    if (cached) return [
                        2,
                        cached
                    ];
                    if (!slug) return [
                        2,
                        null
                    ];
                    request = search(slug, folder);
                    requests.set(key, request);
                    _state.label = 1;
                case 1:
                    _state.trys.push([
                        1,
                        ,
                        3,
                        4
                    ]);
                    return [
                        4,
                        request
                    ];
                case 2:
                    url = _state.sent();
                    if (url) resolved.set(key, url);
                    return [
                        2,
                        url
                    ];
                case 3:
                    requests.delete(key);
                    return [
                        7
                    ];
                case 4:
                    return [
                        2
                    ];
            }
        });
    })();
}function _array_like_to_array$1(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_with_holes$1(arr) {
    if (Array.isArray(arr)) return arr;
}
function _array_without_holes$1(arr) {
    if (Array.isArray(arr)) return _array_like_to_array$1(arr);
}
function _iterable_to_array$1(iter) {
    if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) {
        return Array.from(iter);
    }
}
function _iterable_to_array_limit$1(arr, i) {
    var _i = arr == null ? null : typeof Symbol !== "undefined" && arr[Symbol.iterator] || arr["@@iterator"];
    if (_i == null) return;
    var _arr = [];
    var _n = true;
    var _d = false;
    var _s, _e;
    try {
        for(_i = _i.call(arr); !(_n = (_s = _i.next()).done); _n = true){
            _arr.push(_s.value);
            if (i && _arr.length === i) break;
        }
    } catch (err) {
        _d = true;
        _e = err;
    } finally{
        try {
            if (!_n && _i["return"] != null) _i["return"]();
        } finally{
            if (_d) throw _e;
        }
    }
    return _arr;
}
function _non_iterable_rest$1() {
    throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _non_iterable_spread$1() {
    throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _sliced_to_array$1(arr, i) {
    return _array_with_holes$1(arr) || _iterable_to_array_limit$1(arr, i) || _unsupported_iterable_to_array$1(arr, i) || _non_iterable_rest$1();
}
function _to_consumable_array$1(arr) {
    return _array_without_holes$1(arr) || _iterable_to_array$1(arr) || _unsupported_iterable_to_array$1(arr) || _non_iterable_spread$1();
}
function _unsupported_iterable_to_array$1(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _array_like_to_array$1(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(n);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _array_like_to_array$1(o, minLen);
}
function pointAtGif(source, gifUrl) {
    source.uri = gifUrl;
    source.sourceURI = gifUrl;
    source.contentType = 'image/gif';
    delete source.videoURI;
    delete source.isGIFV;
}
/**
 * @description Points the media viewer's share and save actions at the GIF instead of its video rendition.
 * @returns A function that removes the patches.
 */ function patchMediaShareActions() {
    var modules = _to_consumable_array$1(new Set(findMediaShareActions()));
    if (!modules.length) {
        console.error('[Fix GIF Downloads: share actions] Skipped, modules not found: useMediaShareActions.');
        return function() {};
    }
    var unpatches = modules.map(function(module) {
        return Patcher.before(module, 'useMediaShareActions', function(param) {
            var args = param.args;
            var _args = _sliced_to_array$1(args, 1), options = _args[0];
            if (!isRecord(options) || !isRecord(options.source)) return;
            var source = options.source;
            var gifUrl = getPreferredGifUrl(source);
            if (gifUrl) {
                pointAtGif(source, gifUrl);
                return;
            }
            void resolveKlipyGifUrl(source).then(function(resolved) {
                if (resolved) pointAtGif(source, resolved);
            });
        });
    });
    return function() {
        var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
        try {
            for(var _iterator = unpatches[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                var unpatch = _step.value;
                unpatch();
            }
        } catch (err) {
            _didIteratorError = true;
            _iteratorError = err;
        } finally{
            try {
                if (!_iteratorNormalCompletion && _iterator.return != null) {
                    _iterator.return();
                }
            } finally{
                if (_didIteratorError) {
                    throw _iteratorError;
                }
            }
        }
    };
}function _define_property(obj, key, value) {
    if (key in obj) {
        Object.defineProperty(obj, key, {
            value: value,
            enumerable: true,
            configurable: true,
            writable: true
        });
    } else obj[key] = value;
    return obj;
}
function _instanceof(left, right) {
    "@swc/helpers - instanceof";
    if (right != null && typeof Symbol !== "undefined" && right[Symbol.hasInstance]) {
        return !!right[Symbol.hasInstance](left);
    } else return left instanceof right;
}
function _object_spread(target) {
    for(var i = 1; i < arguments.length; i++){
        var source = arguments[i] != null ? arguments[i] : {};
        var ownKeys = Object.keys(source);
        if (typeof Object.getOwnPropertySymbols === "function") {
            ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function(sym) {
                return Object.getOwnPropertyDescriptor(source, sym).enumerable;
            }));
        }
        ownKeys.forEach(function(key) {
            _define_property(target, key, source[key]);
        });
    }
    return target;
}
function ownKeys(object, enumerableOnly) {
    var keys = Object.keys(object);
    if (Object.getOwnPropertySymbols) {
        var symbols = Object.getOwnPropertySymbols(object);
        keys.push.apply(keys, symbols);
    }
    return keys;
}
function _object_spread_props(target, source) {
    source = source != null ? source : {};
    if (Object.getOwnPropertyDescriptors) Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));
    else {
        ownKeys(Object(source)).forEach(function(key) {
            Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
        });
    }
    return target;
}
function toFilter(source) {
    return typeof source === 'string' ? window.unbound.metro.filters.byFilePath(source) : source;
}
function findFirst(sources, options, signal) {
    var waits = [];
    var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
    try {
        for(var _iterator = sources[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
            var source = _step.value;
            var found = window.unbound.metro.findLazy(toFilter(source), _object_spread_props(_object_spread({}, options), {
                signal: signal
            }));
            if (!_instanceof(found, Promise)) {
                return found;
            }
            waits.push(found);
        }
    } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
    } finally{
        try {
            if (!_iteratorNormalCompletion && _iterator.return != null) {
                _iterator.return();
            }
        } finally{
            if (_didIteratorError) {
                throw _iteratorError;
            }
        }
    }
    return Promise.race(waits);
}
/**
 * @description Applies a feature to a module once it loads, now or later, so `stop` can cancel the wait or remove the feature.
 * @template T The module's type.
 * @param source The module's filter or file path, or several in order of preference: the first loaded wins, else the first to load.
 * @param apply Applies the feature and returns the function that removes it, or nothing when it did not apply.
 * @param options Metro search options, such as `interop`; a file path always yields the module's exports.
 * @returns A function that stops waiting and removes the feature if it was applied; call it in `stop`.
 */ function whenLoaded(source, apply) {
    var options = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : {};
    var controller = new AbortController();
    var sources = Array.isArray(source) ? source : [
        source
    ];
    var remove;
    void Promise.resolve(findFirst(sources, options, controller.signal)).then(function(module) {
        if (controller.signal.aborted) return;
        // Ends the waits on the other sources.
        controller.abort();
        if (module) {
            remove = apply(module);
        }
    });
    return function() {
        controller.abort();
        remove === null || remove === void 0 ? void 0 : remove();
        remove = undefined;
    };
}function _array_like_to_array(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_with_holes(arr) {
    if (Array.isArray(arr)) return arr;
}
function _array_without_holes(arr) {
    if (Array.isArray(arr)) return _array_like_to_array(arr);
}
function _iterable_to_array(iter) {
    if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) {
        return Array.from(iter);
    }
}
function _iterable_to_array_limit(arr, i) {
    var _i = arr == null ? null : typeof Symbol !== "undefined" && arr[Symbol.iterator] || arr["@@iterator"];
    if (_i == null) return;
    var _arr = [];
    var _n = true;
    var _d = false;
    var _s, _e;
    try {
        for(_i = _i.call(arr); !(_n = (_s = _i.next()).done); _n = true){
            _arr.push(_s.value);
            if (i && _arr.length === i) break;
        }
    } catch (err) {
        _d = true;
        _e = err;
    } finally{
        try {
            if (!_n && _i["return"] != null) _i["return"]();
        } finally{
            if (_d) throw _e;
        }
    }
    return _arr;
}
function _non_iterable_rest() {
    throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _non_iterable_spread() {
    throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _sliced_to_array(arr, i) {
    return _array_with_holes(arr) || _iterable_to_array_limit(arr, i) || _unsupported_iterable_to_array(arr, i) || _non_iterable_rest();
}
function _to_consumable_array(arr) {
    return _array_without_holes(arr) || _iterable_to_array(arr) || _unsupported_iterable_to_array(arr) || _non_iterable_spread();
}
function _unsupported_iterable_to_array(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _array_like_to_array(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(n);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _array_like_to_array(o, minLen);
}
// Discord's `MediaType.GIF` from wherever the enum is exported, or `1` when none is found.
function getGifType(manager) {
    var _ref, _ref1, _ref2, _ref3;
    var _manager_MediaType, _MediaTypes_MediaType, _MediaTypesFile_MediaType, _MediaTypesFile_default_MediaType, _MediaTypesFile_default;
    return (_ref = (_ref1 = (_ref2 = (_ref3 = (_manager_MediaType = manager.MediaType) === null || _manager_MediaType === void 0 ? void 0 : _manager_MediaType.GIF) !== null && _ref3 !== void 0 ? _ref3 : (_MediaTypes_MediaType = MediaTypes.MediaType) === null || _MediaTypes_MediaType === void 0 ? void 0 : _MediaTypes_MediaType.GIF) !== null && _ref2 !== void 0 ? _ref2 : (_MediaTypesFile_MediaType = MediaTypesFile.MediaType) === null || _MediaTypesFile_MediaType === void 0 ? void 0 : _MediaTypesFile_MediaType.GIF) !== null && _ref1 !== void 0 ? _ref1 : (_MediaTypesFile_default = MediaTypesFile.default) === null || _MediaTypesFile_default === void 0 ? void 0 : (_MediaTypesFile_default_MediaType = _MediaTypesFile_default.MediaType) === null || _MediaTypesFile_default_MediaType === void 0 ? void 0 : _MediaTypesFile_default_MediaType.GIF) !== null && _ref !== void 0 ? _ref : 1;
}
function patchDownload(manager, method) {
    // Both methods take `(source, mediaType, contentType?)`.
    function asGif(args, gifUrl) {
        var rewritten = _to_consumable_array(args);
        rewritten[0] = gifUrl;
        rewritten[1] = getGifType(manager);
        if (method === 'downloadMediaAssetWithContentType') rewritten[2] = 'image/gif';
        return rewritten;
    }
    return Patcher.instead(manager, method, function(param) {
        var args = param.args, original = param.original, self = param.this;
        var _args = _sliced_to_array(args, 3), source = _args[0], contentType = _args[2];
        var gifUrl = getPreferredGifUrl(source);
        if (gifUrl) return original.apply(self, asGif(args, gifUrl));
        if (!isGifSource(source, contentType)) return original.apply(self, args);
        return resolveKlipyGifUrl(source).then(function(resolved) {
            return original.apply(self, resolved ? asGif(args, resolved) : args);
        });
    });
}
function patchManager(manager) {
    var unpatches = [];
    // Resolving Klipy GIFs while media is shown keeps the later download instant.
    for(var _i = 0, _iter = [
        'extractMediaSourcesFromMessage',
        'extractMediaSourcesFromEmbed',
        'extractMediaFromEmbed',
        'extractMediaFromAttachment',
        'getEmbedMedia'
    ]; _i < _iter.length; _i++){
        var method = _iter[_i];
        if (typeof manager[method] !== 'function') {
            continue;
        }
        unpatches.push(Patcher.after(manager, method, function(param) {
            var args = param.args, result = param.result;
            void resolveKlipyGifUrl(args[0]);
            void resolveKlipyGifUrl(result);
        }));
    }
    if (typeof manager.isGIFSource === 'function') {
        unpatches.push(Patcher.after(manager, 'isGIFSource', function(param) {
            var args = param.args;
            if (isGifSource(args[0], args[1])) return true;
        }));
    }
    for(var _i1 = 0, _iter1 = [
        'downloadMediaAsset',
        'downloadMediaAssetWithContentType'
    ]; _i1 < _iter1.length; _i1++){
        var method1 = _iter1[_i1];
        if (typeof manager[method1] === 'function') {
            unpatches.push(patchDownload(manager, method1));
        }
    }
    return function() {
        var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
        try {
            for(var _iterator = unpatches[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                var unpatch = _step.value;
                unpatch();
            }
        } catch (err) {
            _didIteratorError = true;
            _iteratorError = err;
        } finally{
            try {
                if (!_iteratorNormalCompletion && _iterator.return != null) {
                    _iterator.return();
                }
            } finally{
                if (_didIteratorError) {
                    throw _iteratorError;
                }
            }
        }
    };
}
/**
 * @description Makes Discord treat GIF provider media as GIFs and save them as GIF files instead of videos, once its media manager loads.
 * @returns A function that stops waiting for the media manager, or removes every patch.
 */ function patchMediaManager() {
    return whenLoaded(MediaManagerFilters, patchManager);
}var dispose = function dispose() {};
function start() {
    dispose = applyFeatures('Fix GIF Downloads', [
        patchMediaShareActions,
        patchMediaManager
    ]);
}
function stop() {
    dispose();
    dispose = function dispose() {};
}
var index = {
    start: start,
    stop: stop
};
return index;
})();return this.__plugin;},start(context){const module=this.__load();const plugin=module?.default??module;if(plugin&&typeof plugin.start==='function')return plugin.start(context);},stop(){const module=this.__load();const plugin=module?.default??module;if(plugin&&typeof plugin.stop==='function')return plugin.stop();}})