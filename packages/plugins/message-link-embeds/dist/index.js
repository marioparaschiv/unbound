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
}function _define_property$8(obj, key, value) {
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
function _instanceof$1(left, right) {
    "@swc/helpers - instanceof";
    if (right != null && typeof Symbol !== "undefined" && right[Symbol.hasInstance]) {
        return !!right[Symbol.hasInstance](left);
    } else return left instanceof right;
}
function _object_spread$7(target) {
    for(var i = 1; i < arguments.length; i++){
        var source = arguments[i] != null ? arguments[i] : {};
        var ownKeys = Object.keys(source);
        if (typeof Object.getOwnPropertySymbols === "function") {
            ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function(sym) {
                return Object.getOwnPropertyDescriptor(source, sym).enumerable;
            }));
        }
        ownKeys.forEach(function(key) {
            _define_property$8(target, key, source[key]);
        });
    }
    return target;
}
function ownKeys$5(object, enumerableOnly) {
    var keys = Object.keys(object);
    if (Object.getOwnPropertySymbols) {
        var symbols = Object.getOwnPropertySymbols(object);
        keys.push.apply(keys, symbols);
    }
    return keys;
}
function _object_spread_props$5(target, source) {
    source = source != null ? source : {};
    if (Object.getOwnPropertyDescriptors) Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));
    else {
        ownKeys$5(Object(source)).forEach(function(key) {
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
            var found = window.unbound.metro.findLazy(toFilter(source), _object_spread_props$5(_object_spread$7({}, options), {
                signal: signal
            }));
            if (!_instanceof$1(found, Promise)) {
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
}/**
 * @description Reads a `CGRect` or `CGSize` the Objective-C bridge returned, boxed in an `NSValue` or not.
 * @param raw The bridge's return value from `frame`, `bounds`, `sizeThatFits:` and similar selectors.
 * @returns The rect's fields, each `0` when the value does not carry it.
 */ // UNKNOWN: the bridge returns struct values untyped.
function readRect(raw) {
    var _ref, _ref1, _ref2, _ref3, _ref4, _ref5, _ref6, _ref7, _ref8;
    var _rect_origin, _rect_origin1, _rect_size, _rect_size1;
    var boxed = raw;
    var rect = (_ref = boxed === null || boxed === void 0 ? void 0 : boxed.value) !== null && _ref !== void 0 ? _ref : boxed;
    return {
        x: Number((_ref1 = (_ref2 = rect === null || rect === void 0 ? void 0 : (_rect_origin = rect.origin) === null || _rect_origin === void 0 ? void 0 : _rect_origin.x) !== null && _ref2 !== void 0 ? _ref2 : rect === null || rect === void 0 ? void 0 : rect.x) !== null && _ref1 !== void 0 ? _ref1 : 0),
        y: Number((_ref3 = (_ref4 = rect === null || rect === void 0 ? void 0 : (_rect_origin1 = rect.origin) === null || _rect_origin1 === void 0 ? void 0 : _rect_origin1.y) !== null && _ref4 !== void 0 ? _ref4 : rect === null || rect === void 0 ? void 0 : rect.y) !== null && _ref3 !== void 0 ? _ref3 : 0),
        width: Number((_ref5 = (_ref6 = rect === null || rect === void 0 ? void 0 : (_rect_size = rect.size) === null || _rect_size === void 0 ? void 0 : _rect_size.width) !== null && _ref6 !== void 0 ? _ref6 : rect === null || rect === void 0 ? void 0 : rect.width) !== null && _ref5 !== void 0 ? _ref5 : 0),
        height: Number((_ref7 = (_ref8 = rect === null || rect === void 0 ? void 0 : (_rect_size1 = rect.size) === null || _rect_size1 === void 0 ? void 0 : _rect_size1.height) !== null && _ref8 !== void 0 ? _ref8 : rect === null || rect === void 0 ? void 0 : rect.height) !== null && _ref7 !== void 0 ? _ref7 : 0)
    };
}function _array_like_to_array$c(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_without_holes$6(arr) {
    if (Array.isArray(arr)) return _array_like_to_array$c(arr);
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
function _iterable_to_array$6(iter) {
    if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) {
        return Array.from(iter);
    }
}
function _non_iterable_spread$6() {
    throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _to_consumable_array$6(arr) {
    return _array_without_holes$6(arr) || _iterable_to_array$6(arr) || _unsupported_iterable_to_array$c(arr) || _non_iterable_spread$6();
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
function _type_of$9(obj) {
    "@swc/helpers - typeof";
    return obj && typeof Symbol !== "undefined" && obj.constructor === Symbol ? "symbol" : typeof obj;
}
function _unsupported_iterable_to_array$c(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _array_like_to_array$c(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(n);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _array_like_to_array$c(o, minLen);
}
var ATTACHMENT_CHARACTER = '￼';
var MESSAGE_TEXT_VIEW_CLASSES = [
    'DCDAttributedTextView',
    'DCDReusableYYLabel'
];
/**
 * @description Picks the message text view class this Discord build draws message text with.
 * @param objc The Objective-C bridge.
 * @returns The first class from `MESSAGE_TEXT_VIEW_CLASSES` that exists, or the newest one when none does.
 */ function messageTextViewClass(objc) {
    var _MESSAGE_TEXT_VIEW_CLASSES_find;
    return (_MESSAGE_TEXT_VIEW_CLASSES_find = MESSAGE_TEXT_VIEW_CLASSES.find(function(name) {
        return objc.getClass(name);
    })) !== null && _MESSAGE_TEXT_VIEW_CLASSES_find !== void 0 ? _MESSAGE_TEXT_VIEW_CLASSES_find : MESSAGE_TEXT_VIEW_CLASSES[0];
}
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
    return value === null || VALUE_TYPES.has(typeof value === "undefined" ? "undefined" : _type_of$9(value));
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
            return _async_to_generator$9(function() {
                var result;
                return _ts_generator$9(this, function(_state) {
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
function hasAny(attributes, keys) {
    if (!attributes || (typeof attributes === "undefined" ? "undefined" : _type_of$9(attributes)) !== 'object') {
        return false;
    }
    return keys.some(function(key) {
        return Boolean(attributes[key]);
    });
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
    if ((typeof value === "undefined" ? "undefined" : _type_of$9(value)) === 'bigint') {
        return Number(value);
    }
    return typeof value === 'number' ? value : Number(value) || 0;
}
function range(bridge, location, length) {
    return bridge.struct('NSRange', {
        location: location,
        length: length
    });
}
function blankImage(bridge) {
    var image = bridge.alloc('UIImage');
    bridge.call(image, 'init');
    return image;
}
function textKitView(bridge, options) {
    if (!bridge.getClass('NSTextAttachment')) {
        return null;
    }
    var attributes = options.attributes, width = options.width, height = options.height;
    var attachment = bridge.alloc('NSTextAttachment');
    bridge.call(attachment, 'init');
    bridge.call(attachment, 'setImage:', blankImage(bridge));
    bridge.call(attachment, 'setBounds:', bridge.struct('CGRect', {
        origin: {
            x: 0,
            y: 0
        },
        size: {
            width: width,
            height: height
        }
    }));
    var result = bridge.alloc('NSMutableAttributedString');
    bridge.call(result, 'initWithString:attributes:', ATTACHMENT_CHARACTER, attributes);
    bridge.call(result, 'addAttribute:value:range:', 'NSAttachment', attachment, range(bridge, 0, 1));
    return result;
}
function yyTextView(bridge, options) {
    if (!bridge.getClass('YYTextAttachment')) {
        return null;
    }
    var attributes = options.attributes, view = options.view, width = options.width, height = options.height;
    var attachment = bridge.alloc('YYTextAttachment');
    bridge.call(attachment, 'setValue:forKey:', view, 'content');
    bridge.call(attachment, 'setValue:forKey:', 1, 'contentMode');
    var result = bridge.alloc('NSMutableAttributedString');
    bridge.call(result, 'initWithString:attributes:', ATTACHMENT_CHARACTER, attributes);
    bridge.call(result, 'addAttribute:value:range:', 'YYTextAttachment', attachment, range(bridge, 0, 1));
    if (!bridge.getClass('YYTextRunDelegate')) {
        return result;
    }
    var delegate = bridge.alloc('YYTextRunDelegate');
    bridge.call(delegate, 'setValue:forKey:', height, 'ascent');
    bridge.call(delegate, 'setValue:forKey:', 0, 'descent');
    bridge.call(delegate, 'setValue:forKey:', width, 'width');
    var runDelegate = bridge.call(delegate, 'CTRunDelegate');
    if (runDelegate) {
        bridge.call(result, 'addAttribute:value:range:', 'CTRunDelegate', runDelegate, range(bridge, 0, 1));
    }
    return result;
}
/**
 * @description Builds a one-character attributed string that reserves room for a view inside message text.
 * @param bridge The attachment bridge.
 * @param engine The text view's layout engine.
 * @param options The view, the room to reserve for it, and the surrounding text's attributes.
 * @returns The attributed string to insert, or `null` when the engine's attachment class is missing.
 */ function viewAttachment(bridge, engine, options) {
    return engine === 'textkit' ? textKitView(bridge, options) : yyTextView(bridge, options);
}
function isAttributes(value) {
    return (typeof value === "undefined" ? "undefined" : _type_of$9(value)) === 'object' && value !== null;
}
function readInset(value) {
    var _value_value, _inset_top, _inset_left;
    if (!isAttributes(value)) {
        return {
            top: 0,
            left: 0
        };
    }
    var boxed = (_value_value = value.value) !== null && _value_value !== void 0 ? _value_value : null;
    var inset = isAttributes(boxed) ? boxed : value;
    return {
        top: Number((_inset_top = inset.top) !== null && _inset_top !== void 0 ? _inset_top : 0),
        left: Number((_inset_left = inset.left) !== null && _inset_left !== void 0 ? _inset_left : 0)
    };
}
/**
 * @description Positions views over the attachments that reserve their room in a TextKit text view, skipping any not laid out yet.
 * @param bridge The attachment bridge.
 * @param textView The message text view.
 * @param views Each view with the index of the attachment character that reserves its room.
 * @returns Resolves once every view is placed.
 */ function placeAttachedViews(bridge, textView, views) {
    return _async_to_generator$9(function() {
        var layoutManager, textContainer, inset, _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, _step_value, view, index, glyph, rect, err;
        return _ts_generator$9(this, function(_state) {
            switch(_state.label){
                case 0:
                    layoutManager = bridge.call(textView, 'layoutManager');
                    textContainer = bridge.call(textView, 'textContainer');
                    if (!isAttributes(layoutManager) || !isAttributes(textContainer)) {
                        return [
                            2
                        ];
                    }
                    inset = readInset(bridge.call(textView, 'textContainerInset'));
                    _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
                    _state.label = 1;
                case 1:
                    _state.trys.push([
                        1,
                        7,
                        8,
                        9
                    ]);
                    _iterator = views[Symbol.iterator]();
                    _state.label = 2;
                case 2:
                    if (!!(_iteratorNormalCompletion = (_step = _iterator.next()).done)) return [
                        3,
                        6
                    ];
                    _step_value = _step.value, view = _step_value.view, index = _step_value.index;
                    glyph = numeric(bridge.call(layoutManager, 'glyphIndexForCharacterAtIndex:', index));
                    rect = readRect(bridge.call(layoutManager, 'boundingRectForGlyphRange:inTextContainer:', range(bridge, glyph, 1), textContainer));
                    if (rect.width <= 0 || rect.height <= 0) {
                        return [
                            3,
                            5
                        ];
                    }
                    return [
                        4,
                        bridge.callAsync(view, 'setFrame:', bridge.struct('CGRect', {
                            origin: {
                                x: rect.x + inset.left,
                                y: rect.y + inset.top
                            },
                            size: {
                                width: rect.width,
                                height: rect.height
                            }
                        }))
                    ];
                case 3:
                    _state.sent();
                    if (!(bridge.call(view, 'superview') !== textView)) return [
                        3,
                        5
                    ];
                    return [
                        4,
                        bridge.callAsync(textView, 'addSubview:', view)
                    ];
                case 4:
                    _state.sent();
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
}function _type_of$8(obj) {
    "@swc/helpers - typeof";
    return obj && typeof Symbol !== "undefined" && obj.constructor === Symbol ? "symbol" : typeof obj;
}
var MessageStore = window.unbound.metro.findStore('Message', {
    lazy: true
});
var ChannelStore = window.unbound.metro.findStore('Channel', {
    lazy: true
});
var SelectedChannelStore = window.unbound.metro.findStore('SelectedChannel', {
    lazy: true
});
var MessageActions = window.unbound.metro.api.Messages;
window.unbound.metro.findByProps('generateMessageRowData', {
    lazy: true
});
window.unbound.patcher.createPatcher('unbound.message-link-embeds');
// The media components patched to play inside embeds, loaded when Discord first shows media.
var FastImageSource = 'components_native/common/FastImage.tsx';
var LottieAnimationViewSource = 'components_native/common/LottieAnimationView.tsx';
var NativeLottieViewSource = 'modules/stickers/native/NativeLottieView.tsx';
// ChatItem is exported wrapped in `memo`, `forwardRef`, or a module default, a few layers deep.
function unwrapComponent(value) {
    var depth = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : 0;
    var _ref, _holder_type;
    if (typeof value === 'function') return value;
    if (!value || (typeof value === "undefined" ? "undefined" : _type_of$8(value)) !== 'object' || depth >= 5) return;
    var holder = value;
    return unwrapComponent((_ref = (_holder_type = holder.type) !== null && _holder_type !== void 0 ? _holder_type : holder.render) !== null && _ref !== void 0 ? _ref : holder.default, depth + 1);
}
/**
 * @description Finds the classes and component Discord renders a chat row with. Metro's lazy proxy cannot be constructed or rendered, so these resolve when called.
 * @returns `MessageRecord`, `RowManager`, and the `ChatItem` component, each `undefined` when not found.
 */ function findRenderers() {
    var _metro_findByFilePath, _unwrapComponent;
    // A build that moves ChatItem's file still exports these message views beside it.
    var chatItemModule = (_metro_findByFilePath = window.unbound.metro.findByFilePath('components_native/chat/ChatItem.tsx', {
        interop: false
    })) !== null && _metro_findByFilePath !== void 0 ? _metro_findByFilePath : window.unbound.metro.findByProps('DCDMessageView', 'DCDSystemMessageView', 'DCDAutoModerationSystemMessageView', {
        interop: false
    });
    return {
        MessageRecord: window.unbound.metro.findByName('MessageRecord'),
        RowManager: window.unbound.metro.findByName('RowManager'),
        ChatItem: (_unwrapComponent = unwrapComponent(chatItemModule === null || chatItemModule === void 0 ? void 0 : chatItemModule.default)) !== null && _unwrapComponent !== void 0 ? _unwrapComponent : unwrapComponent(chatItemModule)
    };
}function _define_property$7(obj, key, value) {
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
function _object_spread$6(target) {
    for(var i = 1; i < arguments.length; i++){
        var source = arguments[i] != null ? arguments[i] : {};
        var ownKeys = Object.keys(source);
        if (typeof Object.getOwnPropertySymbols === "function") {
            ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function(sym) {
                return Object.getOwnPropertyDescriptor(source, sym).enumerable;
            }));
        }
        ownKeys.forEach(function(key) {
            _define_property$7(target, key, source[key]);
        });
    }
    return target;
}
function ownKeys$4(object, enumerableOnly) {
    var keys = Object.keys(object);
    if (Object.getOwnPropertySymbols) {
        var symbols = Object.getOwnPropertySymbols(object);
        keys.push.apply(keys, symbols);
    }
    return keys;
}
function _object_spread_props$4(target, source) {
    source = source != null ? source : {};
    if (Object.getOwnPropertyDescriptors) Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));
    else {
        ownKeys$4(Object(source)).forEach(function(key) {
            Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
        });
    }
    return target;
}
function _type_of$7(obj) {
    "@swc/helpers - typeof";
    return obj && typeof Symbol !== "undefined" && obj.constructor === Symbol ? "symbol" : typeof obj;
}
function sourceUri(source) {
    if (typeof source === 'string') return source;
    if (!source || (typeof source === "undefined" ? "undefined" : _type_of$7(source)) !== 'object') return;
    var uri = source.uri;
    return typeof uri === 'string' ? uri : undefined;
}
// React Native's `URL` throws on unparsable input and on members it does not implement.
function animatedGifSource(source) {
    try {
        var url = new URL(source);
        if (url.hostname !== 'cdn.discordapp.com' || !/^\/emojis\/\d+\.webp$/.test(url.pathname) || url.searchParams.get('animated') !== 'true') {
            return;
        }
        url.pathname = url.pathname.replace(/\.webp$/, '.gif');
        url.searchParams.delete('animated');
        return url.toString();
    } catch (unused) {
        return;
    }
}
/**
 * @description Tells whether an image source is a GIF, an animated emoji, or an animated sticker.
 * @param source An image `source` prop: a URI string, `{ uri }`, or an array of them.
 * @returns `true` when the source animates.
 */ function isAnimatedMediaSource(source) {
    if (Array.isArray(source)) return source.some(isAnimatedMediaSource);
    var uri = sourceUri(source);
    if (!uri) return false;
    if (/^data:image\/gif/i.test(uri) || /\.gif(?:$|[?#])/i.test(uri)) return true;
    try {
        var url = new URL(uri);
        return url.searchParams.get('animated') === 'true' || /^\/stickers\/\d+\.(?:png|webp)$/.test(url.pathname);
    } catch (unused) {
        return /[?&]animated=true(?:&|$)/i.test(uri);
    }
}
/**
 * @description Makes an animated image play on its own.
 * @param props The image's props.
 * @returns New props with playback enabled, or the same props when the source does not animate.
 */ function animatedImageProps(props) {
    if (!isAnimatedMediaSource(props.source)) return props;
    return _object_spread_props$4(_object_spread$6({}, props), {
        enableAnimation: true,
        manualPlayback: false,
        paused: false
    });
}
/**
 * @description Makes a Lottie animation play on a loop.
 * @param props The animation's props.
 * @returns New props with autoplay and looping on.
 */ function animatedLottieProps(props) {
    return _object_spread_props$4(_object_spread$6({}, props), {
        autoPlay: true,
        loop: true
    });
}
/**
 * @description Points every animated custom emoji in parsed message content at its GIF, which plays without interaction.
 * @param content The parsed content tree, changed in place.
 * @returns How many emoji were changed.
 */ function enableAnimatedEmojiSources(content) {
    var updated = 0;
    var visited = new WeakSet();
    function visit(value) {
        if (!value || (typeof value === "undefined" ? "undefined" : _type_of$7(value)) !== 'object' || visited.has(value)) return;
        visited.add(value);
        if (Array.isArray(value)) {
            var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
            try {
                for(var _iterator = value[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                    var child = _step.value;
                    visit(child);
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
            return;
        }
        var node = value;
        if (node.type === 'customEmoji' && typeof node.src === 'string') {
            var source = animatedGifSource(node.src);
            if (source) {
                node.src = source;
                if (typeof node.frozenSrc === 'string') node.frozenSrc = source;
                updated++;
            }
        }
        var _iteratorNormalCompletion1 = true, _didIteratorError1 = false, _iteratorError1 = undefined;
        try {
            for(var _iterator1 = Object.values(node)[Symbol.iterator](), _step1; !(_iteratorNormalCompletion1 = (_step1 = _iterator1.next()).done); _iteratorNormalCompletion1 = true){
                var child1 = _step1.value;
                visit(child1);
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
    visit(content);
    return updated;
}/** `true` inside an embed, where media should play on its own. */ var EmbeddedMediaContext = /*#__PURE__*/ window.React.createContext(false);/**
 * @description Replaces a media component with one that changes its props inside an embed. The swap is by hand because the patcher calls the original as a function, and these can be class components.
 * @template P The component's props.
 * @param holder The object holding the component, such as a module or a `memo`.
 * @param key The property the component is stored under.
 * @param embeddedProps Maps the component's props inside an embed.
 * @returns A function that puts the original component back.
 */ function embedComponent(holder, key, embeddedProps) {
    var _Original_displayName;
    var Original = holder[key];
    function Embedded(props) {
        var embedded = window.React.useContext(EmbeddedMediaContext);
        return /*#__PURE__*/ React.createElement(Original, embedded ? embeddedProps(props) : props);
    }
    Embedded.defaultProps = Original.defaultProps;
    Embedded.displayName = (_Original_displayName = Original.displayName) !== null && _Original_displayName !== void 0 ? _Original_displayName : Original.name;
    holder[key] = Embedded;
    return function() {
        if (holder[key] === Embedded) holder[key] = Original;
    };
}/**
 * @description Loops Lottie animations inside embeds.
 * @param LottieAnimationView The `LottieAnimationView` module.
 * @returns A function that restores `LottieAnimationView`.
 */ function patchLottieAnimationView(LottieAnimationView) {
    var modules = {
        LottieAnimationView: LottieAnimationView.default
    };
    if (!ensureModules('Message Link Embeds: animated Lottie', modules)) return function() {};
    return embedComponent(LottieAnimationView, 'default', animatedLottieProps);
}/**
 * @description Loops Lottie stickers inside embeds.
 * @param NativeLottieView The `NativeLottieView` module.
 * @returns A function that restores `NativeLottieView`.
 */ function patchNativeLottieView(NativeLottieView) {
    var modules = {
        NativeLottieView: NativeLottieView.default
    };
    if (!ensureModules('Message Link Embeds: animated stickers', modules)) return function() {};
    return embedComponent(NativeLottieView, 'default', animatedLottieProps);
}var MESSAGE_LINK_PATTERN = /https?:\/\/(?:\w+\.)?discord(?:app)?\.com\/channels\/(?:(?:\d{17,20}|@me)\/)?(\d{17,20})\/(\d{17,20})/g;
var Surface = {
    minWidth: 80,
    minHeight: 72,
    maxHeight: 520,
    bottomTrim: 5,
    settleDelay: 80,
    spacerFontSize: 3,
    topGap: 1,
    background: '#2b2d31'
};
var CollapsedRemount = {
    minHeight: 8,
    delay: 400,
    limit: 5
};
var CellRetry = {
    limit: 8,
    delay: 120
};
var BottomScroll = {
    frame: 16,
    attempts: 12
};
// The order `layoutMetricsFromNative` reads them in.
var TABLE_METRICS = [
    'contentSize',
    'contentOffset',
    'bounds',
    'transform',
    'adjustedContentInset'
];
var SCROLL_STATE = [
    'isTracking',
    'isDragging',
    'isDecelerating'
];
var INITIAL_SCAN_DELAYS = [
    0,
    300,
    1500
];
var WINDOW_SCAN_DELAY = 150;function _class_call_check(instance, Constructor) {
    if (!(instance instanceof Constructor)) throw new TypeError("Cannot call a class as a function");
}
function _defineProperties(target, props) {
    for(var i = 0; i < props.length; i++){
        var descriptor = props[i];
        descriptor.enumerable = descriptor.enumerable || false;
        descriptor.configurable = true;
        if ("value" in descriptor) descriptor.writable = true;
        Object.defineProperty(target, descriptor.key, descriptor);
    }
}
function _create_class(Constructor, protoProps, staticProps) {
    if (protoProps) _defineProperties(Constructor.prototype, protoProps);
    return Constructor;
}
function _define_property$6(obj, key, value) {
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
function _type_of$6(obj) {
    "@swc/helpers - typeof";
    return obj && typeof Symbol !== "undefined" && obj.constructor === Symbol ? "symbol" : typeof obj;
}
// The bridge returns structs either as their fields or wrapped as `{ name, value }`.
function structFields(raw) {
    if (!raw || (typeof raw === "undefined" ? "undefined" : _type_of$6(raw)) !== 'object') return {};
    var struct = raw;
    return struct.value && _type_of$6(struct.value) === 'object' ? struct.value : raw;
}
function bottomOffset(metrics) {
    var maximumOffset = metrics.contentHeight - metrics.viewportHeight + metrics.bottomInset;
    return metrics.inverted ? -metrics.topInset : Math.max(-metrics.topInset, maximumOffset);
}
/**
 * @description Computes how wide an embed can be, from the message label's frame in its cell.
 * @param labelInCell The label's `CGRect` converted into the cell's coordinates.
 * @param cellBounds The cell's `bounds`.
 * @returns The width from the label's left edge to the cell's right padding, or the label's own width.
 */ function availableMessageWidthFromNative(labelInCell, cellBounds) {
    var label = structFields(labelInCell);
    var labelWidth = Number(structFields(label.size).width);
    var left = Number(structFields(label.origin).x);
    var cellWidth = Number(structFields(structFields(cellBounds).size).width);
    if (!Number.isFinite(labelWidth)) return 0;
    if (!Number.isFinite(cellWidth) || !Number.isFinite(left)) return labelWidth;
    var availableWidth = cellWidth - left - 12;
    if (!Number.isFinite(availableWidth) || availableWidth < Surface.minWidth) return labelWidth;
    return Math.max(labelWidth, Math.min(cellWidth, availableWidth));
}
/**
 * @description Reads a table view's scroll geometry from its native values.
 * @param values `contentSize`, `contentOffset`, `bounds`, `transform`, and `adjustedContentInset`, in that order.
 * @returns The table's layout metrics.
 */ function layoutMetricsFromNative(values) {
    var _contentInset_bottom, _contentInset_top;
    var contentSize = structFields(values[0]);
    var contentOffset = structFields(values[1]);
    var boundsSize = structFields(structFields(values[2]).size);
    var transform = structFields(values[3]);
    var contentInset = structFields(values[4]);
    return {
        bottomInset: Number((_contentInset_bottom = contentInset.bottom) !== null && _contentInset_bottom !== void 0 ? _contentInset_bottom : 0),
        contentHeight: Number(contentSize.height),
        inverted: Number(transform.d) < 0,
        offsetX: Number(contentOffset.x),
        offsetY: Number(contentOffset.y),
        topInset: Number((_contentInset_top = contentInset.top) !== null && _contentInset_top !== void 0 ? _contentInset_top : 0),
        viewportHeight: Number(boundsSize.height)
    };
}
/**
 * @description Records where the chat is scrolled and whether that is its bottom.
 * @param metrics The table's layout metrics.
 * @param tolerance How far from the bottom still counts as at the bottom, in points.
 * @returns The current scroll anchor.
 */ function readBottomAnchor(metrics) {
    var tolerance = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : 36;
    var targetOffset = bottomOffset(metrics);
    var atBottom = Number.isFinite(targetOffset) && Number.isFinite(metrics.offsetY) && Math.abs(targetOffset - metrics.offsetY) <= Math.max(tolerance, metrics.topInset + metrics.bottomInset);
    return {
        atBottom: atBottom,
        inverted: metrics.inverted,
        x: Number.isFinite(metrics.offsetX) ? metrics.offsetX : 0,
        y: Number.isFinite(metrics.offsetY) ? metrics.offsetY : 0
    };
}
/**
 * @description Records the scroll anchor for an embed, pinning the latest message to the bottom while it is near it.
 * @param metrics The table's layout metrics.
 * @param followsLatestMessage Whether the embed belongs to the channel's latest message.
 * @param tolerance How far from the bottom still counts as at the bottom, in points.
 * @returns The scroll anchor to restore after the embed resizes.
 */ function readSurfaceAnchor(metrics, followsLatestMessage) {
    var tolerance = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : 36;
    var anchor = readBottomAnchor(metrics, tolerance);
    if (followsLatestMessage && Number.isFinite(metrics.offsetY) && Math.abs(bottomOffset(metrics) - metrics.offsetY) <= Surface.maxHeight) {
        anchor.atBottom = true;
    }
    return anchor;
}
/**
 * @description Computes the scroll offset that puts the chat back at its bottom after a row resized.
 * @param anchor The anchor captured before the resize.
 * @param metrics The table's layout metrics after the resize.
 * @param userIsScrolling Whether the user is touching or flinging the table.
 * @returns The offset to scroll to, or `undefined` when no correction is needed.
 */ function bottomOffsetCorrection(anchor, metrics, userIsScrolling) {
    if (!anchor.atBottom || userIsScrolling) return;
    var targetOffset = bottomOffset(metrics);
    if (!Number.isFinite(targetOffset) || !Number.isFinite(metrics.offsetY)) return;
    if (Math.abs(targetOffset - metrics.offsetY) <= 1) return;
    return {
        x: anchor.x,
        y: targetOffset
    };
}
/**
 * @description Builds the height cache key for an embed of one message at one width.
 * @param channelId The linked message's channel.
 * @param messageId The linked message.
 * @param width The embed's width.
 * @returns The cache key.
 */ function surfaceHeightCacheKey(channelId, messageId, width) {
    return "".concat(channelId, ":").concat(messageId, ":").concat(Math.round(width));
}
/** Holds a bottom anchor until a resize lands, then yields the one correction it needs. */ var BottomAnchorTracker = /*#__PURE__*/ function() {
    function BottomAnchorTracker() {
        _class_call_check(this, BottomAnchorTracker);
        _define_property$6(this, "anchor", void 0);
    }
    _create_class(BottomAnchorTracker, [
        {
            key: "pending",
            get: function get() {
                return this.anchor !== undefined;
            }
        },
        {
            key: "capture",
            value: function capture(anchor) {
                if (!(anchor === null || anchor === void 0 ? void 0 : anchor.atBottom) || this.anchor) return;
                this.anchor = anchor;
            }
        },
        {
            key: "correction",
            value: function correction(metrics, userIsScrolling) {
                if (!this.anchor) return;
                if (userIsScrolling) {
                    this.clear();
                    return;
                }
                var correction = bottomOffsetCorrection(this.anchor, metrics, false);
                if (correction) this.clear();
                return correction;
            }
        },
        {
            key: "clear",
            value: function clear() {
                this.anchor = undefined;
            }
        }
    ]);
    return BottomAnchorTracker;
}();
/** Remembers measured embed heights so a recycled cell starts at the right size. */ var SurfaceHeightCache = /*#__PURE__*/ function() {
    function SurfaceHeightCache() {
        var limit = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : 128;
        _class_call_check(this, SurfaceHeightCache);
        _define_property$6(this, "limit", void 0);
        _define_property$6(this, "values", void 0);
        this.limit = limit;
        this.values = new Map();
    }
    _create_class(SurfaceHeightCache, [
        {
            key: "get",
            value: function get(key, fallback) {
                var height = this.values.get(key);
                if (height === undefined) return fallback;
                this.values.delete(key);
                this.values.set(key, height);
                return height;
            }
        },
        {
            key: "set",
            value: function set(key, height) {
                if (!Number.isFinite(height) || height <= 0) return;
                this.values.delete(key);
                this.values.set(key, height);
                if (this.values.size > this.limit) {
                    this.values.delete(this.values.keys().next().value);
                }
            }
        }
    ]);
    return SurfaceHeightCache;
}();function _array_like_to_array$b(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_with_holes$9(arr) {
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
function _iterable_to_array_limit$9(arr, i) {
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
function _non_iterable_rest$9() {
    throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _sliced_to_array$9(arr, i) {
    return _array_with_holes$9(arr) || _iterable_to_array_limit$9(arr, i) || _unsupported_iterable_to_array$b(arr, i) || _non_iterable_rest$9();
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
function _type_of$5(obj) {
    "@swc/helpers - typeof";
    return obj && typeof Symbol !== "undefined" && obj.constructor === Symbol ? "symbol" : typeof obj;
}
function _unsupported_iterable_to_array$b(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _array_like_to_array$b(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(n);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _array_like_to_array$b(o, minLen);
}
/**
 * @description Reads a native value as a string, through `description` when it is an object.
 * @param objc The Objective-C bridge.
 * @param value A string or an object handle.
 * @returns The string, or `undefined` when there is none.
 */ function nativeString$1(objc, value) {
    if (typeof value === 'string') return value;
    if (!value || (typeof value === "undefined" ? "undefined" : _type_of$5(value)) !== 'object') return;
    var handle = value;
    if (!objc.respondsTo(handle, 'description')) return;
    var description = safeInvoke(objc, handle, 'description');
    return typeof description === 'string' ? description : undefined;
}
/**
 * @description Builds a `CGRect` at the origin.
 * @param objc The Objective-C bridge.
 * @param width The rectangle's width.
 * @param height The rectangle's height.
 * @returns The struct.
 */ function nativeFrame(objc, width, height) {
    return objc.struct('CGRect', {
        origin: {
            x: 0,
            y: 0
        },
        size: {
            width: width,
            height: height
        }
    });
}
/**
 * @description Reads a label's attributed text and its plain string in one batch.
 * @param objc The Objective-C bridge.
 * @param label The label.
 * @returns Both texts, or `undefined` when the label has none or the read failed.
 */ function readLabelText(objc, label) {
    return _async_to_generator$8(function() {
        var _ref, attributedText, text;
        return _ts_generator$8(this, function(_state) {
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
                        objc.batch([
                            {
                                target: label,
                                selector: 'attributedText',
                                args: []
                            },
                            {
                                target: {
                                    $nativeBatchResult: 0
                                },
                                selector: 'string',
                                args: []
                            }
                        ])
                    ];
                case 1:
                    _ref = _sliced_to_array$9.apply(void 0, [
                        _state.sent(),
                        2
                    ]), attributedText = _ref[0], text = _ref[1];
                    if (!attributedText || typeof text !== 'string') return [
                        2
                    ];
                    return [
                        2,
                        {
                            attributedText: attributedText,
                            text: text
                        }
                    ];
                case 2:
                    _state.sent();
                    return [
                        2
                    ];
                case 3:
                    return [
                        2
                    ];
            }
        });
    })();
}
/**
 * @description Finds the table view that holds a cell.
 * @param objc The Objective-C bridge.
 * @param cell The cell.
 * @returns The table, or `null` when the cell is not in one.
 */ function findTable(objc, cell) {
    return _async_to_generator$8(function() {
        var _tables_find, tables;
        return _ts_generator$8(this, function(_state) {
            switch(_state.label){
                case 0:
                    return [
                        4,
                        objc.findViews(cell, 'UITableView', {
                            direction: 'ancestors',
                            maxDepth: 14,
                            maxResults: 1,
                            stopAtMatch: true
                        })
                    ];
                case 1:
                    tables = _state.sent();
                    return [
                        2,
                        (_tables_find = tables.find(function(view) {
                            return objc.respondsTo(view, 'beginUpdates') && objc.respondsTo(view, 'endUpdates');
                        })) !== null && _tables_find !== void 0 ? _tables_find : null
                    ];
            }
        });
    })();
}
/**
 * @description Measures how wide an embed under a message label can be.
 * @param objc The Objective-C bridge.
 * @param cell The message's cell.
 * @param label The message's text label.
 * @returns The available width in points.
 */ function availableMessageWidth(objc, cell, label) {
    return _async_to_generator$8(function() {
        var values;
        return _ts_generator$8(this, function(_state) {
            switch(_state.label){
                case 0:
                    return [
                        4,
                        objc.batch([
                            {
                                target: label,
                                selector: 'bounds',
                                args: []
                            },
                            {
                                target: label,
                                selector: 'convertRect:toView:',
                                args: [
                                    {
                                        $nativeBatchResult: 0
                                    },
                                    cell
                                ]
                            },
                            {
                                target: cell,
                                selector: 'bounds',
                                args: []
                            }
                        ])
                    ];
                case 1:
                    values = _state.sent();
                    return [
                        2,
                        availableMessageWidthFromNative(values[1], values[2])
                    ];
            }
        });
    })();
}function _array_like_to_array$a(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_without_holes$5(arr) {
    if (Array.isArray(arr)) return _array_like_to_array$a(arr);
}
function asyncGeneratorStep$7(gen, resolve, reject, _next, _throw, key, arg) {
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
function _iterable_to_array$5(iter) {
    if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) {
        return Array.from(iter);
    }
}
function _non_iterable_spread$5() {
    throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _to_consumable_array$5(arr) {
    return _array_without_holes$5(arr) || _iterable_to_array$5(arr) || _unsupported_iterable_to_array$a(arr) || _non_iterable_spread$5();
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
function _unsupported_iterable_to_array$a(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _array_like_to_array$a(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(n);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _array_like_to_array$a(o, minLen);
}
function steps(target, selectors) {
    return selectors.map(function(selector) {
        return {
            target: target,
            selector: selector,
            args: []
        };
    });
}
function followsLatestMessage(surface) {
    var _MessageStore_getLastMessage;
    return ((_MessageStore_getLastMessage = MessageStore.getLastMessage(surface.target.channelId)) === null || _MessageStore_getLastMessage === void 0 ? void 0 : _MessageStore_getLastMessage.id) === surface.messageId;
}
/**
 * @description Remembers whether the chat is at its bottom before an embed resizes, so the resize can keep it there.
 * @param session The running session.
 * @param surface The embed about to resize.
 * @param table The chat's table view.
 */ function captureBottomAnchor(session, surface, table) {
    var values = TABLE_METRICS.map(function(selector) {
        return safeInvoke(session.objc, table, selector);
    });
    surface.bottomAnchor.capture(readSurfaceAnchor(layoutMetricsFromNative(values), followsLatestMessage(surface)));
}
function scheduleBottomScrollCorrection(session, surface, table) {
    var objc = session.objc, timers = session.timers;
    if (!surface.bottomAnchor.pending || surface.bottomScrollTimer || surface.bottomScrollPending) {
        return;
    }
    var attempts = 0;
    function correct() {
        return _async_to_generator$7(function() {
            var values, metrics, correction, scrolling;
            return _ts_generator$7(this, function(_state) {
                switch(_state.label){
                    case 0:
                        surface.bottomScrollTimer = undefined;
                        if (surface.disposed) {
                            surface.bottomAnchor.clear();
                            return [
                                2
                            ];
                        }
                        surface.bottomScrollPending = true;
                        _state.label = 1;
                    case 1:
                        _state.trys.push([
                            1,
                            7,
                            8,
                            9
                        ]);
                        return [
                            4,
                            objc.batch(_to_consumable_array$5(steps(surface.label, [
                                'layoutIfNeeded'
                            ])).concat(_to_consumable_array$5(steps(surface.cell, [
                                'layoutIfNeeded'
                            ])), _to_consumable_array$5(steps(table, [
                                'layoutIfNeeded'
                            ].concat(_to_consumable_array$5(TABLE_METRICS), _to_consumable_array$5(SCROLL_STATE))))))
                        ];
                    case 2:
                        values = _state.sent();
                        if (surface.disposed) {
                            surface.bottomAnchor.clear();
                            return [
                                2
                            ];
                        }
                        metrics = layoutMetricsFromNative(values.slice(3, 8));
                        correction = surface.bottomAnchor.correction(metrics, values.slice(8).some(Boolean));
                        if (!correction) return [
                            3,
                            6
                        ];
                        return [
                            4,
                            objc.batch(steps(table, SCROLL_STATE))
                        ];
                    case 3:
                        scrolling = _state.sent();
                        if (surface.disposed) {
                            surface.bottomAnchor.clear();
                            return [
                                2
                            ];
                        }
                        if (!!scrolling.some(Boolean)) return [
                            3,
                            5
                        ];
                        return [
                            4,
                            objc.invokeAsync(table, 'setContentOffset:animated:', [
                                objc.struct('CGPoint', correction),
                                false
                            ])
                        ];
                    case 4:
                        _state.sent();
                        _state.label = 5;
                    case 5:
                        return [
                            2
                        ];
                    case 6:
                        // The row has not published its new height yet; look again next frame.
                        if (surface.bottomAnchor.pending && attempts < BottomScroll.attempts) {
                            attempts++;
                            surface.bottomScrollTimer = timers.later(function() {
                                return void correct();
                            }, BottomScroll.frame);
                            return [
                                2
                            ];
                        }
                        surface.bottomAnchor.clear();
                        return [
                            3,
                            9
                        ];
                    case 7:
                        _state.sent();
                        surface.bottomAnchor.clear();
                        return [
                            3,
                            9
                        ];
                    case 8:
                        surface.bottomScrollPending = false;
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
    surface.bottomScrollTimer = timers.later(function() {
        return void correct();
    }, BottomScroll.frame);
}
/**
 * @description Cancels a pending reaction scroll correction.
 * @param session The running session.
 * @param surface The embed.
 */ function clearReactionLayout(session, surface) {
    session.timers.cancel(surface.reactionLayoutTimer);
    surface.reactionLayoutTimer = undefined;
}
/**
 * @description Keeps the chat at its bottom after the message holding an embed gains or loses a reaction row.
 * @param session The running session.
 * @param surface The embed whose message's reactions changed.
 */ function scheduleReactionScrollCorrection(session, surface) {
    clearReactionLayout(session, surface);
    surface.reactionLayoutTimer = session.timers.later(function() {
        surface.reactionLayoutTimer = undefined;
        if (surface.disposed) return;
        void findTable(session.objc, surface.cell).then(function(table) {
            if (surface.disposed) return;
            surface.table = table;
            if (table) scheduleBottomScrollCorrection(session, surface, table);
        }).catch(function() {
            return undefined;
        });
    }, Surface.settleDelay);
}
/**
 * @description Makes the table re-measure the row that holds an embed, then keeps the chat at its bottom.
 * @param session The running session.
 * @param surface The embed whose height changed.
 * @param force Whether to re-measure even when the height is the one last measured.
 */ function refreshRowSize(session, surface, force) {
    var objc = session.objc;
    if (!force && surface.lastInvalidatedHeight === surface.height) return;
    surface.lastInvalidatedHeight = surface.height;
    var generation = ++surface.rowRefreshGeneration;
    function isCurrent() {
        return !surface.disposed && surface.rowRefreshGeneration === generation;
    }
    function refresh() {
        return _async_to_generator$7(function() {
            var table, values;
            return _ts_generator$7(this, function(_state) {
                switch(_state.label){
                    case 0:
                        _state.trys.push([
                            0,
                            3,
                            ,
                            4
                        ]);
                        return [
                            4,
                            findTable(objc, surface.cell)
                        ];
                    case 1:
                        table = _state.sent();
                        if (!isCurrent()) return [
                            2
                        ];
                        if (!table) {
                            surface.table = null;
                            surface.lastInvalidatedHeight = -1;
                            surface.bottomAnchor.clear();
                            return [
                                2
                            ];
                        }
                        surface.table = table;
                        return [
                            4,
                            objc.batch(_to_consumable_array$5(steps(table, TABLE_METRICS)).concat(_to_consumable_array$5(steps(surface.label, [
                                'invalidateIntrinsicContentSize',
                                'setNeedsLayout'
                            ])), _to_consumable_array$5(steps(surface.cell, [
                                'setNeedsUpdateConstraints',
                                'setNeedsLayout'
                            ])), _to_consumable_array$5(steps(table, [
                                'beginUpdates',
                                'endUpdates'
                            ]))))
                        ];
                    case 2:
                        values = _state.sent();
                        if (!isCurrent()) return [
                            2
                        ];
                        surface.bottomAnchor.capture(readSurfaceAnchor(layoutMetricsFromNative(values.slice(0, TABLE_METRICS.length)), followsLatestMessage(surface)));
                        scheduleBottomScrollCorrection(session, surface, table);
                        return [
                            3,
                            4
                        ];
                    case 3:
                        _state.sent();
                        if (surface.rowRefreshGeneration !== generation) return [
                            2
                        ];
                        surface.lastInvalidatedHeight = -1;
                        surface.bottomAnchor.clear();
                        return [
                            3,
                            4
                        ];
                    case 4:
                        return [
                            2
                        ];
                }
            });
        })();
    }
    void refresh();
}function _array_like_to_array$9(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_with_holes$8(arr) {
    if (Array.isArray(arr)) return arr;
}
function _array_without_holes$4(arr) {
    if (Array.isArray(arr)) return _array_like_to_array$9(arr);
}
function _iterable_to_array$4(iter) {
    if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) {
        return Array.from(iter);
    }
}
function _iterable_to_array_limit$8(arr, i) {
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
function _non_iterable_rest$8() {
    throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _non_iterable_spread$4() {
    throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _sliced_to_array$8(arr, i) {
    return _array_with_holes$8(arr) || _iterable_to_array_limit$8(arr, i) || _unsupported_iterable_to_array$9(arr, i) || _non_iterable_rest$8();
}
function _to_consumable_array$4(arr) {
    return _array_without_holes$4(arr) || _iterable_to_array$4(arr) || _unsupported_iterable_to_array$9(arr) || _non_iterable_spread$4();
}
function _type_of$4(obj) {
    "@swc/helpers - typeof";
    return obj && typeof Symbol !== "undefined" && obj.constructor === Symbol ? "symbol" : typeof obj;
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
 * @description Builds the key that identifies a linked message across channels.
 * @param target The linked message.
 * @returns `channelId:messageId`.
 */ function targetKey(param) {
    var channelId = param.channelId, messageId = param.messageId;
    return "".concat(channelId, ":").concat(messageId);
}
/**
 * @description Converts a Discord role color string into the ARGB number React Native's native text expects.
 * @param value The `#rrggbb` color string.
 * @returns The opaque color as a signed 32-bit ARGB integer, which Android's row parser requires, or `undefined` for anything that is not six hex digits.
 */ function nativeUsernameColor(value) {
    if (typeof value !== 'string') return;
    var match = /^#?([0-9a-f]{6})$/i.exec(value.trim());
    if (!match) return;
    return Number.parseInt("ff".concat(match[1]), 16) | 0;
}
/**
 * @description Flattens message content, plain or parsed into rich nodes, into its text.
 * @param value The content string or node tree.
 * @returns The concatenated text, including link targets of link nodes.
 */ function contentText(value) {
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) return value.map(contentText).join('');
    if (!value || (typeof value === "undefined" ? "undefined" : _type_of$4(value)) !== 'object') return '';
    var node = value;
    var link = typeof node.originalLink === 'string' ? node.originalLink : '';
    var text = typeof node.text === 'string' ? node.text : '';
    return "".concat(contentText(node.content)).concat(link).concat(text);
}
/**
 * @description Finds every distinct Discord message link in a message.
 * @param message The message to scan.
 * @returns The linked messages, in order of first appearance.
 */ function linkedTargets(message) {
    var targets = new Map();
    var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
    try {
        for(var _iterator = contentText(message.content).matchAll(MESSAGE_LINK_PATTERN)[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
            var _step_value = _sliced_to_array$8(_step.value, 3), channelId = _step_value[1], messageId = _step_value[2];
            var target = {
                channelId: channelId,
                messageId: messageId
            };
            if (!targets.has(targetKey(target))) targets.set(targetKey(target), target);
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
    return _to_consumable_array$4(targets.values());
}
var CHIP_OPENING = '\uFFFC\u2068\u2060\u200B';
var CHIP_CLOSING = '\uFFFC\u2068\u2069\u2060\u2009\u200B';
var CHIP_ICON = /[\uFFFC\u200B]/;
/**
 * @description Locates the rendered channel mention of a message link inside a label's text.
 * @param text The label's plain text.
 * @param channelName The name of the linked message's channel.
 * @returns The range of the mention, including its attachment and bidi markers, or `undefined`.
 */ function findRenderedLinkRange(text, channelName) {
    if (!channelName) return;
    var searchFrom = 0;
    while(searchFrom < text.length){
        var location = text.indexOf(channelName, searchFrom);
        if (location === -1) return;
        var start = location;
        var end = location + channelName.length;
        while(start > 0 && CHIP_OPENING.includes(text[start - 1]))start--;
        while(end < text.length && CHIP_CLOSING.includes(text[end]))end++;
        if (CHIP_ICON.test(text.slice(start, end)) && start < location && end > location + channelName.length) {
            return {
                location: start,
                length: end - start
            };
        }
        searchFrom = location + channelName.length;
    }
}function _type_of$3(obj) {
    "@swc/helpers - typeof";
    return obj && typeof Symbol !== "undefined" && obj.constructor === Symbol ? "symbol" : typeof obj;
}
/**
 * @description Reads the font of the attachment that draws a rendered channel mention.
 * @param objc The Objective-C bridge.
 * @param attributedText The label's attributed text.
 * @param range The mention's range.
 * @returns The mention's font, or `null` when it has none.
 */ function linkFont(objc, attributedText, range) {
    var _nativeString;
    var text = (_nativeString = nativeString$1(objc, safeInvoke(objc, attributedText, 'string'))) !== null && _nativeString !== void 0 ? _nativeString : '';
    for(var index = range.location, end = range.location + range.length; index < end; index++){
        var _attributes_NSFont;
        if (text[index] !== '\uFFFC') continue;
        var attributes = safeInvoke(objc, attributedText, 'attributesAtIndex:effectiveRange:', index, null);
        if (!isFontRun(attributes) || !isAttachmentRun(attributes)) continue;
        return (_attributes_NSFont = attributes.NSFont) !== null && _attributes_NSFont !== void 0 ? _attributes_NSFont : null;
    }
    return null;
}
function isFontRun(value) {
    return (typeof value === "undefined" ? "undefined" : _type_of$3(value)) === 'object' && value !== null;
}
function plainText(objc, value, font) {
    var text = objc.alloc('NSMutableAttributedString');
    safeInvoke(objc, text, 'initWithString:attributes:', value, font ? {
        NSFont: font
    } : {});
    return text;
}
/**
 * @description Builds the text inserted after a channel mention: a line break, a small spacer line, and an attachment reserving the embed's size.
 * @param objc The Objective-C bridge.
 * @param insertion The host view, the label's original text, the mention's range and font, the embed's size and the label's text engine.
 * @returns The attributed string to insert and where its attachment sits in it, or `null` when the engine's attachment class is missing.
 */ function surfaceInsertion(objc, param) {
    var host = param.host, original = param.original, range = param.range, font = param.font, width = param.width, height = param.height, engine = param.engine;
    var _nativeString;
    var attachment = viewAttachment(textAttachmentBridge(objc), engine, {
        attributes: font ? {
            NSFont: font
        } : {},
        view: host,
        width: width,
        height: height
    });
    if (!attachment) return null;
    var sourceText = (_nativeString = nativeString$1(objc, safeInvoke(objc, original, 'string'))) !== null && _nativeString !== void 0 ? _nativeString : '';
    var insertAt = range.location + range.length;
    var leadingNewline = sourceText[insertAt - 1] === '\n' ? '' : '\n';
    var trailingNewline = sourceText.slice(insertAt).trim().length > 0 ? '\n' : '';
    var spacerFont = font ? safeInvoke(objc, font, 'fontWithSize:', Surface.spacerFontSize) : null;
    var insertion = objc.alloc('NSMutableAttributedString');
    safeInvoke(objc, insertion, 'init');
    for(var _i = 0, _iter = [
        plainText(objc, leadingNewline, font),
        plainText(objc, '\u200B\n', spacerFont !== null && spacerFont !== void 0 ? spacerFont : font),
        attachment,
        plainText(objc, trailingNewline, font)
    ]; _i < _iter.length; _i++){
        var part = _iter[_i];
        safeInvoke(objc, insertion, 'appendAttributedString:', part);
    }
    return {
        text: insertion,
        attachmentOffset: leadingNewline.length + 2
    };
}function _array_like_to_array$8(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_with_holes$7(arr) {
    if (Array.isArray(arr)) return arr;
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
function _iterable_to_array_limit$7(arr, i) {
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
function _non_iterable_rest$7() {
    throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _sliced_to_array$7(arr, i) {
    return _array_with_holes$7(arr) || _iterable_to_array_limit$7(arr, i) || _unsupported_iterable_to_array$8(arr, i) || _non_iterable_rest$7();
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
function _unsupported_iterable_to_array$8(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _array_like_to_array$8(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(n);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _array_like_to_array$8(o, minLen);
}
/**
 * @description Inserts the embed's attachment after the channel mention and sets it as the label's text.
 * @param session The running session.
 * @param surface The embed.
 * @param forceRefresh Whether to resize the row even when the embed's height did not change.
 * @returns `true` when the label now shows the embed.
 */ function applyAttachment(session, surface) {
    var forceRefresh = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : false;
    var objc = session.objc;
    if (surface.applying) return false;
    // The label's own text hook fires for this write, and must ignore it.
    surface.applying = true;
    try {
        var insertion = surfaceInsertion(objc, surface);
        if (!insertion) return false;
        var insertAt = surface.range.location + surface.range.length;
        var updated = safeInvoke(objc, surface.original, 'mutableCopy');
        if (!updated) return false;
        safeInvoke(objc, updated, 'insertAttributedString:atIndex:', insertion.text, insertAt);
        var text = nativeString$1(objc, safeInvoke(objc, updated, 'string'));
        if (text === undefined) return false;
        surface.rendered = updated;
        surface.renderedText = text;
        surface.attachmentIndex = insertAt + insertion.attachmentOffset;
        safeInvoke(objc, surface.label, 'setAttributedText:', updated);
        safeInvoke(objc, surface.label, 'setNeedsLayout');
        refreshRowSize(session, surface, forceRefresh);
        placeHost$1(session, surface);
        return true;
    } finally{
        surface.applying = false;
    }
}
function placeHost$1(session, surface) {
    if (surface.engine !== 'textkit' || surface.placing || surface.disposed) return;
    surface.placing = true;
    void placeAttachedViews(textAttachmentBridge(session.objc), surface.label, [
        {
            view: surface.host,
            index: surface.attachmentIndex
        }
    ]).catch(function() {
        return undefined;
    }).finally(function() {
        surface.placing = false;
        if (surface.disposed) safeInvoke(session.objc, surface.host, 'removeFromSuperview');
    });
}
function hookLayout(session, surface) {
    if (surface.engine !== 'textkit') return null;
    try {
        var _session_objc_className;
        return session.objc.hook((_session_objc_className = session.objc.className(surface.label)) !== null && _session_objc_className !== void 0 ? _session_objc_className : MESSAGE_TEXT_VIEW_CLASSES[0], 'layoutSubviews', {
            after: function after() {
                return placeHost$1(session, surface);
            }
        }, {
            instance: surface.label
        });
    } catch (unused) {
        return null;
    }
}
/**
 * @description Re-applies an embed to a label whose text Discord replaced.
 * @param session The running session.
 * @param surface The embed.
 * @param attributedText The label's new text.
 * @param range The channel mention's range in the new text.
 */ function updateSurface(session, surface, attributedText, range) {
    surface.original = attributedText;
    surface.range = range;
    surface.font = linkFont(session.objc, attributedText, range);
    applyAttachment(session, surface, true);
}
/**
 * @description Puts the embed back when Discord re-renders the label's text without it.
 * @param session The running session.
 * @param surface The embed.
 */ function reconcileSurfaceText(session, surface) {
    return _async_to_generator$6(function() {
        var label, range;
        return _ts_generator$6(this, function(_state) {
            switch(_state.label){
                case 0:
                    if (surface.reconciling) {
                        surface.reconcileQueued = true;
                        return [
                            2
                        ];
                    }
                    surface.reconciling = true;
                    _state.label = 1;
                case 1:
                    _state.trys.push([
                        1,
                        3,
                        4,
                        5
                    ]);
                    return [
                        4,
                        readLabelText(session.objc, surface.label)
                    ];
                case 2:
                    label = _state.sent();
                    if (surface.disposed || !label || label.text === surface.renderedText) return [
                        2
                    ];
                    range = findRenderedLinkRange(label.text, surface.channelName);
                    if (range) updateSurface(session, surface, label.attributedText, range);
                    return [
                        3,
                        5
                    ];
                case 3:
                    _state.sent();
                    return [
                        3,
                        5
                    ];
                case 4:
                    surface.reconciling = false;
                    if (surface.reconcileQueued) {
                        surface.reconcileQueued = false;
                        void reconcileSurfaceText(session, surface);
                    }
                    return [
                        7
                    ];
                case 5:
                    return [
                        2
                    ];
            }
        });
    })();
}
function clearSurfaceTimers(session, surface) {
    session.timers.cancel(surface.layoutTimer);
    session.timers.cancel(surface.bottomScrollTimer);
    clearReactionLayout(session, surface);
    surface.layoutTimer = undefined;
    surface.bottomScrollTimer = undefined;
    surface.pendingHeight = null;
    surface.bottomAnchor.clear();
}
/**
 * @description Removes an embed: unmounts its surface, detaches its host view, and optionally restores the label's original text.
 * @param session The running session.
 * @param surface The embed.
 * @param restore Whether to put the label's text back as it was before the embed.
 */ function teardownSurface(session, surface, restore) {
    var _surface_labelHook, _surface_layoutHook;
    var objc = session.objc, fabric = session.fabric;
    surface.disposed = true;
    clearSurfaceTimers(session, surface);
    (_surface_labelHook = surface.labelHook) === null || _surface_labelHook === void 0 ? void 0 : _surface_labelHook.remove();
    (_surface_layoutHook = surface.layoutHook) === null || _surface_layoutHook === void 0 ? void 0 : _surface_layoutHook.remove();
    if (restore && surface.rendered) {
        var current = safeInvoke(objc, surface.label, 'attributedText');
        var currentText = current ? nativeString$1(objc, safeInvoke(objc, current, 'string')) : undefined;
        // Only restore text the embed wrote; Discord may have set new text since.
        if (current && (currentText === surface.renderedText || current === surface.rendered)) {
            safeInvoke(objc, surface.label, 'setAttributedText:', surface.original);
            safeInvoke(objc, surface.label, 'setNeedsLayout');
        }
    }
    if (surface.mounted) {
        try {
            fabric.unmount(surface.mounted);
        } catch (unused) {
        // The surface was already unmounted with its window.
        }
    }
    safeInvoke(objc, surface.host, 'removeFromSuperview');
    session.surfacesById.delete(surface.id);
    session.surfaces.delete(surface.cellKey);
}
/**
 * @description Creates an embed for a linked message: a host view sized for it, a mounted Fabric surface, and the attachment in the label.
 * @param session The running session.
 * @param init The cell, the label and mention to attach after, and the content to render.
 * @param isCurrent Tells whether the cell still shows the message this lookup started for.
 * @returns The embed, or `undefined` when the cell changed or a native step failed.
 */ function createSurface(session, init, isCurrent) {
    return _async_to_generator$6(function() {
        var objc, fabric, cell, cellKey, label, target, width, font, heightKey, height, _ref, host, table, surface, _objc_className;
        return _ts_generator$6(this, function(_state) {
            switch(_state.label){
                case 0:
                    objc = session.objc, fabric = session.fabric;
                    cell = init.cell, cellKey = init.cellKey, label = init.label, target = init.target;
                    _state.label = 1;
                case 1:
                    _state.trys.push([
                        1,
                        3,
                        ,
                        4
                    ]);
                    return [
                        4,
                        availableMessageWidth(objc, cell, label)
                    ];
                case 2:
                    width = _state.sent();
                    return [
                        3,
                        4
                    ];
                case 3:
                    _state.sent();
                    return [
                        2
                    ];
                case 4:
                    if (!isCurrent() || !Number.isFinite(width) || width < Surface.minWidth) return [
                        2
                    ];
                    font = linkFont(objc, init.attributedText, init.range);
                    heightKey = surfaceHeightCacheKey(target.channelId, target.messageId, width);
                    height = session.heights.get(heightKey, Surface.minHeight);
                    return [
                        4,
                        Promise.all([
                            createHost$1(session, width, height),
                            findTable(objc, cell).catch(function() {
                                return null;
                            })
                        ])
                    ];
                case 5:
                    _ref = _sliced_to_array$7.apply(void 0, [
                        _state.sent(),
                        2
                    ]), host = _ref[0], table = _ref[1];
                    if (!isCurrent() || !host) return [
                        2
                    ];
                    surface = {
                        id: "message-link-".concat(cellKey, "-").concat(init.messageId, "-").concat(target.messageId),
                        cell: cell,
                        cellKey: cellKey,
                        messageId: init.messageId,
                        target: target,
                        channelName: init.channelName,
                        record: init.content.record,
                        generator: init.content.generator,
                        reactionSnapshot: init.reactionSnapshot,
                        label: label,
                        labelHook: null,
                        layoutHook: null,
                        engine: textEngine(textAttachmentBridge(objc), label),
                        attachmentIndex: 0,
                        placing: false,
                        host: host,
                        mounted: null,
                        table: table,
                        original: init.attributedText,
                        range: init.range,
                        font: font,
                        rendered: null,
                        renderedText: null,
                        width: width,
                        height: height,
                        heightKey: heightKey,
                        pendingHeight: null,
                        lastInvalidatedHeight: -1,
                        rowRefreshGeneration: 0,
                        bottomScrollPending: false,
                        bottomAnchor: new BottomAnchorTracker(),
                        applying: false,
                        reconciling: false,
                        reconcileQueued: false,
                        disposed: false
                    };
                    if (table) captureBottomAnchor(session, surface, table);
                    session.surfacesById.set(surface.id, surface);
                    try {
                        ;
                        surface.labelHook = objc.hook((_objc_className = objc.className(label)) !== null && _objc_className !== void 0 ? _objc_className : MESSAGE_TEXT_VIEW_CLASSES[0], 'setAttributedText:', {
                            after: function after() {
                                if (surface.applying) return;
                                session.timers.later(function() {
                                    return void reconcileSurfaceText(session, surface);
                                });
                            }
                        }, {
                            instance: label
                        });
                        surface.layoutHook = hookLayout(session, surface);
                        surface.mounted = fabric.mount(host, session.surfaceModule, {
                            renderRevision: 0,
                            surfaceId: surface.id
                        });
                        fabric.setSize(surface.mounted, {
                            width: width,
                            height: Surface.minHeight
                        }, {
                            width: width,
                            height: Surface.maxHeight
                        });
                        session.surfaces.set(cellKey, surface);
                        if (!applyAttachment(session, surface)) {
                            throw new Error('Could not attach the Fabric message surface');
                        }
                        return [
                            2,
                            surface
                        ];
                    } catch (unused) {
                        teardownSurface(session, surface, false);
                        return [
                            2
                        ];
                    }
                    return [
                        2
                    ];
            }
        });
    })();
}
function createHost$1(session, width, height) {
    return _async_to_generator$6(function() {
        var objc, view;
        return _ts_generator$6(this, function(_state) {
            switch(_state.label){
                case 0:
                    objc = session.objc;
                    _state.label = 1;
                case 1:
                    _state.trys.push([
                        1,
                        3,
                        ,
                        4
                    ]);
                    view = objc.alloc('UIView');
                    return [
                        4,
                        objc.invokeAsync(view, 'setFrame:', [
                            nativeFrame(objc, width, height)
                        ])
                    ];
                case 2:
                    _state.sent();
                    return [
                        2,
                        view
                    ];
                case 3:
                    _state.sent();
                    return [
                        2,
                        null
                    ];
                case 4:
                    return [
                        2
                    ];
            }
        });
    })();
}
/**
 * @description Resizes an embed's host view to the height its content laid out at, once the height settles.
 * @param session The running session.
 * @param surfaceId The embed's surface ID.
 * @param height The height React Native measured.
 */ function reportSurfaceLayout(session, surfaceId, height) {
    var _surface_pendingHeight;
    var surface = session.surfacesById.get(surfaceId);
    if (!surface || !Number.isFinite(height) || height <= 0 || height > Surface.maxHeight) return;
    var fittedHeight = Math.max(Surface.minHeight, height - Surface.bottomTrim);
    if (Math.abs(((_surface_pendingHeight = surface.pendingHeight) !== null && _surface_pendingHeight !== void 0 ? _surface_pendingHeight : surface.height) - fittedHeight) < 2) return;
    surface.pendingHeight = fittedHeight;
    session.timers.cancel(surface.layoutTimer);
    surface.layoutTimer = session.timers.later(function() {
        var settledHeight = surface.pendingHeight;
        surface.layoutTimer = undefined;
        surface.pendingHeight = null;
        if (settledHeight === null || surface.disposed || Math.abs(surface.height - settledHeight) < 2) {
            return;
        }
        if (surface.table) captureBottomAnchor(session, surface, surface.table);
        surface.height = settledHeight;
        session.heights.set(surface.heightKey, settledHeight);
        clearReactionLayout(session, surface);
        safeInvoke(session.objc, surface.host, 'setFrame:', nativeFrame(session.objc, surface.width, settledHeight));
        applyAttachment(session, surface, true);
    }, Surface.settleDelay);
}function _type_of$2(obj) {
    "@swc/helpers - typeof";
    return obj && typeof Symbol !== "undefined" && obj.constructor === Symbol ? "symbol" : typeof obj;
}
/**
 * @description Serializes the parts of a message's reactions that change its rendered height.
 * @param value The message's `reactions` array.
 * @returns A string that differs whenever a reaction is added, removed, or recounted.
 */ function reactionSnapshot(value) {
    if (!Array.isArray(value)) return '[]';
    return JSON.stringify(value.map(function(reaction) {
        var _reaction_burst_colors, _reaction_me_burst;
        var _reaction_emoji, _reaction_emoji1;
        if (!reaction || (typeof reaction === "undefined" ? "undefined" : _type_of$2(reaction)) !== 'object') return reaction;
        var details = reaction.count_details;
        return {
            burstColors: (_reaction_burst_colors = reaction.burst_colors) !== null && _reaction_burst_colors !== void 0 ? _reaction_burst_colors : reaction.burstColors,
            count: reaction.count,
            countDetails: details ? {
                burst: details.burst,
                normal: details.normal
            } : undefined,
            emojiId: (_reaction_emoji = reaction.emoji) === null || _reaction_emoji === void 0 ? void 0 : _reaction_emoji.id,
            emojiName: (_reaction_emoji1 = reaction.emoji) === null || _reaction_emoji1 === void 0 ? void 0 : _reaction_emoji1.name,
            me: reaction.me,
            meBurst: (_reaction_me_burst = reaction.me_burst) !== null && _reaction_me_burst !== void 0 ? _reaction_me_burst : reaction.meBurst
        };
    }));
}function _array_like_to_array$7(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_with_holes$6(arr) {
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
function _iterable_to_array_limit$6(arr, i) {
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
function _non_iterable_rest$6() {
    throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _sliced_to_array$6(arr, i) {
    return _array_with_holes$6(arr) || _iterable_to_array_limit$6(arr, i) || _unsupported_iterable_to_array$7(arr, i) || _non_iterable_rest$6();
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
function _type_of$1(obj) {
    "@swc/helpers - typeof";
    return obj && typeof Symbol !== "undefined" && obj.constructor === Symbol ? "symbol" : typeof obj;
}
function _unsupported_iterable_to_array$7(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _array_like_to_array$7(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(n);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _array_like_to_array$7(o, minLen);
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
    return _async_to_generator$5(function() {
        var direct, handle;
        return _ts_generator$5(this, function(_state) {
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
    return _async_to_generator$5(function() {
        var channelId, channel;
        return _ts_generator$5(this, function(_state) {
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
    return _async_to_generator$5(function() {
        var fallbackChannelId, _ref, viewModel, _ref1, message, id, messageId, channelId, currentViewModel, _tmp;
        return _ts_generator$5(this, function(_state) {
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
                    _ref1 = _sliced_to_array$6.apply(void 0, [
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
}function _type_of(obj) {
    "@swc/helpers - typeof";
    return obj && typeof Symbol !== "undefined" && obj.constructor === Symbol ? "symbol" : typeof obj;
}
// UNKNOWN: `hash` and `description` come back from the bridge untyped.
function scalar(value) {
    if (typeof value === 'number' || (typeof value === "undefined" ? "undefined" : _type_of(value)) === 'bigint') {
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
 */ function viewKey$2(objc, view) {
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
}function _define_property$5(obj, key, value) {
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
function _object_spread$5(target) {
    for(var i = 1; i < arguments.length; i++){
        var source = arguments[i] != null ? arguments[i] : {};
        var ownKeys = Object.keys(source);
        if (typeof Object.getOwnPropertySymbols === "function") {
            ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function(sym) {
                return Object.getOwnPropertyDescriptor(source, sym).enumerable;
            }));
        }
        ownKeys.forEach(function(key) {
            _define_property$5(target, key, source[key]);
        });
    }
    return target;
}
function ownKeys$3(object, enumerableOnly) {
    var keys = Object.keys(object);
    if (Object.getOwnPropertySymbols) {
        var symbols = Object.getOwnPropertySymbols(object);
        keys.push.apply(keys, symbols);
    }
    return keys;
}
function _object_spread_props$3(target, source) {
    source = source != null ? source : {};
    if (Object.getOwnPropertyDescriptors) Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));
    else {
        ownKeys$3(Object(source)).forEach(function(key) {
            Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
        });
    }
    return target;
}
// A forward or a reply wraps the message that holds the content.
function messagePayload(message) {
    for(var _i = 0, _iter = [
        'message',
        'message_snapshot',
        'messageSnapshot'
    ]; _i < _iter.length; _i++){
        var key = _iter[_i];
        var nested = message[key];
        if (typeof (nested === null || nested === void 0 ? void 0 : nested.id) === 'string' && nested.id !== message.id) return nested;
    }
    for(var _i1 = 0, _iter1 = [
        'message_snapshots',
        'messageSnapshots'
    ]; _i1 < _iter1.length; _i1++){
        var key1 = _iter1[_i1];
        var snapshots = message[key1];
        if (!Array.isArray(snapshots)) continue;
        var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
        try {
            for(var _iterator = snapshots[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                var snapshot = _step.value;
                if (typeof (snapshot === null || snapshot === void 0 ? void 0 : snapshot.id) === 'string' && snapshot.id !== message.id) return snapshot;
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
    return message;
}
// MessageRecord reads both the API's snake_case fields and the client's camelCase ones.
function recordFields(message, channelId) {
    var _ref, _payload_guild_id, _ref1, _payload_guildId, _payload_attachments, _payload_embeds, _payload_mentions, _payload_mention_roles, _ref2, _payload_mentionRoles, _payload_timestamp, _payload_edited_timestamp, _ref3, _payload_editedTimestamp, _payload_mentionEveryone, _payload_flags, _payload_components, _payload_reactions, _ref4, _payload_sticker_items, _ref5, _payload_stickers, _ref6, _payload_message_reference, _ref7, _payload_messageReference, _ref8, _payload_message_snapshots, _ref9, _payload_messageSnapshots, _payload_state, _payload_nonce;
    var payload = messagePayload(message);
    return _object_spread_props$3(_object_spread$5({}, payload), {
        id: payload.id,
        type: 0,
        channel_id: channelId,
        channelId: channelId,
        guild_id: (_ref = (_payload_guild_id = payload.guild_id) !== null && _payload_guild_id !== void 0 ? _payload_guild_id : payload.guildId) !== null && _ref !== void 0 ? _ref : null,
        guildId: (_ref1 = (_payload_guildId = payload.guildId) !== null && _payload_guildId !== void 0 ? _payload_guildId : payload.guild_id) !== null && _ref1 !== void 0 ? _ref1 : null,
        content: contentText(payload.content),
        author: payload.author,
        attachments: (_payload_attachments = payload.attachments) !== null && _payload_attachments !== void 0 ? _payload_attachments : [],
        embeds: (_payload_embeds = payload.embeds) !== null && _payload_embeds !== void 0 ? _payload_embeds : [],
        mentions: (_payload_mentions = payload.mentions) !== null && _payload_mentions !== void 0 ? _payload_mentions : [],
        mention_roles: (_payload_mention_roles = payload.mention_roles) !== null && _payload_mention_roles !== void 0 ? _payload_mention_roles : [],
        mentionRoles: (_ref2 = (_payload_mentionRoles = payload.mentionRoles) !== null && _payload_mentionRoles !== void 0 ? _payload_mentionRoles : payload.mention_roles) !== null && _ref2 !== void 0 ? _ref2 : [],
        timestamp: _instanceof(payload.timestamp, Date) ? payload.timestamp : new Date((_payload_timestamp = payload.timestamp) !== null && _payload_timestamp !== void 0 ? _payload_timestamp : Date.now()),
        edited_timestamp: (_payload_edited_timestamp = payload.edited_timestamp) !== null && _payload_edited_timestamp !== void 0 ? _payload_edited_timestamp : null,
        editedTimestamp: (_ref3 = (_payload_editedTimestamp = payload.editedTimestamp) !== null && _payload_editedTimestamp !== void 0 ? _payload_editedTimestamp : payload.edited_timestamp) !== null && _ref3 !== void 0 ? _ref3 : null,
        pinned: Boolean(payload.pinned),
        mention_everyone: Boolean(payload.mention_everyone),
        mentionEveryone: Boolean((_payload_mentionEveryone = payload.mentionEveryone) !== null && _payload_mentionEveryone !== void 0 ? _payload_mentionEveryone : payload.mention_everyone),
        tts: Boolean(payload.tts),
        flags: (_payload_flags = payload.flags) !== null && _payload_flags !== void 0 ? _payload_flags : 0,
        components: (_payload_components = payload.components) !== null && _payload_components !== void 0 ? _payload_components : [],
        reactions: (_payload_reactions = payload.reactions) !== null && _payload_reactions !== void 0 ? _payload_reactions : [],
        sticker_items: (_ref4 = (_payload_sticker_items = payload.sticker_items) !== null && _payload_sticker_items !== void 0 ? _payload_sticker_items : payload.stickerItems) !== null && _ref4 !== void 0 ? _ref4 : [],
        stickers: (_ref5 = (_payload_stickers = payload.stickers) !== null && _payload_stickers !== void 0 ? _payload_stickers : payload.sticker_items) !== null && _ref5 !== void 0 ? _ref5 : [],
        message_reference: (_ref6 = (_payload_message_reference = payload.message_reference) !== null && _payload_message_reference !== void 0 ? _payload_message_reference : payload.messageReference) !== null && _ref6 !== void 0 ? _ref6 : null,
        messageReference: (_ref7 = (_payload_messageReference = payload.messageReference) !== null && _payload_messageReference !== void 0 ? _payload_messageReference : payload.message_reference) !== null && _ref7 !== void 0 ? _ref7 : null,
        message_snapshots: (_ref8 = (_payload_message_snapshots = payload.message_snapshots) !== null && _payload_message_snapshots !== void 0 ? _payload_message_snapshots : payload.messageSnapshots) !== null && _ref8 !== void 0 ? _ref8 : [],
        messageSnapshots: (_ref9 = (_payload_messageSnapshots = payload.messageSnapshots) !== null && _payload_messageSnapshots !== void 0 ? _payload_messageSnapshots : payload.message_snapshots) !== null && _ref9 !== void 0 ? _ref9 : [],
        state: (_payload_state = payload.state) !== null && _payload_state !== void 0 ? _payload_state : 'SENT',
        nonce: (_payload_nonce = payload.nonce) !== null && _payload_nonce !== void 0 ? _payload_nonce : null
    });
}
/**
 * @description Builds the record and row generator that render a linked message as a chat row, without reactions and with media playing.
 * @param renderers Discord's `MessageRecord` and `RowManager`.
 * @param message The linked message.
 * @param channelId The linked message's channel.
 * @returns The content for an embed, or `undefined` when Discord could not build its row.
 */ function buildEmbeddedContent(param, message, channelId) {
    var MessageRecord = param.MessageRecord, RowManager = param.RowManager;
    try {
        var record = new MessageRecord(recordFields(message, channelId));
        record.reactions = [];
        record.animateEmoji = true;
        var usernameColor = nativeUsernameColor(record.colorString);
        if (usernameColor !== undefined) record.usernameColor = usernameColor;
        var generator = new RowManager();
        generator.setOptions({
            animateEmoji: true,
            animatingStickerMessageId: record.id,
            gifAutoPlay: true
        });
        var generate = generator.generate.bind(generator);
        generator.generate = function(input) {
            var row = generate(input);
            var rendered = row === null || row === void 0 ? void 0 : row.message;
            if (rendered) {
                rendered.type = 0;
                rendered.renderContentOnly = false;
                rendered.animateEmoji = true;
                rendered.gifAutoPlay = true;
                enableAnimatedEmojiSources(rendered.content);
                if (usernameColor !== undefined) {
                    rendered.colorString = usernameColor;
                    rendered.usernameColor = usernameColor;
                }
            }
            return row;
        };
        var row = generator.generate({
            rowType: 1,
            changeType: 0,
            isFirst: false,
            canAddNewReactions: false,
            canShowImages: true,
            message: record
        });
        if (!row) return;
        row.renderContentOnly = false;
        row.separatorBefore = false;
        return {
            generator: generator,
            record: record
        };
    } catch (unused) {
        return;
    }
}/**
 * @description Reads the channel the user is looking at.
 * @returns The selected channel, or the last selected one while none is.
 */ function currentChannelId() {
    var _SelectedChannelStore_getChannelId;
    return (_SelectedChannelStore_getChannelId = SelectedChannelStore.getChannelId()) !== null && _SelectedChannelStore_getChannelId !== void 0 ? _SelectedChannelStore_getChannelId : SelectedChannelStore.getLastSelectedChannelId();
}
/**
 * @description Finds the channel name Discord renders in the mention of a message link.
 * @param target The linked message.
 * @param message The linked message's data, used when the channel is not in the store.
 * @returns The channel's name, or `undefined` when it is unknown.
 */ function linkedChannelName(target, message) {
    var _message_channelName;
    var _ChannelStore_getChannel;
    var fromStore = (_ChannelStore_getChannel = ChannelStore.getChannel(target.channelId)) === null || _ChannelStore_getChannel === void 0 ? void 0 : _ChannelStore_getChannel.name;
    if (fromStore) return fromStore;
    var fromMessage = (_message_channelName = message.channelName) !== null && _message_channelName !== void 0 ? _message_channelName : message.channel_name;
    return typeof fromMessage === 'string' && fromMessage.length > 0 ? fromMessage : undefined;
}function _array_like_to_array$6(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_with_holes$5(arr) {
    if (Array.isArray(arr)) return arr;
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
    return _array_with_holes$5(arr) || _iterable_to_array_limit$5(arr, i) || _unsupported_iterable_to_array$6(arr, i) || _non_iterable_rest$5();
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
function _unsupported_iterable_to_array$6(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _array_like_to_array$6(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(n);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _array_like_to_array$6(o, minLen);
}
/**
 * @description Embeds the first message a cell's message links to, or brings its existing embed up to date.
 * @param session The running session.
 * @param lookup The cell, its message, and its text labels.
 * @param isCurrent Tells whether the cell still shows the message this lookup started for.
 * @returns What the cell needs next.
 */ function embedCell(_0, _1, _2) {
    return _async_to_generator$4(function(session, param, isCurrent) {
        var key, cell, info, channelId, labels, source, _ref, target, existing, linked, channelName, label, range, _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, label1, text, range1, content, surface, err;
        return _ts_generator$4(this, function(_state) {
            switch(_state.label){
                case 0:
                    key = param.key, cell = param.cell, info = param.info, channelId = param.channelId, labels = param.labels;
                    if (!info || !channelId) return [
                        2,
                        'retry'
                    ];
                    source = MessageStore.getMessage(channelId, info.messageId);
                    _ref = _sliced_to_array$5(source ? linkedTargets(source) : [], 1), target = _ref[0];
                    existing = session.surfaces.get(key);
                    if (!source || !target) {
                        if (existing && existing.messageId !== info.messageId) {
                            teardownSurface(session, existing, true);
                        }
                        return [
                            2,
                            source ? 'done' : 'retry'
                        ];
                    }
                    linked = session.linked.get(target);
                    if (!linked) {
                        session.cells.get(key).waitingFor = targetKey(target);
                        session.linked.fetch(target);
                        return [
                            2,
                            'waiting'
                        ];
                    }
                    channelName = linkedChannelName(target, linked);
                    if (!channelName) return [
                        2,
                        'retry'
                    ];
                    if (!((existing === null || existing === void 0 ? void 0 : existing.messageId) === info.messageId && existing.target.messageId === target.messageId)) return [
                        3,
                        2
                    ];
                    return [
                        4,
                        readLabelText(session.objc, existing.label)
                    ];
                case 1:
                    label = _state.sent();
                    if (!isCurrent()) return [
                        2,
                        'done'
                    ];
                    if (!label) return [
                        2,
                        'retry'
                    ];
                    if (label.text === existing.renderedText) return [
                        2,
                        'done'
                    ];
                    range = findRenderedLinkRange(label.text, channelName);
                    if (!range) return [
                        2,
                        'retry'
                    ];
                    updateSurface(session, existing, label.attributedText, range);
                    return [
                        2,
                        'done'
                    ];
                case 2:
                    if (existing) teardownSurface(session, existing, false);
                    _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
                    _state.label = 3;
                case 3:
                    _state.trys.push([
                        3,
                        9,
                        10,
                        11
                    ]);
                    _iterator = labels[Symbol.iterator]();
                    _state.label = 4;
                case 4:
                    if (!!(_iteratorNormalCompletion = (_step = _iterator.next()).done)) return [
                        3,
                        8
                    ];
                    label1 = _step.value;
                    return [
                        4,
                        readLabelText(session.objc, label1)
                    ];
                case 5:
                    text = _state.sent();
                    if (!isCurrent()) return [
                        2,
                        'done'
                    ];
                    if (!text) return [
                        3,
                        7
                    ];
                    range1 = findRenderedLinkRange(text.text, channelName);
                    if (!range1) return [
                        3,
                        7
                    ];
                    content = buildEmbeddedContent(session.renderers, linked, target.channelId);
                    if (!content) return [
                        2,
                        'retry'
                    ];
                    return [
                        4,
                        createSurface(session, {
                            cell: cell,
                            cellKey: key,
                            messageId: info.messageId,
                            target: target,
                            channelName: channelName,
                            label: label1,
                            attributedText: text.attributedText,
                            range: range1,
                            reactionSnapshot: reactionSnapshot(source.reactions),
                            content: content
                        }, isCurrent)
                    ];
                case 6:
                    surface = _state.sent();
                    return [
                        2,
                        surface ? 'embedded' : 'retry'
                    ];
                case 7:
                    _iteratorNormalCompletion = true;
                    return [
                        3,
                        4
                    ];
                case 8:
                    return [
                        3,
                        11
                    ];
                case 9:
                    err = _state.sent();
                    _didIteratorError = true;
                    _iteratorError = err;
                    return [
                        3,
                        11
                    ];
                case 10:
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
                case 11:
                    return [
                        2,
                        'retry'
                    ];
            }
        });
    }).apply(this, arguments);
}function _array_like_to_array$5(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_with_holes$4(arr) {
    if (Array.isArray(arr)) return arr;
}
function _array_without_holes$3(arr) {
    if (Array.isArray(arr)) return _array_like_to_array$5(arr);
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
function _define_property$4(obj, key, value) {
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
function _object_spread$4(target) {
    for(var i = 1; i < arguments.length; i++){
        var source = arguments[i] != null ? arguments[i] : {};
        var ownKeys = Object.keys(source);
        if (typeof Object.getOwnPropertySymbols === "function") {
            ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function(sym) {
                return Object.getOwnPropertyDescriptor(source, sym).enumerable;
            }));
        }
        ownKeys.forEach(function(key) {
            _define_property$4(target, key, source[key]);
        });
    }
    return target;
}
function _sliced_to_array$4(arr, i) {
    return _array_with_holes$4(arr) || _iterable_to_array_limit$4(arr, i) || _unsupported_iterable_to_array$5(arr, i) || _non_iterable_rest$4();
}
function _to_consumable_array$3(arr) {
    return _array_without_holes$3(arr) || _iterable_to_array$3(arr) || _unsupported_iterable_to_array$5(arr) || _non_iterable_spread$3();
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
function _unsupported_iterable_to_array$5(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _array_like_to_array$5(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(n);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _array_like_to_array$5(o, minLen);
}
function trackCell(session, key, cell) {
    var _session_cells_get;
    var tracked = (_session_cells_get = session.cells.get(key)) !== null && _session_cells_get !== void 0 ? _session_cells_get : {
        cell: cell,
        retries: 0
    };
    tracked.cell = cell;
    session.cells.set(key, tracked);
    return tracked;
}
/**
 * @description Removes the label hooks that watch a cell for the text an embed needs.
 * @param tracked The cell.
 */ function removeLabelHooks(tracked) {
    var _tracked_labelHooks;
    var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
    try {
        for(var _iterator = ((_tracked_labelHooks = tracked.labelHooks) !== null && _tracked_labelHooks !== void 0 ? _tracked_labelHooks : [])[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
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
    tracked.labelHooks = undefined;
}
function textViewClass(className) {
    return MESSAGE_TEXT_VIEW_CLASSES.find(function(name) {
        return className === null || className === void 0 ? void 0 : className.includes(name);
    });
}
function findTextViews(session, cell) {
    return _async_to_generator$3(function() {
        var labels, _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, className, _labels, _, _1, _tmp, err;
        return _ts_generator$3(this, function(_state) {
            switch(_state.label){
                case 0:
                    labels = [];
                    _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
                    _state.label = 1;
                case 1:
                    _state.trys.push([
                        1,
                        6,
                        7,
                        8
                    ]);
                    _iterator = MESSAGE_TEXT_VIEW_CLASSES[Symbol.iterator]();
                    _state.label = 2;
                case 2:
                    if (!!(_iteratorNormalCompletion = (_step = _iterator.next()).done)) return [
                        3,
                        5
                    ];
                    className = _step.value;
                    if (!session.objc.getClass(className)) return [
                        3,
                        4
                    ];
                    _1 = (_ = (_labels = labels).push).apply;
                    _tmp = [
                        _labels
                    ];
                    return [
                        4,
                        session.objc.findViews(cell, className, {
                            maxDepth: 10,
                            maxVisited: 100,
                            maxResults: 32,
                            stopAtMatch: false
                        })
                    ];
                case 3:
                    _1.apply(_, _tmp.concat([
                        _to_consumable_array$3.apply(void 0, [
                            _state.sent()
                        ])
                    ]));
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
                    return [
                        2,
                        labels
                    ];
            }
        });
    })();
}
// Re-checks the cell whenever one of its labels gets new text, until an embed attaches.
function observeLabels(session, tracked, labels) {
    var objc = session.objc;
    if (tracked.labelHooks) return;
    var hooks = [];
    var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
    try {
        for(var _iterator = labels[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
            var label = _step.value;
            var className = textViewClass(objc.className(label));
            if (!className) continue;
            try {
                hooks.push(objc.hook(className, 'setAttributedText:', {
                    after: function after() {
                        return refreshCell(session, tracked.cell);
                    }
                }, {
                    instance: label
                }));
            } catch (unused) {
            // Without the hook this label only lacks the early refresh; retries still run.
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
    if (hooks.length > 0) tracked.labelHooks = hooks;
}
function clearCell(session, key) {
    var tracked = session.cells.get(key);
    if (tracked) {
        session.timers.cancel(tracked.retryTimer);
        removeLabelHooks(tracked);
        session.cells.delete(key);
    }
    var surface = session.surfaces.get(key);
    if (surface) teardownSurface(session, surface, true);
}
function refreshCell(session, cell) {
    var key = viewKey$2(session.objc, cell);
    if (!key || session.surfaces.has(key)) return;
    var tracked = session.cells.get(key);
    if (tracked) {
        tracked.retries = 0;
        tracked.waitingFor = undefined;
        if (tracked.phase === 'done' || tracked.phase === 'waiting') tracked.phase = undefined;
    }
    scheduleCell(session, cell);
}
function lookUpCell(session, cell, isCurrent) {
    return _async_to_generator$3(function() {
        var _ref, objc, info, channelId, source, labels, _tmp;
        return _ts_generator$3(this, function(_state) {
            switch(_state.label){
                case 0:
                    objc = session.objc;
                    return [
                        4,
                        readNativeMessageInfo(cell, objc)
                    ];
                case 1:
                    info = _state.sent();
                    channelId = (_ref = info === null || info === void 0 ? void 0 : info.channelId) !== null && _ref !== void 0 ? _ref : currentChannelId();
                    source = info && channelId ? MessageStore.getMessage(channelId, info.messageId) : null;
                    if (!(source && linkedTargets(source).length > 0)) return [
                        3,
                        3
                    ];
                    return [
                        4,
                        findTextViews(session, cell)
                    ];
                case 2:
                    _tmp = _state.sent();
                    return [
                        3,
                        4
                    ];
                case 3:
                    _tmp = [];
                    _state.label = 4;
                case 4:
                    labels = _tmp;
                    if (!isCurrent()) return [
                        2
                    ];
                    return [
                        2,
                        {
                            info: info,
                            channelId: channelId,
                            labels: labels
                        }
                    ];
            }
        });
    })();
}
function processCell(session, key, cell, isCurrent) {
    return _async_to_generator$3(function() {
        var labels, status, lookup, tracked;
        return _ts_generator$3(this, function(_state) {
            switch(_state.label){
                case 0:
                    if (!isCurrent()) return [
                        2
                    ];
                    labels = [];
                    _state.label = 1;
                case 1:
                    _state.trys.push([
                        1,
                        4,
                        ,
                        5
                    ]);
                    return [
                        4,
                        lookUpCell(session, cell, isCurrent)
                    ];
                case 2:
                    lookup = _state.sent();
                    if (!lookup) return [
                        2
                    ];
                    labels = lookup.labels;
                    return [
                        4,
                        embedCell(session, _object_spread$4({
                            key: key,
                            cell: cell
                        }, lookup), isCurrent)
                    ];
                case 3:
                    status = _state.sent();
                    return [
                        3,
                        5
                    ];
                case 4:
                    _state.sent();
                    status = 'done';
                    return [
                        3,
                        5
                    ];
                case 5:
                    if (!isCurrent()) return [
                        2
                    ];
                    tracked = session.cells.get(key);
                    if (status === 'embedded') removeLabelHooks(tracked);
                    if (status === 'done' || status === 'embedded') {
                        tracked.phase = 'done';
                        tracked.retries = 0;
                        return [
                            2
                        ];
                    }
                    if (status === 'waiting') {
                        tracked.phase = tracked.waitingFor ? 'waiting' : undefined;
                        return [
                            2
                        ];
                    }
                    observeLabels(session, tracked, labels);
                    if (++tracked.retries > CellRetry.limit) {
                        tracked.phase = 'done';
                        return [
                            2
                        ];
                    }
                    tracked.phase = 'retrying';
                    tracked.retryTimer = session.timers.later(function() {
                        tracked.retryTimer = undefined;
                        tracked.phase = undefined;
                        scheduleCell(session, cell);
                    }, CellRetry.delay);
                    return [
                        2
                    ];
            }
        });
    })();
}
/**
 * @description Queues a lookup that embeds the linked message into a cell, unless one is in flight or settled.
 * @param session The running session.
 * @param cell The message cell.
 */ function scheduleCell(session, cell) {
    var key = viewKey$2(session.objc, cell);
    if (!key) return;
    var tracked = trackCell(session, key, cell);
    if (session.surfaces.has(key) || tracked.phase) return;
    var version = ++session.nextVersion;
    tracked.phase = 'pending';
    tracked.version = version;
    // A cleared or rescheduled cell gets a new version, which retires this lookup.
    var isCurrent = function isCurrent() {
        var _session_cells_get;
        return !session.signal.aborted && ((_session_cells_get = session.cells.get(key)) === null || _session_cells_get === void 0 ? void 0 : _session_cells_get.version) === version;
    };
    session.timers.later(function() {
        return void processCell(session, key, cell, isCurrent);
    });
}
/**
 * @description Re-checks the cells that were waiting for a linked message to be fetched.
 * @param session The running session.
 * @param targetKey The fetched message's key.
 */ function wakeWaitingCells(session, targetKey) {
    var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
    try {
        for(var _iterator = session.cells.values()[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
            var tracked = _step.value;
            if (tracked.waitingFor !== targetKey) continue;
            tracked.waitingFor = undefined;
            tracked.retries = 0;
            if (tracked.phase === 'waiting') tracked.phase = undefined;
            scheduleCell(session, tracked.cell);
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
/**
 * @description Finds the message cells on screen and queues each one, for cells that appeared without a hook firing.
 * @param session The running session.
 */ function scanVisibleCells(session) {
    return _async_to_generator$3(function() {
        var objc, signal, application, _ref, windowList, keyWindow, windows, _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, window, cells, _iteratorNormalCompletion1, _didIteratorError1, _iteratorError1, _iterator1, _step1, cell, _ref1, _session_surfaces_get, key, info, known, previousId, err, err;
        return _ts_generator$3(this, function(_state) {
            switch(_state.label){
                case 0:
                    objc = session.objc, signal = session.signal;
                    application = objc.getClass('UIApplication');
                    if (!application) return [
                        2
                    ];
                    _state.label = 1;
                case 1:
                    _state.trys.push([
                        1,
                        18,
                        ,
                        19
                    ]);
                    return [
                        4,
                        objc.batch([
                            {
                                target: application,
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
                    if (signal.aborted) return [
                        2
                    ];
                    windows = keyWindow ? [
                        keyWindow
                    ] : Array.isArray(windowList) ? windowList : objc.array(windowList);
                    _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
                    _state.label = 3;
                case 3:
                    _state.trys.push([
                        3,
                        15,
                        16,
                        17
                    ]);
                    _iterator = windows[Symbol.iterator]();
                    _state.label = 4;
                case 4:
                    if (!!(_iteratorNormalCompletion = (_step = _iterator.next()).done)) return [
                        3,
                        14
                    ];
                    window = _step.value;
                    return [
                        4,
                        objc.findViews(window, 'DCDMessageTableViewCell', {
                            maxDepth: 40,
                            maxVisited: 800,
                            maxResults: 256,
                            attachedOnly: true,
                            stopAtMatch: true
                        })
                    ];
                case 5:
                    cells = _state.sent();
                    if (signal.aborted) return [
                        2
                    ];
                    _iteratorNormalCompletion1 = true, _didIteratorError1 = false, _iteratorError1 = undefined;
                    _state.label = 6;
                case 6:
                    _state.trys.push([
                        6,
                        11,
                        12,
                        13
                    ]);
                    _iterator1 = cells[Symbol.iterator]();
                    _state.label = 7;
                case 7:
                    if (!!(_iteratorNormalCompletion1 = (_step1 = _iterator1.next()).done)) return [
                        3,
                        10
                    ];
                    cell = _step1.value;
                    key = viewKey$2(objc, cell);
                    return [
                        4,
                        readNativeMessageInfo(cell, objc)
                    ];
                case 8:
                    info = _state.sent();
                    if (signal.aborted) return [
                        2
                    ];
                    if (!key || !info) return [
                        3,
                        9
                    ];
                    known = session.cells.get(key);
                    previousId = (_ref1 = known === null || known === void 0 ? void 0 : known.visibleMessageId) !== null && _ref1 !== void 0 ? _ref1 : (_session_surfaces_get = session.surfaces.get(key)) === null || _session_surfaces_get === void 0 ? void 0 : _session_surfaces_get.messageId;
                    if (previousId && previousId !== info.messageId) {
                        clearCell(session, key);
                    } else if (!previousId && (known === null || known === void 0 ? void 0 : known.phase) === 'done') {
                        known.phase = undefined;
                    }
                    trackCell(session, key, cell).visibleMessageId = info.messageId;
                    scheduleCell(session, cell);
                    _state.label = 9;
                case 9:
                    _iteratorNormalCompletion1 = true;
                    return [
                        3,
                        7
                    ];
                case 10:
                    return [
                        3,
                        13
                    ];
                case 11:
                    err = _state.sent();
                    _didIteratorError1 = true;
                    _iteratorError1 = err;
                    return [
                        3,
                        13
                    ];
                case 12:
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
                case 13:
                    _iteratorNormalCompletion = true;
                    return [
                        3,
                        4
                    ];
                case 14:
                    return [
                        3,
                        17
                    ];
                case 15:
                    err = _state.sent();
                    _didIteratorError = true;
                    _iteratorError = err;
                    return [
                        3,
                        17
                    ];
                case 16:
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
                case 17:
                    return [
                        3,
                        19
                    ];
                case 18:
                    _state.sent();
                    return [
                        3,
                        19
                    ];
                case 19:
                    return [
                        2
                    ];
            }
        });
    })();
}
/**
 * @description Hooks message cells as they appear and get reused, and scans the cells already on screen.
 * @param session The running session.
 * @returns A function that removes the hooks.
 */ function hookMessageCells(session) {
    var objc = session.objc, signal = session.signal;
    var hooks = [
        objc.hook('DCDMessageTableViewCell', 'didMoveToWindow', {
            after: function after(param) {
                var self = param.self;
                void objc.invokeAsync(self, 'window', []).then(function(window) {
                    var key = viewKey$2(objc, self);
                    if (signal.aborted || !key) return;
                    if (window) {
                        scheduleCell(session, self);
                    } else {
                        clearCell(session, key);
                    }
                }).catch(function() {
                    return undefined;
                });
            }
        }),
        objc.hook('DCDMessageTableViewCell', 'prepareForReuse', {
            after: function after(param) {
                var self = param.self;
                var key = viewKey$2(objc, self);
                if (!key) return;
                clearCell(session, key);
                session.timers.later(function() {
                    return scheduleCell(session, self);
                });
            }
        })
    ];
    var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
    try {
        for(var _iterator = INITIAL_SCAN_DELAYS[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
            var delay = _step.value;
            session.timers.later(function() {
                return void scanVisibleCells(session);
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
    return function() {
        var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
        try {
            for(var _iterator = hooks[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
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
    };
}/**
 * @description Follows message store changes: keeps embeds in place when their message's reactions change, and scans for new cells when the loaded messages change.
 * @param session The running session.
 * @returns A function that stops listening.
 */ function subscribeMessageStore(session) {
    var timers = session.timers;
    var syncTimer;
    var scanTimer;
    var windowSignature = '';
    function snapshotOf(surface) {
        var source = MessageStore.getMessage(surface.target.channelId, surface.messageId);
        return source ? reactionSnapshot(source.reactions) : surface.reactionSnapshot;
    }
    function syncReactions() {
        var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
        try {
            for(var _iterator = session.surfaces.values()[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                var surface = _step.value;
                var snapshot = snapshotOf(surface);
                var changed = snapshot !== surface.reactionSnapshot;
                if (changed && surface.table) captureBottomAnchor(session, surface, surface.table);
                void reconcileSurfaceText(session, surface);
                if (!changed) continue;
                surface.reactionSnapshot = snapshot;
                scheduleReactionScrollCorrection(session, surface);
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
    function scheduleWindowScan() {
        var _MessageStore_getMessages, _messages_, _messages_at;
        var channelId = currentChannelId();
        var messages = channelId ? (_MessageStore_getMessages = MessageStore.getMessages(channelId)) === null || _MessageStore_getMessages === void 0 ? void 0 : _MessageStore_getMessages._array : undefined;
        if (!channelId || !messages) return;
        var signature = "".concat(channelId, ":").concat(messages.length, ":").concat((_messages_ = messages[0]) === null || _messages_ === void 0 ? void 0 : _messages_.id, ":").concat((_messages_at = messages.at(-1)) === null || _messages_at === void 0 ? void 0 : _messages_at.id);
        if (signature === windowSignature) return;
        windowSignature = signature;
        timers.cancel(scanTimer);
        scanTimer = timers.later(function() {
            scanTimer = undefined;
            void scanVisibleCells(session);
        }, WINDOW_SCAN_DELAY);
    }
    function onChange() {
        var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
        try {
            // Capture the scroll position now, before the reaction row changes the layout.
            for(var _iterator = session.surfaces.values()[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                var surface = _step.value;
                if (surface.table && snapshotOf(surface) !== surface.reactionSnapshot) {
                    captureBottomAnchor(session, surface, surface.table);
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
        syncTimer !== null && syncTimer !== void 0 ? syncTimer : syncTimer = timers.later(function() {
            syncTimer = undefined;
            syncReactions();
        });
        scheduleWindowScan();
    }
    MessageStore.addChangeListener(onChange);
    return function() {
        MessageStore.removeChangeListener(onChange);
        timers.cancel(syncTimer);
        timers.cancel(scanTimer);
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
}function asyncGeneratorStep$2(gen, resolve, reject, _next, _throw, key, arg) {
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
var ALIGN_BOTTOM = 0;
var TRANSPARENT = 0;
var MAX_ANCESTOR_DEPTH = 12;
var MEASURE_EXACTLY = 1 << 30;
/**
 * @description Builds a transparent image span that reserves room for a view inside text, like a TextKit attachment.
 * @param java The plugin's Java bridge.
 * @param width The room's width, in pixels.
 * @param height The room's height, in pixels.
 * @returns The `ImageSpan`, to set over one placeholder character.
 */ function spacerSpan(java, width, height) {
    var drawable = java.construct('android.graphics.drawable.ColorDrawable', [
        javaInt(TRANSPARENT)
    ]);
    java.invoke(drawable, 'setBounds', [
        javaInt(0),
        javaInt(0),
        javaInt(Math.round(width)),
        javaInt(Math.round(height))
    ]);
    return java.construct('android.text.style.ImageSpan', [
        drawable,
        javaInt(ALIGN_BOTTOM)
    ]);
}
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
 * @description Measures where reserved room sits inside a text view, from its laid-out text.
 * @param java The plugin's Java bridge.
 * @param textView The text view.
 * @param index The index of the placeholder character carrying the spacer span.
 * @param height The reserved room's height, in pixels.
 * @returns The room's top-left corner inside the text view, or `null` before the text is laid out.
 */ function reservedPosition(java, textView, index, height) {
    var _javaNumber, _javaNumber1, _javaNumber2, _javaNumber3, _javaNumber4;
    var layout = javaReference(java.invoke(textView, 'getLayout', []));
    if (!layout) return null;
    var line = (_javaNumber = javaNumber(java.invoke(layout, 'getLineForOffset', [
        javaInt(index)
    ]))) !== null && _javaNumber !== void 0 ? _javaNumber : 0;
    var bottom = (_javaNumber1 = javaNumber(java.invoke(layout, 'getLineBottom', [
        javaInt(line)
    ]))) !== null && _javaNumber1 !== void 0 ? _javaNumber1 : 0;
    var left = (_javaNumber2 = javaNumber(java.invoke(layout, 'getPrimaryHorizontal', [
        javaInt(index)
    ]))) !== null && _javaNumber2 !== void 0 ? _javaNumber2 : 0;
    return {
        x: left + ((_javaNumber3 = javaNumber(java.invoke(textView, 'getTotalPaddingLeft', []))) !== null && _javaNumber3 !== void 0 ? _javaNumber3 : 0),
        y: bottom - height + ((_javaNumber4 = javaNumber(java.invoke(textView, 'getTotalPaddingTop', []))) !== null && _javaNumber4 !== void 0 ? _javaNumber4 : 0)
    };
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
    return _async_to_generator$2(function() {
        var _javaNumber, count, index, child;
        return _ts_generator$2(this, function(_state) {
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
    return _async_to_generator$2(function() {
        var params, parent, inContainer, width, height;
        return _ts_generator$2(this, function(_state) {
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
    return _async_to_generator$2(function() {
        var recycler, current, depth, parent, isList, _javaNumber, _javaNumber1, _javaNumber2, _javaNumber3, left, top, width, height;
        return _ts_generator$2(this, function(_state) {
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
 * @description Tells whether a host view still holds the surface mounted into it. Discord can drop that surface while recycling a message row, which leaves the host empty.
 * @param java The plugin's Java bridge.
 * @param host The host view.
 * @returns Whether the host has at least one child view.
 */ function hostHasContent(java, host) {
    var _javaNumber;
    return ((_javaNumber = javaNumber(java.invoke(host, 'getChildCount', []))) !== null && _javaNumber !== void 0 ? _javaNumber : 0) > 0;
}
/**
 * @description Takes a host view out of whatever holds it.
 * @param java The plugin's Java bridge.
 * @param host The host view.
 * @returns Resolves once it is removed.
 */ function removeHost(java, host) {
    return _async_to_generator$2(function() {
        var parent;
        return _ts_generator$2(this, function(_state) {
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
}function _array_like_to_array$4(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_with_holes$3(arr) {
    if (Array.isArray(arr)) return arr;
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
    return _array_with_holes$3(arr) || _iterable_to_array_limit$3(arr, i) || _unsupported_iterable_to_array$4(arr, i) || _non_iterable_rest$3();
}
function _unsupported_iterable_to_array$4(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _array_like_to_array$4(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(n);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _array_like_to_array$4(o, minLen);
}
function staticSubscription() {
    return function() {};
}
/**
 * @description Registers the root component that Fabric surfaces mount to render embeds.
 * @param source Looks up each surface's content, receives the height it lays out at, and can tell a surface when its content changes.
 * @returns The registered module name to mount, or `undefined` when React Native refused it.
 */ function registerMessageSurface(source) {
    function MessageSurface(param) {
        var renderRevision = param.renderRevision, surfaceId = param.surfaceId;
        var contentRevision = window.React.useSyncExternalStore(function(listener) {
            var _source_subscribe;
            return ((_source_subscribe = source.subscribe) !== null && _source_subscribe !== void 0 ? _source_subscribe : staticSubscription)(surfaceId, listener);
        }, function() {
            var _ref;
            var _source_revision;
            return (_ref = (_source_revision = source.revision) === null || _source_revision === void 0 ? void 0 : _source_revision.call(source, surfaceId)) !== null && _ref !== void 0 ? _ref : 0;
        });
        var surface = source.surface(surfaceId);
        var ChatItem = source.renderers.ChatItem;
        var _useState = _sliced_to_array$3(window.React.useState(0), 2), mountAttempt = _useState[0], setMountAttempt = _useState[1];
        var remount = window.React.useRef(undefined);
        window.React.useEffect(function() {
            return function() {
                return clearTimeout(remount.current);
            };
        }, []);
        if (!surface) return /*#__PURE__*/ React.createElement(window.ReactNative.View, {
            style: {
                height: 1
            }
        });
        function onItemLayout(event) {
            var collapsed = event.nativeEvent.layout.height < CollapsedRemount.minHeight;
            clearTimeout(remount.current);
            if (!collapsed || mountAttempt >= CollapsedRemount.limit) return;
            remount.current = setTimeout(function() {
                return setMountAttempt(function(attempt) {
                    return attempt + 1;
                });
            }, CollapsedRemount.delay);
        }
        function onLayout(event) {
            source.reportLayout(surfaceId, event.nativeEvent.layout.height);
        }
        return /*#__PURE__*/ React.createElement(EmbeddedMediaContext.Provider, {
            value: true
        }, /*#__PURE__*/ React.createElement(window.ReactNative.View, {
            onLayout: onLayout,
            style: {
                backgroundColor: Surface.background,
                borderRadius: 8,
                overflow: 'hidden',
                minHeight: Surface.minHeight,
                paddingBottom: 0,
                paddingTop: 6,
                width: surface.width
            }
        }, /*#__PURE__*/ React.createElement(window.ReactNative.View, {
            onLayout: onItemLayout
        }, /*#__PURE__*/ React.createElement(ChatItem, {
            key: "".concat(surfaceId, "-").concat(mountAttempt),
            message: surface.record,
            renderRevision: renderRevision + contentRevision,
            rowGenerator: surface.generator
        }))));
    }
    return registerAppSurface('MessageLinkEmbedSurface', MessageSurface);
}/**
 * @description Caches the messages that links point to, fetching the ones Discord has not loaded.
 * @param signal Aborted when the plugin stops, to drop fetches still in flight.
 * @param onSettled Called with the target's key when a fetch finishes, found or not.
 * @returns `get` reads a linked message, `fetch` requests a missing one, `clear` forgets them all.
 */ function createLinkedMessages(signal, onSettled) {
    var cache = new Map();
    var pending = new Set();
    function get(target) {
        var _cache_get;
        var key = targetKey(target);
        var message = (_cache_get = cache.get(key)) !== null && _cache_get !== void 0 ? _cache_get : MessageStore.getMessage(target.channelId, target.messageId);
        if (message) cache.set(key, message);
        return message;
    }
    function fetch(target) {
        var key = targetKey(target);
        if (pending.has(key) || get(target)) return;
        var request;
        try {
            request = MessageActions.fetchMessage(target);
        } catch (unused) {
            return;
        }
        pending.add(key);
        void request.then(function(result) {
            var _MessageStore_getMessage;
            if (signal.aborted) return;
            var message = (_MessageStore_getMessage = MessageStore.getMessage(target.channelId, target.messageId)) !== null && _MessageStore_getMessage !== void 0 ? _MessageStore_getMessage : result;
            if (message) cache.set(key, message);
        }).catch(function() {
            return undefined;
        }).finally(function() {
            pending.delete(key);
            if (!signal.aborted) onSettled(key);
        });
    }
    function clear() {
        cache.clear();
        pending.clear();
    }
    return {
        get: get,
        fetch: fetch,
        clear: clear
    };
}function _array_like_to_array$3(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_with_holes$2(arr) {
    if (Array.isArray(arr)) return arr;
}
function _array_without_holes$2(arr) {
    if (Array.isArray(arr)) return _array_like_to_array$3(arr);
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
function _define_property$3(obj, key, value) {
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
function _object_spread$3(target) {
    for(var i = 1; i < arguments.length; i++){
        var source = arguments[i] != null ? arguments[i] : {};
        var ownKeys = Object.keys(source);
        if (typeof Object.getOwnPropertySymbols === "function") {
            ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function(sym) {
                return Object.getOwnPropertyDescriptor(source, sym).enumerable;
            }));
        }
        ownKeys.forEach(function(key) {
            _define_property$3(target, key, source[key]);
        });
    }
    return target;
}
function ownKeys$2(object, enumerableOnly) {
    var keys = Object.keys(object);
    if (Object.getOwnPropertySymbols) {
        var symbols = Object.getOwnPropertySymbols(object);
        keys.push.apply(keys, symbols);
    }
    return keys;
}
function _object_spread_props$2(target, source) {
    source = source != null ? source : {};
    if (Object.getOwnPropertyDescriptors) Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));
    else {
        ownKeys$2(Object(source)).forEach(function(key) {
            Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
        });
    }
    return target;
}
function _sliced_to_array$2(arr, i) {
    return _array_with_holes$2(arr) || _iterable_to_array_limit$2(arr, i) || _unsupported_iterable_to_array$3(arr, i) || _non_iterable_rest$2();
}
function _to_consumable_array$2(arr) {
    return _array_without_holes$2(arr) || _iterable_to_array$2(arr) || _unsupported_iterable_to_array$3(arr) || _non_iterable_spread$2();
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
function _unsupported_iterable_to_array$3(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _array_like_to_array$3(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(n);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _array_like_to_array$3(o, minLen);
}
var MESSAGE_VIEW$1 = 'com.discord.chat.presentation.message.MessageView';
var MESSAGE_ID_FIELD$1 = 'messageId';
var MESSAGE_CONTENT_VIEW$1 = 'com.discord.chat.presentation.message.view.MessageContentView';
var SET_MESSAGE_PARAMETERS$1 = [
    'com.discord.chat.bridge.Message',
    'com.discord.chat.presentation.root.MessageContext',
    'com.discord.chat.presentation.events.ChatEventHandler',
    'com.discord.chat.presentation.message.view.botuikit.ComponentProvider',
    'kotlin.jvm.functions.Function0',
    'boolean',
    'boolean'
];
var SPAN_EXCLUSIVE_EXCLUSIVE = 33;
var PLACEHOLDER$1 = '￼';
var SETTLE_DELAYS = [
    0,
    120,
    600
];
var SIZE_PARAMETERS$1 = [
    'int',
    'int',
    'int',
    'int'
];
function viewKey$1(view) {
    return view.type === 'handle' ? view.value : undefined;
}
/**
 * @description Embeds the message each Android message links to as a real chat row, the way the iOS client shows it.
 * @param native The plugin's Java, hook and Fabric bridges.
 * @param renderers Discord's message renderers, shared with the iOS embeds.
 * @returns `dispose`, which removes the hook and every embed and resolves once the views are restored, or `undefined` when the surface did not register.
 */ function createAndroidEmbeds(param, renderers) {
    var java = param.java, hooks = param.hooks, fabric = param.fabric;
    var embeds = new Map();
    var byId = new Map();
    var waiting = new Map();
    var awaitingSize = new Map();
    var controller = new AbortController();
    var nextId = 0;
    var linked = createLinkedMessages(controller.signal, function(key) {
        var _ref;
        var _waiting_get;
        var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
        try {
            for(var _iterator = ((_ref = (_waiting_get = waiting.get(key)) === null || _waiting_get === void 0 ? void 0 : _waiting_get.values()) !== null && _ref !== void 0 ? _ref : [])[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                var _step_value = _step.value, messageView = _step_value.messageView, messageId = _step_value.messageId;
                render(messageView, messageId).catch(function(error) {
                    console.error('[Message Link Embeds] Failed to embed a linked message on Android:', error);
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
        waiting.delete(key);
    });
    var listeners = new Map();
    var surfaceModule = registerMessageSurface({
        renderers: renderers,
        surface: function surface(surfaceId) {
            return byId.get(surfaceId);
        },
        reportLayout: function reportLayout1(surfaceId, height) {
            return reportLayout(surfaceId, height);
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
        }
    });
    function publish(embed) {
        var _listeners_get;
        embed.revision++;
        var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
        try {
            for(var _iterator = ((_listeners_get = listeners.get(embed.id)) !== null && _listeners_get !== void 0 ? _listeners_get : [])[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
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
    if (!surfaceModule) return undefined;
    function contentTextView(messageView, channelName) {
        var stack = [
            messageView
        ];
        var contentClass = java.getClass(MESSAGE_CONTENT_VIEW$1);
        var groupClass = java.getClass('android.view.ViewGroup');
        while(stack.length){
            var _javaNumber;
            var view = stack.pop();
            if (javaFlag(java.invoke(contentClass, 'isInstance', [
                view
            ]))) {
                var _ref;
                var _readViewText;
                var text = (_ref = (_readViewText = readViewText(java, view)) === null || _readViewText === void 0 ? void 0 : _readViewText.string) !== null && _ref !== void 0 ? _ref : '';
                if (findRenderedLinkRange(text, channelName)) return view;
                continue;
            }
            if (!javaFlag(java.invoke(groupClass, 'isInstance', [
                view
            ]))) continue;
            var count = (_javaNumber = javaNumber(java.invoke(view, 'getChildCount', []))) !== null && _javaNumber !== void 0 ? _javaNumber : 0;
            for(var index = count - 1; index >= 0; index--){
                var child = javaReference(java.invoke(view, 'getChildAt', [
                    javaInt(index)
                ]));
                if (child) stack.push(child);
            }
        }
        return null;
    }
    function teardown(embed) {
        return _async_to_generator$1(function() {
            var _viewKey, _embed_mounting, mounted;
            return _ts_generator$1(this, function(_state) {
                switch(_state.label){
                    case 0:
                        embed.disposed = true;
                        embeds.delete((_viewKey = viewKey$1(embed.messageView)) !== null && _viewKey !== void 0 ? _viewKey : '');
                        byId.delete(embed.id);
                        return [
                            4,
                            (_embed_mounting = embed.mounting) === null || _embed_mounting === void 0 ? void 0 : _embed_mounting.catch(function() {
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
                            removeHost(java, embed.host).catch(function() {
                                return undefined;
                            })
                        ];
                    case 4:
                        _state.sent();
                        return [
                            2
                        ];
                }
            });
        })();
    }
    function restore(embed) {
        return _async_to_generator$1(function() {
            var current;
            return _ts_generator$1(this, function(_state) {
                switch(_state.label){
                    case 0:
                        current = readViewText(java, embed.textView);
                        if (!(embed.original && (current === null || current === void 0 ? void 0 : current.string) === embed.renderedText)) return [
                            3,
                            3
                        ];
                        return [
                            4,
                            java.invokeAsync(embed.textView, 'setText', [
                                embed.original
                            ])
                        ];
                    case 1:
                        _state.sent();
                        return [
                            4,
                            relayout(embed)
                        ];
                    case 2:
                        _state.sent();
                        _state.label = 3;
                    case 3:
                        return [
                            2
                        ];
                }
            });
        })();
    }
    function relayout(embed) {
        return _async_to_generator$1(function() {
            return _ts_generator$1(this, function(_state) {
                switch(_state.label){
                    case 0:
                        return [
                            4,
                            java.invokeAsync(embed.textView, 'requestLayout', [])
                        ];
                    case 1:
                        _state.sent();
                        return [
                            4,
                            layoutHostingList(java, embed.messageView)
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
    function reserve(embed) {
        return _async_to_generator$1(function() {
            var _javaText, content, range, insertAt, builder, width, reserved;
            return _ts_generator$1(this, function(_state) {
                switch(_state.label){
                    case 0:
                        content = readViewText(java, embed.textView);
                        if (!content) return [
                            2,
                            false
                        ];
                        range = findRenderedLinkRange(content.string, embed.channelName);
                        if (!range) return [
                            2,
                            false
                        ];
                        if (content.string !== embed.renderedText) embed.original = content.text;
                        insertAt = range.location + range.length;
                        builder = java.construct('android.text.SpannableStringBuilder', [
                            content.text
                        ]);
                        width = embed.width * embed.density;
                        reserved = content.string.slice(insertAt, insertAt + 2) === "\n".concat(PLACEHOLDER$1);
                        java.invoke(builder, 'replace', [
                            javaInt(insertAt),
                            javaInt(reserved ? insertAt + 2 : insertAt),
                            javaString("\n".concat(PLACEHOLDER$1))
                        ]);
                        java.invoke(builder, 'setSpan', [
                            spacerSpan(java, width, (embed.height + Surface.topGap) * embed.density),
                            javaInt(insertAt + 1),
                            javaInt(insertAt + 2),
                            javaInt(SPAN_EXCLUSIVE_EXCLUSIVE)
                        ]);
                        embed.placeholder = insertAt + 1;
                        embed.renderedText = (_javaText = javaText(java.invoke(builder, 'toString', []))) !== null && _javaText !== void 0 ? _javaText : null;
                        return [
                            4,
                            java.invokeAsync(embed.textView, 'setText', [
                                builder
                            ])
                        ];
                    case 1:
                        _state.sent();
                        return [
                            4,
                            relayout(embed)
                        ];
                    case 2:
                        _state.sent();
                        return [
                            2,
                            true
                        ];
                }
            });
        })();
    }
    function isCurrent(embed) {
        var _viewKey;
        var _readViewText;
        return !embed.disposed && embeds.get((_viewKey = viewKey$1(embed.messageView)) !== null && _viewKey !== void 0 ? _viewKey : '') === embed && ((_readViewText = readViewText(java, embed.textView)) === null || _readViewText === void 0 ? void 0 : _readViewText.string) === embed.renderedText;
    }
    function place(embed) {
        return _async_to_generator$1(function() {
            var container, position, _viewKey, mounted;
            return _ts_generator$1(this, function(_state) {
                switch(_state.label){
                    case 0:
                        if (!isCurrent(embed)) return [
                            2
                        ];
                        container = hostContainer(java, embed.textView);
                        position = reservedPosition(java, embed.textView, embed.placeholder, embed.height * embed.density);
                        if (!container || !position) return [
                            2
                        ];
                        return [
                            4,
                            placeHost(java, embed.host, container.container, {
                                x: container.offset.x + position.x,
                                y: container.offset.y + position.y
                            }, {
                                width: embed.width * embed.density,
                                height: embed.height * embed.density
                            })
                        ];
                    case 1:
                        _state.sent();
                        if (!!isCurrent(embed)) return [
                            3,
                            4
                        ];
                        if (!(embed.disposed || embeds.get((_viewKey = viewKey$1(embed.messageView)) !== null && _viewKey !== void 0 ? _viewKey : '') !== embed)) return [
                            3,
                            3
                        ];
                        return [
                            4,
                            removeHost(java, embed.host).catch(function() {
                                return undefined;
                            })
                        ];
                    case 2:
                        _state.sent();
                        _state.label = 3;
                    case 3:
                        return [
                            2
                        ];
                    case 4:
                        if (!(embed.mounting && !embed.disposed)) return [
                            3,
                            7
                        ];
                        return [
                            4,
                            embed.mounting.catch(function() {
                                return null;
                            })
                        ];
                    case 5:
                        mounted = _state.sent();
                        if (!!hostHasContent(java, embed.host)) return [
                            3,
                            7
                        ];
                        embed.mounting = null;
                        if (!mounted) return [
                            3,
                            7
                        ];
                        return [
                            4,
                            fabric.unmountAsync(mounted).catch(function() {
                                return undefined;
                            })
                        ];
                    case 6:
                        _state.sent();
                        _state.label = 7;
                    case 7:
                        if (!(!embed.mounting && !embed.disposed)) return [
                            3,
                            9
                        ];
                        embed.mounting = fabric.mountAsync(embed.host, surfaceModule, {
                            renderRevision: embed.revision,
                            surfaceId: embed.id
                        });
                        return [
                            4,
                            embed.mounting.catch(function(error) {
                                embed.mounting = null;
                                throw error;
                            })
                        ];
                    case 8:
                        _state.sent();
                        _state.label = 9;
                    case 9:
                        return [
                            2
                        ];
                }
            });
        })();
    }
    function settle(embed) {
        var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
        try {
            for(var _iterator = SETTLE_DELAYS[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                var delay = _step.value;
                setTimeout(function() {
                    place(embed).catch(function(error) {
                        console.error('[Message Link Embeds] Failed to place an Android embed:', error);
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
    function reportLayout(surfaceId, height) {
        var embed = byId.get(surfaceId);
        if (!embed || embed.disposed || !Number.isFinite(height) || height <= 0 || height > Surface.maxHeight) return;
        var fitted = Math.max(Surface.minHeight, height - Surface.bottomTrim);
        if (Math.abs(fitted - embed.height) < 2) return;
        embed.height = fitted;
        void reserve(embed).then(function(reserved) {
            return reserved && settle(embed);
        }).catch(function() {
            return undefined;
        });
    }
    function render(messageView, messageId) {
        return _async_to_generator$1(function() {
            var _javaNumber, _javaNumber1, _javaNumber2, _javaNumber3, key, channelId, source, _ref, target, existing, linkedMessage, _waiting_get, views, channelName, textView, built, resources, metrics, density, textWidth, width, embed;
            return _ts_generator$1(this, function(_state) {
                switch(_state.label){
                    case 0:
                        key = viewKey$1(messageView);
                        if (!key) return [
                            2
                        ];
                        channelId = currentChannelId();
                        source = channelId ? MessageStore.getMessage(channelId, messageId) : undefined;
                        _ref = _sliced_to_array$2(source ? linkedTargets(source) : [], 1), target = _ref[0];
                        existing = embeds.get(key);
                        if (!(existing && (!target || existing.messageId !== messageId || targetKey(existing.target) !== targetKey(target)))) return [
                            3,
                            2
                        ];
                        return [
                            4,
                            teardown(existing)
                        ];
                    case 1:
                        _state.sent();
                        _state.label = 2;
                    case 2:
                        if (!target) {
                            awaitingSize.delete(key);
                            return [
                                2
                            ];
                        }
                        linkedMessage = linked.get(target);
                        if (!linkedMessage) {
                            views = (_waiting_get = waiting.get(targetKey(target))) !== null && _waiting_get !== void 0 ? _waiting_get : new Map();
                            views.set(key, {
                                messageView: messageView,
                                messageId: messageId
                            });
                            waiting.set(targetKey(target), views);
                            linked.fetch(target);
                            return [
                                2
                            ];
                        }
                        channelName = linkedChannelName(target, linkedMessage);
                        textView = channelName ? contentTextView(messageView, channelName) : null;
                        built = buildEmbeddedContent(renderers, linkedMessage, target.channelId);
                        if (!channelName || !textView || !built) {
                            if (channelName && built) awaitingSize.set(key, {
                                messageView: messageView,
                                messageId: messageId
                            });
                            return [
                                2
                            ];
                        }
                        awaitingSize.delete(key);
                        resources = javaReference(java.invoke(textView, 'getResources', []));
                        metrics = resources ? javaReference(java.invoke(resources, 'getDisplayMetrics', [])) : null;
                        density = metrics ? (_javaNumber = javaNumber(java.getField(metrics, 'density'))) !== null && _javaNumber !== void 0 ? _javaNumber : 1 : 1;
                        textWidth = ((_javaNumber1 = javaNumber(java.invoke(textView, 'getWidth', []))) !== null && _javaNumber1 !== void 0 ? _javaNumber1 : 0) - ((_javaNumber2 = javaNumber(java.invoke(textView, 'getTotalPaddingLeft', []))) !== null && _javaNumber2 !== void 0 ? _javaNumber2 : 0) - ((_javaNumber3 = javaNumber(java.invoke(textView, 'getTotalPaddingRight', []))) !== null && _javaNumber3 !== void 0 ? _javaNumber3 : 0);
                        width = textWidth / density;
                        if (width < Surface.minWidth) {
                            awaitingSize.set(key, {
                                messageView: messageView,
                                messageId: messageId
                            });
                            return [
                                2
                            ];
                        }
                        embed = existing && !existing.disposed ? Object.assign(existing, {
                            textView: textView,
                            record: built.record,
                            generator: built.generator,
                            width: width
                        }) : _object_spread_props$2(_object_spread$3({
                            id: "message-link-android-".concat(nextId++),
                            messageView: messageView,
                            textView: textView,
                            host: createHost(java, textView),
                            mounting: null,
                            messageId: messageId,
                            target: target,
                            channelName: channelName,
                            density: density,
                            height: Surface.minHeight,
                            placeholder: 0,
                            renderedText: null,
                            original: null,
                            revision: 0,
                            disposed: false
                        }, built), {
                            width: width
                        });
                        embeds.set(key, embed);
                        byId.set(embed.id, embed);
                        if (embed === existing) publish(embed);
                        return [
                            4,
                            reserve(embed)
                        ];
                    case 3:
                        if (_state.sent()) settle(embed);
                        return [
                            2
                        ];
                }
            });
        })();
    }
    var token = hooks.hook(MESSAGE_VIEW$1, 'setMessage', SET_MESSAGE_PARAMETERS$1, {
        notify: true
    }, function(param) {
        var self = param.self, args = param.args;
        var messageView = javaReference(self);
        var message = javaReference(args[0]);
        var messageId = message ? javaText(java.invoke(message, 'getId-3Eiw7ao', [])) : undefined;
        if (!messageView || !messageId) return;
        setTimeout(function() {
            render(messageView, messageId).catch(function(error) {
                console.error('[Message Link Embeds] Failed to embed a linked message on Android:', error);
            });
        }, 0);
    });
    var sizeToken = hooks.hook(MESSAGE_VIEW$1, 'onSizeChanged', SIZE_PARAMETERS$1, {
        notify: true
    }, function(param) {
        var self = param.self;
        var key = viewKey$1(self);
        var pending = key ? awaitingSize.get(key) : undefined;
        if (!key || !pending) return;
        awaitingSize.delete(key);
        render(pending.messageView, pending.messageId).catch(function(error) {
            console.error('[Message Link Embeds] Failed to embed a linked message on Android:', error);
        });
    });
    function scanVisible() {
        var decor = currentDecorView(java);
        if (!decor || controller.signal.aborted) return;
        var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
        try {
            for(var _iterator = findViewsOfClass(java, decor, MESSAGE_VIEW$1)[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                var messageView = _step.value;
                var messageId = javaText(java.getField(messageView, MESSAGE_ID_FIELD$1));
                if (messageId) {
                    render(messageView, messageId).catch(function(error) {
                        console.error('[Message Link Embeds] Failed to embed a linked message on Android:', error);
                    });
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
            controller.abort();
            hooks.remove(token);
            hooks.remove(sizeToken);
            awaitingSize.clear();
            linked.clear();
            listeners.clear();
            return Promise.all(_to_consumable_array$2(embeds.values()).flatMap(function(embed) {
                return [
                    teardown(embed),
                    restore(embed)
                ];
            })).then(function() {
                return undefined;
            });
        }
    };
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
            return call('put', [
                javaString(original),
                javaString(rendered),
                javaString(JSON.stringify(edits))
            ]);
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
}function _array_like_to_array$2(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_with_holes$1(arr) {
    if (Array.isArray(arr)) return arr;
}
function _array_without_holes$1(arr) {
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
function _define_property$2(obj, key, value) {
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
function _sliced_to_array$1(arr, i) {
    return _array_with_holes$1(arr) || _iterable_to_array_limit$1(arr, i) || _unsupported_iterable_to_array$2(arr, i) || _non_iterable_rest$1();
}
function _to_consumable_array$1(arr) {
    return _array_without_holes$1(arr) || _iterable_to_array$1(arr) || _unsupported_iterable_to_array$2(arr) || _non_iterable_spread$1();
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
var NEEDS_HOST_PARAMETERS = [
    'android.widget.TextView',
    'java.lang.String'
];
var MAX_GROUPS_PER_TEXT = 4;
var INITIAL_GROUPS = 2;
var MAX_DEFINITIONS = 48;
function anchorOf(slot) {
    return {
        placeholder: slot.placeholder,
        width: slot.width,
        height: slot.height,
        pinTop: slot.pinTop,
        offsetY: slot.offsetY
    };
}
function sameAnchors(left, right) {
    return left.length === right.length && left.every(function(slot, index) {
        return JSON.stringify(slot) === JSON.stringify(right[index]);
    });
}
/**
 * @description Shows React surfaces inside reserved room in Discord's Android message text through the loader's native text rewrites. Each rendered text gets groups of mounted hosts that the loader moves into whichever chat row shows that text, while Discord binds the row, so cards and embeds stay in place while the chat scrolls.
 * @param native The plugin's Java, hook and Fabric bridges.
 * @param options The text view class to rewrite, the registered surface to mount, and a prefix for group IDs.
 * @returns The inline surfaces, or `null` when the installed loader has no native text rewrites.
 */ function createInlineSurfaces(native, options) {
    var java = native.java, hooks = native.hooks, fabric = native.fabric;
    var rewrites = connectTextRewrites(java, options.watchedClass);
    if (!rewrites) return null;
    var active = rewrites;
    var entries = new Map();
    var nextGroup = 0;
    var disposed = false;
    function createGroup(entry) {
        if (disposed || entry.groups.length >= MAX_GROUPS_PER_TEXT) return;
        var context = javaReference(java.invoke(entry.textView, 'getContext', []));
        var group = {
            id: "".concat(options.groupPrefix, "-").concat(nextGroup++),
            hosts: [],
            mounts: []
        };
        var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
        try {
            var _loop = function() {
                var slot = _step.value;
                var host = java.construct('android.widget.FrameLayout', context ? [
                    context
                ] : []);
                var mount = fabric.mountAsync(host, options.surfaceModule, {
                    surfaceId: slot.surfaceId
                }).catch(function() {
                    return null;
                });
                group.hosts.push(host);
                group.mounts.push(mount);
                void mount.then(function() {
                    if (!disposed && entry.groups.includes(group)) {
                        active.addHost(group.id, entry.rendered, host, anchorOf(slot));
                    }
                });
            };
            for(var _iterator = entry.slots[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true)_loop();
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
        entry.groups.push(group);
    }
    function removeGroup(group) {
        return _async_to_generator(function() {
            var _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, mount, surface, err;
            return _ts_generator(this, function(_state) {
                switch(_state.label){
                    case 0:
                        active.removeGroup(group.id);
                        _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
                        _state.label = 1;
                    case 1:
                        _state.trys.push([
                            1,
                            7,
                            8,
                            9
                        ]);
                        _iterator = group.mounts[Symbol.iterator]();
                        _state.label = 2;
                    case 2:
                        if (!!(_iteratorNormalCompletion = (_step = _iterator.next()).done)) return [
                            3,
                            6
                        ];
                        mount = _step.value;
                        return [
                            4,
                            mount
                        ];
                    case 3:
                        surface = _state.sent();
                        if (!surface) return [
                            3,
                            5
                        ];
                        return [
                            4,
                            fabric.unmountAsync(surface).catch(function() {
                                return undefined;
                            })
                        ];
                    case 4:
                        _state.sent();
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
    function evict(entry) {
        entries.delete(entry.rendered);
        active.remove(entry.original);
        var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
        try {
            for(var _iterator = entry.groups[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                var group = _step.value;
                void removeGroup(group);
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
    var token = hooks.hook(TEXT_REWRITES_CLASS, 'needsHost', NEEDS_HOST_PARAMETERS, {
        notify: true
    }, function(param) {
        var args = param.args;
        var rendered = javaText(args[1]);
        var entry = rendered ? entries.get(rendered) : undefined;
        if (entry) {
            createGroup(entry);
        }
    });
    return {
        define: function define(definition) {
            if (disposed) return;
            var existing = entries.get(definition.rendered);
            active.put(definition.original, definition.rendered, definition.edits);
            if (existing) {
                var resized = !sameAnchors(existing.slots, definition.slots);
                Object.assign(existing, definition);
                entries.delete(definition.rendered);
                entries.set(definition.rendered, existing);
                if (resized) {
                    var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
                    try {
                        for(var _iterator = existing.groups[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                            var group = _step.value;
                            var _iteratorNormalCompletion1 = true, _didIteratorError1 = false, _iteratorError1 = undefined;
                            try {
                                for(var _iterator1 = group.hosts.entries()[Symbol.iterator](), _step1; !(_iteratorNormalCompletion1 = (_step1 = _iterator1.next()).done); _iteratorNormalCompletion1 = true){
                                    var _step_value = _sliced_to_array$1(_step1.value, 2), index = _step_value[0], host = _step_value[1];
                                    var slot = definition.slots[index];
                                    if (slot) {
                                        active.updateAnchor(host, anchorOf(slot));
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
                    active.refresh(definition.rendered);
                }
                active.reapply(definition.textView);
                return;
            }
            var entry = _object_spread_props$1(_object_spread$2({}, definition), {
                groups: []
            });
            entries.set(definition.rendered, entry);
            if (entries.size > MAX_DEFINITIONS) {
                evict(entries.values().next().value);
            }
            for(var index1 = 0; index1 < INITIAL_GROUPS; index1++)createGroup(entry);
            active.reapply(definition.textView);
        },
        isDefined: function isDefined(rendered) {
            return entries.has(rendered);
        },
        definitions: function definitions() {
            return _to_consumable_array$1(entries.values());
        },
        dispose: function dispose() {
            return _async_to_generator(function() {
                var groups;
                return _ts_generator(this, function(_state) {
                    switch(_state.label){
                        case 0:
                            disposed = true;
                            hooks.remove(token);
                            groups = _to_consumable_array$1(entries.values()).flatMap(function(entry) {
                                active.remove(entry.original);
                                return entry.groups;
                            });
                            entries.clear();
                            active.refreshAll();
                            return [
                                4,
                                Promise.all(groups.map(removeGroup))
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
    };
}function _array_like_to_array$1(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_with_holes(arr) {
    if (Array.isArray(arr)) return arr;
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
var MESSAGE_VIEW = 'com.discord.chat.presentation.message.MessageView';
var MESSAGE_ID_FIELD = 'messageId';
var MESSAGE_CONTENT_VIEW = 'com.discord.chat.presentation.message.view.MessageContentView';
var SET_MESSAGE_PARAMETERS = [
    'com.discord.chat.bridge.Message',
    'com.discord.chat.presentation.root.MessageContext',
    'com.discord.chat.presentation.events.ChatEventHandler',
    'com.discord.chat.presentation.message.view.botuikit.ComponentProvider',
    'kotlin.jvm.functions.Function0',
    'boolean',
    'boolean'
];
var SIZE_PARAMETERS = [
    'int',
    'int',
    'int',
    'int'
];
var PLACEHOLDER = '￼';
var INSERTION = "\n".concat(PLACEHOLDER);
function viewKey(view) {
    return view.type === 'handle' ? view.value : undefined;
}
/**
 * @description Embeds the message each Android message links to as a real chat row through the loader's native text rewrites, so embeds stay in place while the chat scrolls.
 * @param native The plugin's Java, hook and Fabric bridges.
 * @param renderers Discord's message renderers, shared with the iOS embeds.
 * @returns `dispose`, which removes every embed and restores the text, or `undefined` when the surface or the native rewrites are unavailable.
 */ function createNativeEmbeds(native, renderers) {
    var java = native.java, hooks = native.hooks;
    if (!connectTextRewrites(java, MESSAGE_CONTENT_VIEW)) return undefined;
    var embeds = new Map();
    var bySurface = new Map();
    var heights = new Map();
    var listeners = new Map();
    var waiting = new Map();
    var awaitingSize = new Map();
    var controller = new AbortController();
    var nextSurface = 0;
    var disposed = false;
    var linked = createLinkedMessages(controller.signal, function(key) {
        var _ref;
        var _waiting_get;
        var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
        try {
            for(var _iterator = ((_ref = (_waiting_get = waiting.get(key)) === null || _waiting_get === void 0 ? void 0 : _waiting_get.values()) !== null && _ref !== void 0 ? _ref : [])[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                var _step_value = _step.value, messageView = _step_value.messageView, messageId = _step_value.messageId;
                schedule(messageView, messageId);
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
        waiting.delete(key);
    });
    var surfaceModule = registerMessageSurface({
        renderers: renderers,
        surface: function surface(surfaceId) {
            return bySurface.get(surfaceId);
        },
        reportLayout: function reportLayout1(surfaceId, height) {
            return reportLayout(surfaceId, height);
        },
        revision: function revision(surfaceId) {
            var _ref;
            var _bySurface_get;
            return (_ref = (_bySurface_get = bySurface.get(surfaceId)) === null || _bySurface_get === void 0 ? void 0 : _bySurface_get.revision) !== null && _ref !== void 0 ? _ref : -1;
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
        }
    });
    if (!surfaceModule) return undefined;
    var surfaces = createInlineSurfaces(native, {
        watchedClass: MESSAGE_CONTENT_VIEW,
        surfaceModule: surfaceModule,
        groupPrefix: 'embed'
    });
    if (!surfaces) return undefined;
    var inline = surfaces;
    function publish(embed) {
        var _listeners_get;
        embed.revision++;
        var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
        try {
            for(var _iterator = ((_listeners_get = listeners.get(embed.surfaceId)) !== null && _listeners_get !== void 0 ? _listeners_get : [])[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
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
    function heightFor(target) {
        var _heights_get;
        return (_heights_get = heights.get(targetKey(target))) !== null && _heights_get !== void 0 ? _heights_get : Surface.minHeight;
    }
    function define(embed) {
        var px = function px(value) {
            return Math.round(value * embed.density);
        };
        var height = heightFor(embed.target);
        inline.define({
            original: embed.original,
            rendered: embed.rendered,
            textView: embed.textView,
            edits: [
                {
                    start: embed.insertAt,
                    end: embed.insertAt,
                    text: INSERTION,
                    spacerOffset: 1,
                    width: px(embed.width),
                    height: px(height + Surface.topGap)
                }
            ],
            slots: [
                {
                    surfaceId: embed.surfaceId,
                    placeholder: embed.insertAt + 1,
                    width: px(embed.width),
                    height: px(height)
                }
            ]
        });
    }
    function reportLayout(surfaceId, height) {
        var _heights_get;
        var embed = bySurface.get(surfaceId);
        if (!embed || disposed || !Number.isFinite(height) || height <= 0 || height > Surface.maxHeight) {
            return;
        }
        var fitted = Math.max(Surface.minHeight, height - Surface.bottomTrim);
        var key = targetKey(embed.target);
        if (Math.abs(fitted - ((_heights_get = heights.get(key)) !== null && _heights_get !== void 0 ? _heights_get : Surface.minHeight)) < 2) return;
        heights.set(key, fitted);
        define(embed);
    }
    function contentTextView(messageView, channelName) {
        var stack = [
            messageView
        ];
        var contentClass = java.getClass(MESSAGE_CONTENT_VIEW);
        var groupClass = java.getClass('android.view.ViewGroup');
        while(stack.length){
            var _javaNumber;
            var view = stack.pop();
            if (javaFlag(java.invoke(contentClass, 'isInstance', [
                view
            ]))) {
                var _ref;
                var _readViewText;
                var text = (_ref = (_readViewText = readViewText(java, view)) === null || _readViewText === void 0 ? void 0 : _readViewText.string) !== null && _ref !== void 0 ? _ref : '';
                if (findRenderedLinkRange(text, channelName)) return view;
                continue;
            }
            if (!javaFlag(java.invoke(groupClass, 'isInstance', [
                view
            ]))) continue;
            var count = (_javaNumber = javaNumber(java.invoke(view, 'getChildCount', []))) !== null && _javaNumber !== void 0 ? _javaNumber : 0;
            for(var index = count - 1; index >= 0; index--){
                var child = javaReference(java.invoke(view, 'getChildAt', [
                    javaInt(index)
                ]));
                if (child) stack.push(child);
            }
        }
        return null;
    }
    function textWidth(textView, density) {
        var _javaNumber, _javaNumber1, _javaNumber2;
        return (((_javaNumber = javaNumber(java.invoke(textView, 'getWidth', []))) !== null && _javaNumber !== void 0 ? _javaNumber : 0) - ((_javaNumber1 = javaNumber(java.invoke(textView, 'getTotalPaddingLeft', []))) !== null && _javaNumber1 !== void 0 ? _javaNumber1 : 0) - ((_javaNumber2 = javaNumber(java.invoke(textView, 'getTotalPaddingRight', []))) !== null && _javaNumber2 !== void 0 ? _javaNumber2 : 0)) / density;
    }
    function displayDensity(textView) {
        var _javaNumber;
        var resources = javaReference(java.invoke(textView, 'getResources', []));
        var metrics = resources ? javaReference(java.invoke(resources, 'getDisplayMetrics', [])) : null;
        return metrics ? (_javaNumber = javaNumber(java.getField(metrics, 'density'))) !== null && _javaNumber !== void 0 ? _javaNumber : 1 : 1;
    }
    function render(messageView, messageId) {
        var _ref, _ref1;
        var key = viewKey(messageView);
        var channelId = currentChannelId();
        var source = channelId ? MessageStore.getMessage(channelId, messageId) : undefined;
        var _ref2 = _sliced_to_array(source ? linkedTargets(source) : [], 1), target = _ref2[0];
        if (!key || !target || disposed) return;
        var linkedMessage = linked.get(target);
        if (!linkedMessage) {
            var _waiting_get;
            var views = (_waiting_get = waiting.get(targetKey(target))) !== null && _waiting_get !== void 0 ? _waiting_get : new Map();
            views.set(key, {
                messageView: messageView,
                messageId: messageId
            });
            waiting.set(targetKey(target), views);
            linked.fetch(target);
            return;
        }
        var channelName = linkedChannelName(target, linkedMessage);
        var textView = channelName ? contentTextView(messageView, channelName) : null;
        var content = textView ? readViewText(java, textView) : null;
        if (!channelName || !textView || !content || inline.isDefined(content.string)) return;
        var range = findRenderedLinkRange(content.string, channelName);
        var built = buildEmbeddedContent(renderers, linkedMessage, target.channelId);
        var density = displayDensity(textView);
        var width = textWidth(textView, density);
        if (!range || !built) return;
        if (width < Surface.minWidth) {
            awaitingSize.set(key, {
                messageView: messageView,
                messageId: messageId
            });
            return;
        }
        awaitingSize.delete(key);
        var insertAt = range.location + range.length;
        var rendered = content.string.slice(0, insertAt) + INSERTION + content.string.slice(insertAt);
        var previous = embeds.get(rendered);
        var embed = _object_spread_props(_object_spread$1({}, built), {
            width: width,
            target: target,
            original: content.string,
            rendered: rendered,
            insertAt: insertAt,
            textView: textView,
            density: density,
            surfaceId: (_ref = previous === null || previous === void 0 ? void 0 : previous.surfaceId) !== null && _ref !== void 0 ? _ref : "message-link-android-".concat(nextSurface++),
            revision: (_ref1 = previous === null || previous === void 0 ? void 0 : previous.revision) !== null && _ref1 !== void 0 ? _ref1 : 0
        });
        embeds.set(rendered, embed);
        bySurface.set(embed.surfaceId, embed);
        publish(embed);
        define(embed);
    }
    function schedule(messageView, messageId) {
        setTimeout(function() {
            try {
                render(messageView, messageId);
            } catch (error) {
                console.error('[Message Link Embeds] Failed to embed a linked message on Android:', error);
            }
        }, 0);
    }
    var token = hooks.hook(MESSAGE_VIEW, 'setMessage', SET_MESSAGE_PARAMETERS, {
        notify: true
    }, function(param) {
        var self = param.self, args = param.args;
        var messageView = javaReference(self);
        var message = javaReference(args[0]);
        var messageId = message ? javaText(java.invoke(message, 'getId-3Eiw7ao', [])) : undefined;
        if (messageView && messageId) schedule(messageView, messageId);
    });
    var sizeToken = hooks.hook(MESSAGE_VIEW, 'onSizeChanged', SIZE_PARAMETERS, {
        notify: true
    }, function(param) {
        var self = param.self;
        var key = viewKey(self);
        var pending = key ? awaitingSize.get(key) : undefined;
        if (!key || !pending) return;
        awaitingSize.delete(key);
        schedule(pending.messageView, pending.messageId);
    });
    function scanVisible() {
        var decor = currentDecorView(java);
        if (!decor || disposed) return;
        var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
        try {
            for(var _iterator = findViewsOfClass(java, decor, MESSAGE_VIEW)[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                var messageView = _step.value;
                var messageId = javaText(java.getField(messageView, MESSAGE_ID_FIELD));
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
            controller.abort();
            hooks.remove(token);
            hooks.remove(sizeToken);
            awaitingSize.clear();
            waiting.clear();
            embeds.clear();
            bySurface.clear();
            listeners.clear();
            return inline.dispose();
        }
    };
}/**
 * @description Plays animated images inside embeds, where Discord would otherwise wait for a tap.
 * @param FastImage The `FastImage` module, whose default export is a `memo`.
 * @returns A function that restores `FastImage`.
 */ function patchFastImage(FastImage) {
    var Memo = FastImage.default;
    if (!ensureModules('Message Link Embeds: animated images', {
        FastImage: Memo === null || Memo === void 0 ? void 0 : Memo.type
    })) {
        return function() {};
    }
    return embedComponent(Memo, 'type', animatedImageProps);
}/**
 * @description Tracks timeouts so stopping the plugin can cancel every one still pending.
 * @returns `later` schedules a callback, `cancel` drops one, `clear` drops them all.
 */ function createTimers() {
    var pending = new Set();
    function later(callback) {
        var delay = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : 0;
        var timer = setTimeout(function() {
            pending.delete(timer);
            callback();
        }, delay);
        pending.add(timer);
        return timer;
    }
    function cancel(timer) {
        if (!timer) return;
        clearTimeout(timer);
        pending.delete(timer);
    }
    function clear() {
        var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
        try {
            for(var _iterator = pending[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
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
        pending.clear();
    }
    return {
        later: later,
        cancel: cancel,
        clear: clear
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
 * @description Opens a session and registers the React surface its embeds mount.
 * @param objc The Objective-C bridge.
 * @param fabric The Fabric bridge that mounts React surfaces into native views.
 * @param renderers Discord's message renderers.
 * @returns The session, and `dispose`, which tears down every embed it created; `undefined` when the surface did not register.
 */ function createSession(objc, fabric, renderers) {
    var controller = new AbortController();
    var session = {
        objc: objc,
        fabric: fabric,
        renderers: renderers,
        signal: controller.signal,
        timers: createTimers(),
        surfaceModule: '',
        linked: createLinkedMessages(controller.signal, function(key) {
            return wakeWaitingCells(session, key);
        }),
        cells: new Map(),
        surfaces: new Map(),
        surfacesById: new Map(),
        heights: new SurfaceHeightCache(),
        nextVersion: 0
    };
    var surfaceModule = registerMessageSurface({
        renderers: session.renderers,
        surface: function surface(surfaceId) {
            return session.surfacesById.get(surfaceId);
        },
        reportLayout: function reportLayout(surfaceId, height) {
            return reportSurfaceLayout(session, surfaceId, height);
        }
    });
    if (!surfaceModule) return;
    session.surfaceModule = surfaceModule;
    // The registered surface keeps this session alive after `stop`, so it lets go of every handle and message.
    function dispose() {
        controller.abort();
        session.timers.clear();
        var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
        try {
            for(var _iterator = session.cells.values()[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                var cell = _step.value;
                removeLabelHooks(cell);
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
            for(var _iterator1 = _to_consumable_array(session.surfaces.values())[Symbol.iterator](), _step1; !(_iteratorNormalCompletion1 = (_step1 = _iterator1.next()).done); _iteratorNormalCompletion1 = true){
                var surface = _step1.value;
                teardownSurface(session, surface, true);
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
        session.cells.clear();
        session.surfacesById.clear();
        session.linked.clear();
    }
    return {
        session: session,
        dispose: dispose
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
var dispose = function dispose() {
    return undefined;
};
function start(context) {
    var _context_native = context.native, objc = _context_native.objc, fabric = _context_native.fabric;
    var renderers = findRenderers();
    var modules = _object_spread({
        ChannelStore: ChannelStore,
        MessageStore: MessageStore,
        SelectedChannelStore: SelectedChannelStore,
        fetchMessage: MessageActions.fetchMessage
    }, renderers);
    if (context.platform === 'android') {
        var _createNativeEmbeds;
        if (!ensureCapabilities('Message Link Embeds', context.native, context.capabilities) || !ensureModules('Message Link Embeds', modules)) {
            return;
        }
        var android = (_createNativeEmbeds = createNativeEmbeds(context.native, renderers)) !== null && _createNativeEmbeds !== void 0 ? _createNativeEmbeds : createAndroidEmbeds(context.native, renderers);
        if (!android) {
            console.error('[Message Link Embeds] Skipped, the embed surface did not register.');
            return;
        }
        dispose = applyFeatures('Message Link Embeds', [
            function() {
                return android.dispose;
            },
            function() {
                return whenLoaded(FastImageSource, patchFastImage);
            },
            function() {
                return whenLoaded(LottieAnimationViewSource, patchLottieAnimationView);
            },
            function() {
                return whenLoaded(NativeLottieViewSource, patchNativeLottieView);
            }
        ]);
        return;
    }
    if (!ensureCapabilities('Message Link Embeds', context.native, context.capabilities) || !ensureModules('Message Link Embeds', modules) || !ensureClasses('Message Link Embeds', objc, [
        'DCDMessageTableViewCell',
        messageTextViewClass(objc)
    ])) {
        return;
    }
    // `ensureModules` found every renderer.
    var embeds = createSession(objc, fabric, renderers);
    if (!embeds) {
        console.error('[Message Link Embeds] Skipped, the embed surface did not register.');
        return;
    }
    var session = embeds.session;
    dispose = applyFeatures('Message Link Embeds', [
        function() {
            return embeds.dispose;
        },
        function() {
            return whenLoaded(FastImageSource, patchFastImage);
        },
        function() {
            return whenLoaded(LottieAnimationViewSource, patchLottieAnimationView);
        },
        function() {
            return whenLoaded(NativeLottieViewSource, patchNativeLottieView);
        },
        function() {
            return subscribeMessageStore(session);
        },
        function() {
            return hookMessageCells(session);
        }
    ]);
}
function stop() {
    var finished = dispose();
    dispose = function dispose() {
        return undefined;
    };
    return finished;
}
var index = {
    start: start,
    stop: stop
};
return index;
})();return this.__plugin;},start(context){const module=this.__load();const plugin=module?.default??module;if(plugin&&typeof plugin.start==='function')return plugin.start(context);},stop(){const module=this.__load();const plugin=module?.default??module;if(plugin&&typeof plugin.stop==='function')return plugin.stop();}})