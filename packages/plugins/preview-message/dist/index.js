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
}function lazyMarker(handle) {
    try {
        var _Object_getOwnPropertyDescriptor;
        return ((_Object_getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor(handle, '__METRO_LAZY__')) === null || _Object_getOwnPropertyDescriptor === void 0 ? void 0 : _Object_getOwnPropertyDescriptor.value) === true;
    } catch (unused) {
        return null;
    }
}
function isResolved(handle) {
    if (!handle) {
        return false;
    }
    var lazy = lazyMarker(handle);
    if (lazy === null) {
        return false;
    }
    if (!lazy) {
        return true;
    }
    // `module` runs a `{ lazy: true }` search, and pre-resolved handles throw on a miss.
    try {
        return Boolean(handle.module);
    } catch (unused) {
        return false;
    }
}
/**
 * @description Checks that every module a plugin or feature needs was found, so it can bail out instead of applying partially.
 * @param plugin The plugin's display name, or `Plugin: feature` for a single feature, used in the log line.
 * @param modules The handles to check, keyed by the name to report when one is missing.
 * @returns `true` when every handle resolved, otherwise `false` after logging the missing names.
 */ function ensureModules(plugin, modules) {
    var missing = Object.keys(modules).filter(function(name) {
        return !isResolved(modules[name]);
    });
    if (!missing.length) {
        return true;
    }
    console.error("[".concat(plugin, "] Skipped, modules not found: ").concat(missing.join(', '), "."));
    return false;
}function _define_property$1(obj, key, value) {
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
function _object_spread$1(target) {
    for(var i = 1; i < arguments.length; i++){
        var source = arguments[i] != null ? arguments[i] : {};
        var ownKeys = Object.keys(source);
        if (typeof Object.getOwnPropertySymbols === "function") {
            ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function(sym) {
                return Object.getOwnPropertyDescriptor(source, sym).enumerable;
            }));
        }
        ownKeys.forEach(function(key) {
            _define_property$1(target, key, source[key]);
        });
    }
    return target;
}
function ownKeys$1(object, enumerableOnly) {
    var keys = Object.keys(object);
    if (Object.getOwnPropertySymbols) {
        var symbols = Object.getOwnPropertySymbols(object);
        keys.push.apply(keys, symbols);
    }
    return keys;
}
function _object_spread_props$1(target, source) {
    source = source != null ? source : {};
    if (Object.getOwnPropertyDescriptors) Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));
    else {
        ownKeys$1(Object(source)).forEach(function(key) {
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
            var found = window.unbound.metro.findLazy(toFilter(source), _object_spread_props$1(_object_spread$1({}, options), {
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
}function _type_of$1(obj) {
    "@swc/helpers - typeof";
    return obj && typeof Symbol !== "undefined" && obj.constructor === Symbol ? "symbol" : typeof obj;
}
/**
 * @description Finds the render function behind the component at `owner[key]`, unwrapping `memo` (`type`) and `forwardRef` (`render`).
 * @param owner The object holding the component, such as a module's exports or a rendered element.
 * @param key The property holding the component, such as `default` for a module or `type` for an element.
 * @returns The object and key to patch, or `null` when no render function is found.
 */ function findRenderTarget(owner) {
    var key = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : 'default';
    var holder = owner;
    var prop = key;
    var current = owner[key];
    while(current && (typeof current === "undefined" ? "undefined" : _type_of$1(current)) === 'object'){
        var next = current.type ? 'type' : current.render ? 'render' : null;
        if (!next) {
            break;
        }
        holder = current;
        prop = next;
        current = current[next];
    }
    return typeof current === 'function' ? {
        holder: holder,
        key: prop
    } : null;
}/**
 * @description Lets components a plugin injected hide themselves once it stops, without waiting for their parent to re-render.
 * @param pluginId The plugin's ID, which keys the state.
 * @returns The flag's setter and hook.
 */ function createRunningFlag(pluginId) {
    var _host, _key, _;
    // Every start evaluates the bundle again, so components still mounted from an earlier evaluation
    // read the state through a global key and come back when the plugin starts again.
    var host = globalThis;
    var key = Symbol.for("".concat(pluginId, ".enabled"));
    var state = (_ = (_host = host)[_key = key]) !== null && _ !== void 0 ? _ : _host[_key] = {
        running: false,
        listeners: new Set()
    };
    function set(running) {
        state.running = running;
        var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
        try {
            for(var _iterator = state.listeners[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                var listener = _step.value;
                listener();
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
    }
    function subscribe(listener) {
        state.listeners.add(listener);
        return function() {
            return void state.listeners.delete(listener);
        };
    }
    return {
        markRunning: function markRunning() {
            set(true);
            return function() {
                return set(false);
            };
        },
        useRunning: function useRunning() {
            return window.React.useSyncExternalStore(subscribe, function() {
                return state.running;
            });
        }
    };
}var DraftStore = window.unbound.metro.findByProps('getDraft', {
    lazy: true
});
var SelectedChannelStore = window.unbound.metro.findStore('SelectedChannel', {
    lazy: true
});
var ChatInputs = window.unbound.metro.findByProps('getBestActiveInputForChannelId', {
    lazy: true
});
var Haptics = window.unbound.metro.findByFilePath('modules/haptics/HapticUtils.native.tsx', {
    lazy: true
});
// Whole modules, read through `.default` at use: a lazy handle can be neither rendered nor constructed.
var ChatItem = window.unbound.metro.findByFilePath('components_native/chat/ChatItem.tsx', {
    lazy: true
});
var MessageRecord = window.unbound.metro.findByName('MessageRecord', {
    interop: false,
    lazy: true
});
var RowManager = window.unbound.metro.findByName('RowManager', {
    interop: false,
    lazy: true
});
var FluxHooks = window.unbound.metro.common.FluxHooks;
var Users = window.unbound.metro.stores.Users;
var Plugins = window.unbound.plugins;
var textReplaceSettings = window.unbound.storage.getStore('unbound.text-replace');
var Patcher = window.unbound.patcher.createPatcher('unbound.preview-message');
var PreviewRunning = createRunningFlag('unbound.preview-message');function _array_like_to_array$5(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_without_holes$3(arr) {
    if (Array.isArray(arr)) return _array_like_to_array$5(arr);
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
    return _array_without_holes$3(arr) || _iterable_to_array$3(arr) || _unsupported_iterable_to_array$5(arr) || _non_iterable_spread$3();
}
function _unsupported_iterable_to_array$5(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _array_like_to_array$5(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(n);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _array_like_to_array$5(o, minLen);
}
var NO_STICKERS = Object.freeze([]);
/**
 * @description Holds the stickers waiting to be sent in each channel, notifying that channel's subscribers on change.
 * @returns `get`, `set` and `add` the channel's stickers, `subscribe` to a channel, and list the `channels` holding any.
 */ function createStagedStickers() {
    var staged = new Map();
    var listeners = new Map();
    function get(channelId) {
        var _staged_get;
        return (_staged_get = staged.get(channelId)) !== null && _staged_get !== void 0 ? _staged_get : NO_STICKERS;
    }
    function set(channelId, stickers) {
        var _listeners_get;
        if (stickers.length) {
            staged.set(channelId, stickers);
        } else {
            staged.delete(channelId);
        }
        var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
        try {
            for(var _iterator = ((_listeners_get = listeners.get(channelId)) !== null && _listeners_get !== void 0 ? _listeners_get : [])[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                var listener = _step.value;
                listener();
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
    }
    function add(channelId, sticker) {
        var current = get(channelId);
        if (current.some(function(item) {
            return String(item.id) === String(sticker.id);
        })) return;
        set(channelId, _to_consumable_array$3(current).concat([
            sticker
        ]));
    }
    function subscribe(channelId, listener) {
        var _listeners_get;
        var channelListeners = (_listeners_get = listeners.get(channelId)) !== null && _listeners_get !== void 0 ? _listeners_get : new Set();
        channelListeners.add(listener);
        listeners.set(channelId, channelListeners);
        return function() {
            channelListeners.delete(listener);
            if (!channelListeners.size) {
                listeners.delete(channelId);
            }
        };
    }
    function channels() {
        return _to_consumable_array$3(staged.keys());
    }
    return {
        get: get,
        set: set,
        add: add,
        subscribe: subscribe,
        channels: channels
    };
}
/**
 * @description Returns the staged stickers every plugin bundle shares, so Preview Message can show what Sticker Preview staged.
 * @returns The one staged-sticker store kept on `globalThis`.
 */ function sharedStagedStickers() {
    var _globalThis, ___unboundStagedStickers;
    return (___unboundStagedStickers = (_globalThis = globalThis).__unboundStagedStickers) !== null && ___unboundStagedStickers !== void 0 ? ___unboundStagedStickers : _globalThis.__unboundStagedStickers = createStagedStickers();
}var Button = {
    size: 32,
    gap: 8,
    iconSize: 22
};
var Timing = {
    showDelay: 60,
    show: 70,
    hide: 25,
    fadeIn: 160,
    fadeOut: 120,
    keyboardDismissFallback: 350
};
var MAX_PREVIEW_URLS = 4;
var CHANNEL_MESSAGE_DRAFT_TYPE = 0;
var MESSAGE_ROW_TYPE = 1;
var TextFields = new Map([
    [
        'og:title',
        'title'
    ],
    [
        'twitter:title',
        'title'
    ],
    [
        'og:description',
        'description'
    ],
    [
        'twitter:description',
        'description'
    ],
    [
        'og:site_name',
        'siteName'
    ],
    [
        'og:type',
        'type'
    ],
    [
        'og:image',
        'image'
    ],
    [
        'og:image:url',
        'image'
    ],
    [
        'og:image:secure_url',
        'image'
    ],
    [
        'twitter:image',
        'image'
    ]
]);
var SizeFields = new Map([
    [
        'og:image:width',
        'imageWidth'
    ],
    [
        'twitter:image:width',
        'imageWidth'
    ],
    [
        'og:image:height',
        'imageHeight'
    ],
    [
        'twitter:image:height',
        'imageHeight'
    ]
]);function _array_like_to_array$4(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_with_holes$2(arr) {
    if (Array.isArray(arr)) return arr;
}
function _array_without_holes$2(arr) {
    if (Array.isArray(arr)) return _array_like_to_array$4(arr);
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
function _iterable_to_array_limit$2(arr, i) {
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
function _non_iterable_rest$2() {
    throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _non_iterable_spread$2() {
    throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _sliced_to_array$2(arr, i) {
    return _array_with_holes$2(arr) || _iterable_to_array_limit$2(arr, i) || _unsupported_iterable_to_array$4(arr, i) || _non_iterable_rest$2();
}
function _to_consumable_array$2(arr) {
    return _array_without_holes$2(arr) || _iterable_to_array$2(arr) || _unsupported_iterable_to_array$4(arr) || _non_iterable_spread$2();
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
function decodeHtml(value) {
    return value.replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&#(\d+);/g, function(_match, code) {
        return String.fromCodePoint(Number(code));
    }).replace(/&#x([\da-f]+);/gi, function(_match, code) {
        return String.fromCodePoint(Number.parseInt(code, 16));
    });
}
function clean(value) {
    return value && decodeHtml(value).replace(/\s+/g, ' ').trim() || undefined;
}
function parseAttributes(tag) {
    var attributes = new Map();
    var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
    try {
        for(var _iterator = tag.matchAll(/([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
            var match = _step.value;
            var _ref, _match_;
            attributes.set(match[1].toLowerCase(), decodeHtml((_ref = (_match_ = match[2]) !== null && _match_ !== void 0 ? _match_ : match[3]) !== null && _ref !== void 0 ? _ref : match[4]));
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
    return attributes;
}
function readSize(value) {
    var size = Number.parseInt(value, 10);
    return size > 0 ? size : undefined;
}
function resolveUrl(value, base) {
    if (!value) return undefined;
    try {
        return new URL(value, base).toString();
    } catch (unused) {
        return undefined;
    }
}
function readOpenGraph(html) {
    var metadata = {};
    var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
    try {
        for(var _iterator = html.matchAll(/<meta\b[^>]*>/gi)[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
            var _step_value = _sliced_to_array$2(_step.value, 1), tag = _step_value[0];
            var _ref, _attributes_get;
            var attributes = parseAttributes(tag);
            var key = ((_ref = (_attributes_get = attributes.get('property')) !== null && _attributes_get !== void 0 ? _attributes_get : attributes.get('name')) !== null && _ref !== void 0 ? _ref : '').toLowerCase();
            var value = clean(attributes.get('content'));
            var textField = TextFields.get(key);
            var sizeField = SizeFields.get(key);
            if (!value) {
                continue;
            }
            if (textField) {
                var _metadata, _textField, _;
                (_ = (_metadata = metadata)[_textField = textField]) !== null && _ !== void 0 ? _ : _metadata[_textField] = value;
            } else if (sizeField) {
                var _metadata1, _sizeField, _1;
                (_1 = (_metadata1 = metadata)[_sizeField = sizeField]) !== null && _1 !== void 0 ? _1 : _metadata1[_sizeField] = readSize(value);
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
    return metadata;
}
function pickMedia(media) {
    if (!media || (typeof media === "undefined" ? "undefined" : _type_of(media)) !== 'object' || Array.isArray(media)) return undefined;
    var picked = {};
    if (typeof media.url === 'string') {
        picked.url = media.url;
    }
    if (typeof media.proxy_url === 'string') {
        picked.proxy_url = media.proxy_url;
    }
    if (Number.isFinite(media.width)) {
        picked.width = media.width;
    }
    if (Number.isFinite(media.height)) {
        picked.height = media.height;
    }
    return Object.keys(picked).length ? picked : undefined;
}
/**
 * @description Finds the links a message would embed, skipping `<suppressed>` links and trailing punctuation.
 * @param content The message content.
 * @returns The unique links, in order of appearance.
 */ function extractUrls(content) {
    var urls = new Set();
    var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
    try {
        for(var _iterator = content.matchAll(/https?:\/\/[^\s<>()"']+/gi)[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
            var match = _step.value;
            var start = match.index;
            var end = start + match[0].length;
            if (content[start - 1] === '<' && content[end] === '>') {
                continue;
            }
            var url = match[0].replace(/[.,!;:?]+$/, '');
            while(url.endsWith(')') && url.split('(').length < url.split(')').length){
                url = url.slice(0, -1);
            }
            if (url) {
                urls.add(url);
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
    return _to_consumable_array$2(urls);
}
/**
 * @description Builds a link embed from a page's Open Graph and Twitter card tags, falling back to its `<title>`.
 * @param html The page's HTML.
 * @param sourceUrl The page's URL, used for the embed and to resolve a relative image.
 * @returns The embed, or `null` when the page has no title, description or image.
 */ function parseOpenGraph(html, sourceUrl) {
    var _metadata_title;
    var _html_match;
    var metadata = readOpenGraph(html);
    var title = (_metadata_title = metadata.title) !== null && _metadata_title !== void 0 ? _metadata_title : clean((_html_match = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)) === null || _html_match === void 0 ? void 0 : _html_match[1]);
    var image = resolveUrl(metadata.image, sourceUrl);
    var description = metadata.description, siteName = metadata.siteName;
    if (!title && !description && !image) return null;
    var imageOnly = metadata.type === 'image' && image && !title && !description;
    var embed = {
        type: imageOnly ? 'image' : 'article',
        url: sourceUrl
    };
    if (title) {
        embed.title = title;
    }
    if (description) {
        embed.description = description;
    }
    if (siteName) {
        embed.provider = {
            name: siteName,
            url: sourceUrl
        };
    }
    if (image) {
        embed.image = {
            url: image,
            width: metadata.imageWidth,
            height: metadata.imageHeight
        };
    }
    return embed;
}
/**
 * @description Keeps only the fields of a Discord unfurler embed that the message row renders safely.
 * @param embed One embed from Discord's response.
 * @param url The link it was resolved for, used when the embed has no URL.
 * @returns The embed, or `null` when it has nothing to show.
 */ function normalizeDiscordEmbed(embed, url) {
    if (!embed || (typeof embed === "undefined" ? "undefined" : _type_of(embed)) !== 'object' || Array.isArray(embed)) return null;
    var type = embed.type, title = embed.title, description = embed.description;
    if (typeof type !== 'string' && typeof title !== 'string' && typeof description !== 'string' && !embed.image && !embed.thumbnail && !embed.video) {
        return null;
    }
    var normalized = {
        url: typeof embed.url === 'string' ? embed.url : url
    };
    if ('type' in embed) {
        normalized.type = type;
    }
    if ('title' in embed) {
        normalized.title = title;
    }
    if ('description' in embed) {
        normalized.description = description;
    }
    for(var _i = 0, _iter = [
        'image',
        'thumbnail',
        'video'
    ]; _i < _iter.length; _i++){
        var key = _iter[_i];
        var media = pickMedia(embed[key]);
        if (media) {
            normalized[key] = media;
        }
    }
    return normalized;
}
/**
 * @description Resolves a link's embed through Discord's unfurler, or from the page's own metadata when that fails.
 * @param url The link.
 * @param resolver Discord's REST client.
 * @returns The embed, or `null` when neither source produced one.
 */ function fetchLinkEmbed(url, resolver) {
    return _async_to_generator(function() {
        var _result_body_embeds, _result_body, result, response, _tmp;
        return _ts_generator(this, function(_state) {
            switch(_state.label){
                case 0:
                    _state.trys.push([
                        0,
                        2,
                        ,
                        3
                    ]);
                    return [
                        4,
                        resolver.post({
                            url: '/unfurler/embed-urls',
                            body: {
                                urls: [
                                    url
                                ]
                            }
                        })
                    ];
                case 1:
                    result = _state.sent();
                    return [
                        2,
                        normalizeDiscordEmbed(result === null || result === void 0 ? void 0 : (_result_body = result.body) === null || _result_body === void 0 ? void 0 : (_result_body_embeds = _result_body.embeds) === null || _result_body_embeds === void 0 ? void 0 : _result_body_embeds[0], url)
                    ];
                case 2:
                    _state.sent();
                    return [
                        3,
                        3
                    ];
                case 3:
                    _state.trys.push([
                        3,
                        8,
                        ,
                        9
                    ]);
                    return [
                        4,
                        fetch(url, {
                            headers: {
                                Accept: 'text/html,application/xhtml+xml'
                            }
                        })
                    ];
                case 4:
                    response = _state.sent();
                    if (!response.ok) return [
                        3,
                        6
                    ];
                    return [
                        4,
                        response.text()
                    ];
                case 5:
                    _tmp = parseOpenGraph.apply(void 0, [
                        _state.sent(),
                        url
                    ]);
                    return [
                        3,
                        7
                    ];
                case 6:
                    _tmp = null;
                    _state.label = 7;
                case 7:
                    return [
                        2,
                        _tmp
                    ];
                case 8:
                    _state.sent();
                    return [
                        2,
                        null
                    ];
                case 9:
                    return [
                        2
                    ];
            }
        });
    })();
}/**
 * @description Builds the message record Discord would create if the current user sent the draft now.
 * @param draft The draft's channel, content, stickers and resolved link embeds.
 * @returns A sent-state message record.
 */ function createDraftMessage(param) {
    var channelId = param.channelId, content = param.content, stickers = param.stickers, embeds = param.embeds;
    return new MessageRecord.default({
        id: '0',
        type: 0,
        channel_id: channelId,
        content: content,
        author: Users.getCurrentUser(),
        attachments: [],
        embeds: embeds,
        mentions: [],
        mention_roles: [],
        timestamp: new Date(),
        edited_timestamp: null,
        pinned: false,
        mention_everyone: false,
        tts: false,
        flags: 0,
        components: [],
        reactions: [],
        sticker_items: stickers,
        stickers: stickers,
        state: 'SENT',
        nonce: null
    });
}function _array_like_to_array$3(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_without_holes$1(arr) {
    if (Array.isArray(arr)) return _array_like_to_array$3(arr);
}
function _iterable_to_array$1(iter) {
    if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) {
        return Array.from(iter);
    }
}
function _non_iterable_spread$1() {
    throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _to_consumable_array$1(arr) {
    return _array_without_holes$1(arr) || _iterable_to_array$1(arr) || _unsupported_iterable_to_array$3(arr) || _non_iterable_spread$1();
}
function _unsupported_iterable_to_array$3(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _array_like_to_array$3(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(n);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _array_like_to_array$3(o, minLen);
}
var created = 0;
/**
 * @description Creates an empty rule with a unique id.
 * @returns A rule with blank `find`, `replace` and `onlyIfIncludes`.
 */ function createRule() {
    created++;
    return {
        find: '',
        replace: '',
        onlyIfIncludes: '',
        id: "".concat(Date.now(), "-").concat(created, "-").concat(Math.random().toString(36).slice(2))
    };
}
function isText(value) {
    return typeof value === 'string';
}
/**
 * @description Turns a stored rule list into well-formed rules, giving each one an id.
 * @param value The list read from storage or an imported ruleset.
 * @returns The rules, or a single empty rule when the list is missing or empty.
 */ function normalizeRules(// UNKNOWN: storage and imported rulesets hold whatever shape users or older versions wrote.
value) {
    if (!Array.isArray(value) || !value.length) {
        return [
            createRule()
        ];
    }
    return value.map(function(rule) {
        return {
            find: isText(rule === null || rule === void 0 ? void 0 : rule.find) ? rule.find : '',
            replace: isText(rule === null || rule === void 0 ? void 0 : rule.replace) ? rule.replace : '',
            onlyIfIncludes: isText(rule === null || rule === void 0 ? void 0 : rule.onlyIfIncludes) ? rule.onlyIfIncludes : '',
            id: isText(rule === null || rule === void 0 ? void 0 : rule.id) && rule.id ? rule.id : createRule().id
        };
    });
}
/**
 * @description Parses a regex rule's pattern, written either bare or as `/pattern/flags`.
 * @param value The pattern. Without flags it defaults to `g`; repeated flags are dropped.
 * @returns The compiled expression. Throws when the pattern is invalid.
 */ function stringToRegex(value) {
    var match = value.match(/^(\/)?(.+?)(?:\/([gimsuyv]*))?$/);
    var flags = (match === null || match === void 0 ? void 0 : match[3]) ? _to_consumable_array$1(new Set(match[3])).join('') : 'g';
    return new RegExp(match ? match[2] : value, flags);
}
function applies(rule, content) {
    return Boolean(rule.find) && (!rule.onlyIfIncludes || content.includes(rule.onlyIfIncludes));
}
function withNewlines(value) {
    return value.replaceAll('\\n', '\n');
}
/**
 * @description Rewrites a message with the text rules first, then the regex rules.
 * @param content The message content.
 * @param stringRules Literal rules, replacing every occurrence.
 * @param regexRules Regex rules; an invalid pattern is skipped.
 * @returns The rewritten, trimmed content.
 */ function applyRules(content, stringRules, regexRules) {
    if (!content) {
        return content;
    }
    var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
    try {
        for(var _iterator = stringRules[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
            var rule = _step.value;
            if (!applies(rule, content)) {
                continue;
            }
            content = " ".concat(content, " ").replaceAll(rule.find, withNewlines(rule.replace)).replace(/^\s|\s$/g, '');
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
        for(var _iterator1 = regexRules[Symbol.iterator](), _step1; !(_iteratorNormalCompletion1 = (_step1 = _iterator1.next()).done); _iteratorNormalCompletion1 = true){
            var rule1 = _step1.value;
            if (!applies(rule1, content)) {
                continue;
            }
            try {
                content = content.replace(stringToRegex(rule1.find), withNewlines(rule1.replace));
            } catch (unused) {
            // An invalid pattern leaves the message as it is.
            }
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
    return content.trim();
}/**
 * @description Rewrites a draft the way Text Replace will rewrite it on send.
 * @param content The draft.
 * @returns The draft with the user's Text Replace rules applied, or unchanged when that plugin is not running.
 */ function applyTextReplace(content) {
    var _Plugins_getEntity;
    if (!((_Plugins_getEntity = Plugins.getEntity('unbound.text-replace')) === null || _Plugins_getEntity === void 0 ? void 0 : _Plugins_getEntity.started)) return content;
    return applyRules(content, normalizeRules(textReplaceSettings.get('stringRules', [])), normalizeRules(textReplaceSettings.get('regexRules', [])));
}function _array_like_to_array$2(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_with_holes$1(arr) {
    if (Array.isArray(arr)) return arr;
}
function _define_property(obj, key, value) {
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
function _object_without_properties(source, excluded) {
    if (source == null) return {};
    var target = {}, sourceKeys, key, i;
    if (typeof Reflect !== "undefined" && Reflect.ownKeys) {
        sourceKeys = Reflect.ownKeys(Object(source));
        for(i = 0; i < sourceKeys.length; i++){
            key = sourceKeys[i];
            if (excluded.indexOf(key) >= 0) continue;
            if (!Object.prototype.propertyIsEnumerable.call(source, key)) continue;
            target[key] = source[key];
        }
        return target;
    }
    target = _object_without_properties_loose(source, excluded);
    if (Object.getOwnPropertySymbols) {
        sourceKeys = Object.getOwnPropertySymbols(source);
        for(i = 0; i < sourceKeys.length; i++){
            key = sourceKeys[i];
            if (excluded.indexOf(key) >= 0) continue;
            if (!Object.prototype.propertyIsEnumerable.call(source, key)) continue;
            target[key] = source[key];
        }
    }
    return target;
}
function _object_without_properties_loose(source, excluded) {
    if (source == null) return {};
    var target = {}, sourceKeys = Object.getOwnPropertyNames(source), key, i;
    for(i = 0; i < sourceKeys.length; i++){
        key = sourceKeys[i];
        if (excluded.indexOf(key) >= 0) continue;
        if (!Object.prototype.propertyIsEnumerable.call(source, key)) continue;
        target[key] = source[key];
    }
    return target;
}
function _sliced_to_array$1(arr, i) {
    return _array_with_holes$1(arr) || _iterable_to_array_limit$1(arr, i) || _unsupported_iterable_to_array$2(arr, i) || _non_iterable_rest$1();
}
function _unsupported_iterable_to_array$2(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _array_like_to_array$2(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(n);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _array_like_to_array$2(o, minLen);
}
function useLinkEmbeds(content) {
    var _useState = _sliced_to_array$1(window.React.useState([]), 2), embeds = _useState[0], setEmbeds = _useState[1];
    window.React.useEffect(function() {
        var active = true;
        var urls = extractUrls(content).slice(0, MAX_PREVIEW_URLS);
        setEmbeds([]);
        if (!urls.length) return;
        void Promise.all(urls.map(function(url) {
            return fetchLinkEmbed(url, window.unbound.metro.common.REST);
        })).then(function(resolved) {
            if (active) {
                setEmbeds(resolved.filter(function(embed) {
                    return embed !== null;
                }));
            }
        });
        return function() {
            active = false;
        };
    }, [
        content
    ]);
    return embeds;
}
function MessagePreview(param) {
    var channelId = param.channelId, content = param.content, stickers = param.stickers, embeds = param.embeds;
    var Row = ChatItem.default;
    // Discord's message row can throw on a draft it does not expect, so show the error instead of crashing.
    try {
        var message = createDraftMessage({
            channelId: channelId,
            content: content,
            stickers: stickers,
            embeds: embeds
        });
        var rowGenerator = new RowManager.default();
        rowGenerator.generate({
            rowType: MESSAGE_ROW_TYPE,
            message: message
        });
        return /*#__PURE__*/ React.createElement(Row, {
            rowGenerator: rowGenerator,
            message: message
        });
    } catch (error) {
        return /*#__PURE__*/ React.createElement(window.ReactNative.Text, {
            style: {
                color: '#ff7b72',
                paddingHorizontal: 14
            }
        }, "Preview failed: ".concat(error === null || error === void 0 ? void 0 : error.message));
    }
}
function PreviewOverlay(_0) {
    var content = _0.content, onClose = _0.onClose, props = _object_without_properties(_0, [
        "content",
        "onClose"
    ]);
    var rendered = applyTextReplace(content);
    var embeds = useLinkEmbeds(rendered);
    var opacity = window.React.useRef(new window.ReactNative.Animated.Value(0)).current;
    window.React.useEffect(function() {
        var _Haptics_HapticFeedbackTypes, _Haptics_triggerHapticFeedback;
        (_Haptics_triggerHapticFeedback = Haptics.triggerHapticFeedback) === null || _Haptics_triggerHapticFeedback === void 0 ? void 0 : _Haptics_triggerHapticFeedback.call(Haptics, (_Haptics_HapticFeedbackTypes = Haptics.HapticFeedbackTypes) === null || _Haptics_HapticFeedbackTypes === void 0 ? void 0 : _Haptics_HapticFeedbackTypes.IMPACT_MEDIUM);
        window.ReactNative.Animated.timing(opacity, {
            toValue: 1,
            duration: Timing.fadeIn,
            useNativeDriver: true
        }).start();
    }, [
        opacity
    ]);
    function dismiss() {
        window.ReactNative.Animated.timing(opacity, {
            toValue: 0,
            duration: Timing.fadeOut,
            useNativeDriver: true
        }).start(onClose);
    }
    return /*#__PURE__*/ React.createElement(window.ReactNative.Animated.View, {
        style: {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.65)',
            justifyContent: 'center',
            padding: 18,
            opacity: opacity
        }
    }, /*#__PURE__*/ React.createElement(window.ReactNative.Pressable, {
        onPress: dismiss,
        style: {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0
        }
    }), /*#__PURE__*/ React.createElement(window.ReactNative.KeyboardAvoidingView, {
        behavior: "padding",
        keyboardVerticalOffset: 0,
        style: {
            flex: 1,
            justifyContent: 'center'
        }
    }, /*#__PURE__*/ React.createElement(window.ReactNative.View, {
        style: {
            backgroundColor: '#2b2d31',
            borderRadius: 14,
            paddingVertical: 12,
            maxHeight: '70%'
        }
    }, /*#__PURE__*/ React.createElement(window.ReactNative.Text, {
        style: {
            color: '#f2f3f5',
            fontWeight: '600',
            paddingHorizontal: 14,
            paddingBottom: 10
        }
    }, "Message Preview"), /*#__PURE__*/ React.createElement(MessagePreview, _object_spread_props(_object_spread({}, props), {
        content: rendered,
        embeds: embeds
    })))));
}/**
 * @description Closes the chat's keyboard and custom keyboards, then calls back once it has hidden.
 * @param channelId The channel whose chat input to close.
 * @param onHidden Called once, when the keyboard hides or after a short fallback delay.
 * @returns A function that cancels the pending callback.
 */ function dismissKeyboard(channelId, onHidden) {
    var // Optional: without the chat input module, only the system keyboard is closed.
    _ChatInputs_dismissKeyboard, _ChatInputs_getBestActiveInputForChannelId_closeCustomKeyboard, _ChatInputs_getBestActiveInputForChannelId, _ChatInputs_getBestActiveInputForChannelId1, _state_currentlyFocusedInput;
    (_ChatInputs_dismissKeyboard = ChatInputs.dismissKeyboard) === null || _ChatInputs_dismissKeyboard === void 0 ? void 0 : _ChatInputs_dismissKeyboard.call(ChatInputs);
    (_ChatInputs_getBestActiveInputForChannelId1 = ChatInputs.getBestActiveInputForChannelId) === null || _ChatInputs_getBestActiveInputForChannelId1 === void 0 ? void 0 : (_ChatInputs_getBestActiveInputForChannelId = _ChatInputs_getBestActiveInputForChannelId1.call(ChatInputs, channelId)) === null || _ChatInputs_getBestActiveInputForChannelId === void 0 ? void 0 : (_ChatInputs_getBestActiveInputForChannelId_closeCustomKeyboard = _ChatInputs_getBestActiveInputForChannelId.closeCustomKeyboard) === null || _ChatInputs_getBestActiveInputForChannelId_closeCustomKeyboard === void 0 ? void 0 : _ChatInputs_getBestActiveInputForChannelId_closeCustomKeyboard.call(_ChatInputs_getBestActiveInputForChannelId);
    var state = window.ReactNative.TextInput.State;
    var focused = state === null || state === void 0 ? void 0 : (_state_currentlyFocusedInput = state.currentlyFocusedInput) === null || _state_currentlyFocusedInput === void 0 ? void 0 : _state_currentlyFocusedInput.call(state);
    if (focused) {
        state.blurTextInput(focused);
    }
    var subscription = window.ReactNative.Keyboard.addListener('keyboardDidHide', hidden);
    var timer = setTimeout(hidden, Timing.keyboardDismissFallback);
    function cancel() {
        subscription.remove();
        clearTimeout(timer);
    }
    function hidden() {
        cancel();
        onHidden();
    }
    window.ReactNative.Keyboard.dismiss();
    return cancel;
}function _array_like_to_array$1(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_with_holes(arr) {
    if (Array.isArray(arr)) return arr;
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
function _sliced_to_array(arr, i) {
    return _array_with_holes(arr) || _iterable_to_array_limit(arr, i) || _unsupported_iterable_to_array$1(arr, i) || _non_iterable_rest();
}
function _unsupported_iterable_to_array$1(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _array_like_to_array$1(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(n);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _array_like_to_array$1(o, minLen);
}
var trailingGap = window.ReactNative.Platform.OS === 'android' ? Button.gap : 0;
function useDraft(channelId) {
    return FluxHooks.useStateFromStores([
        DraftStore
    ], function() {
        var _DraftStore_getDraft;
        return (_DraftStore_getDraft = DraftStore.getDraft(channelId, CHANNEL_MESSAGE_DRAFT_TYPE)) !== null && _DraftStore_getDraft !== void 0 ? _DraftStore_getDraft : '';
    });
}
function useStickers(channelId) {
    return window.React.useSyncExternalStore(function(onChange) {
        return sharedStagedStickers().subscribe(channelId, onChange);
    }, function() {
        return sharedStagedStickers().get(channelId);
    });
}
// Collapses the button's slot while the draft is empty, and fades and scales it in once there is something to preview.
function useSlotAnimation(visible) {
    var _useState = _sliced_to_array(window.React.useState(false), 2), slotVisible = _useState[0], setSlotVisible = _useState[1];
    var slotVisibleRef = window.React.useRef(false);
    var timer = window.React.useRef(undefined);
    var progress = window.React.useRef(new window.ReactNative.Animated.Value(visible ? 1 : 0)).current;
    function updateSlot(next) {
        timer.current = undefined;
        slotVisibleRef.current = next;
        setSlotVisible(next);
    }
    window.React.useEffect(function() {
        clearTimeout(timer.current);
        progress.stopAnimation();
        progress.setValue(0);
        function show() {
            updateSlot(true);
            window.ReactNative.Animated.timing(progress, {
                toValue: 1,
                duration: Timing.show,
                useNativeDriver: false
            }).start();
        }
        if (visible) {
            if (slotVisibleRef.current) {
                show();
            } else {
                timer.current = setTimeout(show, Timing.showDelay);
            }
            return;
        }
        if (!slotVisibleRef.current) return;
        timer.current = setTimeout(function() {
            return updateSlot(false);
        }, Timing.hide);
    }, [
        visible,
        progress
    ]);
    window.React.useEffect(function() {
        return function() {
            return clearTimeout(timer.current);
        };
    }, []);
    return {
        slotVisible: slotVisible,
        progress: progress
    };
}
function PreviewButton(param) {
    var channelId = param.channelId, icon = param.icon;
    var running = PreviewRunning.useRunning();
    var _useState = _sliced_to_array(window.React.useState(false), 2), open = _useState[0], setOpen = _useState[1];
    var cancelOpen = window.React.useRef(undefined);
    var draft = useDraft(channelId);
    var stickers = useStickers(channelId);
    var visible = Boolean(draft.trim() || stickers.length);
    var _useSlotAnimation = useSlotAnimation(visible), slotVisible = _useSlotAnimation.slotVisible, progress = _useSlotAnimation.progress;
    window.React.useEffect(function() {
        return function() {
            var _cancelOpen_current;
            return (_cancelOpen_current = cancelOpen.current) === null || _cancelOpen_current === void 0 ? void 0 : _cancelOpen_current.call(cancelOpen);
        };
    }, []);
    function openPreview() {
        cancelOpen.current = dismissKeyboard(channelId, function() {
            return setOpen(true);
        });
    }
    // The patch is gone once the plugin stops, but the chat input keeps this element until it re-renders.
    if (!running) return null;
    return /*#__PURE__*/ React.createElement(React.Fragment, null, /*#__PURE__*/ React.createElement(window.ReactNative.Animated.View, {
        style: {
            width: slotVisible ? Button.size : 0,
            marginRight: slotVisible ? trailingGap : -8,
            height: Button.size,
            opacity: visible ? progress : 0,
            overflow: 'hidden',
            alignItems: 'center',
            justifyContent: 'center'
        }
    }, /*#__PURE__*/ React.createElement(window.ReactNative.Pressable, {
        accessibilityRole: "button",
        accessibilityLabel: "Preview message",
        onPress: openPreview,
        onPressIn: function onPressIn() {
            var _Haptics_HapticFeedbackTypes, _Haptics_triggerHapticFeedback;
            return (_Haptics_triggerHapticFeedback = Haptics.triggerHapticFeedback) === null || _Haptics_triggerHapticFeedback === void 0 ? void 0 : _Haptics_triggerHapticFeedback.call(Haptics, (_Haptics_HapticFeedbackTypes = Haptics.HapticFeedbackTypes) === null || _Haptics_HapticFeedbackTypes === void 0 ? void 0 : _Haptics_HapticFeedbackTypes.IMPACT_LIGHT);
        },
        hitSlop: 8,
        style: function style(param) {
            var pressed = param.pressed;
            return {
                width: Button.size,
                height: Button.size,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.5 : 1,
                transform: [
                    {
                        scale: pressed ? 0.86 : 1
                    }
                ]
            };
        }
    }, /*#__PURE__*/ React.createElement(window.ReactNative.Animated.Image, {
        source: icon,
        style: {
            width: Button.iconSize,
            height: Button.iconSize,
            tintColor: '#b5bac1',
            transform: [
                {
                    scale: progress.interpolate({
                        inputRange: [
                            0,
                            1
                        ],
                        outputRange: [
                            0.6,
                            1
                        ]
                    })
                }
            ]
        }
    }))), open ? /*#__PURE__*/ React.createElement(window.unbound.metro.components.Portal.Portal, null, /*#__PURE__*/ React.createElement(PreviewOverlay, {
        channelId: channelId,
        content: draft,
        stickers: stickers,
        onClose: function onClose() {
            return setOpen(false);
        }
    })) : null);
}function _array_like_to_array(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_without_holes(arr) {
    if (Array.isArray(arr)) return _array_like_to_array(arr);
}
function _iterable_to_array(iter) {
    if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) {
        return Array.from(iter);
    }
}
function _non_iterable_spread() {
    throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
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
/**
 * @description Adds the preview button in front of the chat input's right-hand actions.
 * @param icon The eye icon's asset id.
 * @returns A function that stops waiting for the module or removes the patch.
 */ function patchChatInputRightActions(icon) {
    return whenLoaded('modules/chat_input/native/action_buttons/ChatInputRightActions.tsx', function(module) {
        var target = findRenderTarget(module);
        if (!target) {
            console.error('[Preview Message] Not starting, the chat input actions have no render function.');
            return function() {};
        }
        return Patcher.after(target.holder, target.key, function(param) {
            var args = param.args, result = param.result;
            var _ref;
            var _props_channel;
            if (!(result === null || result === void 0 ? void 0 : result.props)) return;
            var props = args[0];
            var channelId = (_ref = props === null || props === void 0 ? void 0 : (_props_channel = props.channel) === null || _props_channel === void 0 ? void 0 : _props_channel.id) !== null && _ref !== void 0 ? _ref : SelectedChannelStore.getChannelId();
            if (!channelId) return;
            return /*#__PURE__*/ window.React.cloneElement.apply(void 0, [
                result,
                undefined,
                /*#__PURE__*/ React.createElement(PreviewButton, {
                    key: "unbound-preview-message",
                    channelId: channelId,
                    icon: icon
                })
            ].concat(_to_consumable_array(window.React.Children.toArray(result.props.children))));
        });
    });
}/**
 * @description Adds the preview button in front of the send button, where Android keeps it while a draft is typed; Android collapses the right-hand actions as soon as there is text.
 * @param icon The eye icon's asset id.
 * @returns A function that stops waiting for the module or removes the patch.
 */ function patchChatInputSendButton(icon) {
    return whenLoaded('modules/chat_input/native/accessories/ChatInputSendButton.tsx', function(module) {
        var target = findRenderTarget(module);
        if (!target) {
            console.error('[Preview Message] Not starting, the send button has no render function.');
            return function() {};
        }
        return Patcher.after(target.holder, target.key, function(param) {
            var args = param.args, result = param.result;
            var _ref;
            var _props_channel;
            if (!result) return;
            var props = args[0];
            var channelId = (_ref = props === null || props === void 0 ? void 0 : (_props_channel = props.channel) === null || _props_channel === void 0 ? void 0 : _props_channel.id) !== null && _ref !== void 0 ? _ref : SelectedChannelStore.getChannelId();
            if (!channelId) return;
            return /*#__PURE__*/ React.createElement(window.ReactNative.View, {
                style: {
                    flexDirection: 'row',
                    alignItems: 'center'
                }
            }, /*#__PURE__*/ React.createElement(PreviewButton, {
                key: "unbound-preview-message",
                channelId: channelId,
                icon: icon
            }), result);
        });
    });
}var dispose = function dispose() {};
function start() {
    var EyeIcon = window.unbound.assets.getIDByName('EyeIcon');
    var ready = ensureModules('Preview Message', {
        ChatItem: ChatItem,
        MessageRecord: MessageRecord,
        RowManager: RowManager,
        DraftStore: DraftStore,
        SelectedChannelStore: SelectedChannelStore,
        FluxHooks: FluxHooks,
        Portal: window.unbound.metro.components.Portal,
        Users: Users
    });
    if (!ready) return;
    if (EyeIcon === undefined) {
        console.error('[Preview Message] Skipped, the EyeIcon asset was not found.');
        return;
    }
    dispose = applyFeatures('Preview Message', [
        PreviewRunning.markRunning,
        function() {
            return window.ReactNative.Platform.OS === 'android' ? patchChatInputSendButton(EyeIcon) : patchChatInputRightActions(EyeIcon);
        }
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