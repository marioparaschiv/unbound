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
}/**
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
}function _array_like_to_array$a(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_without_holes$6(arr) {
    if (Array.isArray(arr)) return _array_like_to_array$a(arr);
}
function asyncGeneratorStep$6(gen, resolve, reject, _next, _throw, key, arg) {
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
function _iterable_to_array$6(iter) {
    if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) {
        return Array.from(iter);
    }
}
function _non_iterable_spread$6() {
    throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _to_consumable_array$6(arr) {
    return _array_without_holes$6(arr) || _iterable_to_array$6(arr) || _unsupported_iterable_to_array$a(arr) || _non_iterable_spread$6();
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
function _type_of$4(obj) {
    "@swc/helpers - typeof";
    return obj && typeof Symbol !== "undefined" && obj.constructor === Symbol ? "symbol" : typeof obj;
}
function _unsupported_iterable_to_array$a(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _array_like_to_array$a(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(n);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _array_like_to_array$a(o, minLen);
}
var ATTACHMENT_CHARACTER = '￼';
var MESSAGE_TEXT_VIEW_CLASSES = [
    'DCDAttributedTextView',
    'DCDReusableYYLabel'
];
var INVISIBLE_FORMATTING = new Set([
    '​',
    '⁠',
    '⁨',
    '⁩',
    '﻿'
]);
var TAPPABLE_KEYS = [
    'YYTextHighlight',
    'ContentNodeAttribute:TappableHighlight'
];
var ATTACHMENT_KEYS = [
    'YYTextAttachment',
    'NSAttachment'
];
var VALUE_TYPES = new Set([
    'bigint',
    'boolean',
    'number',
    'object',
    'string',
    'undefined'
]);
function isTextAttachmentValue(value) {
    return value === null || VALUE_TYPES.has(typeof value === "undefined" ? "undefined" : _type_of$4(value));
}
/**
 * @description Wraps a plugin's Objective-C bridge for building attachments, returning `null` instead of throwing.
 * @param objc The plugin's Objective-C bridge.
 * @returns The attachment bridge.
 */ function textAttachmentBridge(objc) {
    return {
        call: function call(target, selector) {
            for(var _len = arguments.length, args = new Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++){
                args[_key - 2] = arguments[_key];
            }
            var result = safeInvoke.apply(void 0, [
                objc,
                target,
                selector
            ].concat(_to_consumable_array$6(args)));
            return isTextAttachmentValue(result) ? result : null;
        },
        getClass: function getClass(name) {
            return objc.getClass(name);
        },
        alloc: function alloc(classOrName) {
            return objc.alloc(classOrName);
        },
        struct: function struct(name, value) {
            return objc.struct(name, value);
        },
        callAsync: function callAsync(target, selector) {
            for(var _len = arguments.length, args = new Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++){
                args[_key - 2] = arguments[_key];
            }
            return _async_to_generator$6(function() {
                var result;
                return _ts_generator$6(this, function(_state) {
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
                                objc.invokeAsync(target, selector, args)
                            ];
                        case 1:
                            result = _state.sent();
                            return [
                                2,
                                isTextAttachmentValue(result) ? result : null
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
        }
    };
}
/**
 * @description Tells which layout engine a message text view uses.
 * @param bridge The attachment bridge.
 * @param view The message text view.
 * @returns `textkit` for Discord's `UITextView` based view, otherwise `yytext`.
 */ function textEngine(bridge, view) {
    var textView = bridge.getClass('UITextView');
    if (textView && bridge.call(view, 'isKindOfClass:', textView) === true) {
        return 'textkit';
    }
    return 'yytext';
}
/**
 * @description Tells whether a character ends a run, counting Discord's invisible formatting characters.
 * @param character The character after the run, or `undefined` at the end of the text.
 * @returns Whether the run ends there.
 */ function isTextBoundary(character) {
    return !character || INVISIBLE_FORMATTING.has(character) || RegExp("\\s", "u").test(character);
}
function hasAny(attributes, keys) {
    if (!attributes || (typeof attributes === "undefined" ? "undefined" : _type_of$4(attributes)) !== 'object') {
        return false;
    }
    return keys.some(function(key) {
        return Boolean(attributes[key]);
    });
}
/**
 * @description Tells whether a run is something Discord made tappable, such as a mention or a link.
 * @template T The attributes' shape.
 * @param attributes The run's attributes.
 * @returns Whether either engine marked the run tappable.
 */ function isTappableRun(attributes) {
    return hasAny(attributes, TAPPABLE_KEYS);
}
/**
 * @description Tells whether a run is an attachment, such as an image a previous pass inserted.
 * @template T The attributes' shape.
 * @param attributes The run's attributes.
 * @returns Whether either engine marked the run as an attachment.
 */ function isAttachmentRun(attributes) {
    return hasAny(attributes, ATTACHMENT_KEYS);
}
function numeric(value) {
    if ((typeof value === "undefined" ? "undefined" : _type_of$4(value)) === 'bigint') {
        return Number(value);
    }
    return typeof value === 'number' ? value : Number(value) || 0;
}
function fontOf(attributes) {
    var font = attributes.NSFont;
    return font !== null && (typeof font === "undefined" ? "undefined" : _type_of$4(font)) === 'object' ? font : undefined;
}
function range(bridge, location, length) {
    return bridge.struct('NSRange', {
        location: location,
        length: length
    });
}
function textKitImage(bridge, options) {
    if (!bridge.getClass('NSTextAttachment')) {
        return null;
    }
    var attributes = options.attributes, image = options.image, size = options.size, _options_trailing = options.trailing, trailing = _options_trailing === void 0 ? 0 : _options_trailing;
    var font = fontOf(attributes);
    var capHeight = font ? numeric(bridge.call(font, 'capHeight')) : 0;
    var attachment = bridge.alloc('NSTextAttachment');
    bridge.call(attachment, 'init');
    bridge.call(attachment, 'setImage:', image);
    bridge.call(attachment, 'setBounds:', bridge.struct('CGRect', {
        origin: {
            x: 0,
            y: (capHeight - size) / 2
        },
        size: {
            width: size,
            height: size
        }
    }));
    var result = bridge.alloc('NSMutableAttributedString');
    bridge.call(result, 'initWithString:attributes:', ATTACHMENT_CHARACTER, attributes);
    bridge.call(result, 'addAttribute:value:range:', 'NSAttachment', attachment, range(bridge, 0, 1));
    if (trailing > 0) {
        bridge.call(result, 'addAttribute:value:range:', 'NSKern', trailing, range(bridge, 0, 1));
    }
    return result;
}
function yyTextImage(bridge, options) {
    if (!bridge.getClass('YYTextAttachment')) {
        return null;
    }
    var attributes = options.attributes, image = options.image, size = options.size, _options_leading = options.leading, leading = _options_leading === void 0 ? 0 : _options_leading, _options_trailing = options.trailing, trailing = _options_trailing === void 0 ? 0 : _options_trailing;
    var attachment = bridge.alloc('YYTextAttachment');
    bridge.call(attachment, 'setValue:forKey:', image, 'content');
    bridge.call(attachment, 'setValue:forKey:', 1, 'contentMode');
    bridge.call(attachment, 'setValue:forKey:', bridge.struct('UIEdgeInsets', {
        top: 0,
        left: leading,
        bottom: 0,
        right: trailing
    }), 'contentInsets');
    var result = bridge.alloc('NSMutableAttributedString');
    bridge.call(result, 'initWithString:attributes:', ATTACHMENT_CHARACTER, attributes);
    bridge.call(result, 'addAttribute:value:range:', 'YYTextAttachment', attachment, range(bridge, 0, 1));
    var font = fontOf(attributes);
    if (!font || !bridge.getClass('YYTextRunDelegate')) {
        return result;
    }
    var delegate = bridge.alloc('YYTextRunDelegate');
    bridge.call(delegate, 'setValue:forKey:', numeric(bridge.call(font, 'ascender')), 'ascent');
    bridge.call(delegate, 'setValue:forKey:', -numeric(bridge.call(font, 'descender')), 'descent');
    bridge.call(delegate, 'setValue:forKey:', leading + size + trailing, 'width');
    var runDelegate = bridge.call(delegate, 'CTRunDelegate');
    if (runDelegate) {
        bridge.call(result, 'addAttribute:value:range:', 'CTRunDelegate', runDelegate, range(bridge, 0, 1));
    }
    return result;
}
/**
 * @description Builds a one-character attributed string that draws an image inline with message text.
 * @param bridge The attachment bridge.
 * @param engine The text view's layout engine.
 * @param options The image, its size and spacing, and the surrounding text's attributes.
 * @returns The attributed string to insert, or `null` when the engine's attachment class is missing.
 */ function imageAttachment(bridge, engine, options) {
    return engine === 'textkit' ? textKitImage(bridge, options) : yyTextImage(bridge, options);
}function _array_like_to_array$9(arr, len) {
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
 * @description Hooks `DCDMessageTableViewCell` as it appears, lays out and is reused, installing all three hooks or none.
 * @param objc The Objective-C bridge from `context.native`.
 * @param handlers Called from each hook with the cell.
 * @returns A function that removes the hooks and drops window checks still in flight.
 */ function hookMessageCells(objc, param) {
    var shown = param.shown, laidOut = param.laidOut, reused = param.reused, textChanged = param.textChanged;
    var controller = new AbortController();
    var hooks = [];
    function unhook() {
        controller.abort();
        var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
        try {
            for(var _iterator = hooks.splice(0)[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                var hook = _step.value;
                hook.remove();
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
    try {
        hooks.push(objc.hook('DCDMessageTableViewCell', 'didMoveToWindow', {
            after: function after(param) {
                var self = param.self;
                // `window` is read asynchronously so the hook does not block on the main thread.
                void objc.invokeAsync(self, 'window', []).then(function(window) {
                    if (window && !controller.signal.aborted) {
                        shown(self);
                    }
                }).catch(function() {
                    return undefined;
                });
            }
        }), objc.hook('DCDMessageTableViewCell', 'layoutSubviews', {
            after: function after(param) {
                var self = param.self;
                return laidOut(self);
            }
        }), objc.hook('DCDMessageTableViewCell', 'prepareForReuse', {
            after: function after(param) {
                var self = param.self;
                return reused(self);
            }
        }));
        if (textChanged) {
            var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
            try {
                for(var _iterator = MESSAGE_TEXT_VIEW_CLASSES[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                    var className = _step.value;
                    if (!objc.getClass(className)) {
                        continue;
                    }
                    hooks.push(objc.hook(className, 'setAttributedText:', {
                        after: function after(param) {
                            var self = param.self;
                            void objc.findViews(self, 'DCDMessageTableViewCell', {
                                direction: 'ancestors',
                                maxDepth: 16,
                                maxResults: 1,
                                stopAtMatch: true
                            }).then(function(param) {
                                var _param = _sliced_to_array$5(param, 1), cell = _param[0];
                                if (cell && !controller.signal.aborted) {
                                    textChanged(cell);
                                }
                            }).catch(function() {
                                return undefined;
                            });
                        }
                    }));
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
    } catch (error) {
        unhook();
        throw error;
    }
    return unhook;
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
 * @description Tags a boolean as a Java `boolean`.
 * @param value The boolean.
 * @returns The tagged value.
 */ function javaBoolean(value) {
    return {
        type: 'boolean',
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
var draweeTextBuilder$1 = {
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
var shapes = {
	messageBind: messageBind,
	messageTagBind: messageTagBind,
	messageId: messageId,
	draweeTextBuilder: draweeTextBuilder$1,
	blockBackgroundSpan: blockBackgroundSpan,
	reactionEmoji: reactionEmoji
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
    return shape;
}
function ownerOf(name, className) {
    var owner = DISCORD_SHAPES[name].owner;
    return owner;
}
function matchesParameters(shape, parameters) {
    if (shape.firstParameter !== undefined && parameters[0] !== shape.firstParameter) {
        return false;
    }
    if (parameters.length !== shape.parameterCount) {
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
    var shape = shapeOf(name);
    var matches = describeJavaClass(java, ownerOf(name)).methods.filter(function(method) {
        return matchesMember(shape, method) && matchesParameters(shape, method.parameters);
    });
    return pick(shape, matches, function(method) {
        return method.parameters;
    });
}var DRAWEE_TEXT_SETTER = 'setDraweeSpanStringBuilder';
/**
 * @description Finds the span builder class that Discord's drawee text views take. Fresco's class is obfuscated on newer builds, but it stays the only parameter of the setter.
 * @param java The Java bridge.
 * @returns The builder's class name.
 */ function draweeTextBuilder(java) {
    var _shapeMethod;
    var builder = (_shapeMethod = shapeMethod(java, 'draweeTextBuilder')) === null || _shapeMethod === void 0 ? void 0 : _shapeMethod.parameters[0];
    if (!builder) {
        throw new Error('This Discord build has no single drawee span text builder setter.');
    }
    return builder;
}var ANTI_ALIAS_FLAG = 1;
function encodeBase64(bytes) {
    var binary = '';
    var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
    try {
        for(var _iterator = bytes[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
            var byte = _step.value;
            binary += String.fromCharCode(byte);
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
    return btoa(binary);
}
function enumValue(java, className, name) {
    return javaReference(java.invoke(java.getClass(className), 'valueOf', [
        javaString(name)
    ]));
}
/**
 * @description Decodes image bytes into an Android `Bitmap`.
 * @param java The plugin's Java bridge.
 * @param bytes The encoded image, such as a PNG or WebP.
 * @returns The bitmap, or `null` when Android could not decode it.
 */ function decodeBitmap(java, bytes) {
    var data = javaReference(java.invoke(java.getClass('android.util.Base64'), 'decode', [
        javaString(encodeBase64(bytes)),
        javaInt(0)
    ]));
    if (!data) return null;
    return javaReference(java.invoke(java.getClass('android.graphics.BitmapFactory'), 'decodeByteArray', [
        data,
        javaInt(0),
        javaInt(bytes.length)
    ]));
}
/**
 * @description Scales a bitmap into a square and clips it to a circle.
 * @param java The plugin's Java bridge.
 * @param source The bitmap.
 * @param size The side of the result, in pixels.
 * @returns The circular bitmap, or `null` when a step failed.
 */ function circularBitmap(java, source, size) {
    var Bitmap = java.getClass('android.graphics.Bitmap');
    var scaled = javaReference(java.invoke(Bitmap, 'createScaledBitmap', [
        source,
        javaInt(size),
        javaInt(size),
        javaBoolean(true)
    ]));
    var config = enumValue(java, 'android.graphics.Bitmap$Config', 'ARGB_8888');
    var clamp = enumValue(java, 'android.graphics.Shader$TileMode', 'CLAMP');
    if (!scaled || !config || !clamp) return null;
    var result = javaReference(java.invoke(Bitmap, 'createBitmap', [
        javaInt(size),
        javaInt(size),
        config
    ]));
    if (!result) return null;
    var canvas = java.construct('android.graphics.Canvas', [
        result
    ]);
    var paint = java.construct('android.graphics.Paint', [
        javaInt(ANTI_ALIAS_FLAG)
    ]);
    var radius = javaFloat(size / 2);
    java.invoke(paint, 'setShader', [
        java.construct('android.graphics.BitmapShader', [
            scaled,
            clamp,
            clamp
        ])
    ]);
    java.invoke(canvas, 'drawCircle', [
        radius,
        radius,
        radius,
        paint
    ]);
    return result;
}
/**
 * @description Wraps a bitmap in a drawable sized for inline text.
 * @param java The plugin's Java bridge.
 * @param resources The text view's `Resources`.
 * @param bitmap The bitmap.
 * @param size The drawable's side, in pixels.
 * @returns The `BitmapDrawable`.
 */ function inlineDrawable(java, resources, bitmap, size) {
    var drawable = java.construct('android.graphics.drawable.BitmapDrawable', [
        resources,
        bitmap
    ]);
    java.invoke(drawable, 'setBounds', [
        javaInt(0),
        javaInt(0),
        javaInt(size),
        javaInt(size)
    ]);
    return drawable;
}/**
 * @description Reads a text view's text and its plain string.
 * @param java The plugin's Java bridge.
 * @param view The `TextView`.
 * @returns The `CharSequence` and its string, or `null` when the view has no text.
 */ function readViewText(java, view) {
    var text = javaReference(java.invoke(view, 'getText', []));
    var string = text ? javaText(java.invoke(text, 'toString', [])) : undefined;
    return text && string !== undefined ? {
        text: text,
        string: string
    } : null;
}
/**
 * @description Lists the spans of one class over a whole `Spanned`, with their ranges and flags.
 * @param java The plugin's Java bridge.
 * @param text The `Spanned`.
 * @param length The text's length.
 * @param className The span class, such as `android.text.style.ForegroundColorSpan`.
 * @returns Each span in the order Android reports them.
 */ function spansOf(java, text, length, className) {
    var _javaNumber;
    var reflection = java.getClass('java.lang.reflect.Array');
    var spans = javaReference(java.invoke(text, 'getSpans', [
        javaInt(0),
        javaInt(length),
        java.getClass(className)
    ]));
    var count = spans ? (_javaNumber = javaNumber(java.invoke(reflection, 'getLength', [
        spans
    ]))) !== null && _javaNumber !== void 0 ? _javaNumber : 0 : 0;
    var hits = [];
    for(var position = 0; spans && position < count; position++){
        var _javaNumber1, _javaNumber2, _javaNumber3;
        var span = javaReference(java.invoke(reflection, 'get', [
            spans,
            javaInt(position)
        ]));
        if (!span) {
            continue;
        }
        hits.push({
            span: span,
            start: (_javaNumber1 = javaNumber(java.invoke(text, 'getSpanStart', [
                span
            ]))) !== null && _javaNumber1 !== void 0 ? _javaNumber1 : -1,
            end: (_javaNumber2 = javaNumber(java.invoke(text, 'getSpanEnd', [
                span
            ]))) !== null && _javaNumber2 !== void 0 ? _javaNumber2 : -1,
            flags: (_javaNumber3 = javaNumber(java.invoke(text, 'getSpanFlags', [
                span
            ]))) !== null && _javaNumber3 !== void 0 ? _javaNumber3 : 0
        });
    }
    return hits;
}var RETRY_DELAY_MS = 60;
var MAX_RETRIES = 5;
/**
 * @description Retries a text rewrite another plugin's rule declined, once the view shows that plugin's rewritten text to build on.
 * @returns `retry` schedules another attempt for a view, up to five; `succeeded` and `clear` forget the attempts.
 */ function createRewriteRetry() {
    var attempts = new Map();
    var timers = new Set();
    return {
        retry: function retry(key, run) {
            var _attempts_get;
            var count = ((_attempts_get = attempts.get(key)) !== null && _attempts_get !== void 0 ? _attempts_get : 0) + 1;
            if (count > MAX_RETRIES) return;
            attempts.set(key, count);
            var timer = setTimeout(function() {
                timers.delete(timer);
                run();
            }, RETRY_DELAY_MS);
            timers.add(timer);
        },
        succeeded: function succeeded(key) {
            attempts.delete(key);
        },
        clear: function clear() {
            var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
            try {
                for(var _iterator = timers[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                    var timer = _step.value;
                    clearTimeout(timer);
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
            timers.clear();
            attempts.clear();
        }
    };
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
}var TEXT_REWRITES_CLASS = 'app.unbound.android.TextRewrites';
/**
 * @description Connects to the loader's native text rewrites. They apply a plugin's text edits while Discord sets a message's text, and move, show, hide and position the plugin's host views in the same step, so a recycled chat row never shows Discord's original text or another message's view.
 * @param java The plugin's Java bridge.
 * @param watchedClass The text view class whose text is rewritten, such as Discord's message content view.
 * @returns The rewrites, or `null` when the installed loader predates them.
 */ function connectTextRewrites(java, watchedClass) {
    var instance = null;
    try {
        instance = javaReference(java.getField(java.getClass(TEXT_REWRITES_CLASS), 'INSTANCE'));
    } catch (unused) {
        return null;
    }
    if (!instance) return null;
    var target = instance;
    function call(method, args) {
        java.invoke(target, method, args);
    }
    call('watch', [
        javaString(watchedClass)
    ]);
    return {
        put: function put(original, rendered, edits) {
            return javaFlag(java.invoke(target, 'put', [
                javaString(original),
                javaString(rendered),
                javaString(JSON.stringify(edits))
            ]));
        },
        remove: function remove(original) {
            return call('remove', [
                javaString(original)
            ]);
        },
        putImage: function putImage(key, bitmap) {
            return call('putImage', [
                javaString(key),
                bitmap
            ]);
        },
        hasImage: function hasImage(key) {
            return javaFlag(java.invoke(target, 'hasImage', [
                javaString(key)
            ]));
        },
        addHost: function addHost(groupId, rendered, host, anchor) {
            return call('addHost', [
                javaString(groupId),
                javaString(rendered),
                host,
                javaString(JSON.stringify(anchor))
            ]);
        },
        updateAnchor: function updateAnchor(host, anchor) {
            return call('updateAnchor', [
                host,
                javaString(JSON.stringify(anchor))
            ]);
        },
        removeGroup: function removeGroup(groupId) {
            return call('removeGroup', [
                javaString(groupId)
            ]);
        },
        reapply: function reapply(textView) {
            return call('reapply', [
                textView
            ]);
        },
        refresh: function refresh(rendered) {
            return call('refresh', [
                javaString(rendered)
            ]);
        },
        refreshAll: function refreshAll() {
            return call('refreshAll', []);
        }
    };
}function _array_like_to_array$7(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_without_holes$4(arr) {
    if (Array.isArray(arr)) return _array_like_to_array$7(arr);
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
function _unsupported_iterable_to_array$7(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _array_like_to_array$7(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(n);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _array_like_to_array$7(o, minLen);
}
// Discord wraps mention labels in first-strong isolate marks (U+2068, U+2069).
function endsMention(next) {
    return isTextBoundary(next);
}
/**
 * @description Finds the user and role mentions in raw message content, in order.
 * @param content The message's raw content, such as `Hi <@123> and <@&456>`.
 * @returns One token per mention.
 */ function extractMentionTokens(content) {
    return _to_consumable_array$4(content.matchAll(/<@!?([0-9]+)>|<@&([0-9]+)>/g)).map(function(match) {
        var _match_;
        return {
            id: (_match_ = match[1]) !== null && _match_ !== void 0 ? _match_ : match[2],
            type: match[1] ? 'user' : 'role'
        };
    });
}
/**
 * @description Picks the label a rendered mention shows, preferring the longest complete match.
 * @param text Rendered text starting at or before the mention's `@`.
 * @param labels The names the mention may render as.
 * @returns The matching label, or `undefined` when none fits.
 */ function selectMentionLabel(text, labels) {
    var atOffset = text.indexOf('@');
    if (atOffset === -1) return;
    var mentionText = text.slice(atOffset);
    return _to_consumable_array$4(labels).sort(function(left, right) {
        return right.length - left.length;
    }).find(function(label) {
        var prefix = "@".concat(label);
        return mentionText.startsWith(prefix) && endsMention(mentionText[prefix.length]);
    });
}
/**
 * @description Checks that every mention appears as a complete `@label` somewhere in the text.
 * @param value The rendered text.
 * @param mentions The mentions to look for.
 * @returns `true` when each mention has a label rendered in full.
 */ function containsMentionText(value, mentions) {
    return mentions.every(function(param) {
        var labels = param.labels;
        return labels.some(function(label) {
            var prefix = "@".concat(label);
            for(var index = value.indexOf(prefix); index !== -1;){
                if (endsMention(value[index + prefix.length])) return true;
                index = value.indexOf(prefix, index + 1);
            }
            return false;
        });
    });
}
/**
 * @description Picks the image for a role mention: its custom icon, else its color for a tinted symbol.
 * @param role The guild role.
 * @returns The role icon URL and the role color, each when present.
 */ function roleImageSource(role) {
    return {
        avatarURL: role.icon ? "https://cdn.discordapp.com/role-icons/".concat(role.id, "/").concat(role.icon, ".png?size=32&quality=lossless") : undefined,
        roleColor: typeof role.color === 'number' && role.color > 0 ? role.color : undefined
    };
}
/**
 * @description Rewrites a Discord CDN image URL to a 32px PNG, which UIImage can decode.
 * @param url The image URL.
 * @returns The PNG URL with `size=32`.
 */ function avatarPngURL(url) {
    var png = url.replace(/\.webp(?=\?|$)/, '.png');
    if (/[?&]size=\d+/.test(png)) return png.replace(/([?&]size=)\d+/, function(_, prefix) {
        return "".concat(prefix, "32");
    });
    return "".concat(png).concat(png.includes('?') ? '&' : '?', "size=32");
}var IMAGE_CHARACTER = '￼';
var IMAGE_PADDING = ' ';
var PADDED_IMAGE = "".concat(IMAGE_PADDING).concat(IMAGE_CHARACTER).concat(IMAGE_PADDING);
function isDecorated(text, range) {
    return text.slice(range.start - PADDED_IMAGE.length, range.start) === PADDED_IMAGE || text.slice(range.end, range.end + PADDED_IMAGE.length) === PADDED_IMAGE;
}
function mentionAt(text, range, mentions) {
    var rendered = text.slice(range.start, range.end);
    return mentions.find(function(mention) {
        var label = selectMentionLabel(rendered, mention.labels);
        return label !== undefined && "@".concat(label) === rendered;
    });
}
function placementFor(mention, range, showAtSymbol) {
    if (mention.type === 'role') {
        return {
            mention: mention,
            range: range,
            replaceStart: range.end,
            replaceEnd: range.end,
            insertion: PADDED_IMAGE,
            imageOffset: 1
        };
    }
    return {
        mention: mention,
        range: range,
        replaceStart: range.start,
        replaceEnd: showAtSymbol ? range.start : range.start + 1,
        insertion: PADDED_IMAGE,
        imageOffset: 1
    };
}
/**
 * @description Plans where an image goes beside each mention Discord rendered as a tappable span.
 * @param text The message text.
 * @param tappable The ranges of the text's tappable spans.
 * @param mentions The mentions that may appear in the text.
 * @param showAtSymbol Whether a user mention keeps its `@` beside the image.
 * @returns One placement per recognised mention not decorated yet, last first so applying them in order keeps earlier ranges valid.
 */ function planPlacements(text, tappable, mentions, showAtSymbol) {
    var placements = [];
    var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
    try {
        for(var _iterator = tappable[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
            var range = _step.value;
            if (text[range.start] !== '@' || isDecorated(text, range)) continue;
            var mention = mentionAt(text, range, mentions);
            if (mention) placements.push(placementFor(mention, range, showAtSymbol));
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
    return placements.sort(function(left, right) {
        return right.replaceStart - left.replaceStart;
    });
}function asyncGeneratorStep$5(gen, resolve, reject, _next, _throw, key, arg) {
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
var TEXT_VIEW = 'com.facebook.drawee.span.SimpleDraweeSpanTextView';
var TAPPABLE_SPAN = 'android.text.style.ClickableSpan';
var ANY_SPAN = 'java.lang.Object';
var IMAGE_SIZE = 16;
var ALIGN_CENTER = 2;
var SPAN_EXCLUSIVE_EXCLUSIVE = 33;
var MAX_IMAGE_BYTES = 12000;
var MAX_TRACKED_VIEWS = 64;
function viewKey$1(view) {
    return view.type === 'handle' ? view.value : undefined;
}
/**
 * @description Creates the renderer that draws mention images into Discord's Android message text.
 * @param native The plugin's Java and hook bridges.
 * @param index The mention index the renderer reads.
 * @param showAtSymbol Reads whether a user mention keeps its `@` beside the image.
 * @returns The renderer, whose `dispose` removes its hook.
 */ function createAndroidRenderer(param, index, showAtSymbol) {
    var java = param.java, hooks = param.hooks;
    var images = new Map();
    var views = new Map();
    var pending = new Set();
    var imageSize = 0;
    var disposed = false;
    var rewrites = connectTextRewrites(java, TEXT_VIEW);
    var rules = new Set();
    var retries = createRewriteRetry();
    var renderedTexts = new Set();
    var registered = new Set();
    function sizeFor(view, resources) {
        var _javaNumber;
        if (imageSize > 0) return imageSize;
        var metrics = javaReference(java.invoke(resources, 'getDisplayMetrics'));
        var density = metrics ? (_javaNumber = javaNumber(java.getField(metrics, 'density'))) !== null && _javaNumber !== void 0 ? _javaNumber : 1 : 1;
        imageSize = Math.round(IMAGE_SIZE * density);
        return imageSize;
    }
    function load(url) {
        return _async_to_generator$5(function() {
            var bitmap, response, bytes, _tmp, _, source, _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, view;
            return _ts_generator$5(this, function(_state) {
                switch(_state.label){
                    case 0:
                        images.set(url, {
                            bitmap: null,
                            pending: true
                        });
                        bitmap = null;
                        _state.label = 1;
                    case 1:
                        _state.trys.push([
                            1,
                            6,
                            ,
                            7
                        ]);
                        return [
                            4,
                            fetch(url)
                        ];
                    case 2:
                        response = _state.sent();
                        if (!response.ok) return [
                            3,
                            4
                        ];
                        _ = Uint8Array.bind;
                        return [
                            4,
                            response.arrayBuffer()
                        ];
                    case 3:
                        _tmp = new (_.apply(Uint8Array, [
                            void 0,
                            _state.sent()
                        ]));
                        return [
                            3,
                            5
                        ];
                    case 4:
                        _tmp = null;
                        _state.label = 5;
                    case 5:
                        bytes = _tmp;
                        source = bytes && bytes.length <= MAX_IMAGE_BYTES ? decodeBitmap(java, bytes) : null;
                        bitmap = source && imageSize > 0 ? circularBitmap(java, source, imageSize) : null;
                        return [
                            3,
                            7
                        ];
                    case 6:
                        _state.sent();
                        bitmap = null;
                        return [
                            3,
                            7
                        ];
                    case 7:
                        if (disposed) return [
                            2
                        ];
                        images.set(url, {
                            bitmap: bitmap,
                            pending: false
                        });
                        if (bitmap) {
                            _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
                            try {
                                for(_iterator = views.values()[Symbol.iterator](); !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                                    view = _step.value;
                                    schedule(view);
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
                        return [
                            2
                        ];
                }
            });
        })();
    }
    function bitmapFor(mention) {
        var _ref;
        var url = mention.avatarURL;
        if (!(url === null || url === void 0 ? void 0 : url.startsWith('https://'))) return null;
        var entry = images.get(url);
        if (!entry) void load(url);
        return (_ref = entry === null || entry === void 0 ? void 0 : entry.bitmap) !== null && _ref !== void 0 ? _ref : null;
    }
    function isTappable(span) {
        return javaFlag(java.invoke(java.getClass(TAPPABLE_SPAN), 'isInstance', [
            span
        ]));
    }
    function overlappingSpans(builder, range) {
        var _javaNumber;
        var length = (_javaNumber = javaNumber(java.invoke(builder, 'length'))) !== null && _javaNumber !== void 0 ? _javaNumber : 0;
        return spansOf(java, builder, length, ANY_SPAN).filter(function(hit) {
            return hit.start < range.end && hit.end > range.start;
        });
    }
    function apply(builder, resources, placement, bitmap) {
        var range = placement.range, replaceStart = placement.replaceStart, replaceEnd = placement.replaceEnd, insertion = placement.insertion, imageOffset = placement.imageOffset;
        var spans = overlappingSpans(builder, range);
        var grown = insertion.length - (replaceEnd - replaceStart);
        java.invoke(builder, 'replace', [
            javaInt(replaceStart),
            javaInt(replaceEnd),
            javaString(insertion)
        ]);
        var image = replaceStart + imageOffset;
        var span = java.construct('android.text.style.ImageSpan', [
            inlineDrawable(java, resources, bitmap, imageSize),
            javaInt(ALIGN_CENTER)
        ]);
        java.invoke(builder, 'setSpan', [
            span,
            javaInt(image),
            javaInt(image + 1),
            javaInt(SPAN_EXCLUSIVE_EXCLUSIVE)
        ]);
        var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
        try {
            for(var _iterator = spans[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                var _step_value = _step.value, existing = _step_value.span, flags = _step_value.flags;
                var _javaNumber, _javaNumber1;
                var spanStart = (_javaNumber = javaNumber(java.invoke(builder, 'getSpanStart', [
                    existing
                ]))) !== null && _javaNumber !== void 0 ? _javaNumber : -1;
                var spanEnd = (_javaNumber1 = javaNumber(java.invoke(builder, 'getSpanEnd', [
                    existing
                ]))) !== null && _javaNumber1 !== void 0 ? _javaNumber1 : -1;
                var stretched = isTappable(existing) || spanStart === range.start && spanEnd === range.end;
                var start = stretched ? range.start : spanStart;
                var end = stretched ? range.end + grown : spanEnd;
                java.invoke(builder, 'removeSpan', [
                    existing
                ]);
                if (start >= 0 && end > start) {
                    java.invoke(builder, 'setSpan', [
                        existing,
                        javaInt(start),
                        javaInt(end),
                        javaInt(flags)
                    ]);
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
    }
    function rewriteNatively(view, original, ready) {
        var active = rewrites;
        var rendered = original;
        var edits = [];
        var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
        try {
            for(var _iterator = ready[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                var _step_value = _step.value, placement = _step_value.placement, bitmap = _step_value.bitmap;
                var key = placement.mention.avatarURL;
                if (!registered.has(key) || !active.hasImage(key)) {
                    active.putImage(key, bitmap);
                    registered.add(key);
                }
                rendered = rendered.slice(0, placement.replaceStart) + placement.insertion + rendered.slice(placement.replaceEnd);
                edits.push({
                    start: placement.replaceStart,
                    end: placement.replaceEnd,
                    text: placement.insertion,
                    imageKey: key,
                    imageOffset: placement.imageOffset,
                    imageSize: imageSize,
                    stretchFrom: placement.range.start,
                    stretchTo: placement.range.end,
                    stretchClasses: [
                        TAPPABLE_SPAN
                    ]
                });
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
        var key1 = viewKey$1(view);
        if (!active.put(original, rendered, edits)) {
            active.reapply(view);
            if (key1) retries.retry(key1, function() {
                return schedule(view);
            });
            return;
        }
        if (key1) retries.succeeded(key1);
        rules.add(original);
        renderedTexts.add(rendered);
        active.reapply(view);
    }
    function render(view) {
        var content = readViewText(java, view);
        if (!(content === null || content === void 0 ? void 0 : content.string.includes('@')) || renderedTexts.has(content.string)) return;
        var text = content.text, string = content.string;
        index.hydrateChannel();
        var mentions = index.all();
        if (!mentions.length) return;
        var tappable = spansOf(java, text, string.length, TAPPABLE_SPAN);
        var placements = planPlacements(string, tappable, mentions, showAtSymbol());
        if (!placements.length) return;
        var resources = javaReference(java.invoke(view, 'getResources'));
        if (!resources) return;
        sizeFor(view, resources);
        var ready = placements.map(function(placement) {
            return {
                placement: placement,
                bitmap: bitmapFor(placement.mention)
            };
        }).filter(function(entry) {
            return Boolean(entry.bitmap);
        });
        if (!ready.length) return;
        if (rewrites) {
            rewriteNatively(view, string, ready);
            return;
        }
        var builder = java.construct('android.text.SpannableStringBuilder', [
            text
        ]);
        var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
        try {
            for(var _iterator = ready[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                var _step_value = _step.value, placement = _step_value.placement, bitmap = _step_value.bitmap;
                apply(builder, resources, placement, bitmap);
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
        void java.invokeAsync(view, 'setText', [
            builder
        ]).catch(function() {
            return undefined;
        });
    }
    function track(key, view) {
        views.delete(key);
        views.set(key, view);
        if (views.size > MAX_TRACKED_VIEWS) views.delete(views.keys().next().value);
    }
    function schedule(view) {
        var key = viewKey$1(view);
        if (disposed || !key || pending.has(key)) return;
        pending.add(key);
        track(key, view);
        setTimeout(function() {
            pending.delete(key);
            if (disposed) return;
            try {
                render(view);
            } catch (unused) {
                views.delete(key);
            }
        }, 0);
    }
    var textBuilder = draweeTextBuilder(java);
    var token = hooks.hook(TEXT_VIEW, DRAWEE_TEXT_SETTER, [
        textBuilder
    ], {
        notify: true
    }, function(param) {
        var self = param.self;
        var view = javaReference(self);
        if (view) schedule(view);
    });
    function scanVisible() {
        var decor = currentDecorView(java);
        if (!decor || disposed) return;
        var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
        try {
            for(var _iterator = findViewsOfClass(java, decor, TEXT_VIEW)[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                var view = _step.value;
                schedule(view);
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
            var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
            try {
                for(var _iterator = scans[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                    var scan = _step.value;
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
            retries.clear();
            hooks.remove(token);
            var _iteratorNormalCompletion1 = true, _didIteratorError1 = false, _iteratorError1 = undefined;
            try {
                for(var _iterator1 = rules[Symbol.iterator](), _step1; !(_iteratorNormalCompletion1 = (_step1 = _iterator1.next()).done); _iteratorNormalCompletion1 = true){
                    var original = _step1.value;
                    rewrites === null || rewrites === void 0 ? void 0 : rewrites.remove(original);
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
            if (rules.size) rewrites === null || rewrites === void 0 ? void 0 : rewrites.refreshAll();
            rules.clear();
            renderedTexts.clear();
            views.clear();
            images.clear();
        }
    };
}function _type_of$3(obj) {
    "@swc/helpers - typeof";
    return obj && typeof Symbol !== "undefined" && obj.constructor === Symbol ? "symbol" : typeof obj;
}
// UNKNOWN: `hash` and `description` come back from the bridge untyped.
function scalar(value) {
    if (typeof value === 'number' || (typeof value === "undefined" ? "undefined" : _type_of$3(value)) === 'bigint') {
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
}function _array_like_to_array$6(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_with_holes$4(arr) {
    if (Array.isArray(arr)) return arr;
}
function _array_without_holes$3(arr) {
    if (Array.isArray(arr)) return _array_like_to_array$6(arr);
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
function _non_iterable_spread$3() {
    throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _sliced_to_array$4(arr, i) {
    return _array_with_holes$4(arr) || _iterable_to_array_limit$4(arr, i) || _unsupported_iterable_to_array$6(arr, i) || _non_iterable_rest$4();
}
function _to_consumable_array$3(arr) {
    return _array_without_holes$3(arr) || _iterable_to_array$3(arr) || _unsupported_iterable_to_array$6(arr) || _non_iterable_spread$3();
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
function _type_of$2(obj) {
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
// UNKNOWN: `windows` comes back as a JS array or an `NSArray` handle.
function handles(objc, value) {
    if (Array.isArray(value)) {
        return value;
    }
    if (!value || (typeof value === "undefined" ? "undefined" : _type_of$2(value)) !== 'object') {
        return [];
    }
    return objc.array(value);
}
// Records a key, reporting whether it is new; an unkeyable view always counts as new.
function once(seen, key) {
    if (key === undefined) {
        return true;
    }
    if (seen.has(key)) {
        return false;
    }
    seen.add(key);
    return true;
}
/**
 * @description Finds the cells of a class on screen in every window, for cells that appeared before a plugin hooked them.
 * @param objc The Objective-C bridge from `context.native`.
 * @param className The cell class, such as `DCDMessageTableViewCell`.
 * @param signal Aborts the scan between native calls, when a newer scan or `stop` supersedes it.
 * @returns Each visible cell once, or `[]` when the scan was aborted or a window went away mid-scan.
 */ function findVisibleCells(objc, className, signal) {
    return _async_to_generator$4(function() {
        var UIApplication, _ref, windowList, keyWindow, windows, cells, seen, _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, window, _cells, found, err;
        return _ts_generator$4(this, function(_state) {
            switch(_state.label){
                case 0:
                    UIApplication = objc.getClass('UIApplication');
                    if (!UIApplication) {
                        return [
                            2,
                            []
                        ];
                    }
                    _state.label = 1;
                case 1:
                    _state.trys.push([
                        1,
                        11,
                        ,
                        12
                    ]);
                    return [
                        4,
                        objc.batch([
                            {
                                target: UIApplication,
                                selector: 'sharedApplication',
                                args: []
                            },
                            {
                                target: {
                                    $nativeBatchResult: 0
                                },
                                selector: 'windows',
                                args: []
                            },
                            {
                                target: {
                                    $nativeBatchResult: 0
                                },
                                selector: 'keyWindow',
                                args: []
                            }
                        ])
                    ];
                case 2:
                    _ref = _sliced_to_array$4.apply(void 0, [
                        _state.sent(),
                        3
                    ]), windowList = _ref[1], keyWindow = _ref[2];
                    windows = handles(objc, windowList);
                    if (keyWindow) {
                        windows.push(keyWindow);
                    }
                    cells = [];
                    seen = new Set();
                    _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
                    _state.label = 3;
                case 3:
                    _state.trys.push([
                        3,
                        8,
                        9,
                        10
                    ]);
                    _iterator = windows[Symbol.iterator]();
                    _state.label = 4;
                case 4:
                    if (!!(_iteratorNormalCompletion = (_step = _iterator.next()).done)) return [
                        3,
                        7
                    ];
                    window = _step.value;
                    if (signal === null || signal === void 0 ? void 0 : signal.aborted) {
                        return [
                            2,
                            []
                        ];
                    }
                    // The key window is usually in `windows` too.
                    if (!once(seen, viewKey(objc, window))) {
                        return [
                            3,
                            6
                        ];
                    }
                    return [
                        4,
                        objc.findViews(window, className, {
                            maxDepth: 40,
                            maxVisited: 1600,
                            maxResults: 256,
                            attachedOnly: true,
                            stopAtMatch: true
                        })
                    ];
                case 5:
                    found = _state.sent();
                    (_cells = cells).push.apply(_cells, _to_consumable_array$3(found.filter(function(cell) {
                        return once(seen, viewKey(objc, cell));
                    })));
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
                        (signal === null || signal === void 0 ? void 0 : signal.aborted) ? [] : cells
                    ];
                case 11:
                    _state.sent();
                    return [
                        2,
                        []
                    ];
                case 12:
                    return [
                        2
                    ];
            }
        });
    })();
}function asyncGeneratorStep$3(gen, resolve, reject, _next, _throw, key, arg) {
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
/**
 * @description Finds the message cells already on screen, which no cell hook reports until they lay out again.
 * @param objc The plugin's Objective-C bridge.
 * @param onCell Called with each visible `DCDMessageTableViewCell`.
 * @returns The scanner; `schedule` runs a round of scans and `cancel` stops them.
 */ function createVisibleCellScanner(objc, onCell) {
    var timers = [];
    var current = null;
    // A newer scan supersedes one still in flight.
    function scan() {
        return _async_to_generator$3(function() {
            var signal, _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, cell, err;
            return _ts_generator$3(this, function(_state) {
                switch(_state.label){
                    case 0:
                        current === null || current === void 0 ? void 0 : current.abort();
                        signal = (current = new AbortController()).signal;
                        _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
                        _state.label = 1;
                    case 1:
                        _state.trys.push([
                            1,
                            6,
                            7,
                            8
                        ]);
                        return [
                            4,
                            findVisibleCells(objc, 'DCDMessageTableViewCell', signal)
                        ];
                    case 2:
                        _iterator = _state.sent()[Symbol.iterator]();
                        _state.label = 3;
                    case 3:
                        if (!!(_iteratorNormalCompletion = (_step = _iterator.next()).done)) return [
                            3,
                            5
                        ];
                        cell = _step.value;
                        onCell(cell);
                        _state.label = 4;
                    case 4:
                        _iteratorNormalCompletion = true;
                        return [
                            3,
                            3
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
                        return [
                            2
                        ];
                }
            });
        })();
    }
    function cancel() {
        var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
        try {
            for(var _iterator = timers[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                var timer = _step.value;
                clearTimeout(timer);
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
        timers = [];
        current === null || current === void 0 ? void 0 : current.abort();
        current = null;
    }
    // Cells keep appearing while a channel loads, so scan a few times over three seconds.
    function schedule() {
        cancel();
        timers = [
            0,
            100,
            500,
            1500,
            3000
        ].map(function(delay) {
            return setTimeout(function() {
                return void scan();
            }, delay);
        });
    }
    return {
        schedule: schedule,
        cancel: cancel
    };
}var UserStore = window.unbound.metro.stores.Users;
var ChannelStore = window.unbound.metro.findStore('Channel', {
    lazy: true
});
var MessageStore = window.unbound.metro.findStore('Message', {
    lazy: true
});
var GuildMemberStore = window.unbound.metro.findStore('GuildMember', {
    lazy: true
});
var SelectedChannelStore = window.unbound.metro.findStore('SelectedChannel', {
    lazy: true
});
var RoleStore = window.unbound.metro.findByProps('getRole', 'getSortedRoles', {
    lazy: true
});
var RowGenerator = window.unbound.metro.findByProps('generateMessageRowData', {
    lazy: true
});
var settings = window.unbound.storage.getStore('unbound.mention-avatars');
var Patcher = window.unbound.patcher.createPatcher('unbound.mention-avatars');function selectedChannelId() {
    var _SelectedChannelStore_getChannelId;
    return (_SelectedChannelStore_getChannelId = SelectedChannelStore.getChannelId()) !== null && _SelectedChannelStore_getChannelId !== void 0 ? _SelectedChannelStore_getChannelId : SelectedChannelStore.getLastSelectedChannelId();
}
/**
 * @description Renders the cells on screen now, then starts over in each newly selected channel: restores the old cells and scans the new ones.
 * @param renderer The mention renderer.
 * @param scanner The visible cell scanner.
 * @returns A function that stops listening and cancels pending scans.
 */ function subscribeSelectedChannel(renderer, scanner) {
    var channelId = selectedChannelId();
    // The store also emits for changes that keep the same channel selected.
    function onChange() {
        var next = selectedChannelId();
        if (!next || next === channelId) return;
        channelId = next;
        renderer.clear();
        scanner.schedule();
    }
    SelectedChannelStore.addChangeListener(onChange);
    scanner.schedule();
    return function() {
        SelectedChannelStore.removeChangeListener(onChange);
        scanner.cancel();
    };
}/**
 * @description Indexes each message's mentions as Discord builds its chat row.
 * @param index The mention index to fill.
 * @returns A function that removes the patch.
 */ function patchRowGenerator(index) {
    return Patcher.after(RowGenerator, 'generateMessageRowData', function(param) {
        var args = param.args;
        var _args_;
        index.add((_args_ = args[0]) === null || _args_ === void 0 ? void 0 : _args_.message);
    });
}function _array_like_to_array$5(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_with_holes$3(arr) {
    if (Array.isArray(arr)) return arr;
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
function _type_of$1(obj) {
    "@swc/helpers - typeof";
    return obj && typeof Symbol !== "undefined" && obj.constructor === Symbol ? "symbol" : typeof obj;
}
function _unsupported_iterable_to_array$5(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _array_like_to_array$5(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(n);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _array_like_to_array$5(o, minLen);
}
// UNKNOWN: a value returned by the bridge, which may be a string, a number, or an object handle.
function stringValue(value) {
    if (typeof value === 'string' && value.length > 0) {
        return value;
    }
    if (typeof value === 'number' || (typeof value === "undefined" ? "undefined" : _type_of$1(value)) === 'bigint') {
        return String(value);
    }
}
// UNKNOWN: a value returned by the bridge, read through `description` when it is an object.
function nativeString(value, bridge) {
    return _async_to_generator$2(function() {
        var direct, handle;
        return _ts_generator$2(this, function(_state) {
            switch(_state.label){
                case 0:
                    direct = stringValue(value);
                    if (direct || !value || (typeof value === "undefined" ? "undefined" : _type_of$1(value)) !== 'object') {
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
    return _async_to_generator$2(function() {
        var channelId, channel;
        return _ts_generator$2(this, function(_state) {
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
    return _async_to_generator$2(function() {
        var fallbackChannelId, _ref, viewModel, _ref1, message, id, messageId, channelId, currentViewModel, _tmp;
        return _ts_generator$2(this, function(_state) {
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
                    _ref1 = _sliced_to_array$3.apply(void 0, [
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
}// YYText stores an inline attachment as this object replacement character.
var MENTION_PLACEHOLDER = '\uFFFC';
var PILL_PADDING = '\u2060\u2009\u2060';
var PILL_PADDING_ATTRIBUTE = 'UnboundMentionPadding';function _define_property$1(obj, key, value) {
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
function isInsertedPadding(bridge, text, string, index) {
    var _string_index;
    var _bridge_attributes;
    return PILL_PADDING.includes((_string_index = string[index]) !== null && _string_index !== void 0 ? _string_index : '\uFFFF') && Boolean((_bridge_attributes = bridge.attributes(text, index)) === null || _bridge_attributes === void 0 ? void 0 : _bridge_attributes[PILL_PADDING_ATTRIBUTE]);
}
function isInsertedAvatar(bridge, text, string, index) {
    return string[index] === MENTION_PLACEHOLDER && isAttachmentRun(bridge.attributes(text, index)) || isInsertedPadding(bridge, text, string, index);
}
function isHighlighted(bridge, text, from, to) {
    for(var index = from; index < to; index++){
        if (!isTappableRun(bridge.attributes(text, index))) {
            return false;
        }
    }
    return true;
}
// Finds the next `@label` that Discord rendered as a tappable mention, from `start` on.
function nextMention(bridge, text, string, start, labels) {
    for(var index = string.indexOf('@', start); index !== -1; index = string.indexOf('@', index + 1)){
        var label = selectMentionLabel(string.slice(index), labels);
        var attributes = label ? bridge.attributes(text, index) : null;
        if (!label || !isTappableRun(attributes)) {
            continue;
        }
        if (!isHighlighted(bridge, text, index + 1, index + label.length + 1)) {
            continue;
        }
        var begin = index;
        while(begin > start && (string[begin - 1] === MENTION_PLACEHOLDER || isInsertedPadding(bridge, text, string, begin - 1)) && isTappableRun(bridge.attributes(text, begin - 1))){
            begin--;
        }
        return {
            attributes: attributes,
            begin: begin,
            index: index,
            label: label
        };
    }
    return null;
}
function attributedMention(bridge, engine, text, type, attributes, image) {
    var leading = type === 'role' ? 4 : 2;
    var trailing = type === 'role' ? 2 : 4;
    var mention = bridge.objc.alloc('NSMutableAttributedString');
    bridge.call(mention, 'initWithString:attributes:', text, attributes);
    var avatar = imageAttachment(textAttachmentBridge(bridge.objc), engine, {
        attributes: attributes,
        image: image,
        leading: leading,
        size: 16,
        trailing: engine === 'textkit' ? 0 : trailing
    });
    if (!avatar) return mention;
    var replacement = bridge.objc.alloc('NSMutableAttributedString');
    var parts = type === 'role' ? [
        mention,
        avatar
    ] : [
        avatar,
        mention
    ];
    if (engine === 'textkit') {
        var gap = bridge.objc.alloc('NSMutableAttributedString');
        bridge.call(gap, 'initWithString:attributes:', PILL_PADDING, _object_spread_props$1(_object_spread$1({}, attributes), _define_property$1({}, PILL_PADDING_ATTRIBUTE, true)));
        parts.splice(1, 0, gap);
    }
    bridge.call(replacement, 'init');
    var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
    try {
        for(var _iterator = parts[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
            var part = _step.value;
            bridge.call(replacement, 'appendAttributedString:', part);
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
    return replacement;
}
/**
 * @description Copies attributed message text with an image beside each mention whose image is ready.
 * @param bridge The plugin's native bridge.
 * @param text The original attributed text.
 * @param mentions The message's mentions, in order.
 * @param imageFor Returns a mention's image, or `null` while it is not ready.
 * @param showAtSymbol Whether a mention keeps its `@` beside the image.
 * @returns The new attributed text, or `text` when it cannot be copied.
 */ function insertMentionImages(bridge, engine, text, mentions, imageFor, showAtSymbol) {
    var result = bridge.handle(text, 'mutableCopy');
    if (!result) return text;
    var searchIndex = 0;
    var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
    try {
        for(var _iterator = mentions[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
            var mention = _step.value;
            var string = bridge.string(result, 'string');
            if (string === undefined || searchIndex >= string.length) break;
            var match = nextMention(bridge, result, string, searchIndex, mention.labels);
            if (!match) break;
            var attributes = match.attributes, begin = match.begin, index = match.index, label = match.label;
            var end = index + label.length + 1;
            var image = imageFor(mention);
            if (!image) {
                searchIndex = end;
                continue;
            }
            // Widen the range over images a previous pass inserted, so they are replaced, not doubled.
            var from = index;
            var to = end;
            while(from > begin && isInsertedAvatar(bridge, result, string, from - 1)){
                from--;
            }
            while(isInsertedAvatar(bridge, result, string, to)){
                to++;
            }
            var replacement = attributedMention(bridge, engine, showAtSymbol ? "@".concat(label) : label, mention.type, attributes, image);
            bridge.call(result, 'replaceCharactersInRange:withAttributedString:', bridge.range(from, to - from), replacement);
            searchIndex = from + bridge.number(replacement, 'length');
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
    return result;
}function _array_like_to_array$4(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_with_holes$2(arr) {
    if (Array.isArray(arr)) return arr;
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
function _sliced_to_array$2(arr, i) {
    return _array_with_holes$2(arr) || _iterable_to_array_limit$2(arr, i) || _unsupported_iterable_to_array$4(arr, i) || _non_iterable_rest$2();
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
 * @description Collects the text views under a view, depth-first, at most 40 levels and 1,600 views deep.
 * @param bridge The plugin's native bridge.
 * @param root The view to search.
 * @returns Every view with settable attributed text.
 */ function findTextViews(bridge, root) {
    var objc = bridge.objc;
    var maxDepth = 40;
    var maxVisited = 1600;
    var views = [];
    var pending = [
        [
            root,
            0
        ]
    ];
    var visited = 0;
    while(pending.length && visited < maxVisited){
        var _pending_pop = _sliced_to_array$2(pending.pop(), 2), view = _pending_pop[0], depth = _pending_pop[1];
        visited++;
        if (objc.respondsTo(view, 'setAttributedText:') && objc.respondsTo(view, 'attributedText')) {
            views.push(view);
        }
        // Reaction pills hold their own text views, and never a mention.
        if (depth >= maxDepth || !objc.respondsTo(view, 'subviews') || objc.className(view) === 'DCDReactionListView') {
            continue;
        }
        var children = bridge.call(view, 'subviews');
        if (!Array.isArray(children)) {
            continue;
        }
        var remaining = maxVisited - visited - pending.length;
        for(var index = Math.min(children.length, remaining) - 1; index >= 0; index--){
            pending.push([
                children[index],
                depth + 1
            ]);
        }
    }
    return views;
}
/**
 * @description Tracks the message text views the plugin rewrote, so they can be updated and restored.
 * @param bridge The plugin's native bridge.
 * @param images The mention image cache.
 * @param showAtSymbol Reads whether a mention keeps its `@` beside the image.
 * @returns The text view tracker.
 */ function createTextViews(bridge, images, showAtSymbol) {
    var states = new Map();
    var cellViews = new Map();
    function attributedText(view) {
        var text = bridge.handle(view, 'attributedText');
        return {
            text: text,
            string: text ? bridge.string(text, 'string') : undefined
        };
    }
    function forCell(cell, key, messageID) {
        if (!key) return findTextViews(bridge, cell);
        var cached = cellViews.get(key);
        if (cached && cached.messageID === messageID && cached.expiresAt > Date.now() && cached.views.every(function(view) {
            return Boolean(bridge.call(view, 'window'));
        })) {
            return cached.views;
        }
        var views = findTextViews(bridge, cell);
        // An empty result is retried soon, since the cell may not have laid out its text yet.
        cellViews.set(key, {
            expiresAt: Date.now() + (views.length ? 1000 : 50),
            messageID: messageID,
            views: views
        });
        return views;
    }
    function restore(view) {
        var _attributedText_string;
        var key = viewKey(bridge.objc, view);
        var state = key ? states.get(key) : undefined;
        if (!key || !state) return;
        if ((_attributedText_string = attributedText(view).string) === null || _attributedText_string === void 0 ? void 0 : _attributedText_string.includes(MENTION_PLACEHOLDER)) {
            bridge.call(view, 'setAttributedText:', state.original);
        }
        states.delete(key);
    }
    function forget(view) {
        var key = viewKey(bridge.objc, view);
        if (key) states.delete(key);
    }
    // Returns whether the view's text changed.
    function update(view, messageID, mentions) {
        var _states_get;
        if (!messageID) {
            restore(view);
            return false;
        }
        var key = viewKey(bridge.objc, view);
        if (!key) return false;
        var _attributedText = attributedText(view), text = _attributedText.text, string = _attributedText.string;
        if (!text || !string) return false;
        if (((_states_get = states.get(key)) === null || _states_get === void 0 ? void 0 : _states_get.messageID) !== messageID) states.delete(key);
        if (!mentions.length) {
            restore(view);
            return false;
        }
        var state = states.get(key);
        if (!string.includes('@') && (!state || !string.includes(MENTION_PLACEHOLDER))) {
            states.delete(key);
            return false;
        }
        var signature = JSON.stringify(mentions);
        if ((state === null || state === void 0 ? void 0 : state.signature) === signature && state.imageRevision === images.revision() && state.expiresAt > Date.now() && bridge.call(text, 'isEqual:', state.rendered)) {
            return false;
        }
        // Rebuild from the live text when Discord replaced it, else from the saved original so images never stack.
        var base = !state || !string.includes(MENTION_PLACEHOLDER) && (string !== state.originalString || !containsMentionText(state.originalString, mentions)) && containsMentionText(string, mentions) ? {
            original: text,
            originalString: string
        } : state;
        var rendered = insertMentionImages(bridge, textEngine(textAttachmentBridge(bridge.objc), view), base.original, mentions, images.imageFor, showAtSymbol());
        states.set(key, {
            expiresAt: Date.now() + 5000,
            imageRevision: images.revision(),
            messageID: messageID,
            original: base.original,
            originalString: base.originalString,
            rendered: rendered,
            signature: signature
        });
        if (bridge.call(rendered, 'isEqual:', text)) return false;
        bridge.call(view, 'setAttributedText:', rendered);
        return true;
    }
    return {
        forCell: forCell,
        update: update,
        restore: restore,
        forget: forget,
        hasCell: function hasCell(key) {
            return cellViews.has(key);
        },
        forgetCell: function forgetCell(key) {
            cellViews.delete(key);
        },
        clear: function clear() {
            states.clear();
            cellViews.clear();
        }
    };
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
 * @description Wraps the Objective-C bridge with main-thread calls that return `null` instead of throwing.
 * @param objc The plugin's Objective-C bridge.
 * @returns The bridge plus typed call helpers.
 */ function createBridge(objc) {
    function call(target, selector) {
        for(var _len = arguments.length, args = new Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++){
            args[_key - 2] = arguments[_key];
        }
        return safeInvoke.apply(void 0, [
            objc,
            target,
            selector
        ].concat(_to_consumable_array$2(args)));
    }
    function handle(target, selector) {
        for(var _len = arguments.length, args = new Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++){
            args[_key - 2] = arguments[_key];
        }
        var _call;
        return (_call = call.apply(void 0, [
            target,
            selector
        ].concat(_to_consumable_array$2(args)))) !== null && _call !== void 0 ? _call : null;
    }
    function string(target, selector) {
        var value = call(target, selector);
        return typeof value === 'string' ? value : undefined;
    }
    function number(target, selector) {
        var value = call(target, selector);
        if ((typeof value === "undefined" ? "undefined" : _type_of(value)) === 'bigint') return Number(value);
        return typeof value === 'number' ? value : Number(value) || 0;
    }
    function attributes(text, index) {
        return call(text, 'attributesAtIndex:effectiveRange:', index, null);
    }
    // Returns every class in order, or `null` when any is missing.
    function classes() {
        for(var _len = arguments.length, names = new Array(_len), _key = 0; _key < _len; _key++){
            names[_key] = arguments[_key];
        }
        var found = names.map(function(name) {
            return objc.getClass(name);
        }).filter(function(value) {
            return value !== null;
        });
        return found.length === names.length ? found : null;
    }
    function setValues(target, values) {
        var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
        try {
            for(var _iterator = Object.entries(values)[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                var _step_value = _sliced_to_array$1(_step.value, 2), key = _step_value[0], value = _step_value[1];
                call(target, 'setValue:forKey:', value, key);
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
    function range(location, length) {
        return objc.struct('NSRange', {
            location: location,
            length: length
        });
    }
    return {
        objc: objc,
        call: call,
        handle: handle,
        string: string,
        number: number,
        attributes: attributes,
        classes: classes,
        setValues: setValues,
        range: range
    };
}function _array_like_to_array$2(arr, len) {
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
    return _array_with_holes(arr) || _iterable_to_array_limit(arr, i) || _unsupported_iterable_to_array$2(arr, i) || _non_iterable_rest();
}
function _unsupported_iterable_to_array$2(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _array_like_to_array$2(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(n);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _array_like_to_array$2(o, minLen);
}
function uiColor(bridge, rgb) {
    var UIColor = bridge.objc.getClass('UIColor');
    if (!UIColor) return null;
    return bridge.handle(UIColor, 'colorWithRed:green:blue:alpha:', (rgb >> 16 & 0xff) / 255, (rgb >> 8 & 0xff) / 255, (rgb & 0xff) / 255, 1);
}
function tint(bridge, image, color) {
    if (bridge.objc.respondsTo(image, 'imageWithTintColor:renderingMode:')) {
        var _bridge_handle;
        return (_bridge_handle = bridge.handle(image, 'imageWithTintColor:renderingMode:', color, 1)) !== null && _bridge_handle !== void 0 ? _bridge_handle : image;
    }
    if (bridge.objc.respondsTo(image, 'imageWithTintColor:')) {
        var _bridge_handle1;
        return (_bridge_handle1 = bridge.handle(image, 'imageWithTintColor:', color)) !== null && _bridge_handle1 !== void 0 ? _bridge_handle1 : image;
    }
    return image;
}
// Text attachments drop a symbol's tint, so the color is baked into a bitmap with CIFalseColor.
function rasterize(bridge, image, color) {
    var _bridge_handle, _bridge_handle1, _bridge_call;
    var _bridge_call1, _bridge_call2;
    var classes = bridge.classes('UIImage', 'CIImage', 'CIColor', 'CIFilter', 'CIContext');
    if (!classes) return image;
    var _classes = _sliced_to_array(classes, 5), UIImage = _classes[0], CIImage = _classes[1], CIColor = _classes[2], CIFilter = _classes[3], CIContext = _classes[4];
    var sourceCGImage = bridge.call(image, 'CGImage');
    var tintCGColor = bridge.call(color, 'CGColor');
    if (!sourceCGImage || !tintCGColor) return image;
    var source = bridge.handle(CIImage, 'imageWithCGImage:', sourceCGImage);
    var ciColor = bridge.handle(CIColor, 'colorWithCGColor:', tintCGColor);
    var filter = bridge.handle(CIFilter, 'filterWithName:', 'CIFalseColor');
    if (!source || !ciColor || !filter) return image;
    bridge.setValues(filter, {
        inputImage: source,
        inputColor0: ciColor,
        inputColor1: ciColor
    });
    var output = bridge.handle(filter, 'outputImage');
    if (!output) return image;
    var size = (_bridge_call1 = bridge.call(image, 'size')) === null || _bridge_call1 === void 0 ? void 0 : _bridge_call1.value;
    var extent = (_bridge_call2 = bridge.call(output, 'extent')) === null || _bridge_call2 === void 0 ? void 0 : _bridge_call2.value;
    var scale = bridge.number(image, 'scale');
    var dimensions = [
        size === null || size === void 0 ? void 0 : size.width,
        size === null || size === void 0 ? void 0 : size.height,
        extent === null || extent === void 0 ? void 0 : extent.size.width,
        extent === null || extent === void 0 ? void 0 : extent.size.height,
        scale
    ];
    var sized = size && extent && dimensions.every(function(value) {
        return value !== undefined && Number.isFinite(value) && value > 0;
    }) ? (_bridge_handle = bridge.handle(output, 'imageByApplyingTransform:', bridge.objc.struct('CGAffineTransform', {
        a: size.width * scale / extent.size.width,
        b: 0,
        c: 0,
        d: size.height * scale / extent.size.height,
        tx: 0,
        ty: 0
    }))) !== null && _bridge_handle !== void 0 ? _bridge_handle : output : output;
    var sizedExtent = bridge.call(sized, 'extent');
    var context = bridge.handle(CIContext, 'contextWithOptions:', null);
    var bitmap = sizedExtent && context ? bridge.call(context, 'createCGImage:fromRect:', sized, sizedExtent) : null;
    if (!bitmap) return image;
    return (_bridge_handle1 = bridge.handle(UIImage, 'imageWithCGImage:scale:orientation:', bitmap, scale || 1, (_bridge_call = bridge.call(image, 'imageOrientation')) !== null && _bridge_call !== void 0 ? _bridge_call : 0)) !== null && _bridge_handle1 !== void 0 ? _bridge_handle1 : image;
}
/**
 * @description Loads the SF Symbol shown on role mentions without a custom icon.
 * @param bridge The plugin's native bridge.
 * @returns The untinted symbol image, or `null` when UIKit cannot provide it.
 */ function roleSymbol(bridge) {
    var UIImage = bridge.objc.getClass('UIImage');
    if (!UIImage) return null;
    var UIImageSymbolConfiguration = bridge.objc.getClass('UIImageSymbolConfiguration');
    var configuration = UIImageSymbolConfiguration && bridge.handle(UIImageSymbolConfiguration, 'configurationWithPointSize:weight:scale:', 14, 0, 1);
    if (configuration && bridge.objc.respondsTo(UIImage, 'systemImageNamed:withConfiguration:')) {
        return bridge.handle(UIImage, 'systemImageNamed:withConfiguration:', 'person.2.fill', configuration);
    }
    return bridge.handle(UIImage, 'systemImageNamed:', 'person.2.fill');
}
/**
 * @description Colors the role symbol with the role's color, or the label color when it has none.
 * @param bridge The plugin's native bridge.
 * @param symbol The image from {@link roleSymbol}.
 * @param roleColor The role's RGB color.
 * @returns The tinted bitmap, or `symbol` when it cannot be tinted.
 */ function tintRoleSymbol(bridge, symbol, roleColor) {
    var UIColor = bridge.objc.getClass('UIColor');
    var color = roleColor ? uiColor(bridge, roleColor) : UIColor && bridge.handle(UIColor, 'labelColor');
    if (!color) return symbol;
    return rasterize(bridge, tint(bridge, symbol, color), color);
}
/**
 * @description Crops a 32px avatar to a circle.
 * @param bridge The plugin's native bridge.
 * @param image The square avatar.
 * @returns The circular avatar, or `image` when Core Image cannot render it.
 */ function roundedAvatar(bridge, image) {
    var _bridge_handle, _bridge_call;
    var classes = bridge.classes('UIImage', 'CIImage', 'CIContext', 'CIFilter', 'CIColor', 'CIVector');
    if (!classes) return image;
    var _classes = _sliced_to_array(classes, 6), UIImage = _classes[0], CIImage = _classes[1], CIContext = _classes[2], CIFilter = _classes[3], CIColor = _classes[4], CIVector = _classes[5];
    var sourceCGImage = bridge.call(image, 'CGImage');
    if (!sourceCGImage) return image;
    var source = bridge.handle(CIImage, 'imageWithCGImage:', sourceCGImage);
    var mask = bridge.handle(CIFilter, 'filterWithName:', 'CIRadialGradient');
    if (!source || !mask) return image;
    var white = bridge.handle(CIColor, 'colorWithRed:green:blue:alpha:', 1, 1, 1, 1);
    var clear = bridge.handle(CIColor, 'colorWithRed:green:blue:alpha:', 0, 0, 0, 0);
    var center = bridge.handle(CIVector, 'vectorWithX:Y:', 16, 16);
    if (!white || !clear || !center) return image;
    bridge.setValues(mask, {
        inputCenter: center,
        inputRadius0: 15.5,
        inputRadius1: 16,
        inputColor0: white,
        inputColor1: clear
    });
    var maskImage = bridge.handle(mask, 'outputImage');
    var blend = bridge.handle(CIFilter, 'filterWithName:', 'CIBlendWithMask');
    if (!maskImage || !blend) return image;
    bridge.setValues(blend, {
        inputImage: source,
        inputMaskImage: maskImage
    });
    var output = bridge.handle(blend, 'outputImage');
    if (!output) return image;
    var rect = bridge.objc.struct('CGRect', {
        origin: {
            x: 0,
            y: 0
        },
        size: {
            width: 32,
            height: 32
        }
    });
    var context = bridge.handle(CIContext, 'contextWithOptions:', null);
    var cgImage = context && bridge.call(context, 'createCGImage:fromRect:', output, rect);
    if (!cgImage) return image;
    return (_bridge_handle = bridge.handle(UIImage, 'imageWithCGImage:scale:orientation:', cgImage, 2, (_bridge_call = bridge.call(image, 'imageOrientation')) !== null && _bridge_call !== void 0 ? _bridge_call : 0)) !== null && _bridge_handle !== void 0 ? _bridge_handle : image;
}function asyncGeneratorStep$1(gen, resolve, reject, _next, _throw, key, arg) {
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
function _instanceof(left, right) {
    "@swc/helpers - instanceof";
    if (right != null && typeof Symbol !== "undefined" && right[Symbol.hasInstance]) {
        return !!right[Symbol.hasInstance](left);
    } else return left instanceof right;
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
/**
 * @description Reads the file path of an image bundled with Discord.
 * @param url The image URL.
 * @returns The decoded path for a `file:///` URL, otherwise `undefined`.
 */ function bundledFilePath(url) {
    if (url.startsWith('file:///')) return decodeURIComponent(url.slice('file://'.length));
}
/**
 * @description Reads an image's bytes from Discord's app bundle (`file:///`) or the CDN (`https://`).
 * @param url The image URL.
 * @param objc The plugin's Objective-C bridge, used to read bundled files.
 * @returns The bytes, or `null` for an unsupported URL or a failed read.
 */ function loadImageBytes(url, objc) {
    return _async_to_generator$1(function() {
        var path, NSData, bytes, response;
        return _ts_generator$1(this, function(_state) {
            switch(_state.label){
                case 0:
                    path = bundledFilePath(url);
                    if (!path) return [
                        3,
                        2
                    ];
                    NSData = objc.getClass('NSData');
                    if (!NSData) return [
                        2,
                        null
                    ];
                    return [
                        4,
                        objc.invokeAsync(NSData, 'dataWithContentsOfFile:', [
                            path
                        ])
                    ];
                case 1:
                    bytes = _state.sent();
                    return [
                        2,
                        _instanceof(bytes, Uint8Array) ? bytes : null
                    ];
                case 2:
                    if (!url.startsWith('https://')) return [
                        2,
                        null
                    ];
                    return [
                        4,
                        fetch(url)
                    ];
                case 3:
                    response = _state.sent();
                    return [
                        2,
                        response.ok ? response.arrayBuffer() : null
                    ];
            }
        });
    })();
}
/**
 * @description Creates the cache of mention images, loading avatars and role icons in the background.
 * @param bridge The plugin's native bridge.
 * @param onLoad Called after an image finishes loading or fails, so visible cells can redraw.
 * @returns The cache.
 */ function createImageCache(bridge, onLoad) {
    var images = new Map();
    var roleImages = new Map();
    var revision = 0;
    var disposed = false;
    function roleImage(roleColor) {
        var cached = roleColor ? roleImages.get(roleColor) : undefined;
        if (cached) return cached;
        var symbol = roleSymbol(bridge);
        if (!symbol) return null;
        var image = tintRoleSymbol(bridge, symbol, roleColor);
        if (roleColor && image !== symbol) {
            if (roleImages.size >= 64) roleImages.delete(roleImages.keys().next().value);
            roleImages.set(roleColor, image);
        }
        return image;
    }
    function download(url, type) {
        return _async_to_generator$1(function() {
            var bytes, UIImage, image;
            return _ts_generator$1(this, function(_state) {
                switch(_state.label){
                    case 0:
                        return [
                            4,
                            loadImageBytes(url, bridge.objc)
                        ];
                    case 1:
                        bytes = _state.sent();
                        if (!bytes) return [
                            2,
                            null
                        ];
                        UIImage = bridge.objc.getClass('UIImage');
                        image = UIImage && bridge.handle(UIImage, 'imageWithData:', bridge.objc.data(bytes));
                        if (!image) return [
                            2,
                            null
                        ];
                        return [
                            2,
                            type === 'user' ? roundedAvatar(bridge, image) : image
                        ];
                }
            });
        })();
    }
    function load(url, type) {
        var pending = download(url, type).catch(function() {
            return null;
        });
        images.set(url, {
            image: null,
            pending: pending
        });
        void pending.then(function(image) {
            if (disposed) return;
            images.set(url, image ? {
                image: image
            } : {
                image: null,
                retryAt: Date.now() + 5000
            });
            revision++;
            onLoad();
        });
    }
    // Returns `null` while an image loads; `onLoad` reports when to ask again.
    function imageFor(param) {
        var avatarURL = param.avatarURL, roleColor = param.roleColor, type = param.type;
        var _ref;
        if (!avatarURL) return type === 'role' ? roleImage(roleColor) : null;
        var entry = images.get(avatarURL);
        if (entry === null || entry === void 0 ? void 0 : entry.image) return entry.image;
        if (!(entry === null || entry === void 0 ? void 0 : entry.pending) && !(((_ref = entry === null || entry === void 0 ? void 0 : entry.retryAt) !== null && _ref !== void 0 ? _ref : 0) > Date.now())) load(avatarURL, type);
        return null;
    }
    return {
        imageFor: imageFor,
        revision: function revision1() {
            return revision;
        },
        dispose: function dispose() {
            disposed = true;
            images.clear();
            roleImages.clear();
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
/**
 * @description Creates the renderer that draws mention images into visible message cells.
 * @param objc The plugin's Objective-C bridge.
 * @param index The mention index the renderer reads.
 * @param showAtSymbol Reads whether a mention keeps its `@` beside the image.
 * @returns The renderer.
 */ function createRenderer(objc, index, showAtSymbol) {
    var bridge = createBridge(objc);
    var activeCells = new Map();
    var pendingCells = new Map();
    var images = createImageCache(bridge, function() {
        var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
        try {
            for(var _iterator = activeCells.values()[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                var cell = _step.value;
                schedule(cell);
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
    var textViews = createTextViews(bridge, images, showAtSymbol);
    var disposed = false;
    // Resolves whether the cell's message was not indexed yet, so the render should be retried.
    function render(cell) {
        return _async_to_generator(function() {
            var key, info, id, hydrated, mentions, retry, changed, _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, view;
            return _ts_generator(this, function(_state) {
                switch(_state.label){
                    case 0:
                        index.hydrateChannel();
                        key = viewKey(objc, cell);
                        return [
                            4,
                            readNativeMessageInfo(cell, objc)
                        ];
                    case 1:
                        info = _state.sent();
                        id = info === null || info === void 0 ? void 0 : info.messageId;
                        if (disposed) return [
                            2,
                            false
                        ];
                        hydrated = index.hydrateMessage(id, info === null || info === void 0 ? void 0 : info.channelId);
                        mentions = id ? index.get(id) : [];
                        retry = id ? !hydrated || index.isUnresolved(id) : false;
                        if (!mentions.length && (!key || !textViews.hasCell(key))) {
                            if (key) activeCells.delete(key);
                            return [
                                2,
                                retry
                            ];
                        }
                        if (key) activeCells.set(key, cell);
                        changed = false;
                        _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
                        try {
                            for(_iterator = textViews.forCell(cell, key, id)[Symbol.iterator](); !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                                view = _step.value;
                                if (textViews.update(view, id, mentions)) changed = true;
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
                        if (changed) bridge.call(cell, 'setNeedsLayout');
                        if (!mentions.length && key) {
                            textViews.forgetCell(key);
                            activeCells.delete(key);
                        }
                        return [
                            2,
                            retry
                        ];
                }
            });
        })();
    }
    function schedule(cell) {
        var attempt = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : 0;
        if (disposed) return;
        var key = viewKey(objc, cell);
        if (!key || pendingCells.has(key)) return;
        pendingCells.set(key, cell);
        setTimeout(function() {
            var pending = pendingCells.get(key);
            pendingCells.delete(key);
            if (disposed || !pending) return;
            void render(pending).then(function(retry) {
                if (retry && attempt < 12) setTimeout(function() {
                    return schedule(pending, attempt + 1);
                }, 100);
            });
        }, 0);
    }
    // Drops a reused cell's state without restoring its text, which Discord is about to replace.
    function reuse(cell) {
        var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
        try {
            for(var _iterator = findTextViews(bridge, cell)[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                var view = _step.value;
                textViews.forget(view);
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
        var key = viewKey(objc, cell);
        if (key) {
            activeCells.delete(key);
            pendingCells.delete(key);
            textViews.forgetCell(key);
        }
        schedule(cell);
    }
    function restoreAll() {
        var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
        try {
            for(var _iterator = activeCells.values()[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                var cell = _step.value;
                var _iteratorNormalCompletion1 = true, _didIteratorError1 = false, _iteratorError1 = undefined;
                try {
                    for(var _iterator1 = findTextViews(bridge, cell)[Symbol.iterator](), _step1; !(_iteratorNormalCompletion1 = (_step1 = _iterator1.next()).done); _iteratorNormalCompletion1 = true){
                        var view = _step1.value;
                        textViews.restore(view);
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
        activeCells.clear();
        pendingCells.clear();
        textViews.clear();
    }
    // Called when the selected channel changes and every visible cell is about to change.
    function clear() {
        restoreAll();
        index.clear();
    }
    function dispose() {
        disposed = true;
        restoreAll();
        images.dispose();
    }
    return {
        schedule: schedule,
        reuse: reuse,
        clear: clear,
        dispose: dispose
    };
}function _array_like_to_array$1(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_without_holes$1(arr) {
    if (Array.isArray(arr)) return _array_like_to_array$1(arr);
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
function _iterable_to_array$1(iter) {
    if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) {
        return Array.from(iter);
    }
}
function _non_iterable_spread$1() {
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
function userAvatarURL(user, guildId) {
    var _user_getAvatarURL, _metro_common_ReactNative_Image_resolveAssetSource;
    var resolved = (_user_getAvatarURL = user.getAvatarURL) === null || _user_getAvatarURL === void 0 ? void 0 : _user_getAvatarURL.call(user, guildId !== null && guildId !== void 0 ? guildId : null, 32, false);
    if (typeof resolved === 'string' && resolved) return avatarPngURL(resolved);
    if (user.avatar) {
        return "https://cdn.discordapp.com/avatars/".concat(user.id, "/").concat(user.avatar, ".png?size=32");
    }
    // Default avatars resolve to a bundled asset ID instead of a URL.
    if (typeof resolved !== 'number') return;
    var uri = (_metro_common_ReactNative_Image_resolveAssetSource = window.unbound.metro.common.ReactNative.Image.resolveAssetSource(resolved)) === null || _metro_common_ReactNative_Image_resolveAssetSource === void 0 ? void 0 : _metro_common_ReactNative_Image_resolveAssetSource.uri;
    if (uri === null || uri === void 0 ? void 0 : uri.startsWith('file:///')) return uri;
}
function userMention(userId, guildId) {
    var _GuildMemberStore_getMember, _GuildMemberStore_getMember1;
    var user = UserStore.getUser(userId);
    if (!user) return;
    var labels = [
        (_GuildMemberStore_getMember1 = GuildMemberStore.getMember) === null || _GuildMemberStore_getMember1 === void 0 ? void 0 : (_GuildMemberStore_getMember = _GuildMemberStore_getMember1.call(GuildMemberStore, guildId !== null && guildId !== void 0 ? guildId : '', userId)) === null || _GuildMemberStore_getMember === void 0 ? void 0 : _GuildMemberStore_getMember.nick,
        user.globalName,
        user.username
    ].filter(function(label) {
        return Boolean(label);
    });
    if (!labels.length) return;
    return {
        avatarURL: userAvatarURL(user, guildId),
        labels: _to_consumable_array$1(new Set(labels)),
        type: 'user'
    };
}
function roleMention(roleId, guildId) {
    var _RoleStore_getRole;
    var _RoleStore_getSortedRoles;
    if (!guildId) return;
    var role = (_RoleStore_getRole = RoleStore.getRole(guildId, roleId)) !== null && _RoleStore_getRole !== void 0 ? _RoleStore_getRole : (_RoleStore_getSortedRoles = RoleStore.getSortedRoles(guildId)) === null || _RoleStore_getSortedRoles === void 0 ? void 0 : _RoleStore_getSortedRoles.find(function(candidate) {
        return candidate.id === roleId;
    });
    if (!(role === null || role === void 0 ? void 0 : role.name)) return;
    return _object_spread_props(_object_spread({}, roleImageSource(role)), {
        labels: [
            role.name
        ],
        type: 'role'
    });
}
function guildIdForMessage(message) {
    var _message_guild_id, _message_channel_id, _ref;
    var _ChannelStore_getChannel;
    var guildId = (_message_guild_id = message.guild_id) !== null && _message_guild_id !== void 0 ? _message_guild_id : message.guildId;
    if (guildId) return guildId;
    var channelId = (_message_channel_id = message.channel_id) !== null && _message_channel_id !== void 0 ? _message_channel_id : message.channelId;
    var channel = channelId ? (_ChannelStore_getChannel = ChannelStore.getChannel) === null || _ChannelStore_getChannel === void 0 ? void 0 : _ChannelStore_getChannel.call(ChannelStore, channelId) : undefined;
    return (_ref = channel === null || channel === void 0 ? void 0 : channel.guild_id) !== null && _ref !== void 0 ? _ref : channel === null || channel === void 0 ? void 0 : channel.guildId;
}
/**
 * @description Resolves each mention in a message to the labels and image it renders with.
 * @param message The Discord message.
 * @param includeRoles Whether role mentions can be resolved; when not, they count as unresolved.
 * @returns The resolved mentions, and whether every mention resolved.
 */ function collectMentions(message, includeRoles) {
    var mentions = [];
    var complete = true;
    if (typeof message.content !== 'string') return {
        complete: complete,
        mentions: mentions
    };
    var guildId = guildIdForMessage(message);
    var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
    try {
        for(var _iterator = extractMentionTokens(message.content)[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
            var _step_value = _step.value, id = _step_value.id, type = _step_value.type;
            var mention = type === 'user' ? userMention(id, guildId) : includeRoles ? roleMention(id, guildId) : undefined;
            if (mention) {
                mentions.push(mention);
            } else {
                complete = false;
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
    return {
        complete: complete,
        mentions: mentions
    };
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
 * @description Creates the per-message record of resolved mentions that the native renderer reads.
 * @param includeRoles Whether role mentions can be resolved.
 * @returns The index.
 */ function createMentionIndex(includeRoles) {
    var mentionsByMessage = new Map();
    var unresolved = new Set();
    var hydratedKey = null;
    function add(message) {
        if (typeof (message === null || message === void 0 ? void 0 : message.id) !== 'string') return;
        var id = message.id;
        var _collectMentions = collectMentions(message, includeRoles), complete = _collectMentions.complete, mentions = _collectMentions.mentions;
        if (complete) {
            unresolved.delete(id);
        } else {
            unresolved.add(id);
        }
        mentionsByMessage.set(id, mentions);
    }
    // Indexes the selected channel's loaded messages, skipping the work when nothing changed.
    function hydrateChannel() {
        var _ref;
        var _MessageStore_getMessages, _messages_at;
        var channelId = SelectedChannelStore.getChannelId();
        var messages = (_MessageStore_getMessages = MessageStore.getMessages(channelId)) === null || _MessageStore_getMessages === void 0 ? void 0 : _MessageStore_getMessages._array;
        if (!Array.isArray(messages)) return;
        var key = "".concat(channelId, ":").concat(messages.length, ":").concat((_ref = (_messages_at = messages.at(-1)) === null || _messages_at === void 0 ? void 0 : _messages_at.id) !== null && _ref !== void 0 ? _ref : '');
        if (key === hydratedKey && !unresolved.size) return;
        hydratedKey = key;
        var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
        try {
            for(var _iterator = messages[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                var message = _step.value;
                add(message);
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
    function hydrateMessage(id, channelId) {
        if (!id) return false;
        var message = MessageStore.getMessage(channelId !== null && channelId !== void 0 ? channelId : SelectedChannelStore.getChannelId(), id);
        if (!message) return false;
        add(message);
        return true;
    }
    return {
        add: add,
        hydrateChannel: hydrateChannel,
        hydrateMessage: hydrateMessage,
        get: function get(id) {
            var _mentionsByMessage_get;
            return (_mentionsByMessage_get = mentionsByMessage.get(id)) !== null && _mentionsByMessage_get !== void 0 ? _mentionsByMessage_get : [];
        },
        all: function all() {
            return _to_consumable_array(new Set(_to_consumable_array(mentionsByMessage.values()).flat()));
        },
        isUnresolved: function isUnresolved(id) {
            return unresolved.has(id);
        },
        clear: function clear() {
            mentionsByMessage.clear();
            unresolved.clear();
            hydratedKey = null;
        }
    };
}var dispose = function dispose() {};
function start(context) {
    var objc = context.native.objc;
    var modules = {
        MessageStore: MessageStore,
        SelectedChannelStore: SelectedChannelStore,
        UserStore: UserStore,
        generateMessageRowData: RowGenerator.generateMessageRowData
    };
    if (!ensureCapabilities('Mention Avatars', context.native, context.capabilities) || !ensureModules('Mention Avatars', modules)) {
        return;
    }
    var index = createMentionIndex(ensureModules('Mention Avatars: role mentions', {
        RoleStore: RoleStore
    }));
    var showAtSymbol = function showAtSymbol() {
        return settings.get('showAtSymbol', true);
    };
    if (context.platform === 'android') {
        var android = createAndroidRenderer(context.native, index, showAtSymbol);
        dispose = applyFeatures('Mention Avatars', [
            function() {
                return android.dispose;
            },
            function() {
                return patchRowGenerator(index);
            }
        ]);
        return;
    }
    var renderer = createRenderer(objc, index, showAtSymbol);
    var scanner = createVisibleCellScanner(objc, renderer.schedule);
    dispose = applyFeatures('Mention Avatars', [
        function() {
            return renderer.dispose;
        },
        function() {
            return patchRowGenerator(index);
        },
        function() {
            return hookMessageCells(objc, {
                shown: renderer.schedule,
                laidOut: renderer.schedule,
                reused: renderer.reuse,
                textChanged: renderer.schedule
            });
        },
        function() {
            return subscribeSelectedChannel(renderer, scanner);
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