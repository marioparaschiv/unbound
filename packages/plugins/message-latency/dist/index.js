({__plugin:null,__load(){if(this.__plugin)return this.__plugin;this.__plugin=(function () {
'use strict';
/**
 * @description Checks that the loader offers every native capability a feature uses, since a missing bridge is a stand-in whose methods throw.
 * @param plugin The plugin's display name, or `Plugin: feature` for a single feature, used in the log line.
 * @param native The bridge from `context.native`.
 * @param capabilities The capabilities to check, usually `context.capabilities`.
 * @returns `true` when every capability is available, otherwise `false` after logging the missing ones.
 */ function ensureCapabilities(plugin, native, capabilities) {
    var missing = capabilities.filter(function(capability) {
        return !native.capabilities.includes(capability);
    });
    if (!missing.length) {
        return true;
    }
    console.error("[".concat(plugin, "] Skipped, native capabilities not available: ").concat(missing.join(', '), "."));
    return false;
}function isPending(result) {
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
}/**
 * @description Checks that every Objective-C class a plugin hooks or allocates exists, so `start` can bail out before applying a partial feature.
 * @param plugin The plugin's display name, used in the log line.
 * @param objc The Objective-C bridge from `context.native`.
 * @param classes The class names to check.
 * @returns `true` when every class exists, otherwise `false` after logging the missing names.
 */ function ensureClasses(plugin, objc, classes) {
    var missing = classes.filter(function(name) {
        return !objc.getClass(name);
    });
    if (!missing.length) {
        return true;
    }
    console.error("[".concat(plugin, "] Not starting, native classes not found: ").concat(missing.join(', '), "."));
    return false;
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
}function _define_property$2(obj, key, value) {
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
function _object_spread$2(target) {
    for(var i = 1; i < arguments.length; i++){
        var source = arguments[i] != null ? arguments[i] : {};
        var ownKeys = Object.keys(source);
        if (typeof Object.getOwnPropertySymbols === "function") {
            ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function(sym) {
                return Object.getOwnPropertyDescriptor(source, sym).enumerable;
            }));
        }
        ownKeys.forEach(function(key) {
            _define_property$2(target, key, source[key]);
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
            var found = window.unbound.metro.findLazy(toFilter(source), _object_spread_props(_object_spread$2({}, options), {
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
}var UserStore = window.unbound.metro.stores.Users;
var ThemeStore = window.unbound.metro.findStore('Theme', {
    lazy: true
});
// The same module as `metro.common.Theme`, which its typings do not declare yet.
var Theme = window.unbound.metro.findByProps('colors', 'internal', {
    lazy: true
});
var Tooltips = window.unbound.metro.findByProps('TooltipArrowDirections', 'TooltipArrowPositions', {
    lazy: true
});
var MessageRowDataFilter = window.unbound.metro.filters.byProps('generateMessageRowData');
var settings = window.unbound.storage.getStore('unbound.message-latency');
var Patcher = window.unbound.patcher.createPatcher('unbound.message-latency');function _array_like_to_array$9(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_with_holes$5(arr) {
    if (Array.isArray(arr)) return arr;
}
function _iterable_to_array_limit$5(arr, i) {
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
function _non_iterable_rest$5() {
    throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _sliced_to_array$5(arr, i) {
    return _array_with_holes$5(arr) || _iterable_to_array_limit$5(arr, i) || _unsupported_iterable_to_array$9(arr, i) || _non_iterable_rest$5();
}
function _unsupported_iterable_to_array$9(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _array_like_to_array$9(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(n);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _array_like_to_array$9(o, minLen);
}
/**
 * @description Measures each message Discord builds a chat row for, once the row module loads. The row itself is not changed.
 * @param records The latency cache to fill.
 * @returns A function that stops waiting for the module and removes the patch.
 */ function patchMessageRowData(records) {
    return whenLoaded(MessageRowDataFilter, function(MessageRowData) {
        return Patcher.after(MessageRowData, 'generateMessageRowData', function(param) {
            var args = param.args, result = param.result;
            var _result_message;
            var _args = _sliced_to_array$5(args, 1), input = _args[0];
            var username = result === null || result === void 0 ? void 0 : (_result_message = result.message) === null || _result_message === void 0 ? void 0 : _result_message.username;
            if (!(input === null || input === void 0 ? void 0 : input.message)) return;
            records.update(input.message, typeof username === 'string' ? username : undefined);
        });
    });
}/**
 * @description Measures every message as it arrives, through the native runtime when available or Discord's dispatcher otherwise.
 * @param records The latency cache to fill.
 * @param context The plugin context, whose runtime events are used when granted.
 * @returns A function that unsubscribes.
 */ function subscribeMessageCreate(records, context) {
    function onMessageCreate(param) {
        var message = param.message;
        var _message_author;
        if (!message) return;
        records.update(message, (_message_author = message.author) === null || _message_author === void 0 ? void 0 : _message_author.username);
    }
    if (context.capabilities.includes('native.runtime.events')) {
        try {
            var token = context.native.runtime.subscribe('message.created', onMessageCreate);
            return function() {
                return token.remove();
            };
        } catch (unused) {
        // The runtime refused the subscription; the dispatcher delivers the same event.
        }
    }
    window.unbound.metro.common.Dispatcher.subscribe('MESSAGE_CREATE', onMessageCreate);
    return function() {
        return window.unbound.metro.common.Dispatcher.unsubscribe('MESSAGE_CREATE', onMessageCreate);
    };
}/**
 * @description Tags a number as a Java `int`.
 * @param value The number.
 * @returns The tagged value.
 */ function javaInt(value) {
    return {
        type: 'int',
        value: Math.trunc(value)
    };
}
/**
 * @description Tags a number as a Java `float`.
 * @param value The number.
 * @returns The tagged value.
 */ function javaFloat(value) {
    return {
        type: 'float',
        value: value
    };
}
/**
 * @description Tags a string as a Java `String`.
 * @param value The string.
 * @returns The tagged value.
 */ function javaString(value) {
    return {
        type: 'string',
        value: value
    };
}
/**
 * @description Tells whether a Java result is an object handle.
 * @param value The result.
 * @returns `true` for a handle, which can be passed back as a target or argument.
 */ function isJavaHandle(value) {
    return (value === null || value === void 0 ? void 0 : value.type) === 'handle';
}
/**
 * @description Reads a Java result as an object reference.
 * @param value The result.
 * @returns The handle, or `null` for Java `null` and non-object results.
 */ function javaReference(value) {
    return isJavaHandle(value) ? value : null;
}
/**
 * @description Reads a Java result as a string.
 * @param value The result.
 * @returns The string, or `undefined` when the result is not a `String` or `char`.
 */ function javaText(value) {
    return (value === null || value === void 0 ? void 0 : value.type) === 'string' || (value === null || value === void 0 ? void 0 : value.type) === 'char' ? value.value : undefined;
}
/**
 * @description Reads a Java result as a boolean.
 * @param value The result.
 * @returns `true` only for a Java `true`.
 */ function javaFlag(value) {
    return (value === null || value === void 0 ? void 0 : value.type) === 'boolean' && value.value;
}
/**
 * @description Tells whether two Java references point at the same object.
 * @param left A reference.
 * @param right Another reference.
 * @returns `true` when both are handles to the same object.
 */ function sameJavaReference(left, right) {
    var key = function key(reference) {
        return reference && 'value' in reference ? reference.value : reference && 'id' in reference ? String(reference.id) : undefined;
    };
    return key(left) !== undefined && key(left) === key(right);
}
/**
 * @description Reads a Java result as a number.
 * @param value The result.
 * @returns The number, or `undefined` when the result is not numeric.
 */ function javaNumber(value) {
    switch(value === null || value === void 0 ? void 0 : value.type){
        case 'byte':
        case 'short':
        case 'int':
        case 'long':
        case 'float':
        case 'double':
            return value.value;
        default:
            return undefined;
    }
}function asyncGeneratorStep$a(gen, resolve, reject, _next, _throw, key, arg) {
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
function _async_to_generator$a(fn) {
    return function() {
        var self = this, args = arguments;
        return new Promise(function(resolve, reject) {
            var gen = fn.apply(self, args);
            function _next(value) {
                asyncGeneratorStep$a(gen, resolve, reject, _next, _throw, "next", value);
            }
            function _throw(err) {
                asyncGeneratorStep$a(gen, resolve, reject, _next, _throw, "throw", err);
            }
            _next(undefined);
        });
    };
}
function _ts_generator$a(thisArg, body) {
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
var MAX_ANCESTOR_DEPTH = 12;
var MEASURE_EXACTLY = 1 << 30;
function hostsFreely(java, view) {
    return javaFlag(java.invoke(java.getClass('android.view.ViewGroup'), 'isInstance', [
        view
    ])) && !javaFlag(java.invoke(java.getClass('androidx.recyclerview.widget.RecyclerView'), 'isInstance', [
        view
    ]));
}
/**
 * @description Finds the nearest ancestor of a text view that can hold a free-floating child view, skipping recycler views.
 * @param java The plugin's Java bridge.
 * @param textView The text view the reserved room is in.
 * @returns The ancestor and the text view's offset inside it, or `null` when none was found.
 */ function hostContainer(java, textView) {
    var x = 0;
    var y = 0;
    var current = textView;
    for(var depth = 0; current && depth < MAX_ANCESTOR_DEPTH; depth++){
        var _javaNumber, _javaNumber1, _javaNumber2, _javaNumber3;
        x += ((_javaNumber = javaNumber(java.invoke(current, 'getLeft', []))) !== null && _javaNumber !== void 0 ? _javaNumber : 0) - ((_javaNumber1 = javaNumber(java.invoke(current, 'getScrollX', []))) !== null && _javaNumber1 !== void 0 ? _javaNumber1 : 0);
        y += ((_javaNumber2 = javaNumber(java.invoke(current, 'getTop', []))) !== null && _javaNumber2 !== void 0 ? _javaNumber2 : 0) - ((_javaNumber3 = javaNumber(java.invoke(current, 'getScrollY', []))) !== null && _javaNumber3 !== void 0 ? _javaNumber3 : 0);
        var parent = javaReference(java.invoke(current, 'getParent', []));
        if (!parent) return null;
        if (hostsFreely(java, parent)) {
            return {
                container: parent,
                offset: {
                    x: x,
                    y: y
                }
            };
        }
        current = parent;
    }
    return null;
}
/**
 * @description Creates an empty `FrameLayout` to mount a React surface into over reserved room.
 * @param java The plugin's Java bridge.
 * @param textView A view whose context the host shares.
 * @returns The host view.
 */ function createHost(java, textView) {
    var context = javaReference(java.invoke(textView, 'getContext', []));
    return java.construct('android.widget.FrameLayout', context ? [
        context
    ] : []);
}
function layoutParamsClass(java, container) {
    var _javaNumber;
    var count = (_javaNumber = javaNumber(java.invoke(container, 'getChildCount', []))) !== null && _javaNumber !== void 0 ? _javaNumber : 0;
    for(var index = 0; index < count; index++){
        var child = javaReference(java.invoke(container, 'getChildAt', [
            javaInt(index)
        ]));
        var params = child ? javaReference(java.invoke(child, 'getLayoutParams', [])) : null;
        var name = params ? javaText(java.className(params)) : undefined;
        if (name) {
            return name;
        }
    }
    return 'android.view.ViewGroup$LayoutParams';
}
function fillHost(java, host, width, height) {
    return _async_to_generator$a(function() {
        var _javaNumber, count, index, child;
        return _ts_generator$a(this, function(_state) {
            switch(_state.label){
                case 0:
                    count = (_javaNumber = javaNumber(java.invoke(host, 'getChildCount', []))) !== null && _javaNumber !== void 0 ? _javaNumber : 0;
                    index = 0;
                    _state.label = 1;
                case 1:
                    if (!(index < count)) return [
                        3,
                        5
                    ];
                    child = javaReference(java.invoke(host, 'getChildAt', [
                        javaInt(index)
                    ]));
                    if (!child) {
                        return [
                            3,
                            4
                        ];
                    }
                    return [
                        4,
                        java.invokeAsync(child, 'measure', [
                            javaInt(width | MEASURE_EXACTLY),
                            javaInt(height | MEASURE_EXACTLY)
                        ])
                    ];
                case 2:
                    _state.sent();
                    return [
                        4,
                        java.invokeAsync(child, 'layout', [
                            javaInt(0),
                            javaInt(0),
                            javaInt(width),
                            javaInt(height)
                        ])
                    ];
                case 3:
                    _state.sent();
                    _state.label = 4;
                case 4:
                    index++;
                    return [
                        3,
                        1
                    ];
                case 5:
                    return [
                        2
                    ];
            }
        });
    })();
}
/**
 * @description Sizes a host view, adds it to its container when it is elsewhere, and moves it over the reserved room. The host and the surfaces in it are measured and laid out directly, since a container that lays out only the children it knows about would leave the host at zero size, and a surface would keep the height it mounted at.
 * @param java The plugin's Java bridge.
 * @param host The host view.
 * @param container The view to hold it.
 * @param position The host's top-left corner inside the container.
 * @param size The host's width and height, in pixels.
 * @returns Resolves once the host is in place on the main thread.
 */ function placeHost(java, host, container, position, size) {
    return _async_to_generator$a(function() {
        var params, parent, inContainer, width, height;
        return _ts_generator$a(this, function(_state) {
            switch(_state.label){
                case 0:
                    params = java.construct(layoutParamsClass(java, container), [
                        javaInt(Math.round(size.width)),
                        javaInt(Math.round(size.height))
                    ]);
                    parent = javaReference(java.invoke(host, 'getParent', []));
                    inContainer = sameJavaReference(parent, container);
                    if (!(parent && !inContainer)) return [
                        3,
                        2
                    ];
                    return [
                        4,
                        java.invokeAsync(parent, 'removeView', [
                            host
                        ])
                    ];
                case 1:
                    _state.sent();
                    _state.label = 2;
                case 2:
                    if (!!inContainer) return [
                        3,
                        4
                    ];
                    return [
                        4,
                        java.invokeAsync(container, 'addView', [
                            host,
                            params
                        ])
                    ];
                case 3:
                    _state.sent();
                    return [
                        3,
                        6
                    ];
                case 4:
                    return [
                        4,
                        java.invokeAsync(host, 'setLayoutParams', [
                            params
                        ])
                    ];
                case 5:
                    _state.sent();
                    _state.label = 6;
                case 6:
                    width = Math.round(size.width);
                    height = Math.round(size.height);
                    return [
                        4,
                        java.invokeAsync(host, 'measure', [
                            javaInt(width | MEASURE_EXACTLY),
                            javaInt(height | MEASURE_EXACTLY)
                        ])
                    ];
                case 7:
                    _state.sent();
                    return [
                        4,
                        java.invokeAsync(host, 'layout', [
                            javaInt(0),
                            javaInt(0),
                            javaInt(width),
                            javaInt(height)
                        ])
                    ];
                case 8:
                    _state.sent();
                    return [
                        4,
                        fillHost(java, host, width, height)
                    ];
                case 9:
                    _state.sent();
                    return [
                        4,
                        java.invokeAsync(host, 'setTranslationX', [
                            javaFloat(position.x)
                        ])
                    ];
                case 10:
                    _state.sent();
                    return [
                        4,
                        java.invokeAsync(host, 'setTranslationY', [
                            javaFloat(position.y)
                        ])
                    ];
                case 11:
                    _state.sent();
                    return [
                        2
                    ];
            }
        });
    })();
}
/**
 * @description Lays out the recycler view a reserved row sits in at its current bounds. React Native views ignore layout requests from native children, so a row that grew would otherwise keep its old height.
 * @param java The plugin's Java bridge.
 * @param view A view inside the row.
 * @returns Resolves once the list has been laid out on the main thread, or at once when there is no list above the view.
 */ function layoutHostingList(java, view) {
    return _async_to_generator$a(function() {
        var recycler, current, depth, parent, isList, _javaNumber, _javaNumber1, _javaNumber2, _javaNumber3, left, top, width, height;
        return _ts_generator$a(this, function(_state) {
            switch(_state.label){
                case 0:
                    recycler = java.getClass('androidx.recyclerview.widget.RecyclerView');
                    current = javaReference(java.invoke(view, 'getParent', []));
                    depth = 0;
                    _state.label = 1;
                case 1:
                    if (!(current && depth < MAX_ANCESTOR_DEPTH)) return [
                        3,
                        6
                    ];
                    parent = javaReference(java.invoke(current, 'getParent', []));
                    isList = javaFlag(java.invoke(recycler, 'isInstance', [
                        current
                    ]));
                    if (!(isList && parent && !javaFlag(java.invoke(recycler, 'isInstance', [
                        parent
                    ])))) return [
                        3,
                        4
                    ];
                    left = (_javaNumber = javaNumber(java.invoke(current, 'getLeft', []))) !== null && _javaNumber !== void 0 ? _javaNumber : 0;
                    top = (_javaNumber1 = javaNumber(java.invoke(current, 'getTop', []))) !== null && _javaNumber1 !== void 0 ? _javaNumber1 : 0;
                    width = (_javaNumber2 = javaNumber(java.invoke(current, 'getWidth', []))) !== null && _javaNumber2 !== void 0 ? _javaNumber2 : 0;
                    height = (_javaNumber3 = javaNumber(java.invoke(current, 'getHeight', []))) !== null && _javaNumber3 !== void 0 ? _javaNumber3 : 0;
                    return [
                        4,
                        java.invokeAsync(current, 'measure', [
                            javaInt(width | MEASURE_EXACTLY),
                            javaInt(height | MEASURE_EXACTLY)
                        ])
                    ];
                case 2:
                    _state.sent();
                    return [
                        4,
                        java.invokeAsync(current, 'layout', [
                            javaInt(left),
                            javaInt(top),
                            javaInt(left + width),
                            javaInt(top + height)
                        ])
                    ];
                case 3:
                    _state.sent();
                    return [
                        2
                    ];
                case 4:
                    current = parent;
                    _state.label = 5;
                case 5:
                    depth++;
                    return [
                        3,
                        1
                    ];
                case 6:
                    return [
                        2
                    ];
            }
        });
    })();
}
/**
 * @description Takes a host view out of whatever holds it.
 * @param java The plugin's Java bridge.
 * @param host The host view.
 * @returns Resolves once it is removed.
 */ function removeHost(java, host) {
    return _async_to_generator$a(function() {
        var parent;
        return _ts_generator$a(this, function(_state) {
            switch(_state.label){
                case 0:
                    parent = javaReference(java.invoke(host, 'getParent', []));
                    if (!parent) return [
                        3,
                        2
                    ];
                    return [
                        4,
                        java.invokeAsync(parent, 'removeView', [
                            host
                        ])
                    ];
                case 1:
                    _state.sent();
                    _state.label = 2;
                case 2:
                    return [
                        2
                    ];
            }
        });
    })();
}var descriptions = new WeakMap();
/**
 * @description Describes a Java class once and reuses the description, since a class does not change while Discord runs.
 * @param java The Java bridge.
 * @param name The class name.
 * @returns The class's declared constructors, methods and fields.
 */ function describeJavaClass(java, name) {
    var _descriptions_get;
    var known = (_descriptions_get = descriptions.get(java)) !== null && _descriptions_get !== void 0 ? _descriptions_get : new Map();
    var cached = known.get(name);
    if (cached) {
        return cached;
    }
    var description = java.describe(name);
    known.set(name, description);
    descriptions.set(java, known);
    return description;
}var messageBind = {
	owner: "com.discord.chat.presentation.message.MessageView",
	member: "method",
	"static": false,
	firstParameter: "com.discord.chat.bridge.Message",
	pick: "most-parameters"
};
var messageTagBind = {
	owner: "com.discord.chat.presentation.message.MessageTagView",
	member: "method",
	"static": false,
	firstParameter: "java.lang.String",
	pick: "most-parameters"
};
var messageId = {
	owner: "com.discord.chat.presentation.message.MessageView",
	member: "field",
	"static": false,
	type: "java.lang.String",
	pick: "only"
};
var draweeTextBuilder = {
	owner: "com.facebook.drawee.span.SimpleDraweeSpanTextView",
	member: "method",
	name: "setDraweeSpanStringBuilder",
	parameterCount: 1,
	pick: "only"
};
var blockBackgroundSpan = {
	"implements": "android.text.style.LineBackgroundSpan",
	member: "constructor",
	parameters: [
		"int",
		"int",
		"int",
		"int",
		"int",
		"int",
		"int"
	],
	pick: "only"
};
var reactionEmoji = {
	"extends": "android.widget.LinearLayout",
	withFields: [
		"java.lang.Integer",
		"java.lang.Boolean"
	],
	member: "field",
	"static": false,
	type: "java.lang.String",
	pick: "only"
};
var reactSurface = {
	parameterOf: "com.facebook.react.runtime.ReactInstance",
	unlessClass: "com.facebook.react.ReactHost",
	member: "constructor",
	parameters: [
		"android.content.Context",
		"java.lang.String",
		"android.os.Bundle"
	],
	pick: "only"
};
var reactSurfaceHandler = {
	ownerShape: "reactSurface",
	unlessClass: "com.facebook.react.ReactHost",
	member: "field",
	type: "com.facebook.react.fabric.SurfaceHandlerBinding",
	pick: "only"
};
var reactSurfaceReferences = {
	ownerShape: "reactSurface",
	unlessClass: "com.facebook.react.ReactHost",
	member: "field",
	type: "java.util.concurrent.atomic.AtomicReference",
	count: 2,
	pick: "all"
};
var reactSurfaceHost = {
	ownerShape: "reactSurface",
	unlessClass: "com.facebook.react.ReactHost",
	member: "method",
	parameterCount: 0,
	returnsAssignableFrom: "com.facebook.react.runtime.ReactHostImpl",
	pick: "only"
};
var reactFabric = {
	owner: "com.facebook.react.runtime.ReactInstance",
	unlessClass: "com.facebook.react.ReactHost",
	member: "field",
	type: "com.facebook.react.fabric.FabricUIManager",
	pick: "only"
};
var reactHostDelegate = {
	owner: "com.facebook.react.runtime.ReactHostImpl",
	unlessClass: "com.facebook.react.ReactHost",
	member: "field",
	type: "com.facebook.react.defaults.DefaultReactHostDelegate",
	pick: "only"
};
var reactSurfaceViewFactory = {
	owner: "com.facebook.react.defaults.DefaultReactHostDelegate",
	unlessClass: "com.facebook.react.ReactHost",
	member: "field",
	typeAssignableTo: "kotlin.jvm.functions.Function2",
	pick: "only"
};
var shapes = {
	messageBind: messageBind,
	messageTagBind: messageTagBind,
	messageId: messageId,
	draweeTextBuilder: draweeTextBuilder,
	blockBackgroundSpan: blockBackgroundSpan,
	reactionEmoji: reactionEmoji,
	reactSurface: reactSurface,
	reactSurfaceHandler: reactSurfaceHandler,
	reactSurfaceReferences: reactSurfaceReferences,
	reactSurfaceHost: reactSurfaceHost,
	reactFabric: reactFabric,
	reactHostDelegate: reactHostDelegate,
	reactSurfaceViewFactory: reactSurfaceViewFactory
};function _array_like_to_array$8(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_without_holes$5(arr) {
    if (Array.isArray(arr)) return _array_like_to_array$8(arr);
}
function _iterable_to_array$5(iter) {
    if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) {
        return Array.from(iter);
    }
}
function _non_iterable_spread$5() {
    throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _to_consumable_array$5(arr) {
    return _array_without_holes$5(arr) || _iterable_to_array$5(arr) || _unsupported_iterable_to_array$8(arr) || _non_iterable_spread$5();
}
function _unsupported_iterable_to_array$8(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _array_like_to_array$8(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(n);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _array_like_to_array$8(o, minLen);
}
var DISCORD_SHAPES = shapes;
var LOADER_ONLY_KEYS = [
    'ownerShape',
    'parameterOf',
    'typeAssignableTo',
    'returnsAssignableFrom',
    'count'
];
function shapeOf(name, member) {
    var shape = DISCORD_SHAPES[name];
    var loaderOnly = LOADER_ONLY_KEYS.filter(function(key) {
        return key in shape;
    });
    if (loaderOnly.length > 0) {
        throw new Error("The Discord shape ".concat(name, " uses ").concat(loaderOnly.join(', '), ", which only the Android loader applies."));
    }
    if (shape.member !== member) {
        throw new Error("The Discord shape ".concat(name, " describes a ").concat(shape.member, ", not a ").concat(member, "."));
    }
    return shape;
}
function ownerOf(name, className) {
    var owner = DISCORD_SHAPES[name].owner;
    if (!owner) {
        throw new Error("The Discord shape ".concat(name, " needs the class to look in."));
    }
    return owner;
}
function matchesParameters(shape, parameters) {
    if (shape.firstParameter !== undefined && parameters[0] !== shape.firstParameter) {
        return false;
    }
    if (shape.parameterCount !== undefined && parameters.length !== shape.parameterCount) {
        return false;
    }
    return shape.parameters === undefined || shape.parameters.length === parameters.length && shape.parameters.every(function(parameter, index) {
        return parameter === parameters[index];
    });
}
function matchesMember(shape, member) {
    return (shape.name === undefined || member.name === shape.name) && (shape.static === undefined || member.static === shape.static);
}
function pick(shape, matches, parameters) {
    var _Math;
    var longest = (_Math = Math).max.apply(_Math, [
        0
    ].concat(_to_consumable_array$5(matches.map(function(match) {
        return parameters(match).length;
    }))));
    var picked = shape.pick === 'most-parameters' ? matches.filter(function(match) {
        return parameters(match).length === longest;
    }) : matches;
    return picked.length === 1 ? picked[0] : null;
}
/**
 * @description Finds the method a Discord shape describes, for code that cannot name an obfuscated method. The compat scan checks the same shape against each Discord build.
 * @param java The Java bridge.
 * @param name The shape's name in `discord-shapes.json`.
 * @param className The class to look in, when the shape has no owner of its own.
 * @returns The method, or `null` when no method or several fit the shape.
 */ function shapeMethod(java, name, className) {
    var shape = shapeOf(name, 'method');
    var matches = describeJavaClass(java, ownerOf(name)).methods.filter(function(method) {
        return matchesMember(shape, method) && matchesParameters(shape, method.parameters);
    });
    return pick(shape, matches, function(method) {
        return method.parameters;
    });
}
/**
 * @description Finds the field a Discord shape describes, for code that cannot name an obfuscated field. The compat scan checks the same shape against each Discord build.
 * @param java The Java bridge.
 * @param name The shape's name in `discord-shapes.json`.
 * @param className The class to look in, when the shape has no owner of its own.
 * @returns The field, or `null` when no field or several fit the shape.
 */ function shapeField(java, name, className) {
    var shape = shapeOf(name, 'field');
    var matches = describeJavaClass(java, ownerOf(name)).fields.filter(function(field) {
        return matchesMember(shape, field) && (shape.type === undefined || field.type === shape.type);
    });
    return pick(shape, matches, function() {
        return [];
    });
}var MESSAGE_VIEW = 'com.discord.chat.presentation.message.MessageView';
var DISCORD_PACKAGE = 'com.discord';
var viewIds = new Map();
/**
 * @description Finds the method a `MessageView` binds a message with. Discord obfuscates its name and most parameter types, but on every build it takes the message first and has the most parameters.
 * @param java The Java bridge.
 * @returns The method's name and parameter types, ready to hook.
 */ function messageBindMethod(java) {
    var method = shapeMethod(java, 'messageBind');
    if (!method) {
        throw new Error('This Discord build has no single MessageView method that binds a message.');
    }
    return method;
}
/**
 * @description Names the field holding the id of the message a `MessageView` shows, its only `String` field.
 * @param java The Java bridge.
 * @returns The field name.
 */ function messageIdField(java) {
    var field = shapeField(java, 'messageId');
    if (!field) {
        throw new Error('MessageView has no single text field, so its message id is ambiguous.');
    }
    return field.name;
}
/**
 * @description Finds a descendant view by the name of its Discord resource id. Resource ids keep their names on every build, unlike the view binding classes.
 * @param java The Java bridge.
 * @param view The view to search under.
 * @param name The id's resource name, such as `author_name`.
 * @returns The view, or `null` when the view has no such descendant.
 */ function viewByIdName(java, view, name) {
    var id = viewId(java, view, name);
    return id ? javaReference(java.invoke(view, 'findViewById', [
        javaInt(id)
    ])) : null;
}
function viewId(java, view, name) {
    var cached = viewIds.get(name);
    if (cached !== undefined) {
        return cached;
    }
    var resources = javaReference(java.invoke(view, 'getResources', []));
    var id = resources ? javaNumber(java.invoke(resources, 'getIdentifier', [
        javaString(name),
        javaString('id'),
        javaString(DISCORD_PACKAGE)
    ])) : undefined;
    if (id) {
        viewIds.set(name, id);
    }
    return id;
}var MAX_VISITED = 4000;
var STARTUP_SCAN_DELAYS = [
    300
];
/**
 * @description Reads the activity the loader's `ActivityTracker` saw resume last.
 * @param java The plugin's Java bridge.
 * @returns The activity, or `null` while no activity is resumed.
 */ function currentActivity(java) {
    var tracker = javaReference(java.getField(java.getClass('app.unbound.android.ActivityTracker'), 'INSTANCE'));
    return tracker ? javaReference(java.invoke(tracker, 'currentActivity', [])) : null;
}
/**
 * @description Reads the decor view of the activity the loader saw resume last.
 * @param java The plugin's Java bridge.
 * @returns The decor view, or `null` while no activity is resumed.
 */ function currentDecorView(java) {
    var activity = currentActivity(java);
    var window = activity ? javaReference(java.invoke(activity, 'getWindow', [])) : null;
    return window ? javaReference(java.invoke(window, 'getDecorView', [])) : null;
}
/**
 * @description Finds the attached views of a class under a root, for views bound before a plugin's hooks were installed.
 * @param java The plugin's Java bridge.
 * @param root The view to search under.
 * @param className The view class, such as `com.discord.chat.presentation.message.MessageView`.
 * @returns Each matching view, in tree order.
 */ function findViewsOfClass(java, root, className) {
    var target = java.getClass(className);
    var group = java.getClass('android.view.ViewGroup');
    var found = [];
    var queue = [
        root
    ];
    for(var visited = 0; queue.length && visited < MAX_VISITED; visited++){
        var _javaNumber;
        var view = queue.shift();
        if (javaFlag(java.invoke(target, 'isInstance', [
            view
        ]))) {
            found.push(view);
        }
        if (!javaFlag(java.invoke(group, 'isInstance', [
            view
        ]))) {
            continue;
        }
        var count = (_javaNumber = javaNumber(java.invoke(view, 'getChildCount', []))) !== null && _javaNumber !== void 0 ? _javaNumber : 0;
        for(var index = 0; index < count; index++){
            var child = javaReference(java.invoke(view, 'getChildAt', [
                javaInt(index)
            ]));
            if (child) {
                queue.push(child);
            }
        }
    }
    return found;
}/**
 * @description Picks the first `prefix` + index name that React Native has not registered yet.
 * @param prefix The surface's name prefix.
 * @param registered The app keys already registered.
 * @returns The free name.
 */ function nextSurfaceName(prefix, registered) {
    var index = 0;
    while(registered.includes("".concat(prefix).concat(index)))index++;
    return "".concat(prefix).concat(index);
}function findRegistry() {
    var _ref;
    return (_ref = window.ReactNative.AppRegistry !== null && window.ReactNative.AppRegistry !== void 0 ? window.ReactNative.AppRegistry : globalThis.RN$AppRegistry) !== null && _ref !== void 0 ? _ref : window.unbound.metro.findByProps('registerComponent', 'runApplication');
}
/**
 * @description Registers a root component that Fabric can mount into a native view. App keys cannot be unregistered, so each call takes the next free name.
 * @param prefix The surface's name prefix, such as `MessageLinkEmbedSurface`.
 * @param component The root component.
 * @returns The registered name to pass to `fabric.mount`, or `undefined` when React Native refused it.
 */ function registerAppSurface(prefix, component) {
    var _ref;
    var _registry_getAppKeys;
    var registry = findRegistry();
    if (typeof (registry === null || registry === void 0 ? void 0 : registry.registerComponent) !== 'function') return;
    var name = nextSurfaceName(prefix, (_ref = (_registry_getAppKeys = registry.getAppKeys) === null || _registry_getAppKeys === void 0 ? void 0 : _registry_getAppKeys.call(registry)) !== null && _ref !== void 0 ? _ref : []);
    try {
        registry.registerComponent(name, function() {
            return component;
        });
        return name;
    } catch (unused) {
        return;
    }
}var Defaults = {
    latency: 2,
    showMillis: false,
    ignoreSelf: false,
    detectDiscordKotlin: true
};
var LATENCY_OPTIONS = [
    1,
    2,
    3,
    5,
    10
];
var DISCORD_EPOCH = 1420070400000;
// 2^22: a snowflake's timestamp is its value shifted right by 22 bits.
var SNOWFLAKE_SHIFT = 4194304;
// Old Discord Android (Kotlin) clients generate nonces this far ahead of the message ID.
var ANDROID_NONCE_OFFSET = 1471228928;
var ANDROID_OFFSET_TOLERANCE = 86400000;
var MAX_LATENCY_RECORDS = 500;
var CELL_SNAPSHOT = {
    maxDepth: 12,
    maxNodes: 120
};
var Icon = {
    width: 12,
    height: 12,
    controlWidth: 16,
    controlHeight: 20,
    bars: [
        {
            x: 1.2,
            y: 12.4,
            width: 2.4,
            height: 2.4
        },
        {
            x: 4.8,
            y: 8.8,
            width: 2.4,
            height: 6
        },
        {
            x: 8.4,
            y: 5.2,
            width: 2.4,
            height: 9.6
        }
    ]
};
var FILL_TOKENS = {
    danger: 'STATUS_DANGER',
    muted: 'TEXT_MUTED',
    positive: 'STATUS_POSITIVE',
    warning: 'STATUS_WARNING'
};
var Tooltip = {
    maxWidth: 250,
    arrowHeight: 8,
    anchorGap: 3,
    fontSize: 13,
    duration: 3000
};
// NSLayoutAttribute and NSLayoutRelation values from UIKit.
var LayoutAttribute = {
    NotAnAttribute: 0,
    Leading: 5,
    Trailing: 6,
    Width: 7,
    Height: 8,
    CenterY: 10
};
var LAYOUT_RELATION_EQUAL = 0;/**
 * @description Reads the theme Discord is currently showing.
 * @returns The theme name, falling back to dark.
 */ function currentTheme() {
    var _ThemeStore_theme;
    return (_ThemeStore_theme = ThemeStore.theme) !== null && _ThemeStore_theme !== void 0 ? _ThemeStore_theme : Theme.themes.DARK;
}
/**
 * @description Resolves one of Discord's semantic color tokens for the current theme.
 * @param token The token name in `Theme.colors`, such as `TEXT_MUTED`.
 * @returns The resolved color, usually a `#rrggbb` string.
 */ function resolveColor(token) {
    return Theme.internal.resolveSemanticColor(currentTheme(), Theme.colors[token]);
}
/**
 * @description Calls `listener` whenever the theme changes.
 * @param listener The function to call.
 * @returns A function that stops listening.
 */ function subscribeTheme(listener) {
    // The theme store is optional: without it the indicator keeps the dark theme's colors.
    if (!ThemeStore.addChangeListener) return function() {};
    ThemeStore.addChangeListener(listener);
    return function() {
        return ThemeStore.removeChangeListener(listener);
    };
}/**
 * @description Registers the root component Fabric surfaces mount to draw the three-bar indicator, as a tappable control the size of the iOS one.
 * @param source Looks up each surface's record, tells the surface when it changes, and receives its taps.
 * @returns The registered module name to mount, or `undefined` when React Native refused it.
 */ function registerLatencyIconSurface(source) {
    function LatencyIconSurface(param) {
        var surfaceId = param.surfaceId;
        var _record_details_displayDelta;
        window.React.useSyncExternalStore(function(listener) {
            return source.subscribe(surfaceId, listener);
        }, function() {
            return source.revision(surfaceId);
        });
        var record = source.record(surfaceId);
        var size = {
            width: Icon.controlWidth,
            height: Icon.controlHeight
        };
        if (!record) return /*#__PURE__*/ React.createElement(window.ReactNative.View, {
            style: size
        });
        return /*#__PURE__*/ React.createElement(window.ReactNative.Pressable, {
            accessibilityRole: "button",
            accessibilityLabel: (_record_details_displayDelta = record.details.displayDelta) !== null && _record_details_displayDelta !== void 0 ? _record_details_displayDelta : 'Old Discord Android client',
            accessibilityHint: record.tooltip,
            onPress: function onPress() {
                return source.press(surfaceId);
            },
            style: size
        }, Icon.bars.map(function(bar, index) {
            return /*#__PURE__*/ React.createElement(window.ReactNative.View, {
                key: index,
                style: {
                    position: 'absolute',
                    left: bar.x,
                    top: bar.y,
                    width: bar.width,
                    height: bar.height,
                    borderRadius: 0.5,
                    backgroundColor: resolveColor(FILL_TOKENS[record.details.fill[index]])
                }
            });
        }));
    }
    return registerAppSurface('MessageLatencyIconSurface', LatencyIconSurface);
}function _array_like_to_array$7(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_without_holes$4(arr) {
    if (Array.isArray(arr)) return _array_like_to_array$7(arr);
}
function asyncGeneratorStep$9(gen, resolve, reject, _next, _throw, key, arg) {
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
function _async_to_generator$9(fn) {
    return function() {
        var self = this, args = arguments;
        return new Promise(function(resolve, reject) {
            var gen = fn.apply(self, args);
            function _next(value) {
                asyncGeneratorStep$9(gen, resolve, reject, _next, _throw, "next", value);
            }
            function _throw(err) {
                asyncGeneratorStep$9(gen, resolve, reject, _next, _throw, "throw", err);
            }
            _next(undefined);
        });
    };
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
    return _array_without_holes$4(arr) || _iterable_to_array$4(arr) || _unsupported_iterable_to_array$7(arr) || _non_iterable_spread$4();
}
function _ts_generator$9(thisArg, body) {
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
function _unsupported_iterable_to_array$7(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _array_like_to_array$7(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(n);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _array_like_to_array$7(o, minLen);
}
var DRAWABLE = 'android.graphics.drawable.Drawable';
var NO_DRAWABLE = {
    type: 'null',
    class: DRAWABLE
};
var VISIBLE = 0;
var SETTLE_DELAYS = [
    0,
    120,
    600
];
function viewKey$1(view) {
    return view.type === 'handle' ? view.value : undefined;
}
/**
 * @description Draws the latency indicator in front of the author name of Discord's Android message rows, like the iOS one, and opens its tooltip on tap.
 * @param native The plugin's Java, hook and Fabric bridges.
 * @param records The latency cache to draw from.
 * @param tooltips The tooltip shown when an indicator is tapped, or `null` when unavailable. The indicators own and dispose it.
 * @returns `dispose`, which removes every indicator and resolves once the rows are restored, or `undefined` when the icon surface did not register.
 */ function createAndroidIndicators(param, records, tooltips) {
    var java = param.java, hooks = param.hooks, fabric = param.fabric;
    var indicators = new Map();
    var byId = new Map();
    var bound = new Map();
    var listeners = new Map();
    var queues = new Map();
    var nextId = 0;
    var disposed = false;
    var iconModule = registerLatencyIconSurface({
        record: function record(surfaceId) {
            var _byId_get;
            return (_byId_get = byId.get(surfaceId)) === null || _byId_get === void 0 ? void 0 : _byId_get.record;
        },
        revision: function revision(surfaceId) {
            var _ref;
            var _byId_get;
            return (_ref = (_byId_get = byId.get(surfaceId)) === null || _byId_get === void 0 ? void 0 : _byId_get.revision) !== null && _ref !== void 0 ? _ref : -1;
        },
        subscribe: function subscribe(surfaceId, listener) {
            var _listeners_get;
            var set = (_listeners_get = listeners.get(surfaceId)) !== null && _listeners_get !== void 0 ? _listeners_get : new Set();
            set.add(listener);
            listeners.set(surfaceId, set);
            return function() {
                set.delete(listener);
                if (!set.size) listeners.delete(surfaceId);
            };
        },
        press: function press(surfaceId) {
            var indicator = byId.get(surfaceId);
            if (indicator && !indicator.disposed) {
                tooltips === null || tooltips === void 0 ? void 0 : tooltips.show({
                    key: indicator.id,
                    host: indicator.host,
                    tooltip: indicator.record.tooltip
                });
            }
        }
    });
    if (!iconModule) return undefined;
    function publish(indicator) {
        var _listeners_get;
        indicator.revision++;
        var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
        try {
            for(var _iterator = ((_listeners_get = listeners.get(indicator.id)) !== null && _listeners_get !== void 0 ? _listeners_get : [])[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
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
    function density(view) {
        var _javaNumber;
        var resources = javaReference(java.invoke(view, 'getResources', []));
        var metrics = resources ? javaReference(java.invoke(resources, 'getDisplayMetrics', [])) : null;
        return metrics ? (_javaNumber = javaNumber(java.getField(metrics, 'density'))) !== null && _javaNumber !== void 0 ? _javaNumber : 1 : 1;
    }
    function startDrawable(authorName) {
        var drawables = java.invoke(authorName, 'getCompoundDrawablesRelative', []);
        return javaReference(java.invoke(java.getClass('java.lang.reflect.Array'), 'get', [
            drawables,
            javaInt(0)
        ]));
    }
    function createSpacer(authorName) {
        var scale = density(authorName);
        var spacer = java.construct('android.graphics.drawable.ColorDrawable', [
            javaInt(0)
        ]);
        java.invoke(spacer, 'setBounds', [
            javaInt(0),
            javaInt(0),
            javaInt(Math.round(Icon.controlWidth * scale)),
            javaInt(Math.round(Icon.controlHeight * scale))
        ]);
        return spacer;
    }
    function relayout(indicator) {
        return _async_to_generator$9(function() {
            return _ts_generator$9(this, function(_state) {
                switch(_state.label){
                    case 0:
                        return [
                            4,
                            java.invokeAsync(indicator.authorName, 'requestLayout', [])
                        ];
                    case 1:
                        _state.sent();
                        return [
                            4,
                            layoutHostingList(java, indicator.messageView)
                        ];
                    case 2:
                        _state.sent();
                        return [
                            2
                        ];
                }
            });
        })();
    }
    function remove(indicator) {
        return _async_to_generator$9(function() {
            var _viewKey, _indicator_mounting, mounted;
            return _ts_generator$9(this, function(_state) {
                switch(_state.label){
                    case 0:
                        indicator.disposed = true;
                        byId.delete(indicator.id);
                        indicators.delete((_viewKey = viewKey$1(indicator.messageView)) !== null && _viewKey !== void 0 ? _viewKey : '');
                        tooltips === null || tooltips === void 0 ? void 0 : tooltips.dismissFor(indicator.id);
                        return [
                            4,
                            (_indicator_mounting = indicator.mounting) === null || _indicator_mounting === void 0 ? void 0 : _indicator_mounting.catch(function() {
                                return null;
                            })
                        ];
                    case 1:
                        mounted = _state.sent();
                        if (!mounted) return [
                            3,
                            3
                        ];
                        return [
                            4,
                            fabric.unmountAsync(mounted).catch(function() {
                                return undefined;
                            })
                        ];
                    case 2:
                        _state.sent();
                        _state.label = 3;
                    case 3:
                        return [
                            4,
                            removeHost(java, indicator.host).catch(function() {
                                return undefined;
                            })
                        ];
                    case 4:
                        _state.sent();
                        if (!sameJavaReference(startDrawable(indicator.authorName), indicator.spacer)) return [
                            3,
                            7
                        ];
                        return [
                            4,
                            java.invokeAsync(indicator.authorName, 'setCompoundDrawablesRelative', [
                                NO_DRAWABLE,
                                NO_DRAWABLE,
                                NO_DRAWABLE,
                                NO_DRAWABLE
                            ])
                        ];
                    case 5:
                        _state.sent();
                        return [
                            4,
                            relayout(indicator)
                        ];
                    case 6:
                        _state.sent();
                        _state.label = 7;
                    case 7:
                        return [
                            2
                        ];
                }
            });
        })();
    }
    function place(indicator) {
        return _async_to_generator$9(function() {
            var _javaNumber, _javaNumber1, scale, container, width, height, nameHeight, paddingStart;
            return _ts_generator$9(this, function(_state) {
                switch(_state.label){
                    case 0:
                        if (indicator.disposed) return [
                            2
                        ];
                        scale = density(indicator.authorName);
                        container = hostContainer(java, indicator.authorName);
                        if (!container) return [
                            2
                        ];
                        width = Icon.controlWidth * scale;
                        height = Icon.controlHeight * scale;
                        nameHeight = (_javaNumber = javaNumber(java.invoke(indicator.authorName, 'getHeight', []))) !== null && _javaNumber !== void 0 ? _javaNumber : 0;
                        paddingStart = (_javaNumber1 = javaNumber(java.invoke(indicator.authorName, 'getPaddingStart', []))) !== null && _javaNumber1 !== void 0 ? _javaNumber1 : 0;
                        return [
                            4,
                            placeHost(java, indicator.host, container.container, {
                                x: container.offset.x + paddingStart,
                                y: container.offset.y + (nameHeight - height) / 2
                            }, {
                                width: width,
                                height: height
                            })
                        ];
                    case 1:
                        _state.sent();
                        if (!(!indicator.mounting && !indicator.disposed)) return [
                            3,
                            4
                        ];
                        indicator.mounting = fabric.mountAsync(indicator.host, iconModule, {
                            surfaceId: indicator.id
                        });
                        return [
                            4,
                            indicator.mounting.catch(function(error) {
                                indicator.mounting = null;
                                throw error;
                            })
                        ];
                    case 2:
                        _state.sent();
                        return [
                            4,
                            placeHost(java, indicator.host, container.container, {
                                x: container.offset.x + paddingStart,
                                y: container.offset.y + (nameHeight - height) / 2
                            }, {
                                width: width,
                                height: height
                            })
                        ];
                    case 3:
                        _state.sent();
                        _state.label = 4;
                    case 4:
                        return [
                            2
                        ];
                }
            });
        })();
    }
    function settle(indicator) {
        var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
        try {
            for(var _iterator = SETTLE_DELAYS[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                var delay = _step.value;
                setTimeout(function() {
                    place(indicator).catch(function(error) {
                        console.error('[Message Latency] Failed to place an Android indicator:', error);
                    });
                }, delay);
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
    function isVisible(view) {
        return javaNumber(java.invoke(view, 'getVisibility', [])) === VISIBLE;
    }
    function render(messageView, messageId) {
        return _async_to_generator$9(function() {
            var key, record, existing, header, authorName, shown, current, indicator;
            return _ts_generator$9(this, function(_state) {
                switch(_state.label){
                    case 0:
                        key = viewKey$1(messageView);
                        if (!key || disposed) return [
                            2
                        ];
                        record = records.get(messageId);
                        existing = indicators.get(key);
                        header = viewByIdName(java, messageView, 'header');
                        authorName = viewByIdName(java, messageView, 'author_name');
                        shown = header && authorName && isVisible(header) && isVisible(authorName);
                        if (!(!record || !shown)) return [
                            3,
                            3
                        ];
                        if (!existing) return [
                            3,
                            2
                        ];
                        return [
                            4,
                            remove(existing)
                        ];
                    case 1:
                        _state.sent();
                        _state.label = 2;
                    case 2:
                        return [
                            2
                        ];
                    case 3:
                        current = startDrawable(authorName);
                        if (!(existing && !existing.disposed && sameJavaReference(existing.authorName, authorName))) return [
                            3,
                            7
                        ];
                        existing.messageId = messageId;
                        existing.record = record;
                        publish(existing);
                        if (!!sameJavaReference(current, existing.spacer)) return [
                            3,
                            6
                        ];
                        return [
                            4,
                            java.invokeAsync(authorName, 'setCompoundDrawablesRelative', [
                                existing.spacer,
                                NO_DRAWABLE,
                                NO_DRAWABLE,
                                NO_DRAWABLE
                            ])
                        ];
                    case 4:
                        _state.sent();
                        return [
                            4,
                            relayout(existing)
                        ];
                    case 5:
                        _state.sent();
                        _state.label = 6;
                    case 6:
                        settle(existing);
                        return [
                            2
                        ];
                    case 7:
                        if (!existing) return [
                            3,
                            9
                        ];
                        return [
                            4,
                            remove(existing)
                        ];
                    case 8:
                        _state.sent();
                        _state.label = 9;
                    case 9:
                        if (current) return [
                            2
                        ];
                        indicator = {
                            id: "message-latency-android-".concat(nextId++),
                            messageView: messageView,
                            authorName: authorName,
                            host: createHost(java, authorName),
                            spacer: createSpacer(authorName),
                            mounting: null,
                            messageId: messageId,
                            record: record,
                            revision: 0,
                            disposed: false
                        };
                        indicators.set(key, indicator);
                        byId.set(indicator.id, indicator);
                        return [
                            4,
                            java.invokeAsync(authorName, 'setCompoundDrawablesRelative', [
                                indicator.spacer,
                                NO_DRAWABLE,
                                NO_DRAWABLE,
                                NO_DRAWABLE
                            ])
                        ];
                    case 10:
                        _state.sent();
                        return [
                            4,
                            relayout(indicator)
                        ];
                    case 11:
                        _state.sent();
                        settle(indicator);
                        return [
                            2
                        ];
                }
            });
        })();
    }
    function schedule(messageView, messageId) {
        var _queues_get;
        var key = viewKey$1(messageView);
        if (!key || disposed) return;
        bound.set(key, {
            messageView: messageView,
            messageId: messageId
        });
        var next = ((_queues_get = queues.get(key)) !== null && _queues_get !== void 0 ? _queues_get : Promise.resolve()).then(function() {
            var _bound_get;
            return ((_bound_get = bound.get(key)) === null || _bound_get === void 0 ? void 0 : _bound_get.messageId) === messageId ? render(messageView, messageId) : undefined;
        }).catch(function(error) {
            console.error('[Message Latency] Failed to draw an Android indicator:', error);
        }).finally(function() {
            if (queues.get(key) === next) queues.delete(key);
        });
        queues.set(key, next);
    }
    var bindMessage = messageBindMethod(java);
    var idField = messageIdField(java);
    var token = hooks.hook(MESSAGE_VIEW, bindMessage.name, bindMessage.parameters, {
        notify: true
    }, function(param) {
        var self = param.self, args = param.args;
        var messageView = javaReference(self);
        var message = javaReference(args[0]);
        var messageId = message ? javaText(java.invoke(message, 'getId-3Eiw7ao', [])) : undefined;
        if (messageView && messageId) setTimeout(function() {
            return schedule(messageView, messageId);
        }, 0);
    });
    var unsubscribeRecords = records.subscribe(function(messageId) {
        var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
        try {
            for(var _iterator = bound.values()[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                var _step_value = _step.value, messageView = _step_value.messageView, boundId = _step_value.messageId;
                if (boundId === messageId) schedule(messageView, messageId);
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
    var unsubscribeTheme = subscribeTheme(function() {
        var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
        try {
            for(var _iterator = indicators.values()[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                var indicator = _step.value;
                publish(indicator);
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
    function scanVisible() {
        var decor = currentDecorView(java);
        if (!decor || disposed) return;
        var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
        try {
            for(var _iterator = findViewsOfClass(java, decor, MESSAGE_VIEW)[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                var messageView = _step.value;
                var messageId = javaText(java.getField(messageView, idField));
                if (messageId) schedule(messageView, messageId);
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
    var scans = STARTUP_SCAN_DELAYS.map(function(delay) {
        return setTimeout(scanVisible, delay);
    });
    return {
        dispose: function dispose() {
            return _async_to_generator$9(function() {
                var _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, scan;
                return _ts_generator$9(this, function(_state) {
                    switch(_state.label){
                        case 0:
                            _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
                            try {
                                for(_iterator = scans[Symbol.iterator](); !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                                    scan = _step.value;
                                    clearTimeout(scan);
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
                            disposed = true;
                            hooks.remove(token);
                            unsubscribeRecords();
                            unsubscribeTheme();
                            return [
                                4,
                                Promise.all(_to_consumable_array$4(queues.values()))
                            ];
                        case 1:
                            _state.sent();
                            return [
                                4,
                                Promise.all(_to_consumable_array$4(indicators.values()).map(remove))
                            ];
                        case 2:
                            _state.sent();
                            return [
                                4,
                                tooltips === null || tooltips === void 0 ? void 0 : tooltips.dispose()
                            ];
                        case 3:
                            _state.sent();
                            bound.clear();
                            listeners.clear();
                            return [
                                2
                            ];
                    }
                });
            })();
        }
    };
}function _array_like_to_array$6(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_with_holes$4(arr) {
    if (Array.isArray(arr)) return arr;
}
function asyncGeneratorStep$8(gen, resolve, reject, _next, _throw, key, arg) {
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
function _async_to_generator$8(fn) {
    return function() {
        var self = this, args = arguments;
        return new Promise(function(resolve, reject) {
            var gen = fn.apply(self, args);
            function _next(value) {
                asyncGeneratorStep$8(gen, resolve, reject, _next, _throw, "next", value);
            }
            function _throw(err) {
                asyncGeneratorStep$8(gen, resolve, reject, _next, _throw, "throw", err);
            }
            _next(undefined);
        });
    };
}
function _iterable_to_array_limit$4(arr, i) {
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
function _non_iterable_rest$4() {
    throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _sliced_to_array$4(arr, i) {
    return _array_with_holes$4(arr) || _iterable_to_array_limit$4(arr, i) || _unsupported_iterable_to_array$6(arr, i) || _non_iterable_rest$4();
}
function _ts_generator$8(thisArg, body) {
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
function _type_of$3(obj) {
    "@swc/helpers - typeof";
    return obj && typeof Symbol !== "undefined" && obj.constructor === Symbol ? "symbol" : typeof obj;
}
function _unsupported_iterable_to_array$6(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _array_like_to_array$6(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(n);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _array_like_to_array$6(o, minLen);
}
// UNKNOWN: a value returned by the bridge, which may be a string, a number, or an object handle.
function stringValue(value) {
    if (typeof value === 'string' && value.length > 0) {
        return value;
    }
    if (typeof value === 'number' || (typeof value === "undefined" ? "undefined" : _type_of$3(value)) === 'bigint') {
        return String(value);
    }
}
// UNKNOWN: a value returned by the bridge, read through `description` when it is an object.
function nativeString(value, bridge) {
    return _async_to_generator$8(function() {
        var direct, handle;
        return _ts_generator$8(this, function(_state) {
            switch(_state.label){
                case 0:
                    direct = stringValue(value);
                    if (direct || !value || (typeof value === "undefined" ? "undefined" : _type_of$3(value)) !== 'object') {
                        return [
                            2,
                            direct
                        ];
                    }
                    handle = value;
                    if (!bridge.respondsTo(handle, 'description')) return [
                        2
                    ];
                    return [
                        4,
                        bridge.invokeAsync(handle, 'description', [])
                    ];
                case 1:
                    return [
                        2,
                        stringValue.apply(void 0, [
                            _state.sent()
                        ])
                    ];
            }
        });
    })();
}
function readChannelId(message, bridge) {
    return _async_to_generator$8(function() {
        var channelId, channel;
        return _ts_generator$8(this, function(_state) {
            switch(_state.label){
                case 0:
                    if (!bridge.respondsTo(message, 'channelId')) return [
                        3,
                        3
                    ];
                    return [
                        4,
                        bridge.invokeAsync(message, 'channelId', [])
                    ];
                case 1:
                    return [
                        4,
                        nativeString.apply(void 0, [
                            _state.sent(),
                            bridge
                        ])
                    ];
                case 2:
                    channelId = _state.sent();
                    if (channelId) {
                        return [
                            2,
                            channelId
                        ];
                    }
                    _state.label = 3;
                case 3:
                    if (!bridge.respondsTo(message, 'channel')) return [
                        2
                    ];
                    return [
                        4,
                        bridge.invokeAsync(message, 'channel', [])
                    ];
                case 4:
                    channel = _state.sent();
                    if (!channel || !bridge.respondsTo(channel, 'id')) return [
                        2
                    ];
                    return [
                        4,
                        bridge.invokeAsync(channel, 'id', [])
                    ];
                case 5:
                    return [
                        2,
                        nativeString.apply(void 0, [
                            _state.sent(),
                            bridge
                        ])
                    ];
            }
        });
    })();
}
/**
 * @description Reads which message a `DCDMessageTableViewCell` shows, from its view model.
 * @param cell The message cell.
 * @param bridge The Objective-C bridge.
 * @param selectedChannelId Returns the channel to report when the message names none; called before the native reads start.
 * @returns The message and channel IDs, or `undefined` when the cell has no message or was reused while it was read.
 */ function readNativeMessageInfo(cell, bridge, selectedChannelId) {
    return _async_to_generator$8(function() {
        var fallbackChannelId, _ref, viewModel, _ref1, message, id, messageId, channelId, currentViewModel, _tmp;
        return _ts_generator$8(this, function(_state) {
            switch(_state.label){
                case 0:
                    fallbackChannelId = selectedChannelId === null || selectedChannelId === void 0 ? void 0 : selectedChannelId();
                    _state.label = 1;
                case 1:
                    _state.trys.push([
                        1,
                        7,
                        ,
                        8
                    ]);
                    viewModel = bridge.getIvar(cell, 'viewModel');
                    if (!viewModel || !bridge.respondsTo(viewModel, 'message')) return [
                        2
                    ];
                    return [
                        4,
                        bridge.batch([
                            {
                                target: viewModel,
                                selector: 'message',
                                args: []
                            },
                            {
                                target: {
                                    $nativeBatchResult: 0
                                },
                                selector: 'id',
                                args: []
                            }
                        ])
                    ];
                case 2:
                    _ref1 = _sliced_to_array$4.apply(void 0, [
                        _state.sent(),
                        2
                    ]), message = _ref1[0], id = _ref1[1];
                    if (!message) return [
                        2
                    ];
                    return [
                        4,
                        nativeString(id, bridge)
                    ];
                case 3:
                    messageId = _state.sent();
                    if (!messageId) return [
                        2
                    ];
                    return [
                        4,
                        readChannelId(message, bridge)
                    ];
                case 4:
                    channelId = (_ref = _state.sent()) !== null && _ref !== void 0 ? _ref : fallbackChannelId;
                    currentViewModel = bridge.getIvar(cell, 'viewModel');
                    _tmp = !currentViewModel;
                    if (_tmp) return [
                        3,
                        6
                    ];
                    return [
                        4,
                        bridge.invokeAsync(viewModel, 'isEqual:', [
                            currentViewModel
                        ])
                    ];
                case 5:
                    _tmp = !_state.sent();
                    _state.label = 6;
                case 6:
                    // A reused cell has a new view model, so the IDs read above belong to another message.
                    if (_tmp) {
                        return [
                            2
                        ];
                    }
                    return [
                        2,
                        {
                            channelId: channelId,
                            messageId: messageId
                        }
                    ];
                case 7:
                    _state.sent();
                    // The cell was deallocated while it was being read.
                    return [
                        2
                    ];
                case 8:
                    return [
                        2
                    ];
            }
        });
    })();
}function asyncGeneratorStep$7(gen, resolve, reject, _next, _throw, key, arg) {
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
function _async_to_generator$7(fn) {
    return function() {
        var self = this, args = arguments;
        return new Promise(function(resolve, reject) {
            var gen = fn.apply(self, args);
            function _next(value) {
                asyncGeneratorStep$7(gen, resolve, reject, _next, _throw, "next", value);
            }
            function _throw(err) {
                asyncGeneratorStep$7(gen, resolve, reject, _next, _throw, "throw", err);
            }
            _next(undefined);
        });
    };
}
function _ts_generator$7(thisArg, body) {
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
/**
 * @description Calls a selector on the main thread, treating a bridge error as no result.
 * @param objc The Objective-C bridge from `context.native`.
 * @param handle The receiver.
 * @param selector The selector to call.
 * @param args The selector's arguments.
 * @returns The selector's result, or `null` when the call failed.
 */ // UNKNOWN: returns whatever the Objective-C method returns; callers narrow it.
function safeInvoke(objc, handle, selector) {
    for(var _len = arguments.length, args = new Array(_len > 3 ? _len - 3 : 0), _key = 3; _key < _len; _key++){
        args[_key - 3] = arguments[_key];
    }
    try {
        return objc.invoke(handle, selector, args, {
            thread: 'main'
        });
    } catch (unused) {
        return null;
    }
}
/**
 * @description Calls a selector without blocking the JS thread, treating a bridge error as no result.
 * @param objc The Objective-C bridge from `context.native`.
 * @param handle The receiver.
 * @param selector The selector to call.
 * @param args The selector's arguments.
 * @returns The selector's result, or `null` when the call failed.
 */ // UNKNOWN: resolves to whatever the Objective-C method returns; callers narrow it.
function safeInvokeAsync(objc, handle, selector) {
    for(var _len = arguments.length, args = new Array(_len > 3 ? _len - 3 : 0), _key = 3; _key < _len; _key++){
        args[_key - 3] = arguments[_key];
    }
    return _async_to_generator$7(function() {
        return _ts_generator$7(this, function(_state) {
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
                        objc.invokeAsync(handle, selector, args)
                    ];
                case 1:
                    return [
                        2,
                        _state.sent()
                    ];
                case 2:
                    _state.sent();
                    return [
                        2,
                        null
                    ];
                case 3:
                    return [
                        2
                    ];
            }
        });
    })();
}function _type_of$2(obj) {
    "@swc/helpers - typeof";
    return obj && typeof Symbol !== "undefined" && obj.constructor === Symbol ? "symbol" : typeof obj;
}
// UNKNOWN: `hash` and `description` come back from the bridge untyped.
function scalar(value) {
    if (typeof value === 'number' || (typeof value === "undefined" ? "undefined" : _type_of$2(value)) === 'bigint') {
        return String(value);
    }
    if (typeof value === 'string' && value.length > 0) {
        return value;
    }
}
/**
 * @description Builds a stable key for a native view, since the bridge returns a new handle object on every call.
 * @param objc The Objective-C bridge from `context.native`.
 * @param view The view or cell.
 * @returns `Class:hash`, else `Class:description`, or `undefined` when the view exposes neither.
 */ function viewKey(objc, view) {
    var _objc_className, _scalar;
    var className = (_objc_className = objc.className(view)) !== null && _objc_className !== void 0 ? _objc_className : 'NSObject';
    var hash;
    // `hash` runs on the calling thread, so a layout hook never waits on the main thread.
    try {
        hash = objc.call(view, 'hash');
    } catch (unused) {
        hash = undefined;
    }
    var identity = (_scalar = scalar(hash)) !== null && _scalar !== void 0 ? _scalar : scalar(safeInvoke(objc, view, 'description'));
    return identity === undefined ? undefined : "".concat(className, ":").concat(identity);
}function asyncGeneratorStep$6(gen, resolve, reject, _next, _throw, key, arg) {
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
function _async_to_generator$6(fn) {
    return function() {
        var self = this, args = arguments;
        return new Promise(function(resolve, reject) {
            var gen = fn.apply(self, args);
            function _next(value) {
                asyncGeneratorStep$6(gen, resolve, reject, _next, _throw, "next", value);
            }
            function _throw(err) {
                asyncGeneratorStep$6(gen, resolve, reject, _next, _throw, "throw", err);
            }
            _next(undefined);
        });
    };
}
function _define_property$1(obj, key, value) {
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
function _ts_generator$6(thisArg, body) {
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
function _type_of$1(obj) {
    "@swc/helpers - typeof";
    return obj && typeof Symbol !== "undefined" && obj.constructor === Symbol ? "symbol" : typeof obj;
}
function unwrap(struct) {
    var _ref;
    return (_ref = struct === null || struct === void 0 ? void 0 : struct.value) !== null && _ref !== void 0 ? _ref : struct;
}
function finite() {
    for(var _len = arguments.length, values = new Array(_len), _key = 0; _key < _len; _key++){
        values[_key] = arguments[_key];
    }
    return values.every(Number.isFinite);
}
/**
 * @description Reads a `CGSize` returned by the bridge.
 * @param value The raw bridge return value.
 * @returns The size, or `null` when it is missing or not finite.
 */ function readSize(/* UNKNOWN: an untyped bridge return value. */ value) {
    var size = unwrap(value);
    var width = Number(size === null || size === void 0 ? void 0 : size.width);
    var height = Number(size === null || size === void 0 ? void 0 : size.height);
    return finite(width, height) ? {
        width: width,
        height: height
    } : null;
}
/**
 * @description Reads a `CGRect` returned by the bridge.
 * @param value The raw bridge return value.
 * @returns The frame, or `null` when it is missing or not finite.
 */ function readFrame(/* UNKNOWN: an untyped bridge return value. */ value) {
    var rect = unwrap(value);
    var origin = unwrap(rect === null || rect === void 0 ? void 0 : rect.origin);
    var size = readSize(rect === null || rect === void 0 ? void 0 : rect.size);
    var x = Number(origin === null || origin === void 0 ? void 0 : origin.x);
    var y = Number(origin === null || origin === void 0 ? void 0 : origin.y);
    return size && finite(x, y) ? _object_spread$1({
        x: x,
        y: y
    }, size) : null;
}
/**
 * @description Builds a `CGRect` to pass to the bridge.
 * @param objc The Objective-C bridge from `context.native`.
 * @param frame The rect's origin and size.
 * @returns The struct handle.
 */ function toRect(objc, param) {
    var x = param.x, y = param.y, width = param.width, height = param.height;
    return objc.struct('CGRect', {
        origin: {
            x: x,
            y: y
        },
        size: {
            width: width,
            height: height
        }
    });
}
/**
 * @description Reads a view's frame.
 * @param objc The Objective-C bridge from `context.native`.
 * @param view The view.
 * @returns The frame, or `null` when the call failed or returned no finite rect.
 */ function getFrame(objc, view) {
    return _async_to_generator$6(function() {
        return _ts_generator$6(this, function(_state) {
            switch(_state.label){
                case 0:
                    return [
                        4,
                        safeInvokeAsync(objc, view, 'frame')
                    ];
                case 1:
                    return [
                        2,
                        readFrame.apply(void 0, [
                            _state.sent()
                        ])
                    ];
            }
        });
    })();
}
/**
 * @description Sets a view's frame, ignoring a failed call.
 * @param objc The Objective-C bridge from `context.native`.
 * @param view The view.
 * @param frame The new frame.
 */ function setFrame(objc, view, frame) {
    return _async_to_generator$6(function() {
        return _ts_generator$6(this, function(_state) {
            switch(_state.label){
                case 0:
                    return [
                        4,
                        safeInvokeAsync(objc, view, 'setFrame:', toRect(objc, frame))
                    ];
                case 1:
                    _state.sent();
                    return [
                        2
                    ];
            }
        });
    })();
}
/**
 * @description Reads a view's subviews.
 * @param objc The Objective-C bridge from `context.native`.
 * @param view The view.
 * @returns The subviews, or `[]` when the call failed.
 */ function getSubviews(objc, view) {
    return _async_to_generator$6(function() {
        var value;
        return _ts_generator$6(this, function(_state) {
            switch(_state.label){
                case 0:
                    return [
                        4,
                        safeInvokeAsync(objc, view, 'subviews')
                    ];
                case 1:
                    value = _state.sent();
                    if (Array.isArray(value)) return [
                        2,
                        value
                    ];
                    if (!value || (typeof value === "undefined" ? "undefined" : _type_of$1(value)) !== 'object') return [
                        2,
                        []
                    ];
                    try {
                        return [
                            2,
                            objc.array(value)
                        ];
                    } catch (unused) {
                        return [
                            2,
                            []
                        ];
                    }
                    return [
                        2
                    ];
            }
        });
    })();
}function _array_like_to_array$5(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_with_holes$3(arr) {
    if (Array.isArray(arr)) return arr;
}
function asyncGeneratorStep$5(gen, resolve, reject, _next, _throw, key, arg) {
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
function _async_to_generator$5(fn) {
    return function() {
        var self = this, args = arguments;
        return new Promise(function(resolve, reject) {
            var gen = fn.apply(self, args);
            function _next(value) {
                asyncGeneratorStep$5(gen, resolve, reject, _next, _throw, "next", value);
            }
            function _throw(err) {
                asyncGeneratorStep$5(gen, resolve, reject, _next, _throw, "throw", err);
            }
            _next(undefined);
        });
    };
}
function _iterable_to_array_limit$3(arr, i) {
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
function _non_iterable_rest$3() {
    throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _sliced_to_array$3(arr, i) {
    return _array_with_holes$3(arr) || _iterable_to_array_limit$3(arr, i) || _unsupported_iterable_to_array$5(arr, i) || _non_iterable_rest$3();
}
function _ts_generator$5(thisArg, body) {
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
function _unsupported_iterable_to_array$5(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _array_like_to_array$5(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(n);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _array_like_to_array$5(o, minLen);
}
/**
 * @description Identifies the colors an icon was drawn with, so a theme or fill change can be detected.
 * @param fill The bar colors.
 * @returns A key combining the theme and the fill.
 */ function fillKey(fill) {
    return "".concat(currentTheme(), ":").concat(fill.join(':'));
}
function barColors(objc, fill) {
    return _async_to_generator$5(function() {
        var UIColor;
        return _ts_generator$5(this, function(_state) {
            UIColor = objc.getClass('UIColor');
            return [
                2,
                Promise.all(fill.map(function(color) {
                    return _async_to_generator$5(function() {
                        var _exec, hex, value;
                        return _ts_generator$5(this, function(_state) {
                            switch(_state.label){
                                case 0:
                                    hex = (_exec = /^#([0-9a-f]{6})$/i.exec(resolveColor(FILL_TOKENS[color]))) === null || _exec === void 0 ? void 0 : _exec[1];
                                    if (!hex || !UIColor) return [
                                        2,
                                        null
                                    ];
                                    value = Number.parseInt(hex, 16);
                                    return [
                                        4,
                                        safeInvokeAsync(objc, UIColor, 'colorWithRed:green:blue:alpha:', (value >> 16 & 255) / 255, (value >> 8 & 255) / 255, (value & 255) / 255, 1)
                                    ];
                                case 1:
                                    return [
                                        2,
                                        _state.sent()
                                    ];
                            }
                        });
                    })();
                }))
            ];
        });
    })();
}
/**
 * @description Sets the icon's VoiceOver label and hint from a record.
 * @param objc The Objective-C bridge from `context.native`.
 * @param icon The icon from `createIcon`.
 * @param record The message's latency record.
 */ function describeIcon(objc, icon, record) {
    return _async_to_generator$5(function() {
        var _record_details_displayDelta;
        return _ts_generator$5(this, function(_state) {
            switch(_state.label){
                case 0:
                    return [
                        4,
                        safeInvokeAsync(objc, icon, 'setAccessibilityLabel:', (_record_details_displayDelta = record.details.displayDelta) !== null && _record_details_displayDelta !== void 0 ? _record_details_displayDelta : 'Old Discord Android client')
                    ];
                case 1:
                    _state.sent();
                    return [
                        4,
                        safeInvokeAsync(objc, icon, 'setAccessibilityHint:', record.tooltip)
                    ];
                case 2:
                    _state.sent();
                    return [
                        2
                    ];
            }
        });
    })();
}
/**
 * @description Builds the three-bar signal icon as a tappable `UIButton`.
 * @param objc The Objective-C bridge from `context.native`.
 * @param record The message's latency record.
 * @returns The button, or `null` when a bar color could not be resolved.
 */ function createIcon(objc, record) {
    return _async_to_generator$5(function() {
        var icon, colors, _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, _step_value, index, frame, bar, layer, err;
        return _ts_generator$5(this, function(_state) {
            switch(_state.label){
                case 0:
                    icon = objc.alloc('UIButton');
                    return [
                        4,
                        safeInvokeAsync(objc, icon, 'setUserInteractionEnabled:', true)
                    ];
                case 1:
                    _state.sent();
                    return [
                        4,
                        safeInvokeAsync(objc, icon, 'setExclusiveTouch:', true)
                    ];
                case 2:
                    _state.sent();
                    return [
                        4,
                        safeInvokeAsync(objc, icon, 'setIsAccessibilityElement:', true)
                    ];
                case 3:
                    _state.sent();
                    return [
                        4,
                        safeInvokeAsync(objc, icon, 'setAccessibilityIdentifier:', 'message-latency')
                    ];
                case 4:
                    _state.sent();
                    return [
                        4,
                        describeIcon(objc, icon, record)
                    ];
                case 5:
                    _state.sent();
                    return [
                        4,
                        barColors(objc, record.details.fill)
                    ];
                case 6:
                    colors = _state.sent();
                    if (colors.some(function(color) {
                        return !color;
                    })) return [
                        2,
                        null
                    ];
                    _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
                    _state.label = 7;
                case 7:
                    _state.trys.push([
                        7,
                        18,
                        19,
                        20
                    ]);
                    _iterator = Icon.bars.entries()[Symbol.iterator]();
                    _state.label = 8;
                case 8:
                    if (!!(_iteratorNormalCompletion = (_step = _iterator.next()).done)) return [
                        3,
                        17
                    ];
                    _step_value = _sliced_to_array$3(_step.value, 2), index = _step_value[0], frame = _step_value[1];
                    bar = objc.alloc('UIView');
                    return [
                        4,
                        setFrame(objc, bar, frame)
                    ];
                case 9:
                    _state.sent();
                    return [
                        4,
                        safeInvokeAsync(objc, bar, 'setUserInteractionEnabled:', false)
                    ];
                case 10:
                    _state.sent();
                    return [
                        4,
                        safeInvokeAsync(objc, bar, 'setBackgroundColor:', colors[index])
                    ];
                case 11:
                    _state.sent();
                    return [
                        4,
                        safeInvokeAsync(objc, bar, 'layer')
                    ];
                case 12:
                    layer = _state.sent();
                    if (!layer) return [
                        3,
                        14
                    ];
                    return [
                        4,
                        safeInvokeAsync(objc, layer, 'setCornerRadius:', 0.5)
                    ];
                case 13:
                    _state.sent();
                    _state.label = 14;
                case 14:
                    return [
                        4,
                        safeInvokeAsync(objc, icon, 'addSubview:', bar)
                    ];
                case 15:
                    _state.sent();
                    _state.label = 16;
                case 16:
                    _iteratorNormalCompletion = true;
                    return [
                        3,
                        8
                    ];
                case 17:
                    return [
                        3,
                        20
                    ];
                case 18:
                    err = _state.sent();
                    _didIteratorError = true;
                    _iteratorError = err;
                    return [
                        3,
                        20
                    ];
                case 19:
                    try {
                        if (!_iteratorNormalCompletion && _iterator.return != null) {
                            _iterator.return();
                        }
                    } finally{
                        if (_didIteratorError) {
                            throw _iteratorError;
                        }
                    }
                    return [
                        7
                    ];
                case 20:
                    return [
                        2,
                        icon
                    ];
            }
        });
    })();
}
/**
 * @description Recolors the bars of an existing icon.
 * @param objc The Objective-C bridge from `context.native`.
 * @param icon The icon from `createIcon`.
 * @param fill The new bar colors.
 * @param isCurrent Whether the icon is still on screen, checked once the colors resolve.
 * @returns `true` when the bars were recolored.
 */ function recolorIcon(objc, icon, fill, isCurrent) {
    return _async_to_generator$5(function() {
        var colors, bars, _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, _step_value, index, bar, color, err;
        return _ts_generator$5(this, function(_state) {
            switch(_state.label){
                case 0:
                    return [
                        4,
                        barColors(objc, fill)
                    ];
                case 1:
                    colors = _state.sent();
                    if (!isCurrent()) return [
                        2,
                        false
                    ];
                    return [
                        4,
                        getSubviews(objc, icon)
                    ];
                case 2:
                    bars = _state.sent();
                    _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
                    _state.label = 3;
                case 3:
                    _state.trys.push([
                        3,
                        8,
                        9,
                        10
                    ]);
                    _iterator = bars.slice(0, colors.length).entries()[Symbol.iterator]();
                    _state.label = 4;
                case 4:
                    if (!!(_iteratorNormalCompletion = (_step = _iterator.next()).done)) return [
                        3,
                        7
                    ];
                    _step_value = _sliced_to_array$3(_step.value, 2), index = _step_value[0], bar = _step_value[1];
                    color = colors[index];
                    if (!color) return [
                        3,
                        6
                    ];
                    return [
                        4,
                        safeInvokeAsync(objc, bar, 'setBackgroundColor:', color)
                    ];
                case 5:
                    _state.sent();
                    _state.label = 6;
                case 6:
                    _iteratorNormalCompletion = true;
                    return [
                        3,
                        4
                    ];
                case 7:
                    return [
                        3,
                        10
                    ];
                case 8:
                    err = _state.sent();
                    _didIteratorError = true;
                    _iteratorError = err;
                    return [
                        3,
                        10
                    ];
                case 9:
                    try {
                        if (!_iteratorNormalCompletion && _iterator.return != null) {
                            _iterator.return();
                        }
                    } finally{
                        if (_didIteratorError) {
                            throw _iteratorError;
                        }
                    }
                    return [
                        7
                    ];
                case 10:
                    return [
                        2,
                        true
                    ];
            }
        });
    })();
}function centerOffset(frame, container) {
    return frame.y + frame.height / 2 - container.height / 2;
}
/**
 * @description Lays the indicator in front of the username by widening the name group, keeping every other view where it was.
 * @template T The native view handle type.
 * @param header The message header's views and their current frames.
 * @returns The placements to constrain inside the row and inside the name group.
 */ function headerLayout(param) {
    var row = param.row, group = param.group, username = param.username, trailing = param.trailing, timestamp = param.timestamp, icon = param.icon;
    var groupEnd = group.frame.x + group.frame.width;
    var inGroup = [
        {
            view: icon,
            leading: [
                group.view,
                'leading',
                username.frame.x
            ],
            centerY: [
                group.view,
                0
            ],
            width: Icon.controlWidth,
            height: Icon.controlHeight
        },
        {
            view: username.view,
            leading: [
                icon,
                'trailing',
                0
            ],
            centerY: [
                group.view,
                centerOffset(username.frame, group.frame)
            ],
            width: username.frame.width,
            height: username.frame.height
        }
    ];
    var previous = username;
    var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
    try {
        for(var _iterator = trailing[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
            var next = _step.value;
            inGroup.push({
                view: next.view,
                leading: [
                    previous.view,
                    'trailing',
                    next.frame.x - previous.frame.x - previous.frame.width
                ],
                centerY: [
                    group.view,
                    centerOffset(next.frame, group.frame)
                ],
                width: next.frame.width,
                height: next.frame.height
            });
            previous = next;
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
    return {
        row: [
            {
                view: group.view,
                leading: [
                    row.view,
                    'leading',
                    group.frame.x
                ],
                centerY: [
                    row.view,
                    0
                ],
                width: group.frame.width + Icon.controlWidth,
                height: group.frame.height
            },
            {
                view: timestamp.view,
                leading: [
                    group.view,
                    'trailing',
                    timestamp.frame.x - groupEnd
                ],
                centerY: [
                    row.view,
                    centerOffset(timestamp.frame, row.frame)
                ],
                width: timestamp.frame.width,
                height: timestamp.frame.height
            }
        ],
        group: inGroup
    };
}function _array_like_to_array$4(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_with_holes$2(arr) {
    if (Array.isArray(arr)) return arr;
}
function _array_without_holes$3(arr) {
    if (Array.isArray(arr)) return _array_like_to_array$4(arr);
}
function asyncGeneratorStep$4(gen, resolve, reject, _next, _throw, key, arg) {
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
function _async_to_generator$4(fn) {
    return function() {
        var self = this, args = arguments;
        return new Promise(function(resolve, reject) {
            var gen = fn.apply(self, args);
            function _next(value) {
                asyncGeneratorStep$4(gen, resolve, reject, _next, _throw, "next", value);
            }
            function _throw(err) {
                asyncGeneratorStep$4(gen, resolve, reject, _next, _throw, "throw", err);
            }
            _next(undefined);
        });
    };
}
function _iterable_to_array$3(iter) {
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
function _non_iterable_spread$3() {
    throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _sliced_to_array$2(arr, i) {
    return _array_with_holes$2(arr) || _iterable_to_array_limit$2(arr, i) || _unsupported_iterable_to_array$4(arr, i) || _non_iterable_rest$2();
}
function _to_consumable_array$3(arr) {
    return _array_without_holes$3(arr) || _iterable_to_array$3(arr) || _unsupported_iterable_to_array$4(arr) || _non_iterable_spread$3();
}
function _ts_generator$4(thisArg, body) {
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
function _unsupported_iterable_to_array$4(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _array_like_to_array$4(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(n);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _array_like_to_array$4(o, minLen);
}
function specs(param) {
    var view = param.view, leading = param.leading, centerY = param.centerY, width = param.width, height = param.height;
    var _leading = _sliced_to_array$2(leading, 3), anchor = _leading[0], edge = _leading[1], offset = _leading[2];
    var edgeAttribute = edge === 'leading' ? LayoutAttribute.Leading : LayoutAttribute.Trailing;
    return [
        [
            view,
            LayoutAttribute.Leading,
            anchor,
            edgeAttribute,
            offset
        ],
        [
            view,
            LayoutAttribute.CenterY,
            centerY[0],
            LayoutAttribute.CenterY,
            centerY[1]
        ],
        [
            view,
            LayoutAttribute.Width,
            null,
            LayoutAttribute.NotAnAttribute,
            width
        ],
        [
            view,
            LayoutAttribute.Height,
            null,
            LayoutAttribute.NotAnAttribute,
            height
        ]
    ];
}
function constrain(objc, container, placements, layout) {
    return _async_to_generator$4(function() {
        var NSLayoutConstraint, _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, _step_value, item, attribute, toItem, toAttribute, constant, constraint, err;
        return _ts_generator$4(this, function(_state) {
            switch(_state.label){
                case 0:
                    NSLayoutConstraint = objc.getClass('NSLayoutConstraint');
                    if (!NSLayoutConstraint) throw new Error('NSLayoutConstraint is unavailable');
                    _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
                    _state.label = 1;
                case 1:
                    _state.trys.push([
                        1,
                        7,
                        8,
                        9
                    ]);
                    _iterator = placements.flatMap(specs)[Symbol.iterator]();
                    _state.label = 2;
                case 2:
                    if (!!(_iteratorNormalCompletion = (_step = _iterator.next()).done)) return [
                        3,
                        6
                    ];
                    _step_value = _sliced_to_array$2(_step.value, 5), item = _step_value[0], attribute = _step_value[1], toItem = _step_value[2], toAttribute = _step_value[3], constant = _step_value[4];
                    return [
                        4,
                        objc.invokeAsync(NSLayoutConstraint, 'constraintWithItem:attribute:relatedBy:toItem:attribute:multiplier:constant:', [
                            item,
                            attribute,
                            LAYOUT_RELATION_EQUAL,
                            toItem,
                            toAttribute,
                            1,
                            constant
                        ])
                    ];
                case 3:
                    constraint = _state.sent();
                    if (!constraint) throw new Error('Failed to create message latency layout constraint');
                    return [
                        4,
                        objc.invokeAsync(container, 'addConstraint:', [
                            constraint
                        ])
                    ];
                case 4:
                    _state.sent();
                    layout.constraints.push({
                        container: container,
                        constraint: constraint
                    });
                    _state.label = 5;
                case 5:
                    _iteratorNormalCompletion = true;
                    return [
                        3,
                        2
                    ];
                case 6:
                    return [
                        3,
                        9
                    ];
                case 7:
                    err = _state.sent();
                    _didIteratorError = true;
                    _iteratorError = err;
                    return [
                        3,
                        9
                    ];
                case 8:
                    try {
                        if (!_iteratorNormalCompletion && _iterator.return != null) {
                            _iterator.return();
                        }
                    } finally{
                        if (_didIteratorError) {
                            throw _iteratorError;
                        }
                    }
                    return [
                        7
                    ];
                case 9:
                    return [
                        2
                    ];
            }
        });
    })();
}
function placed(objc, views) {
    return _async_to_generator$4(function() {
        return _ts_generator$4(this, function(_state) {
            return [
                2,
                Promise.all(views.map(function(view) {
                    return _async_to_generator$4(function() {
                        var _tmp;
                        return _ts_generator$4(this, function(_state) {
                            switch(_state.label){
                                case 0:
                                    _tmp = {
                                        view: view
                                    };
                                    return [
                                        4,
                                        getFrame(objc, view)
                                    ];
                                case 1:
                                    return [
                                        2,
                                        (_tmp.frame = _state.sent(), _tmp)
                                    ];
                            }
                        });
                    })();
                }))
            ];
        });
    })();
}
function hasFrame(entry) {
    return entry.frame !== null && entry.frame.width > 0;
}
function save(objc, view) {
    return _async_to_generator$4(function() {
        var frame, translates;
        return _ts_generator$4(this, function(_state) {
            switch(_state.label){
                case 0:
                    return [
                        4,
                        getFrame(objc, view)
                    ];
                case 1:
                    frame = _state.sent();
                    if (!frame) throw new Error('Failed to read message latency layout frame');
                    return [
                        4,
                        safeInvokeAsync(objc, view, 'translatesAutoresizingMaskIntoConstraints')
                    ];
                case 2:
                    translates = _state.sent();
                    return [
                        2,
                        {
                            view: view,
                            frame: frame,
                            translates: Boolean(translates)
                        }
                    ];
            }
        });
    })();
}
/**
 * @description Puts back every frame and constraint `installLayout` changed.
 * @param objc The Objective-C bridge from `context.native`.
 * @param layout The layout `installLayout` returned.
 */ function restoreLayout(objc, layout) {
    return _async_to_generator$4(function() {
        var _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, _step_value, container, constraint, err, _iteratorNormalCompletion1, _didIteratorError1, _iteratorError1, _iterator1, _step1, _step_value1, view, frame, translates, err;
        return _ts_generator$4(this, function(_state) {
            switch(_state.label){
                case 0:
                    _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
                    _state.label = 1;
                case 1:
                    _state.trys.push([
                        1,
                        6,
                        7,
                        8
                    ]);
                    _iterator = layout.constraints[Symbol.iterator]();
                    _state.label = 2;
                case 2:
                    if (!!(_iteratorNormalCompletion = (_step = _iterator.next()).done)) return [
                        3,
                        5
                    ];
                    _step_value = _step.value, container = _step_value.container, constraint = _step_value.constraint;
                    return [
                        4,
                        safeInvokeAsync(objc, container, 'removeConstraint:', constraint)
                    ];
                case 3:
                    _state.sent();
                    _state.label = 4;
                case 4:
                    _iteratorNormalCompletion = true;
                    return [
                        3,
                        2
                    ];
                case 5:
                    return [
                        3,
                        8
                    ];
                case 6:
                    err = _state.sent();
                    _didIteratorError = true;
                    _iteratorError = err;
                    return [
                        3,
                        8
                    ];
                case 7:
                    try {
                        if (!_iteratorNormalCompletion && _iterator.return != null) {
                            _iterator.return();
                        }
                    } finally{
                        if (_didIteratorError) {
                            throw _iteratorError;
                        }
                    }
                    return [
                        7
                    ];
                case 8:
                    _iteratorNormalCompletion1 = true, _didIteratorError1 = false, _iteratorError1 = undefined;
                    _state.label = 9;
                case 9:
                    _state.trys.push([
                        9,
                        15,
                        16,
                        17
                    ]);
                    _iterator1 = layout.views[Symbol.iterator]();
                    _state.label = 10;
                case 10:
                    if (!!(_iteratorNormalCompletion1 = (_step1 = _iterator1.next()).done)) return [
                        3,
                        14
                    ];
                    _step_value1 = _step1.value, view = _step_value1.view, frame = _step_value1.frame, translates = _step_value1.translates;
                    return [
                        4,
                        setFrame(objc, view, frame)
                    ];
                case 11:
                    _state.sent();
                    return [
                        4,
                        safeInvokeAsync(objc, view, 'setTranslatesAutoresizingMaskIntoConstraints:', translates)
                    ];
                case 12:
                    _state.sent();
                    _state.label = 13;
                case 13:
                    _iteratorNormalCompletion1 = true;
                    return [
                        3,
                        10
                    ];
                case 14:
                    return [
                        3,
                        17
                    ];
                case 15:
                    err = _state.sent();
                    _didIteratorError1 = true;
                    _iteratorError1 = err;
                    return [
                        3,
                        17
                    ];
                case 16:
                    try {
                        if (!_iteratorNormalCompletion1 && _iterator1.return != null) {
                            _iterator1.return();
                        }
                    } finally{
                        if (_didIteratorError1) {
                            throw _iteratorError1;
                        }
                    }
                    return [
                        7
                    ];
                case 17:
                    return [
                        2
                    ];
            }
        });
    })();
}
/**
 * @description Inserts the icon before the username in a message header, moving the name group and timestamp with Auto Layout.
 * @param objc The Objective-C bridge from `context.native`.
 * @param icon The icon from `createIcon`.
 * @param label The username label.
 * @param row The header row that holds the name group and timestamp.
 * @returns What was changed, for `restoreLayout`.
 * @throws When the header does not have the expected native layout. Nothing is left changed.
 */ function installLayout(objc, icon, label, row) {
    return _async_to_generator$4(function() {
        var username, group, _tmp, groupRow, _tmp1, _ref, groupFrame, rowFrame, usernameFrame, usernameEnd, groupEnd, usernameKey, siblings, trailing, timestamp, _tmp2, header, layout, _tmp3, _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, view, err, error;
        return _ts_generator$4(this, function(_state) {
            switch(_state.label){
                case 0:
                    return [
                        4,
                        safeInvokeAsync(objc, label, 'superview')
                    ];
                case 1:
                    username = _state.sent();
                    if (!username) return [
                        3,
                        3
                    ];
                    return [
                        4,
                        safeInvokeAsync(objc, username, 'superview')
                    ];
                case 2:
                    _tmp = _state.sent();
                    return [
                        3,
                        4
                    ];
                case 3:
                    _tmp = null;
                    _state.label = 4;
                case 4:
                    group = _tmp;
                    if (!group) return [
                        3,
                        6
                    ];
                    return [
                        4,
                        safeInvokeAsync(objc, group, 'superview')
                    ];
                case 5:
                    _tmp1 = _state.sent();
                    return [
                        3,
                        7
                    ];
                case 6:
                    _tmp1 = null;
                    _state.label = 7;
                case 7:
                    groupRow = _tmp1;
                    if (!username || !group || !groupRow || viewKey(objc, groupRow) !== viewKey(objc, row)) {
                        throw new Error('Message latency username row has an unsupported native layout');
                    }
                    return [
                        4,
                        Promise.all([
                            getFrame(objc, group),
                            getFrame(objc, row),
                            getFrame(objc, username)
                        ])
                    ];
                case 8:
                    _ref = _sliced_to_array$2.apply(void 0, [
                        _state.sent(),
                        3
                    ]), groupFrame = _ref[0], rowFrame = _ref[1], usernameFrame = _ref[2];
                    if (!groupFrame || !rowFrame || !usernameFrame) {
                        throw new Error('Message latency username row has an unsupported native frame');
                    }
                    // Allow half a point of rounding when deciding a view sits after another.
                    usernameEnd = usernameFrame.x + usernameFrame.width - 0.5;
                    groupEnd = groupFrame.x + groupFrame.width - 0.5;
                    usernameKey = viewKey(objc, username);
                    return [
                        4,
                        getSubviews(objc, group)
                    ];
                case 9:
                    siblings = _state.sent().filter(function(view) {
                        return viewKey(objc, view) !== usernameKey;
                    });
                    return [
                        4,
                        placed(objc, siblings)
                    ];
                case 10:
                    trailing = _state.sent().filter(hasFrame).filter(function(param) {
                        var frame = param.frame;
                        return frame.x >= usernameEnd;
                    }).sort(function(left, right) {
                        return left.frame.x - right.frame.x;
                    });
                    _tmp2 = [
                        objc
                    ];
                    return [
                        4,
                        getSubviews(objc, row)
                    ];
                case 11:
                    return [
                        4,
                        placed.apply(void 0, _tmp2.concat([
                            _state.sent()
                        ]))
                    ];
                case 12:
                    timestamp = _state.sent().filter(hasFrame).find(function(param) {
                        var view = param.view, frame = param.frame;
                        return objc.className(view) === 'DCDLabel' && frame.x >= groupEnd;
                    });
                    if (!timestamp) throw new Error('Message latency timestamp row is unavailable');
                    header = headerLayout({
                        row: {
                            view: row,
                            frame: rowFrame
                        },
                        group: {
                            view: group,
                            frame: groupFrame
                        },
                        username: {
                            view: username,
                            frame: usernameFrame
                        },
                        trailing: trailing,
                        timestamp: timestamp,
                        icon: icon
                    });
                    _tmp3 = {};
                    return [
                        4,
                        Promise.all([
                            group,
                            username
                        ].concat(_to_consumable_array$3(trailing.map(function(param) {
                            var view = param.view;
                            return view;
                        })), [
                            timestamp.view
                        ]).map(function(view) {
                            return save(objc, view);
                        }))
                    ];
                case 13:
                    layout = (_tmp3.views = _state.sent(), _tmp3.constraints = [], _tmp3);
                    _state.label = 14;
                case 14:
                    _state.trys.push([
                        14,
                        27,
                        ,
                        30
                    ]);
                    _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
                    _state.label = 15;
                case 15:
                    _state.trys.push([
                        15,
                        20,
                        21,
                        22
                    ]);
                    _iterator = layout.views[Symbol.iterator]();
                    _state.label = 16;
                case 16:
                    if (!!(_iteratorNormalCompletion = (_step = _iterator.next()).done)) return [
                        3,
                        19
                    ];
                    view = _step.value.view;
                    return [
                        4,
                        safeInvokeAsync(objc, view, 'setTranslatesAutoresizingMaskIntoConstraints:', false)
                    ];
                case 17:
                    _state.sent();
                    _state.label = 18;
                case 18:
                    _iteratorNormalCompletion = true;
                    return [
                        3,
                        16
                    ];
                case 19:
                    return [
                        3,
                        22
                    ];
                case 20:
                    err = _state.sent();
                    _didIteratorError = true;
                    _iteratorError = err;
                    return [
                        3,
                        22
                    ];
                case 21:
                    try {
                        if (!_iteratorNormalCompletion && _iterator.return != null) {
                            _iterator.return();
                        }
                    } finally{
                        if (_didIteratorError) {
                            throw _iteratorError;
                        }
                    }
                    return [
                        7
                    ];
                case 22:
                    return [
                        4,
                        safeInvokeAsync(objc, icon, 'setTranslatesAutoresizingMaskIntoConstraints:', false)
                    ];
                case 23:
                    _state.sent();
                    return [
                        4,
                        safeInvokeAsync(objc, group, 'addSubview:', icon)
                    ];
                case 24:
                    _state.sent();
                    return [
                        4,
                        constrain(objc, row, header.row, layout)
                    ];
                case 25:
                    _state.sent();
                    return [
                        4,
                        constrain(objc, group, header.group, layout)
                    ];
                case 26:
                    _state.sent();
                    return [
                        3,
                        30
                    ];
                case 27:
                    error = _state.sent();
                    return [
                        4,
                        restoreLayout(objc, layout)
                    ];
                case 28:
                    _state.sent();
                    return [
                        4,
                        safeInvokeAsync(objc, icon, 'removeFromSuperview')
                    ];
                case 29:
                    _state.sent();
                    throw error;
                case 30:
                    return [
                        2,
                        layout
                    ];
            }
        });
    })();
}function isVisibleLabel(node) {
    return node.className === 'DCDLabel' && Boolean(node.text) && node.frame.width > 0 && node.frame.height > 0;
}
// The header row is the nearest ancestor about as tall as the name but much wider than it.
function headerFor(nodes, label) {
    var parent = nodes[label.parent];
    for(var depth = 0; parent && depth < 8; depth++){
        var frame = parent.frame;
        if (frame.height <= label.frame.height + 4 && frame.width >= 120 && frame.width > label.frame.width * 1.5) {
            return parent.view;
        }
        parent = nodes[parent.parent];
    }
    return null;
}
/**
 * @description Finds the username label and its header row in a message cell's view snapshot.
 * @param nodes The cell's view snapshot.
 * @param username The author name the label should show.
 * @returns The label and header, or `null` when the cell has no header row.
 */ function findUsernameHeader(nodes, username) {
    var exact = nodes.find(function(node) {
        return isVisibleLabel(node) && node.text === username;
    });
    if (exact) {
        var header = headerFor(nodes, exact);
        return header ? {
            label: exact.view,
            header: header
        } : null;
    }
    // The shown name can differ from the account name (nicknames), so fall back to the only label with a header.
    var match = null;
    var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
    try {
        for(var _iterator = nodes[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
            var node = _step.value;
            var header1 = isVisibleLabel(node) ? headerFor(nodes, node) : null;
            if (!header1) {
                continue;
            }
            if (match) return null;
            match = {
                label: node.view,
                header: header1
            };
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
    return match;
}function _array_like_to_array$3(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_with_holes$1(arr) {
    if (Array.isArray(arr)) return arr;
}
function _array_without_holes$2(arr) {
    if (Array.isArray(arr)) return _array_like_to_array$3(arr);
}
function asyncGeneratorStep$3(gen, resolve, reject, _next, _throw, key, arg) {
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
function _async_to_generator$3(fn) {
    return function() {
        var self = this, args = arguments;
        return new Promise(function(resolve, reject) {
            var gen = fn.apply(self, args);
            function _next(value) {
                asyncGeneratorStep$3(gen, resolve, reject, _next, _throw, "next", value);
            }
            function _throw(err) {
                asyncGeneratorStep$3(gen, resolve, reject, _next, _throw, "throw", err);
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
function _non_iterable_spread$2() {
    throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _sliced_to_array$1(arr, i) {
    return _array_with_holes$1(arr) || _iterable_to_array_limit$1(arr, i) || _unsupported_iterable_to_array$3(arr, i) || _non_iterable_rest$1();
}
function _to_consumable_array$2(arr) {
    return _array_without_holes$2(arr) || _iterable_to_array$2(arr) || _unsupported_iterable_to_array$3(arr) || _non_iterable_spread$2();
}
function _ts_generator$3(thisArg, body) {
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
function _unsupported_iterable_to_array$3(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _array_like_to_array$3(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(n);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _array_like_to_array$3(o, minLen);
}
/**
 * @description Draws the indicator into Discord's native message cells as they appear and are reused, and keeps it in step with the records and the theme.
 * @param objc The Objective-C bridge from `context.native`.
 * @param records The latency cache to draw from.
 * @param tooltips The tooltip shown when an indicator is tapped, or `null` when unavailable. The cells own and dispose it.
 * @returns The cells feature, whose `hook` throws when a hook cannot be installed.
 */ function createMessageCells(objc, records, tooltips) {
    var cells = new Map();
    var cellsByMessageId = new Map();
    // Mutations of one cell run one at a time, in order.
    var queues = new Map();
    var tasks = new Set();
    var nextRevision = 0;
    var disposed = false;
    var teardown = Promise.resolve();
    function isCurrent(view) {
        var _cells_get;
        return !disposed && ((_cells_get = cells.get(view.cellKey)) === null || _cells_get === void 0 ? void 0 : _cells_get.view) === view;
    }
    function enqueue(key, work) {
        var _queues_get;
        var task = ((_queues_get = queues.get(key)) !== null && _queues_get !== void 0 ? _queues_get : Promise.resolve()).then(work).catch(function() {
            return undefined;
        }).finally(function() {
            tasks.delete(task);
            if (queues.get(key) === task) queues.delete(key);
        });
        queues.set(key, task);
        tasks.add(task);
        return task;
    }
    function removeView(view) {
        return _async_to_generator$3(function() {
            var cell;
            return _ts_generator$3(this, function(_state) {
                switch(_state.label){
                    case 0:
                        tooltips === null || tooltips === void 0 ? void 0 : tooltips.dismissFor(view.cellKey);
                        cell = cells.get(view.cellKey);
                        if ((cell === null || cell === void 0 ? void 0 : cell.view) === view) cell.view = undefined;
                        return [
                            4,
                            restoreLayout(objc, view.layout)
                        ];
                    case 1:
                        _state.sent();
                        return [
                            4,
                            safeInvokeAsync(objc, view.icon, 'removeFromSuperview')
                        ];
                    case 2:
                        _state.sent();
                        return [
                            2
                        ];
                }
            });
        })();
    }
    function updateView(view, record) {
        return _async_to_generator$3(function() {
            var fill;
            return _ts_generator$3(this, function(_state) {
                switch(_state.label){
                    case 0:
                        fill = fillKey(record.details.fill);
                        if (!(view.fillKey !== fill)) return [
                            3,
                            2
                        ];
                        return [
                            4,
                            recolorIcon(objc, view.icon, record.details.fill, function() {
                                return isCurrent(view);
                            })
                        ];
                    case 1:
                        if (!_state.sent()) {
                            return [
                                2
                            ];
                        }
                        view.fillKey = fill;
                        _state.label = 2;
                    case 2:
                        if (!(view.tooltip !== record.tooltip)) return [
                            3,
                            4
                        ];
                        return [
                            4,
                            describeIcon(objc, view.icon, record)
                        ];
                    case 3:
                        _state.sent();
                        view.tooltip = record.tooltip;
                        _state.label = 4;
                    case 4:
                        return [
                            2
                        ];
                }
            });
        })();
    }
    function addView(key, messageId, record, nodes, isFresh) {
        return _async_to_generator$3(function() {
            var match, icon, layout, cell;
            return _ts_generator$3(this, function(_state) {
                switch(_state.label){
                    case 0:
                        match = findUsernameHeader(nodes, record.username);
                        if (!match) return [
                            2
                        ];
                        return [
                            4,
                            createIcon(objc, record)
                        ];
                    case 1:
                        icon = _state.sent();
                        if (!icon || !viewKey(objc, icon) || !isFresh()) return [
                            2
                        ];
                        return [
                            4,
                            installLayout(objc, icon, match.label, match.header)
                        ];
                    case 2:
                        layout = _state.sent();
                        cell = cells.get(key);
                        if (!(!cell || !isFresh())) return [
                            3,
                            5
                        ];
                        return [
                            4,
                            restoreLayout(objc, layout)
                        ];
                    case 3:
                        _state.sent();
                        return [
                            4,
                            safeInvokeAsync(objc, icon, 'removeFromSuperview')
                        ];
                    case 4:
                        _state.sent();
                        return [
                            2
                        ];
                    case 5:
                        cell.view = {
                            cellKey: key,
                            messageId: messageId,
                            icon: icon,
                            layout: layout,
                            fillKey: fillKey(record.details.fill),
                            tooltip: record.tooltip
                        };
                        return [
                            4,
                            safeInvokeAsync(objc, match.header, 'setNeedsLayout')
                        ];
                    case 6:
                        _state.sent();
                        return [
                            4,
                            safeInvokeAsync(objc, match.header, 'layoutIfNeeded')
                        ];
                    case 7:
                        _state.sent();
                        return [
                            2
                        ];
                }
            });
        })();
    }
    function render(handle, key, revision) {
        return _async_to_generator$3(function() {
            var _nodes_, _this, isFresh, nodes, messageId;
            return _ts_generator$3(this, function(_state) {
                switch(_state.label){
                    case 0:
                        isFresh = function isFresh() {
                            var _cells_get;
                            return !disposed && ((_cells_get = cells.get(key)) === null || _cells_get === void 0 ? void 0 : _cells_get.revision) === revision;
                        };
                        return [
                            4,
                            objc.snapshot(handle, CELL_SNAPSHOT)
                        ];
                    case 1:
                        nodes = _state.sent();
                        if (!isFresh()) return [
                            2
                        ];
                        if (!((_nodes_ = nodes[0]) === null || _nodes_ === void 0 ? void 0 : _nodes_.visible)) {
                            disposeCell(handle);
                            return [
                                2
                            ];
                        }
                        return [
                            4,
                            readNativeMessageInfo(handle, objc)
                        ];
                    case 2:
                        messageId = (_this = _state.sent()) === null || _this === void 0 ? void 0 : _this.messageId;
                        if (!isFresh()) return [
                            2
                        ];
                        return [
                            4,
                            enqueue(key, function() {
                                return _async_to_generator$3(function() {
                                    var cell, record;
                                    return _ts_generator$3(this, function(_state) {
                                        switch(_state.label){
                                            case 0:
                                                cell = cells.get(key);
                                                if (!cell || !isFresh()) return [
                                                    2
                                                ];
                                                if (cell.messageId && cell.messageId !== messageId) {
                                                    cellsByMessageId.delete(cell.messageId);
                                                    cell.messageId = undefined;
                                                }
                                                if (!messageId) return [
                                                    2
                                                ];
                                                cell.messageId = messageId;
                                                cellsByMessageId.set(messageId, handle);
                                                if (!(cell.view && cell.view.messageId !== messageId)) return [
                                                    3,
                                                    2
                                                ];
                                                return [
                                                    4,
                                                    removeView(cell.view)
                                                ];
                                            case 1:
                                                _state.sent();
                                                _state.label = 2;
                                            case 2:
                                                if (!isFresh()) return [
                                                    2
                                                ];
                                                record = records.get(messageId);
                                                if (!!record) return [
                                                    3,
                                                    5
                                                ];
                                                if (!cell.view) return [
                                                    3,
                                                    4
                                                ];
                                                return [
                                                    4,
                                                    removeView(cell.view)
                                                ];
                                            case 3:
                                                _state.sent();
                                                _state.label = 4;
                                            case 4:
                                                return [
                                                    2
                                                ];
                                            case 5:
                                                if (!cell.view) return [
                                                    3,
                                                    7
                                                ];
                                                return [
                                                    4,
                                                    updateView(cell.view, record)
                                                ];
                                            case 6:
                                                _state.sent();
                                                return [
                                                    2
                                                ];
                                            case 7:
                                                return [
                                                    4,
                                                    addView(key, messageId, record, nodes, isFresh)
                                                ];
                                            case 8:
                                                _state.sent();
                                                return [
                                                    2
                                                ];
                                        }
                                    });
                                })();
                            })
                        ];
                    case 3:
                        _state.sent();
                        return [
                            2
                        ];
                }
            });
        })();
    }
    function schedule(handle) {
        var _cells_get;
        var _cells_get1;
        var key = viewKey(objc, handle);
        if (!key || ((_cells_get1 = cells.get(key)) === null || _cells_get1 === void 0 ? void 0 : _cells_get1.rendering)) return;
        var revision = ++nextRevision;
        var cell = (_cells_get = cells.get(key)) !== null && _cells_get !== void 0 ? _cells_get : {
            revision: revision,
            rendering: true
        };
        cell.revision = revision;
        cell.rendering = true;
        cells.set(key, cell);
        // Deferred so the native lifecycle call that triggered it returns first.
        setTimeout(function() {
            if (disposed || cells.get(key) !== cell) return;
            void render(handle, key, revision).catch(function() {
                var _cells_get;
                if (!disposed && ((_cells_get = cells.get(key)) === null || _cells_get === void 0 ? void 0 : _cells_get.revision) === revision) disposeCell(handle);
            }).finally(function() {
                var _cells_get;
                if (((_cells_get = cells.get(key)) === null || _cells_get === void 0 ? void 0 : _cells_get.revision) === revision) cell.rendering = false;
            });
        }, 0);
    }
    function disposeCell(handle) {
        var key = viewKey(objc, handle);
        var cell = key ? cells.get(key) : undefined;
        if (!key || !cell) return;
        var view = cell.view, messageId = cell.messageId;
        cells.delete(key);
        if (view) void enqueue(key, function() {
            return removeView(view);
        });
        if (messageId && cellsByMessageId.get(messageId) === handle) {
            cellsByMessageId.delete(messageId);
        }
    }
    function refresh(messageId) {
        var handle = cellsByMessageId.get(messageId);
        if (handle) schedule(handle);
    }
    function refreshTheme() {
        var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
        try {
            var _loop = function() {
                var view = _step.value.view;
                var record = view && records.get(view.messageId);
                if (view && record) void enqueue(view.cellKey, function() {
                    return updateView(view, record);
                });
            };
            for(var _iterator = cells.values()[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true)_loop();
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
    function onIconTap(icon) {
        var key = viewKey(objc, icon);
        if (!key || !tooltips) return;
        var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
        try {
            var _loop = function() {
                var view = _step.value.view;
                if (view && viewKey(objc, view.icon) === key) {
                    tooltips.show(view, function() {
                        return isCurrent(view);
                    });
                    return {
                        v: void void 0
                    };
                }
            };
            for(var _iterator = cells.values()[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                var _ret = _loop();
                if (_type_of(_ret) === "object") return _ret.v;
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
    function restoreAll() {
        return _async_to_generator$3(function() {
            var views;
            return _ts_generator$3(this, function(_state) {
                switch(_state.label){
                    case 0:
                        return [
                            4,
                            Promise.all(_to_consumable_array$2(tasks))
                        ];
                    case 1:
                        _state.sent();
                        views = _to_consumable_array$2(cells.values()).flatMap(function(param) {
                            var view = param.view;
                            return view ? [
                                view
                            ] : [];
                        });
                        return [
                            4,
                            Promise.all(views.map(removeView))
                        ];
                    case 2:
                        _state.sent();
                        return [
                            4,
                            tooltips === null || tooltips === void 0 ? void 0 : tooltips.dispose()
                        ];
                    case 3:
                        _state.sent();
                        cells.clear();
                        cellsByMessageId.clear();
                        queues.clear();
                        return [
                            2
                        ];
                }
            });
        })();
    }
    function hook() {
        var hooks = [];
        var handlers = [
            [
                'UIControl',
                'endTrackingWithTouch:withEvent:',
                {
                    after: function after(param) {
                        var self = param.self;
                        return onIconTap(self);
                    }
                }
            ],
            [
                'DCDMessageTableViewCell',
                'didMoveToWindow',
                {
                    after: function after(param) {
                        var self = param.self;
                        return schedule(self);
                    }
                }
            ],
            [
                'DCDMessageTableViewCell',
                'prepareForReuse',
                {
                    after: function after(param) {
                        var self = param.self;
                        disposeCell(self);
                        schedule(self);
                    }
                }
            ]
        ];
        try {
            var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
            try {
                for(var _iterator = handlers[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                    var _step_value = _sliced_to_array$1(_step.value, 3), className = _step_value[0], selector = _step_value[1], handler = _step_value[2];
                    hooks.push(objc.hook(className, selector, handler));
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
            var _iteratorNormalCompletion1 = true, _didIteratorError1 = false, _iteratorError1 = undefined;
            try {
                for(var _iterator1 = hooks[Symbol.iterator](), _step1; !(_iteratorNormalCompletion1 = (_step1 = _iterator1.next()).done); _iteratorNormalCompletion1 = true){
                    var token = _step1.value;
                    token.remove();
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
            throw error;
        }
        var unsubscribeRecords = records.subscribe(refresh);
        var unsubscribeTheme = subscribeTheme(refreshTheme);
        return function() {
            var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
            try {
                for(var _iterator = hooks[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                    var token = _step.value;
                    token.remove();
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
            unsubscribeRecords();
            unsubscribeTheme();
            disposed = true;
            teardown = restoreAll();
        };
    }
    return {
        hook: hook,
        settled: function settled() {
            return teardown;
        }
    };
}/**
 * @description The widest the tooltip text may wrap to in a window of this width.
 * @param windowWidth The window's width in points.
 * @returns The maximum text width in points.
 */ function tooltipTextWidth(windowWidth) {
    return Math.max(120, Math.min(Tooltip.maxWidth, windowWidth - 32)) - 20;
}
/**
 * @description Places the tooltip bubble centered on the indicator, below it when it fits and above it otherwise, inside the window.
 * @param text The measured size of the tooltip text.
 * @param icon The indicator's frame in window coordinates.
 * @param bounds The window's bounds.
 * @returns The bubble's frame and arrow, or `null` when the text has no usable size.
 */ function placeTooltip(text, icon, bounds) {
    var textWidth = Math.min(tooltipTextWidth(bounds.width), text.width);
    if (!(textWidth > 0 && text.height > 0)) return null;
    var width = textWidth + 28;
    var height = text.height + 20 + Tooltip.arrowHeight;
    var x = Math.max(8, Math.min(icon.x + (icon.width - width) / 2, bounds.width - width - 8));
    var belowY = icon.y + icon.height + Tooltip.anchorGap;
    var below = belowY + height <= bounds.height - 8;
    var y = below ? belowY : Math.max(8, icon.y - height - Tooltip.anchorGap);
    return {
        frame: {
            x: x,
            y: y,
            width: width,
            height: height
        },
        below: below,
        arrowOffset: icon.x + icon.width / 2 - x - 8
    };
}/**
 * @description Discord's tooltip bubble, mounted on its own Fabric surface over the message list.
 * @param props Where the arrow points, the text, and the bubble width.
 * @returns The tooltip.
 */ function LatencyTooltip(param) {
    var arrowDirection = param.arrowDirection, arrowOffset = param.arrowOffset, label = param.label, width = param.width;
    var background = resolveColor('BACKGROUND_SURFACE_HIGHEST');
    return /*#__PURE__*/ React.createElement(Tooltips.Tooltip, {
        arrowDirection: arrowDirection,
        arrowOffset: arrowOffset,
        arrowPosition: Tooltips.TooltipArrowPositions.LEFT,
        arrowStyle: {
            borderBottomColor: background,
            borderTopColor: background
        },
        containerStyle: {
            backgroundColor: background
        },
        label: label,
        labelStyle: {
            color: resolveColor('TEXT_DEFAULT')
        },
        style: {
            width: width
        }
    });
}function _array_like_to_array$2(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_without_holes$1(arr) {
    if (Array.isArray(arr)) return _array_like_to_array$2(arr);
}
function asyncGeneratorStep$2(gen, resolve, reject, _next, _throw, key, arg) {
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
function _async_to_generator$2(fn) {
    return function() {
        var self = this, args = arguments;
        return new Promise(function(resolve, reject) {
            var gen = fn.apply(self, args);
            function _next(value) {
                asyncGeneratorStep$2(gen, resolve, reject, _next, _throw, "next", value);
            }
            function _throw(err) {
                asyncGeneratorStep$2(gen, resolve, reject, _next, _throw, "throw", err);
            }
            _next(undefined);
        });
    };
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
    return _array_without_holes$1(arr) || _iterable_to_array$1(arr) || _unsupported_iterable_to_array$2(arr) || _non_iterable_spread$1();
}
function _ts_generator$2(thisArg, body) {
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
/**
 * @description Creates the tooltip shown when an Android indicator is tapped, Discord's tooltip on its own surface over the window. It closes on the next touch or after a few seconds, like the iOS one.
 * @param native The plugin's Java, hook and Fabric bridges.
 * @returns The tooltip controller, or `null` when Discord's tooltip component is missing.
 */ function createAndroidTooltips(param) {
    var java = param.java, hooks = param.hooks, fabric = param.fabric;
    if (!ensureModules('Message Latency: tooltip', {
        Tooltips: Tooltips
    })) return null;
    var tasks = new Set();
    var shown = null;
    var timer = null;
    var dismissHook = null;
    var generation = 0;
    var disposed = false;
    var surfaceName;
    function track(task) {
        var settled = task.catch(function() {
            return undefined;
        });
        tasks.add(settled);
        void settled.finally(function() {
            return tasks.delete(settled);
        });
    }
    function dismiss() {
        return _async_to_generator$2(function() {
            var previous;
            return _ts_generator$2(this, function(_state) {
                switch(_state.label){
                    case 0:
                        if (timer) clearTimeout(timer);
                        timer = null;
                        generation++;
                        if (dismissHook) hooks.remove(dismissHook);
                        dismissHook = null;
                        previous = shown;
                        shown = null;
                        if (!previous) return [
                            2
                        ];
                        return [
                            4,
                            fabric.unmountAsync(previous.surface).catch(function() {
                                return undefined;
                            })
                        ];
                    case 1:
                        _state.sent();
                        return [
                            4,
                            removeHost(java, previous.host).catch(function() {
                                return undefined;
                            })
                        ];
                    case 2:
                        _state.sent();
                        return [
                            2
                        ];
                }
            });
        })();
    }
    function closeOnNextTouch(current) {
        if (!shown || dismissHook || current !== generation) return;
        try {
            dismissHook = hooks.hook('android.app.Activity', 'dispatchTouchEvent', [
                'android.view.MotionEvent'
            ], {
                notify: true
            }, function() {
                if (current === generation) track(dismiss());
            });
        } catch (unused) {
            dismissHook = null;
        }
    }
    function metricsOf(view) {
        var _javaNumber, _javaNumber1;
        var resources = javaReference(java.invoke(view, 'getResources', []));
        var metrics = resources ? javaReference(java.invoke(resources, 'getDisplayMetrics', [])) : null;
        var density = metrics ? (_javaNumber = javaNumber(java.getField(metrics, 'density'))) !== null && _javaNumber !== void 0 ? _javaNumber : 1 : 1;
        return {
            density: density,
            scaledDensity: metrics ? (_javaNumber1 = javaNumber(java.getField(metrics, 'scaledDensity'))) !== null && _javaNumber1 !== void 0 ? _javaNumber1 : density : density
        };
    }
    function measure(text, maxWidth, metrics) {
        var _javaNumber, _javaNumber1;
        var paint = java.construct('android.text.TextPaint', []);
        java.invoke(paint, 'setTextSize', [
            javaFloat(Tooltip.fontSize * metrics.scaledDensity)
        ]);
        var builder = java.invoke(java.getClass('android.text.StaticLayout$Builder'), 'obtain', [
            javaString(text),
            javaInt(0),
            javaInt(text.length),
            paint,
            javaInt(Math.round(maxWidth * metrics.density))
        ]);
        var layout = javaReference(builder) ? java.invoke(builder, 'build', []) : null;
        if (!javaReference(layout)) return null;
        var lines = (_javaNumber = javaNumber(java.invoke(layout, 'getLineCount', []))) !== null && _javaNumber !== void 0 ? _javaNumber : 0;
        var width = 0;
        for(var line = 0; line < lines; line++){
            var _javaNumber2;
            width = Math.max(width, (_javaNumber2 = javaNumber(java.invoke(layout, 'getLineWidth', [
                javaInt(line)
            ]))) !== null && _javaNumber2 !== void 0 ? _javaNumber2 : 0);
        }
        return {
            width: Math.ceil(width) / metrics.density,
            height: ((_javaNumber1 = javaNumber(java.invoke(layout, 'getHeight', []))) !== null && _javaNumber1 !== void 0 ? _javaNumber1 : 0) / metrics.density
        };
    }
    function iconFrame(host, density) {
        var _javaNumber, _javaNumber1;
        var rect = java.construct('android.graphics.Rect', []);
        java.invoke(host, 'getGlobalVisibleRect', [
            rect
        ]);
        return {
            x: ((_javaNumber = javaNumber(java.getField(rect, 'left'))) !== null && _javaNumber !== void 0 ? _javaNumber : 0) / density,
            y: ((_javaNumber1 = javaNumber(java.getField(rect, 'top'))) !== null && _javaNumber1 !== void 0 ? _javaNumber1 : 0) / density + 4,
            width: Icon.width,
            height: Icon.height
        };
    }
    function show(anchor) {
        return _async_to_generator$2(function() {
            var _javaNumber, _javaNumber1, current, stale, decor, metrics, bounds, text, placement, frame, below, arrowOffset, position, size, host, surface;
            return _ts_generator$2(this, function(_state) {
                switch(_state.label){
                    case 0:
                        return [
                            4,
                            dismiss()
                        ];
                    case 1:
                        _state.sent();
                        current = generation;
                        stale = function stale() {
                            return disposed || current !== generation;
                        };
                        decor = currentDecorView(java);
                        if (stale() || !decor) return [
                            2
                        ];
                        surfaceName !== null && surfaceName !== void 0 ? surfaceName : surfaceName = registerAppSurface('MessageLatencyTooltipSurface', LatencyTooltip);
                        if (!surfaceName) return [
                            2
                        ];
                        metrics = metricsOf(decor);
                        bounds = {
                            x: 0,
                            y: 0,
                            width: ((_javaNumber = javaNumber(java.invoke(decor, 'getWidth', []))) !== null && _javaNumber !== void 0 ? _javaNumber : 0) / metrics.density,
                            height: ((_javaNumber1 = javaNumber(java.invoke(decor, 'getHeight', []))) !== null && _javaNumber1 !== void 0 ? _javaNumber1 : 0) / metrics.density
                        };
                        text = measure(anchor.tooltip, tooltipTextWidth(bounds.width), metrics);
                        placement = text ? placeTooltip(text, iconFrame(anchor.host, metrics.density), bounds) : null;
                        if (!placement) return [
                            2
                        ];
                        frame = placement.frame, below = placement.below, arrowOffset = placement.arrowOffset;
                        position = {
                            x: frame.x * metrics.density,
                            y: frame.y * metrics.density
                        };
                        size = {
                            width: frame.width * metrics.density,
                            height: frame.height * metrics.density
                        };
                        host = createHost(java, decor);
                        surface = null;
                        _state.label = 2;
                    case 2:
                        _state.trys.push([
                            2,
                            ,
                            6,
                            11
                        ]);
                        return [
                            4,
                            placeHost(java, host, decor, position, size)
                        ];
                    case 3:
                        _state.sent();
                        if (stale()) return [
                            2
                        ];
                        return [
                            4,
                            fabric.mountAsync(host, surfaceName, {
                                arrowDirection: below ? 'UP' : 'DOWN',
                                arrowOffset: arrowOffset,
                                label: anchor.tooltip,
                                width: frame.width
                            })
                        ];
                    case 4:
                        surface = _state.sent();
                        return [
                            4,
                            placeHost(java, host, decor, position, size)
                        ];
                    case 5:
                        _state.sent();
                        if (stale()) return [
                            2
                        ];
                        shown = {
                            key: anchor.key,
                            host: host,
                            surface: surface
                        };
                        surface = null;
                        setTimeout(function() {
                            return closeOnNextTouch(current);
                        }, 0);
                        timer = setTimeout(function() {
                            if (current === generation) track(dismiss());
                        }, Tooltip.duration);
                        return [
                            3,
                            11
                        ];
                    case 6:
                        if (!surface) return [
                            3,
                            8
                        ];
                        return [
                            4,
                            fabric.unmountAsync(surface).catch(function() {
                                return undefined;
                            })
                        ];
                    case 7:
                        _state.sent();
                        _state.label = 8;
                    case 8:
                        if (!((shown === null || shown === void 0 ? void 0 : shown.host) !== host)) return [
                            3,
                            10
                        ];
                        return [
                            4,
                            removeHost(java, host).catch(function() {
                                return undefined;
                            })
                        ];
                    case 9:
                        _state.sent();
                        _state.label = 10;
                    case 10:
                        return [
                            7
                        ];
                    case 11:
                        return [
                            2
                        ];
                }
            });
        })();
    }
    return {
        show: function show1(anchor) {
            return track(show(anchor));
        },
        dismissFor: function dismissFor(key) {
            if ((shown === null || shown === void 0 ? void 0 : shown.key) === key) track(dismiss());
        },
        dispose: function dispose() {
            return _async_to_generator$2(function() {
                return _ts_generator$2(this, function(_state) {
                    switch(_state.label){
                        case 0:
                            disposed = true;
                            return [
                                4,
                                dismiss()
                            ];
                        case 1:
                            _state.sent();
                            return [
                                4,
                                Promise.all(_to_consumable_array$1(tasks))
                            ];
                        case 2:
                            _state.sent();
                            return [
                                2
                            ];
                    }
                });
            })();
        }
    };
}/**
 * @description The root of a plugin settings panel, laid out like Unbound's own settings pages.
 * @param props The page's children, usually `Discord.TableRowGroup`s.
 * @returns A padded scroll view with a 24px gap between groups.
 */ function Page(param) {
    var children = param.children;
    return /*#__PURE__*/ React.createElement(window.ReactNative.ScrollView, {
        contentContainerStyle: {
            padding: 16
        },
        keyboardShouldPersistTaps: "handled"
    }, /*#__PURE__*/ React.createElement(window.unbound.metro.components.SafeArea.SafeAreaPaddingView, {
        bottom: true
    }, /*#__PURE__*/ React.createElement(window.ReactNative.View, {
        style: {
            gap: 24
        }
    }, children)));
}function SettingsPanel() {
    var store = settings.useSettingsStore();
    var latency = store.get('latency', Defaults.latency);
    var next = LATENCY_OPTIONS[(LATENCY_OPTIONS.indexOf(latency) + 1) % LATENCY_OPTIONS.length];
    return /*#__PURE__*/ React.createElement(Page, null, /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TableRowGroup, {
        title: "Indicator"
    }, /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TableRow, {
        label: "Latency threshold",
        subLabel: "Show an indicator when a message takes at least this long to send.",
        trailing: /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TableRow.TrailingText, {
            text: "".concat(latency, "s")
        }),
        onPress: function onPress() {
            return store.set('latency', next);
        }
    }), /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TableSwitchRow, {
        label: "Show milliseconds",
        subLabel: "Include millisecond precision in the indicator.",
        value: store.get('showMillis', Defaults.showMillis),
        onValueChange: function onValueChange(value) {
            return store.set('showMillis', value);
        }
    }), /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TableSwitchRow, {
        label: "Ignore my messages",
        subLabel: "Only mark messages sent by other people.",
        value: store.get('ignoreSelf', Defaults.ignoreSelf),
        onValueChange: function onValueChange(value) {
            return store.set('ignoreSelf', value);
        }
    }), /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TableSwitchRow, {
        label: "Detect legacy Android clients",
        subLabel: "Show a marker for the known timestamp offset in older Discord Android clients.",
        value: store.get('detectDiscordKotlin', Defaults.detectDiscordKotlin),
        onValueChange: function onValueChange(value) {
            return store.set('detectDiscordKotlin', value);
        }
    })));
}function _array_like_to_array$1(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_without_holes(arr) {
    if (Array.isArray(arr)) return _array_like_to_array$1(arr);
}
function asyncGeneratorStep$1(gen, resolve, reject, _next, _throw, key, arg) {
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
function _async_to_generator$1(fn) {
    return function() {
        var self = this, args = arguments;
        return new Promise(function(resolve, reject) {
            var gen = fn.apply(self, args);
            function _next(value) {
                asyncGeneratorStep$1(gen, resolve, reject, _next, _throw, "next", value);
            }
            function _throw(err) {
                asyncGeneratorStep$1(gen, resolve, reject, _next, _throw, "throw", err);
            }
            _next(undefined);
        });
    };
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
function _iterable_to_array(iter) {
    if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) {
        return Array.from(iter);
    }
}
function _non_iterable_spread() {
    throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
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
function _to_consumable_array(arr) {
    return _array_without_holes(arr) || _iterable_to_array(arr) || _unsupported_iterable_to_array$1(arr) || _non_iterable_spread();
}
function _ts_generator$1(thisArg, body) {
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
function _unsupported_iterable_to_array$1(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _array_like_to_array$1(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(n);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _array_like_to_array$1(o, minLen);
}
/**
 * @description Creates the tooltip shown when an indicator is tapped. It closes on the next touch or after a few seconds.
 * @param objc The Objective-C bridge from `context.native`.
 * @param fabric The Fabric bridge used to mount Discord's tooltip.
 * @returns The tooltip controller, or `null` when Discord's tooltip component is missing.
 */ function createTooltips(objc, fabric) {
    if (!ensureModules('Message Latency: tooltip', {
        Tooltips: Tooltips
    })) return null;
    var tasks = new Set();
    var shown = null;
    var timer = null;
    var dismissHook = null;
    // Bumped on every dismiss, so a show that is still awaiting the bridge can tell it was superseded.
    var generation = 0;
    var disposed = false;
    var surfaceName;
    function track(task) {
        var settled = task.catch(function() {
            return undefined;
        });
        tasks.add(settled);
        void settled.finally(function() {
            return tasks.delete(settled);
        });
    }
    function dismiss() {
        return _async_to_generator$1(function() {
            var previous;
            return _ts_generator$1(this, function(_state) {
                switch(_state.label){
                    case 0:
                        if (timer) clearTimeout(timer);
                        timer = null;
                        generation++;
                        dismissHook === null || dismissHook === void 0 ? void 0 : dismissHook.remove();
                        dismissHook = null;
                        previous = shown;
                        shown = null;
                        if (!previous) return [
                            2
                        ];
                        return [
                            4,
                            fabric.unmountAsync(previous.surface).catch(function() {
                                return undefined;
                            })
                        ];
                    case 1:
                        _state.sent();
                        return [
                            4,
                            safeInvokeAsync(objc, previous.host, 'removeFromSuperview')
                        ];
                    case 2:
                        _state.sent();
                        return [
                            2
                        ];
                }
            });
        })();
    }
    function closeOnNextTouch(current) {
        if (!shown || dismissHook || current !== generation) return;
        try {
            dismissHook = objc.hook('UIWindow', 'sendEvent:', {
                after: function after() {
                    if (current === generation) track(dismiss());
                }
            });
        } catch (unused) {
        // Without the hook the timer still closes the tooltip.
        }
    }
    function measure(text, maxWidth) {
        return _async_to_generator$1(function() {
            var label, UIFont, font, _tmp, size;
            return _ts_generator$1(this, function(_state) {
                switch(_state.label){
                    case 0:
                        label = objc.alloc('UILabel');
                        return [
                            4,
                            safeInvokeAsync(objc, label, 'setText:', text)
                        ];
                    case 1:
                        _state.sent();
                        return [
                            4,
                            safeInvokeAsync(objc, label, 'setNumberOfLines:', 0)
                        ];
                    case 2:
                        _state.sent();
                        UIFont = objc.getClass('UIFont');
                        if (!UIFont) return [
                            3,
                            4
                        ];
                        return [
                            4,
                            safeInvokeAsync(objc, UIFont, 'systemFontOfSize:', Tooltip.fontSize)
                        ];
                    case 3:
                        _tmp = _state.sent();
                        return [
                            3,
                            5
                        ];
                    case 4:
                        _tmp = null;
                        _state.label = 5;
                    case 5:
                        font = _tmp;
                        if (!font) return [
                            2,
                            null
                        ];
                        return [
                            4,
                            safeInvokeAsync(objc, label, 'setFont:', font)
                        ];
                    case 6:
                        _state.sent();
                        size = objc.struct('CGSize', {
                            width: maxWidth,
                            height: 1000
                        });
                        return [
                            4,
                            safeInvokeAsync(objc, label, 'sizeThatFits:', size)
                        ];
                    case 7:
                        return [
                            2,
                            readSize.apply(void 0, [
                                _state.sent()
                            ])
                        ];
                }
            });
        })();
    }
    function show(anchor, isCurrent) {
        return _async_to_generator$1(function() {
            var current, stale, uiWindow, windowFrame, _tmp, host, surface, moduleName, text, iconRect, iconFrame, placement, frame, below, arrowOffset, size;
            return _ts_generator$1(this, function(_state) {
                switch(_state.label){
                    case 0:
                        return [
                            4,
                            dismiss()
                        ];
                    case 1:
                        _state.sent();
                        current = generation;
                        stale = function stale() {
                            return disposed || current !== generation || !isCurrent();
                        };
                        if (stale()) return [
                            2
                        ];
                        return [
                            4,
                            safeInvokeAsync(objc, anchor.icon, 'window')
                        ];
                    case 2:
                        uiWindow = _state.sent();
                        if (!uiWindow) return [
                            3,
                            4
                        ];
                        return [
                            4,
                            safeInvokeAsync(objc, uiWindow, 'bounds')
                        ];
                    case 3:
                        _tmp = readFrame.apply(void 0, [
                            _state.sent()
                        ]);
                        return [
                            3,
                            5
                        ];
                    case 4:
                        _tmp = null;
                        _state.label = 5;
                    case 5:
                        windowFrame = _tmp;
                        if (!uiWindow || !windowFrame) return [
                            2
                        ];
                        host = null;
                        surface = null;
                        _state.label = 6;
                    case 6:
                        _state.trys.push([
                            6,
                            16,
                            19,
                            24
                        ]);
                        surfaceName !== null && surfaceName !== void 0 ? surfaceName : surfaceName = registerAppSurface('MessageLatencyTooltipSurface', LatencyTooltip);
                        moduleName = surfaceName;
                        if (!moduleName) return [
                            2
                        ];
                        return [
                            4,
                            measure(anchor.tooltip, tooltipTextWidth(windowFrame.width))
                        ];
                    case 7:
                        text = _state.sent();
                        // The visible bars sit 4pt below the top of the taller tap target.
                        iconRect = toRect(objc, {
                            x: 0,
                            y: 4,
                            width: Icon.width,
                            height: Icon.height
                        });
                        return [
                            4,
                            safeInvokeAsync(objc, anchor.icon, 'convertRect:toView:', iconRect, uiWindow)
                        ];
                    case 8:
                        iconFrame = readFrame.apply(void 0, [
                            _state.sent()
                        ]);
                        placement = text && iconFrame ? placeTooltip(text, iconFrame, windowFrame) : null;
                        if (!placement) return [
                            2
                        ];
                        frame = placement.frame, below = placement.below, arrowOffset = placement.arrowOffset;
                        size = {
                            width: frame.width,
                            height: frame.height
                        };
                        host = objc.alloc('UIView');
                        return [
                            4,
                            safeInvokeAsync(objc, host, 'setUserInteractionEnabled:', false)
                        ];
                    case 9:
                        _state.sent();
                        return [
                            4,
                            safeInvokeAsync(objc, host, 'setAccessibilityIdentifier:', 'message-latency-tooltip')
                        ];
                    case 10:
                        _state.sent();
                        return [
                            4,
                            setFrame(objc, host, frame)
                        ];
                    case 11:
                        _state.sent();
                        if (stale()) return [
                            2
                        ];
                        return [
                            4,
                            safeInvokeAsync(objc, uiWindow, 'addSubview:', host)
                        ];
                    case 12:
                        _state.sent();
                        if (stale()) return [
                            2
                        ];
                        return [
                            4,
                            fabric.mountAsync(host, moduleName, {
                                arrowDirection: below ? 'UP' : 'DOWN',
                                arrowOffset: arrowOffset,
                                label: anchor.tooltip,
                                width: frame.width
                            })
                        ];
                    case 13:
                        surface = _state.sent();
                        return [
                            4,
                            fabric.setSizeAsync(surface, size, size)
                        ];
                    case 14:
                        _state.sent();
                        return [
                            4,
                            fabric.setFrameAsync(surface, _object_spread({
                                x: 0,
                                y: 0
                            }, size))
                        ];
                    case 15:
                        _state.sent();
                        if (stale()) return [
                            2
                        ];
                        shown = {
                            host: host,
                            surface: surface,
                            cellKey: anchor.cellKey
                        };
                        host = null;
                        surface = null;
                        // Deferred so the touch that opened the tooltip does not close it.
                        setTimeout(function() {
                            return closeOnNextTouch(current);
                        }, 0);
                        timer = setTimeout(function() {
                            if (current === generation) track(dismiss());
                        }, Tooltip.duration);
                        return [
                            3,
                            24
                        ];
                    case 16:
                        _state.sent();
                        if (!(current === generation)) return [
                            3,
                            18
                        ];
                        return [
                            4,
                            dismiss()
                        ];
                    case 17:
                        _state.sent();
                        _state.label = 18;
                    case 18:
                        return [
                            3,
                            24
                        ];
                    case 19:
                        if (!surface) return [
                            3,
                            21
                        ];
                        return [
                            4,
                            fabric.unmountAsync(surface).catch(function() {
                                return undefined;
                            })
                        ];
                    case 20:
                        _state.sent();
                        _state.label = 21;
                    case 21:
                        if (!host) return [
                            3,
                            23
                        ];
                        return [
                            4,
                            safeInvokeAsync(objc, host, 'removeFromSuperview')
                        ];
                    case 22:
                        _state.sent();
                        _state.label = 23;
                    case 23:
                        return [
                            7
                        ];
                    case 24:
                        return [
                            2
                        ];
                }
            });
        })();
    }
    return {
        show: function show1(anchor, isCurrent) {
            return track(show(anchor, isCurrent));
        },
        dismissFor: function dismissFor(cellKey) {
            if ((shown === null || shown === void 0 ? void 0 : shown.cellKey) === cellKey) track(dismiss());
        },
        dispose: function dispose() {
            return _async_to_generator$1(function() {
                return _ts_generator$1(this, function(_state) {
                    switch(_state.label){
                        case 0:
                            disposed = true;
                            return [
                                4,
                                dismiss()
                            ];
                        case 1:
                            _state.sent();
                            return [
                                4,
                                Promise.all(_to_consumable_array(tasks))
                            ];
                        case 2:
                            _state.sent();
                            return [
                                2
                            ];
                    }
                });
            })();
        }
    };
}function _array_like_to_array(arr, len) {
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
    return _array_with_holes(arr) || _iterable_to_array_limit(arr, i) || _unsupported_iterable_to_array(arr, i) || _non_iterable_rest();
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
 * @description Reads the creation time out of a Discord snowflake using decimal long division, so it never needs `BigInt`.
 * @param value The snowflake, as a string or a safe integer.
 * @returns The Unix timestamp in milliseconds, or `null` when the value is not a valid snowflake.
 */ function snowflakeTimestamp(value) {
    if (typeof value === 'number' && !Number.isSafeInteger(value)) return null;
    var digits = String(value);
    if (!/^\d+$/.test(digits)) return null;
    var remainder = 0;
    var quotient = '';
    var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
    try {
        for(var _iterator = digits[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
            var digit = _step.value;
            var current = remainder * 10 + Number(digit);
            var next = Math.floor(current / SNOWFLAKE_SHIFT);
            remainder = current % SNOWFLAKE_SHIFT;
            if (quotient || next) quotient += String(next);
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
    if (!quotient) return null;
    var timestamp = DISCORD_EPOCH + Number(quotient);
    return Number.isSafeInteger(timestamp) ? timestamp : null;
}
/**
 * @description Spells out a duration the way Vencord's MessageLatency does, such as "2 minutes and 3 seconds".
 * @param delta The duration in milliseconds.
 * @param showMillis Whether milliseconds are shown, which moves the "and" before them.
 * @returns The English duration text.
 */ function formatLatency(delta, showMillis) {
    // Vencord's joining rule ("1 hour 2 minutes and 3 seconds") has no `Intl.ListFormat` equivalent.
    var parts = [
        [
            Math.floor(delta / 86400000),
            'day'
        ],
        [
            Math.floor(delta / 3600000 % 24),
            'hour'
        ],
        [
            Math.floor(delta / 60000 % 60),
            'minute'
        ],
        [
            Math.floor(delta / 1000 % 60),
            'second'
        ],
        [
            Math.floor(delta % 1000),
            'millisecond'
        ]
    ];
    var lastJoined = showMillis ? 'millisecond' : 'second';
    var result = '';
    var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
    try {
        for(var _iterator = parts[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
            var _step_value = _sliced_to_array(_step.value, 2), value = _step_value[0], unit = _step_value[1];
            if (!value) continue;
            if (result) result += unit === lastJoined ? ' and ' : ' ';
            result += "".concat(value, " ").concat(unit).concat(value > 1 ? 's' : '');
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
    return result || '0 seconds';
}
/**
 * @description Measures how long a message took to send, from the gap between its ID and its nonce.
 * @param message The message, with the author, ID, and nonce.
 * @param currentUserId The signed-in user's ID, for the "ignore my messages" setting.
 * @param options The user's latency settings.
 * @returns What the indicator shows, or `null` when the message gets no indicator.
 */ function latencyDetails(message, currentUserId, options) {
    var _message_author, _message_author1;
    if (message.nonce == null || ((_message_author = message.author) === null || _message_author === void 0 ? void 0 : _message_author.bot)) return null;
    if (options.ignoreSelf && ((_message_author1 = message.author) === null || _message_author1 === void 0 ? void 0 : _message_author1.id) === currentUserId) return null;
    var messageTimestamp = snowflakeTimestamp(message.id);
    var nonceTimestamp = snowflakeTimestamp(message.nonce);
    if (messageTimestamp == null || nonceTimestamp == null) return null;
    var delta = messageTimestamp - nonceTimestamp;
    if (!options.showMillis) delta = Math.round(delta / 1000) * 1000;
    var androidClient = false;
    if (-delta >= ANDROID_NONCE_OFFSET - ANDROID_OFFSET_TOLERANCE) {
        androidClient = options.detectDiscordKotlin;
        delta += ANDROID_NONCE_OFFSET;
    }
    var absoluteDelta = Math.abs(delta);
    var ahead = absoluteDelta !== delta;
    var displayDelta = absoluteDelta >= options.latency * 1000 ? formatLatency(absoluteDelta, options.showMillis) : null;
    if (displayDelta === null && !androidClient) return null;
    var fill = [
        'warning',
        'warning',
        'muted'
    ];
    if (androidClient) {
        fill = [
            'positive',
            'positive',
            'muted'
        ];
    } else if (delta >= 120000 || ahead) {
        fill = [
            'muted',
            'muted',
            'muted'
        ];
    } else if (delta >= options.latency * 2000) {
        fill = [
            'danger',
            'muted',
            'muted'
        ];
    }
    return {
        ahead: ahead,
        androidClient: androidClient,
        delta: absoluteDelta,
        displayDelta: displayDelta,
        fill: fill
    };
}
/**
 * @description Builds the tooltip text shown when the indicator is tapped.
 * @param details The indicator details from `latencyDetails`.
 * @returns The tooltip sentence.
 */ function latencyTooltip(details) {
    if (!details.displayDelta) return 'User is suspected to be on an old Discord Android client';
    var message = details.ahead ? "This user's clock is ".concat(details.displayDelta, " ahead.") : "This message was sent with a delay of ".concat(details.displayDelta, ".");
    return details.androidClient ? "".concat(message, " User is suspected to be on an old Discord Android client.") : message;
}function readOptions() {
    return {
        latency: settings.get('latency', Defaults.latency),
        showMillis: settings.get('showMillis', Defaults.showMillis),
        ignoreSelf: settings.get('ignoreSelf', Defaults.ignoreSelf),
        detectDiscordKotlin: settings.get('detectDiscordKotlin', Defaults.detectDiscordKotlin)
    };
}
/**
 * @description Creates the cache of measured messages, keeping the most recently seen ones.
 * @returns The cache, which tells its subscribers which message's record changed.
 */ function createLatencyRecords() {
    // A Map iterates in insertion order, so re-inserting on update keeps the oldest entry first.
    var records = new Map();
    var listeners = new Set();
    function notify(messageId) {
        var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
        try {
            for(var _iterator = listeners[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                var listener = _step.value;
                listener(messageId);
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
    function update(message, username) {
        var _UserStore_getCurrentUser, _message_author, _records_get;
        if (message.id == null || message.nonce == null) return;
        var messageId = String(message.id);
        var details = latencyDetails(message, (_UserStore_getCurrentUser = UserStore.getCurrentUser()) === null || _UserStore_getCurrentUser === void 0 ? void 0 : _UserStore_getCurrentUser.id, readOptions());
        if (!details) {
            if (records.delete(messageId)) notify(messageId);
            return;
        }
        var name = username || ((_message_author = message.author) === null || _message_author === void 0 ? void 0 : _message_author.username) || ((_records_get = records.get(messageId)) === null || _records_get === void 0 ? void 0 : _records_get.username);
        if (!name) return;
        records.delete(messageId);
        records.set(messageId, {
            details: details,
            tooltip: latencyTooltip(details),
            username: name
        });
        var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
        try {
            for(var _iterator = records.keys()[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                var oldest = _step.value;
                if (records.size <= MAX_LATENCY_RECORDS) break;
                records.delete(oldest);
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
        notify(messageId);
    }
    return {
        get: function get(messageId) {
            return records.get(messageId);
        },
        update: update,
        subscribe: function subscribe(listener) {
            listeners.add(listener);
            return function() {
                return void listeners.delete(listener);
            };
        },
        clear: function clear() {
            return records.clear();
        }
    };
}function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) {
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
var dispose = function dispose() {
    return undefined;
};
var settled = function settled() {
    return Promise.resolve();
};
function startAndroid(context) {
    if (!ensureCapabilities('Message Latency', context.native, context.capabilities) || !ensureModules('Message Latency', {
        UserStore: UserStore,
        Theme: Theme
    })) {
        return;
    }
    var records = createLatencyRecords();
    var indicators = createAndroidIndicators(context.native, records, createAndroidTooltips(context.native));
    if (!indicators) {
        console.error('[Message Latency] Skipped, the indicator surface did not register.');
        return;
    }
    dispose = applyFeatures('Message Latency', [
        function() {
            return records.clear;
        },
        function() {
            return indicators.dispose;
        },
        function() {
            return subscribeMessageCreate(records, context);
        },
        function() {
            return patchMessageRowData(records);
        }
    ]);
}
function start(context) {
    if (context.platform === 'android') {
        startAndroid(context);
        return;
    }
    var _context_native = context.native, objc = _context_native.objc, fabric = _context_native.fabric;
    if (!ensureModules('Message Latency', {
        UserStore: UserStore,
        Theme: Theme
    }) || !ensureClasses('Message Latency', objc, [
        'DCDMessageTableViewCell',
        'NSLayoutConstraint',
        'UIColor',
        'UIFont'
    ])) {
        return;
    }
    var records = createLatencyRecords();
    var cells = createMessageCells(objc, records, createTooltips(objc, fabric));
    settled = cells.settled;
    dispose = applyFeatures('Message Latency', [
        function() {
            return records.clear;
        },
        function() {
            return cells.hook();
        },
        function() {
            return subscribeMessageCreate(records, context);
        },
        function() {
            return patchMessageRowData(records);
        }
    ]);
}
function stop() {
    return _async_to_generator(function() {
        var finished;
        return _ts_generator(this, function(_state) {
            switch(_state.label){
                case 0:
                    finished = dispose();
                    dispose = function dispose() {
                        return undefined;
                    };
                    return [
                        4,
                        finished
                    ];
                case 1:
                    _state.sent();
                    return [
                        4,
                        settled()
                    ];
                case 2:
                    _state.sent();
                    return [
                        2
                    ];
            }
        });
    })();
}
var index = {
    start: start,
    stop: stop,
    getSettingsPanel: function getSettingsPanel() {
        return /*#__PURE__*/ React.createElement(SettingsPanel, null);
    }
};
return index;
})();return this.__plugin;},start(context){const module=this.__load();const plugin=module?.default??module;if(plugin&&typeof plugin.start==='function')return plugin.start(context);},stop(){const module=this.__load();const plugin=module?.default??module;if(plugin&&typeof plugin.stop==='function')return plugin.stop();},getSettingsPanel(...args){const module=this.__load();const plugin=module?.default??module;const settingsPanel=plugin?.getSettingsPanel??module?.getSettingsPanel;if(typeof settingsPanel==='function')return settingsPanel.apply(plugin,args);return null;}})