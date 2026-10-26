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
}/**
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
    return _async_to_generator$3(function() {
        return _ts_generator$3(this, function(_state) {
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
function _to_array(arr) {
    return _array_with_holes$2(arr) || _iterable_to_array$3(arr) || _unsupported_iterable_to_array$4(arr) || _non_iterable_rest$2();
}
function _to_consumable_array$3(arr) {
    return _array_without_holes$3(arr) || _iterable_to_array$3(arr) || _unsupported_iterable_to_array$4(arr) || _non_iterable_spread$3();
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
 * @description Checks that a value is a `#rrggbb` hex color.
 * @param color The value to check.
 * @returns Whether the value is a six-digit hex color string.
 */ function isHexColor(color) {
    return typeof color === 'string' && /^#[\da-f]{6}$/i.test(color);
}
/**
 * @description Converts red, green and blue components in the 0-1 range to a hex color.
 * @param red The red component.
 * @param green The green component.
 * @param blue The blue component.
 * @returns The `#rrggbb` color, or `null` when a component is outside 0-1.
 */ function colorComponentsToHex(red, green, blue) {
    var components = [
        red,
        green,
        blue
    ];
    if (components.some(function(component) {
        return !(component >= 0 && component <= 1);
    })) return null;
    return "#".concat(components.map(function(component) {
        return Math.round(component * 255).toString(16).padStart(2, '0');
    }).join(''));
}
/**
 * @description Parses the `description` of a `UIColor` in the extended sRGB or gray color space.
 * @param description The color's description, such as `UIExtendedSRGBColorSpace 1 0 0 1`.
 * @returns The color's hex value and alpha, or `null` for any other color space.
 */ function parseNativeColorDescription(description) {
    var _description_trim_split = _to_array(description.trim().split(/\s+/)), space = _description_trim_split[0], values = _description_trim_split.slice(1);
    var components = values.map(Number);
    var channels;
    var alpha;
    if (space === 'UIExtendedSRGBColorSpace' && components.length === 4) {
        channels = components.slice(0, 3);
        alpha = components[3];
    } else if (space === 'UIExtendedGrayColorSpace' && components.length === 2) {
        channels = [
            components[0],
            components[0],
            components[0]
        ];
        alpha = components[1];
    } else {
        return null;
    }
    if (!(alpha >= 0 && alpha <= 1)) return null;
    var hex = colorComponentsToHex(channels[0], channels[1], channels[2]);
    return hex ? {
        hex: hex,
        alpha: alpha
    } : null;
}
/**
 * @description Builds the cache key for a role label rendered in a color.
 * @param label The role label.
 * @param color The label's hex color.
 * @returns A key that ignores case and surrounding whitespace.
 */ function getRoleGradientKey(label, color) {
    return "".concat(label.trim().toLowerCase(), ":").concat(color.toLowerCase());
}
/**
 * @description Lists a role's distinct valid color stops, primary first.
 * @param colors The role's enhanced colors.
 * @param fallbackColor The plain role color, used when the enhanced primary color is missing.
 * @param includeEnhanced Whether to include the secondary and tertiary stops.
 * @returns The valid, deduplicated hex stops, or an empty list when the role has no color.
 */ function getRoleColorStops(colors, // UNKNOWN: callers pass Discord's untyped `colorString` fields as they are.
fallbackColor) {
    var includeEnhanced = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : true;
    var primary = isHexColor(colors === null || colors === void 0 ? void 0 : colors.primaryColor) ? colors.primaryColor : fallbackColor;
    if (!isHexColor(primary)) {
        return [];
    }
    if (!includeEnhanced) {
        return [
            primary
        ];
    }
    return [
        primary,
        colors === null || colors === void 0 ? void 0 : colors.secondaryColor,
        colors === null || colors === void 0 ? void 0 : colors.tertiaryColor
    ].filter(function(color, index, stops) {
        return isHexColor(color) && stops.indexOf(color) === index;
    });
}
/**
 * @description Describes how a role's color renders: its stops, and whether it is solid, a gradient or holographic.
 * @param colors The role's enhanced colors.
 * @param fallbackColor The plain role color, used when the enhanced primary color is missing.
 * @param includeEnhanced Whether to include the secondary and tertiary stops.
 * @returns The role's color stops and style.
 */ function getRoleColorAppearance(colors, // UNKNOWN: callers pass Discord's untyped `colorString` fields as they are.
fallbackColor) {
    var includeEnhanced = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : true;
    var stops = getRoleColorStops(colors, fallbackColor, includeEnhanced);
    if (stops.length < 2) {
        return {
            colors: stops,
            style: 'solid'
        };
    }
    var holographic = includeEnhanced && stops.length >= 3 && isHexColor(colors === null || colors === void 0 ? void 0 : colors.secondaryColor) && isHexColor(colors === null || colors === void 0 ? void 0 : colors.tertiaryColor);
    return {
        colors: stops,
        style: holographic ? 'holographic' : 'gradient'
    };
}
function relativeLuminance(color) {
    var value = Number.parseInt(color.slice(1), 16);
    var _map = _sliced_to_array$2([
        16,
        8,
        0
    ].map(function(shift) {
        var channel = (value >> shift & 0xff) / 255;
        return channel <= 0.04045 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
    }), 3), red = _map[0], green = _map[1], blue = _map[2];
    return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}
/**
 * @description Picks black or white text, whichever contrasts more with every background.
 * @param backgrounds The hex colors the text sits on.
 * @returns `#000000` or `#ffffff`, white when there are no backgrounds.
 */ function getContrastingTextColor(backgrounds) {
    var _Math, _Math1;
    if (!backgrounds.length) {
        return '#ffffff';
    }
    var luminances = backgrounds.map(relativeLuminance);
    var whiteContrast = (_Math = Math).min.apply(_Math, _to_consumable_array$3(luminances.map(function(luminance) {
        return 1.05 / (luminance + 0.05);
    })));
    var blackContrast = (_Math1 = Math).min.apply(_Math1, _to_consumable_array$3(luminances.map(function(luminance) {
        return (luminance + 0.05) / 0.05;
    })));
    return blackContrast > whiteContrast ? '#000000' : '#ffffff';
}var HEX_COLOR = /^#[\da-f]{6}$/i;
/** Checked in order; a user gets the first enabled tag they qualify for. */ var TAGS = [
    {
        name: 'WEBHOOK',
        color: '#5865F2',
        displayName: 'Webhook',
        description: 'Messages sent by webhooks',
        condition: function condition(message, user) {
            return Boolean(message.webhookId) && Boolean(user.bot);
        }
    },
    {
        name: 'OWNER',
        color: '#F0B232',
        displayName: 'Owner',
        description: 'Owns the server',
        condition: function condition(_message, user, guild) {
            return (guild === null || guild === void 0 ? void 0 : guild.ownerId) === user.id;
        }
    },
    {
        name: 'ADMINISTRATOR',
        color: '#DA373C',
        displayName: 'Admin',
        description: 'Has the administrator permission',
        permissions: [
            'ADMINISTRATOR'
        ]
    },
    {
        name: 'MODERATOR_STAFF',
        color: '#248046',
        displayName: 'Staff',
        description: 'Can manage the server, channels or roles',
        permissions: [
            'MANAGE_GUILD',
            'MANAGE_CHANNELS',
            'MANAGE_ROLES',
            'MANAGE_WEBHOOKS'
        ]
    },
    {
        name: 'MODERATOR',
        color: '#4E7FFF',
        displayName: 'Mod',
        description: 'Can manage messages or kick/ban people',
        permissions: [
            'MANAGE_MESSAGES',
            'KICK_MEMBERS',
            'BAN_MEMBERS'
        ]
    },
    {
        name: 'VOICE_MODERATOR',
        color: '#059669',
        displayName: 'VC Mod',
        description: 'Can manage voice chats',
        permissions: [
            'MOVE_MEMBERS',
            'MUTE_MEMBERS',
            'DEAFEN_MEMBERS'
        ]
    }
];function _array_like_to_array$3(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_without_holes$2(arr) {
    if (Array.isArray(arr)) return _array_like_to_array$3(arr);
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
function _iterable_to_array$2(iter) {
    if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) {
        return Array.from(iter);
    }
}
function _non_iterable_spread$2() {
    throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _to_consumable_array$2(arr) {
    return _array_without_holes$2(arr) || _iterable_to_array$2(arr) || _unsupported_iterable_to_array$3(arr) || _non_iterable_spread$2();
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
function _unsupported_iterable_to_array$3(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _array_like_to_array$3(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(n);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _array_like_to_array$3(o, minLen);
}
function reducesMotion() {
    return _async_to_generator$2(function() {
        return _ts_generator$2(this, function(_state) {
            return [
                2,
                window.ReactNative.AccessibilityInfo.isReduceMotionEnabled().catch(function() {
                    return false;
                })
            ];
        });
    })();
}
function rectSignature(rect) {
    var value = rect === null || rect === void 0 ? void 0 : rect.value;
    if (!value) return null;
    var coordinates = [
        value.origin.x,
        value.origin.y,
        value.size.width,
        value.size.height
    ];
    return coordinates.every(Number.isFinite) ? coordinates.join(':') : null;
}
/**
 * @description Draws role-color gradients, and the animated holographic sheen, into tag layers.
 * @param objc The Objective-C bridge.
 * @param classes The Core Animation and UIKit classes the painter uses.
 * @param colors The renderer's UIKit color helpers.
 * @returns `createLayer` makes a gradient layer, `paint` applies an appearance to it, `removeSheen` drops its sheen.
 */ function createGradientPainter(objc, classes, colors) {
    var CAGradientLayer = classes.CAGradientLayer, CABasicAnimation = classes.CABasicAnimation, CAMediaTimingFunction = classes.CAMediaTimingFunction;
    function pointHorizontally(layer) {
        return _async_to_generator$2(function() {
            return _ts_generator$2(this, function(_state) {
                switch(_state.label){
                    case 0:
                        return [
                            4,
                            objc.invokeAsync(layer, 'setStartPoint:', [
                                objc.struct('CGPoint', {
                                    x: 0,
                                    y: 0
                                })
                            ])
                        ];
                    case 1:
                        _state.sent();
                        return [
                            4,
                            objc.invokeAsync(layer, 'setEndPoint:', [
                                objc.struct('CGPoint', {
                                    x: 1,
                                    y: 0
                                })
                            ])
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
    function fitLayer(layer, geometry, frame, radius) {
        return _async_to_generator$2(function() {
            var signature;
            return _ts_generator$2(this, function(_state) {
                switch(_state.label){
                    case 0:
                        signature = rectSignature(frame);
                        if (!(signature && signature !== geometry.frameSignature)) return [
                            3,
                            2
                        ];
                        return [
                            4,
                            objc.invokeAsync(layer, 'setFrame:', [
                                frame
                            ])
                        ];
                    case 1:
                        _state.sent();
                        geometry.frameSignature = signature;
                        _state.label = 2;
                    case 2:
                        if (!(Number.isFinite(radius) && radius !== geometry.cornerRadius)) return [
                            3,
                            4
                        ];
                        return [
                            4,
                            objc.invokeAsync(layer, 'setCornerRadius:', [
                                radius
                            ])
                        ];
                    case 3:
                        _state.sent();
                        geometry.cornerRadius = radius;
                        _state.label = 4;
                    case 4:
                        return [
                            2
                        ];
                }
            });
        })();
    }
    function fit(record) {
        return _async_to_generator$2(function() {
            var labelLayer, frame, radius, bounds;
            return _ts_generator$2(this, function(_state) {
                switch(_state.label){
                    case 0:
                        return [
                            4,
                            objc.invokeAsync(record.label, 'layer', [])
                        ];
                    case 1:
                        labelLayer = _state.sent();
                        return [
                            4,
                            objc.invokeAsync(record.label, 'frame', [])
                        ];
                    case 2:
                        frame = _state.sent();
                        return [
                            4,
                            objc.invokeAsync(labelLayer, 'cornerRadius', [])
                        ];
                    case 3:
                        radius = Number.apply(void 0, [
                            _state.sent()
                        ]);
                        return [
                            4,
                            fitLayer(record.layer, record.geometry, frame, radius)
                        ];
                    case 4:
                        _state.sent();
                        if (!record.sheen) return [
                            2
                        ];
                        return [
                            4,
                            objc.invokeAsync(record.layer, 'bounds', [])
                        ];
                    case 5:
                        bounds = _state.sent();
                        return [
                            4,
                            fitLayer(record.sheen.layer, record.sheen, bounds, radius)
                        ];
                    case 6:
                        _state.sent();
                        return [
                            2
                        ];
                }
            });
        })();
    }
    function animateSheen(sheen, CABasicAnimation) {
        return _async_to_generator$2(function() {
            var animation, timing;
            return _ts_generator$2(this, function(_state) {
                switch(_state.label){
                    case 0:
                        return [
                            4,
                            objc.invokeAsync(CABasicAnimation, 'animationWithKeyPath:', [
                                'locations'
                            ])
                        ];
                    case 1:
                        animation = _state.sent();
                        if (!animation) return [
                            2
                        ];
                        return [
                            4,
                            objc.invokeAsync(animation, 'setFromValue:', [
                                [
                                    0,
                                    0.1,
                                    0.2,
                                    0.3,
                                    0.4
                                ]
                            ])
                        ];
                    case 2:
                        _state.sent();
                        return [
                            4,
                            objc.invokeAsync(animation, 'setToValue:', [
                                [
                                    0.6,
                                    0.7,
                                    0.8,
                                    0.9,
                                    1
                                ]
                            ])
                        ];
                    case 3:
                        _state.sent();
                        return [
                            4,
                            objc.invokeAsync(animation, 'setDuration:', [
                                3.2
                            ])
                        ];
                    case 4:
                        _state.sent();
                        return [
                            4,
                            objc.invokeAsync(animation, 'setAutoreverses:', [
                                true
                            ])
                        ];
                    case 5:
                        _state.sent();
                        return [
                            4,
                            objc.invokeAsync(animation, 'setRepeatCount:', [
                                100000
                            ])
                        ];
                    case 6:
                        _state.sent();
                        return [
                            4,
                            objc.invokeAsync(animation, 'setRemovedOnCompletion:', [
                                false
                            ])
                        ];
                    case 7:
                        _state.sent();
                        if (!CAMediaTimingFunction) return [
                            3,
                            10
                        ];
                        return [
                            4,
                            objc.invokeAsync(CAMediaTimingFunction, 'functionWithName:', [
                                'easeInEaseOut'
                            ])
                        ];
                    case 8:
                        timing = _state.sent();
                        if (!timing) return [
                            3,
                            10
                        ];
                        return [
                            4,
                            objc.invokeAsync(animation, 'setTimingFunction:', [
                                timing
                            ])
                        ];
                    case 9:
                        _state.sent();
                        _state.label = 10;
                    case 10:
                        return [
                            4,
                            objc.invokeAsync(sheen, 'addAnimation:forKey:', [
                                animation,
                                'more-user-tags.holographic-sheen'
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
    function createLayer() {
        return _async_to_generator$2(function() {
            return _ts_generator$2(this, function(_state) {
                switch(_state.label){
                    case 0:
                        return [
                            4,
                            objc.invokeAsync(CAGradientLayer, 'layer', [])
                        ];
                    case 1:
                        return [
                            2,
                            _state.sent()
                        ];
                }
            });
        })();
    }
    function createSheen(parent) {
        return _async_to_generator$2(function() {
            var _tmp, sheen, stops, failed;
            return _ts_generator$2(this, function(_state) {
                switch(_state.label){
                    case 0:
                        _tmp = !CABasicAnimation;
                        if (_tmp) return [
                            3,
                            2
                        ];
                        return [
                            4,
                            reducesMotion()
                        ];
                    case 1:
                        _tmp = _state.sent();
                        _state.label = 2;
                    case 2:
                        if (_tmp) return [
                            2,
                            null
                        ];
                        sheen = null;
                        _state.label = 3;
                    case 3:
                        _state.trys.push([
                            3,
                            13,
                            ,
                            16
                        ]);
                        return [
                            4,
                            createLayer()
                        ];
                    case 4:
                        sheen = _state.sent();
                        if (!sheen) return [
                            2,
                            null
                        ];
                        return [
                            4,
                            Promise.all([
                                colors.cgColor('#ffffff', 0),
                                colors.cgColor('#ffffff', 0.26),
                                colors.cgColor('#d8f4ff', 0.34),
                                colors.cgColor('#ffffff', 0.26),
                                colors.cgColor('#ffffff', 0)
                            ])
                        ];
                    case 5:
                        stops = _state.sent();
                        if (stops.some(function(stop) {
                            return !stop;
                        })) return [
                            2,
                            null
                        ];
                        return [
                            4,
                            objc.invokeAsync(sheen, 'setColors:', [
                                stops
                            ])
                        ];
                    case 6:
                        _state.sent();
                        return [
                            4,
                            objc.invokeAsync(sheen, 'setLocations:', [
                                [
                                    0,
                                    0.1,
                                    0.2,
                                    0.3,
                                    0.4
                                ]
                            ])
                        ];
                    case 7:
                        _state.sent();
                        return [
                            4,
                            pointHorizontally(sheen)
                        ];
                    case 8:
                        _state.sent();
                        return [
                            4,
                            objc.invokeAsync(sheen, 'setMasksToBounds:', [
                                true
                            ])
                        ];
                    case 9:
                        _state.sent();
                        return [
                            4,
                            objc.invokeAsync(sheen, 'setZPosition:', [
                                1
                            ])
                        ];
                    case 10:
                        _state.sent();
                        return [
                            4,
                            objc.invokeAsync(parent, 'addSublayer:', [
                                sheen
                            ])
                        ];
                    case 11:
                        _state.sent();
                        return [
                            4,
                            animateSheen(sheen, CABasicAnimation)
                        ];
                    case 12:
                        _state.sent();
                        return [
                            2,
                            sheen
                        ];
                    case 13:
                        _state.sent();
                        failed = sheen;
                        if (!failed) return [
                            3,
                            15
                        ];
                        return [
                            4,
                            safeInvokeAsync(objc, failed, 'removeFromSuperlayer')
                        ];
                    case 14:
                        _state.sent();
                        _state.label = 15;
                    case 15:
                        return [
                            2,
                            null
                        ];
                    case 16:
                        return [
                            2
                        ];
                }
            });
        })();
    }
    function removeSheen(record) {
        return _async_to_generator$2(function() {
            var layer;
            return _ts_generator$2(this, function(_state) {
                switch(_state.label){
                    case 0:
                        if (!record.sheen) return [
                            2
                        ];
                        layer = record.sheen.layer;
                        return [
                            4,
                            safeInvokeAsync(objc, layer, 'removeFromSuperlayer')
                        ];
                    case 1:
                        _state.sent();
                        record.sheen = null;
                        return [
                            2
                        ];
                }
            });
        })();
    }
    function paint(record, appearance) {
        return _async_to_generator$2(function() {
            var stops, style, background, _, _tmp, rendered, cgColors, sheen, _tmp1;
            return _ts_generator$2(this, function(_state) {
                switch(_state.label){
                    case 0:
                        stops = appearance.colors, style = appearance.style;
                        if (!stops.length || stops.some(function(color) {
                            return !HEX_COLOR.test(color);
                        })) return [
                            2,
                            false
                        ];
                        _state.label = 1;
                    case 1:
                        _state.trys.push([
                            1,
                            24,
                            ,
                            25
                        ]);
                        return [
                            4,
                            objc.invokeAsync(record.label, 'backgroundColor', [])
                        ];
                    case 2:
                        background = _state.sent();
                        return [
                            4,
                            colors.isTransparent(background)
                        ];
                    case 3:
                        if (!!_state.sent()) return [
                            3,
                            6
                        ];
                        if (background) record.originalBackground = background;
                        _ = objc.invokeAsync;
                        _tmp = [
                            record.label,
                            'setBackgroundColor:'
                        ];
                        return [
                            4,
                            colors.clear
                        ];
                    case 4:
                        return [
                            4,
                            _.apply(objc, _tmp.concat([
                                [
                                    _state.sent()
                                ]
                            ]))
                        ];
                    case 5:
                        _state.sent();
                        _state.label = 6;
                    case 6:
                        return [
                            4,
                            objc.invokeAsync(record.label, 'isOpaque', [])
                        ];
                    case 7:
                        if (!_state.sent()) return [
                            3,
                            9
                        ];
                        return [
                            4,
                            objc.invokeAsync(record.label, 'setOpaque:', [
                                false
                            ])
                        ];
                    case 8:
                        _state.sent();
                        _state.label = 9;
                    case 9:
                        if (!(record.colors.join(':') !== stops.join(':') || record.style !== style)) return [
                            3,
                            22
                        ];
                        // CAGradientLayer needs two stops, so a solid color is drawn as a flat gradient.
                        rendered = stops.length === 1 ? [
                            stops[0],
                            stops[0]
                        ] : stops;
                        return [
                            4,
                            Promise.all(rendered.map(function(color) {
                                return colors.cgColor(color);
                            }))
                        ];
                    case 10:
                        cgColors = _state.sent();
                        if (cgColors.some(function(color) {
                            return !color;
                        })) return [
                            2,
                            false
                        ];
                        return [
                            4,
                            objc.invokeAsync(record.layer, 'setColors:', [
                                cgColors
                            ])
                        ];
                    case 11:
                        _state.sent();
                        return [
                            4,
                            objc.invokeAsync(record.layer, 'setLocations:', [
                                rendered.map(function(_, index) {
                                    return index / (rendered.length - 1);
                                })
                            ])
                        ];
                    case 12:
                        _state.sent();
                        return [
                            4,
                            pointHorizontally(record.layer)
                        ];
                    case 13:
                        _state.sent();
                        return [
                            4,
                            objc.invokeAsync(record.layer, 'setMasksToBounds:', [
                                true
                            ])
                        ];
                    case 14:
                        _state.sent();
                        return [
                            4,
                            objc.invokeAsync(record.layer, 'setNeedsDisplay', [])
                        ];
                    case 15:
                        _state.sent();
                        if (!(style === 'holographic')) return [
                            3,
                            19
                        ];
                        if (!record.sheen) return [
                            3,
                            16
                        ];
                        _tmp1 = null;
                        return [
                            3,
                            18
                        ];
                    case 16:
                        return [
                            4,
                            createSheen(record.layer)
                        ];
                    case 17:
                        _tmp1 = _state.sent();
                        _state.label = 18;
                    case 18:
                        sheen = _tmp1;
                        if (sheen) record.sheen = {
                            layer: sheen,
                            frameSignature: '',
                            cornerRadius: null
                        };
                        return [
                            3,
                            21
                        ];
                    case 19:
                        return [
                            4,
                            removeSheen(record)
                        ];
                    case 20:
                        _state.sent();
                        _state.label = 21;
                    case 21:
                        record.colors = _to_consumable_array$2(stops);
                        _state.label = 22;
                    case 22:
                        record.style = style;
                        return [
                            4,
                            fit(record)
                        ];
                    case 23:
                        _state.sent();
                        return [
                            2,
                            true
                        ];
                    case 24:
                        _state.sent();
                        return [
                            2,
                            false
                        ];
                    case 25:
                        return [
                            2
                        ];
                }
            });
        })();
    }
    return {
        createLayer: createLayer,
        paint: paint,
        removeSheen: removeSheen
    };
}function _array_like_to_array$2(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_with_holes$1(arr) {
    if (Array.isArray(arr)) return arr;
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
function _sliced_to_array$1(arr, i) {
    return _array_with_holes$1(arr) || _iterable_to_array_limit$1(arr, i) || _unsupported_iterable_to_array$2(arr, i) || _non_iterable_rest$1();
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
function _type_of$2(obj) {
    "@swc/helpers - typeof";
    return obj && typeof Symbol !== "undefined" && obj.constructor === Symbol ? "symbol" : typeof obj;
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
 * @description UIKit color helpers for the gradient renderer.
 * @param objc The Objective-C bridge.
 * @param UIColor The `UIColor` class.
 * @param NSArray The `NSArray` class.
 * @returns `clear` resolves to `UIColor.clearColor`, `cgColor` builds a CGColor, `isTransparent` tests a UIColor.
 */ function createNativeColors(objc, UIColor, NSArray) {
    var clear = objc.invokeAsync(UIColor, 'clearColor', []).catch(function() {
        return null;
    });
    function cgColor(hex) {
        var alpha = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : 1;
        return _async_to_generator$1(function() {
            var value, _map, red, green, blue, color, pointer, boxed, _boxed, handle;
            return _ts_generator$1(this, function(_state) {
                switch(_state.label){
                    case 0:
                        if (!HEX_COLOR.test(hex)) return [
                            2,
                            null
                        ];
                        value = Number.parseInt(hex.slice(1), 16);
                        _map = _sliced_to_array$1([
                            16,
                            8,
                            0
                        ].map(function(shift) {
                            return (value >> shift & 0xff) / 255;
                        }), 3), red = _map[0], green = _map[1], blue = _map[2];
                        _state.label = 1;
                    case 1:
                        _state.trys.push([
                            1,
                            5,
                            ,
                            6
                        ]);
                        return [
                            4,
                            objc.invokeAsync(UIColor, 'colorWithRed:green:blue:alpha:', [
                                red,
                                green,
                                blue,
                                alpha
                            ])
                        ];
                    case 2:
                        color = _state.sent();
                        if (!color) return [
                            2,
                            null
                        ];
                        return [
                            4,
                            objc.invokeAsync(color, 'CGColor', [])
                        ];
                    case 3:
                        pointer = _state.sent();
                        if (!pointer) return [
                            2,
                            null
                        ];
                        return [
                            4,
                            objc.invokeAsync(NSArray, 'arrayWithObject:', [
                                pointer
                            ])
                        ];
                    case 4:
                        boxed = _state.sent();
                        if (!Array.isArray(boxed)) return [
                            2,
                            null
                        ];
                        _boxed = _sliced_to_array$1(boxed, 1), handle = _boxed[0];
                        return [
                            2,
                            handle && (typeof handle === "undefined" ? "undefined" : _type_of$2(handle)) === 'object' ? handle : null
                        ];
                    case 5:
                        _state.sent();
                        return [
                            2,
                            null
                        ];
                    case 6:
                        return [
                            2
                        ];
                }
            });
        })();
    }
    function isTransparent(color) {
        return _async_to_generator$1(function() {
            var _parseNativeColorDescription, _, _tmp, description;
            return _ts_generator$1(this, function(_state) {
                switch(_state.label){
                    case 0:
                        if (!color) return [
                            2,
                            false
                        ];
                        _ = objc.invokeAsync;
                        _tmp = [
                            color,
                            'isEqual:'
                        ];
                        return [
                            4,
                            clear
                        ];
                    case 1:
                        return [
                            4,
                            _.apply(objc, _tmp.concat([
                                [
                                    _state.sent()
                                ]
                            ]))
                        ];
                    case 2:
                        if (_state.sent()) return [
                            2,
                            true
                        ];
                        return [
                            4,
                            objc.invokeAsync(color, 'description', [])
                        ];
                    case 3:
                        description = _state.sent();
                        return [
                            2,
                            typeof description === 'string' && ((_parseNativeColorDescription = parseNativeColorDescription(description)) === null || _parseNativeColorDescription === void 0 ? void 0 : _parseNativeColorDescription.alpha) === 0
                        ];
                }
            });
        })();
    }
    return {
        clear: clear,
        cgColor: cgColor,
        isTransparent: isTransparent
    };
}function _array_like_to_array$1(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_without_holes$1(arr) {
    if (Array.isArray(arr)) return _array_like_to_array$1(arr);
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
function _iterable_to_array$1(iter) {
    if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) {
        return Array.from(iter);
    }
}
function _non_iterable_spread$1() {
    throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
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
function _to_consumable_array$1(arr) {
    return _array_without_holes$1(arr) || _iterable_to_array$1(arr) || _unsupported_iterable_to_array$1(arr) || _non_iterable_spread$1();
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
function _type_of$1(obj) {
    "@swc/helpers - typeof";
    return obj && typeof Symbol !== "undefined" && obj.constructor === Symbol ? "symbol" : typeof obj;
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
 * @description Draws role-color gradients behind Discord's native message tags on iOS.
 * @param context The plugin context, whose Objective-C bridge draws the gradients.
 * @param appearances The colors the tag patch chose for each tag text.
 * @returns The gradients feature; on Android, or when a class or capability is missing, `start` applies nothing.
 */ function createTagGradients(context, appearances) {
    var teardown = Promise.resolve();
    function start() {
        if (context.platform === 'android') return function() {};
        if (!ensureCapabilities('More User Tags: gradients', context.native, context.capabilities)) {
            return function() {};
        }
        var objc = context.native.objc;
        var UIColor = objc.getClass('UIColor');
        var NSArray = objc.getClass('NSArray');
        var CAGradientLayer = objc.getClass('CAGradientLayer');
        if (!objc.getClass('DiscordChat.MessageTagView') || !objc.getClass('DCDLabel') || !CAGradientLayer || !NSArray || !UIColor) {
            console.error('[More User Tags: gradients] Skipped, native classes not found.');
            return function() {};
        }
        var colors = createNativeColors(objc, UIColor, NSArray);
        var painter = createGradientPainter(objc, {
            CAGradientLayer: CAGradientLayer,
            CABasicAnimation: objc.getClass('CABasicAnimation'),
            CAMediaTimingFunction: objc.getClass('CAMediaTimingFunction')
        }, colors);
        var associationKey = objc.createAssociationKey();
        var records = new Map();
        var updating = new Set();
        var inFlight = new Set();
        var pending = new Map();
        var hooks = [];
        var stopped = false;
        function track(operation) {
            inFlight.add(operation);
            void operation.finally(function() {
                return inFlight.delete(operation);
            }).catch(function() {});
            return operation;
        }
        function release(view) {
            try {
                objc.call(view, 'release');
            } catch (unused) {
            // The view is already gone.
            }
        }
        function subviews(view) {
            return _async_to_generator(function() {
                var children;
                return _ts_generator(this, function(_state) {
                    switch(_state.label){
                        case 0:
                            return [
                                4,
                                objc.invokeAsync(view, 'subviews', [])
                            ];
                        case 1:
                            children = _state.sent();
                            if (Array.isArray(children)) return [
                                2,
                                children
                            ];
                            if (!children || (typeof children === "undefined" ? "undefined" : _type_of$1(children)) !== 'object') return [
                                2,
                                []
                            ];
                            try {
                                return [
                                    2,
                                    objc.array(children).filter(function(child) {
                                        return (typeof child === "undefined" ? "undefined" : _type_of$1(child)) === 'object' && child !== null;
                                    })
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
        }
        function removeRecord(record) {
            return _async_to_generator(function() {
                var wasUpdating, background;
                return _ts_generator(this, function(_state) {
                    switch(_state.label){
                        case 0:
                            wasUpdating = updating.has(record.id);
                            updating.add(record.id);
                            _state.label = 1;
                        case 1:
                            _state.trys.push([
                                1,
                                ,
                                10,
                                11
                            ]);
                            return [
                                4,
                                safeInvokeAsync(objc, record.layer, 'removeFromSuperlayer')
                            ];
                        case 2:
                            _state.sent();
                            return [
                                4,
                                safeInvokeAsync(objc, record.label, 'backgroundColor')
                            ];
                        case 3:
                            background = _state.sent();
                            return [
                                4,
                                colors.isTransparent(background)
                            ];
                        case 4:
                            if (!_state.sent()) return [
                                3,
                                6
                            ];
                            return [
                                4,
                                safeInvokeAsync(objc, record.label, 'setBackgroundColor:', record.originalBackground)
                            ];
                        case 5:
                            _state.sent();
                            _state.label = 6;
                        case 6:
                            return [
                                4,
                                objc.invokeAsync(record.label, 'isOpaque', [])
                            ];
                        case 7:
                            if (!!_state.sent()) return [
                                3,
                                9
                            ];
                            return [
                                4,
                                safeInvokeAsync(objc, record.label, 'setOpaque:', record.originalOpaque)
                            ];
                        case 8:
                            _state.sent();
                            _state.label = 9;
                        case 9:
                            return [
                                3,
                                11
                            ];
                        case 10:
                            try {
                                objc.setAssociatedObject(record.label, associationKey, null, 'assign');
                            } catch (unused) {
                            // The label is already gone, and its association with it.
                            }
                            records.delete(record.id);
                            if (!wasUpdating) updating.delete(record.id);
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
        function createRecord(label, labelName, primaryColor, appearance) {
            return _async_to_generator(function() {
                var layer, originalBackground, associated, id, _tmp, parent, parentLayer, originalOpaque, labelLayer, record, _, _tmp1;
                return _ts_generator(this, function(_state) {
                    switch(_state.label){
                        case 0:
                            layer = null;
                            originalBackground = null;
                            associated = false;
                            id = viewKey(objc, label);
                            _tmp = !id;
                            if (_tmp) return [
                                3,
                                2
                            ];
                            return [
                                4,
                                colors.clear
                            ];
                        case 1:
                            _tmp = !_state.sent();
                            _state.label = 2;
                        case 2:
                            if (_tmp) return [
                                2
                            ];
                            _state.label = 3;
                        case 3:
                            _state.trys.push([
                                3,
                                17,
                                ,
                                21
                            ]);
                            return [
                                4,
                                objc.invokeAsync(label, 'superview', [])
                            ];
                        case 4:
                            parent = _state.sent();
                            if (!parent) return [
                                2
                            ];
                            return [
                                4,
                                objc.invokeAsync(parent, 'layer', [])
                            ];
                        case 5:
                            parentLayer = _state.sent();
                            if (!parentLayer) return [
                                2
                            ];
                            return [
                                4,
                                painter.createLayer()
                            ];
                        case 6:
                            layer = _state.sent();
                            if (!layer) return [
                                2
                            ];
                            return [
                                4,
                                objc.invokeAsync(label, 'backgroundColor', [])
                            ];
                        case 7:
                            originalBackground = _state.sent();
                            return [
                                4,
                                objc.invokeAsync(label, 'isOpaque', [])
                            ];
                        case 8:
                            originalOpaque = Boolean.apply(void 0, [
                                _state.sent()
                            ]);
                            return [
                                4,
                                objc.invokeAsync(label, 'layer', [])
                            ];
                        case 9:
                            labelLayer = _state.sent();
                            if (stopped) return [
                                2
                            ];
                            record = {
                                id: id,
                                label: label,
                                layer: layer,
                                labelName: labelName,
                                primaryColor: primaryColor,
                                colors: [],
                                style: 'solid',
                                originalBackground: originalBackground,
                                originalOpaque: originalOpaque,
                                geometry: {
                                    frameSignature: '',
                                    cornerRadius: null
                                },
                                sheen: null
                            };
                            return [
                                4,
                                objc.invokeAsync(parentLayer, 'insertSublayer:below:', [
                                    layer,
                                    labelLayer
                                ])
                            ];
                        case 10:
                            _state.sent();
                            objc.setAssociatedObject(label, associationKey, layer, 'retain');
                            associated = true;
                            _ = objc.invokeAsync;
                            _tmp1 = [
                                label,
                                'setBackgroundColor:'
                            ];
                            return [
                                4,
                                colors.clear
                            ];
                        case 11:
                            return [
                                4,
                                _.apply(objc, _tmp1.concat([
                                    [
                                        _state.sent()
                                    ]
                                ]))
                            ];
                        case 12:
                            _state.sent();
                            return [
                                4,
                                objc.invokeAsync(label, 'setOpaque:', [
                                    false
                                ])
                            ];
                        case 13:
                            _state.sent();
                            records.set(id, record);
                            return [
                                4,
                                painter.paint(record, appearance)
                            ];
                        case 14:
                            if (!!_state.sent()) return [
                                3,
                                16
                            ];
                            return [
                                4,
                                removeRecord(record)
                            ];
                        case 15:
                            _state.sent();
                            _state.label = 16;
                        case 16:
                            return [
                                3,
                                21
                            ];
                        case 17:
                            _state.sent();
                            if (!layer) return [
                                3,
                                19
                            ];
                            return [
                                4,
                                safeInvokeAsync(objc, layer, 'removeFromSuperlayer')
                            ];
                        case 18:
                            _state.sent();
                            _state.label = 19;
                        case 19:
                            if (associated) objc.setAssociatedObject(label, associationKey, null, 'assign');
                            return [
                                4,
                                safeInvokeAsync(objc, label, 'setBackgroundColor:', originalBackground)
                            ];
                        case 20:
                            _state.sent();
                            return [
                                3,
                                21
                            ];
                        case 21:
                            return [
                                2
                            ];
                    }
                });
            })();
        }
        function readLabel(label, record) {
            return _async_to_generator(function() {
                var _ref, text, accessibilityLabel, labelName, background, description, _tmp, color, primaryColor, match;
                return _ts_generator(this, function(_state) {
                    switch(_state.label){
                        case 0:
                            return [
                                4,
                                objc.invokeAsync(label, 'text', [])
                            ];
                        case 1:
                            text = _state.sent();
                            return [
                                4,
                                objc.invokeAsync(label, 'accessibilityLabel', [])
                            ];
                        case 2:
                            accessibilityLabel = _state.sent();
                            labelName = typeof text === 'string' && text.length > 0 ? text : typeof accessibilityLabel === 'string' ? accessibilityLabel : '';
                            if (!labelName) return [
                                2,
                                null
                            ];
                            return [
                                4,
                                objc.invokeAsync(label, 'backgroundColor', [])
                            ];
                        case 3:
                            background = _state.sent();
                            if (!background) return [
                                3,
                                5
                            ];
                            return [
                                4,
                                objc.invokeAsync(background, 'description', [])
                            ];
                        case 4:
                            _tmp = _state.sent();
                            return [
                                3,
                                6
                            ];
                        case 5:
                            _tmp = null;
                            _state.label = 6;
                        case 6:
                            description = _tmp;
                            color = typeof description === 'string' ? parseNativeColorDescription(description) : null;
                            // Once the gradient is drawn the label is clear, so fall back to the color it was drawn for.
                            primaryColor = color && color.alpha > 0 ? color.hex : (_ref = record === null || record === void 0 ? void 0 : record.primaryColor) !== null && _ref !== void 0 ? _ref : null;
                            match = appearances.find(labelName, primaryColor);
                            return [
                                2,
                                match ? _object_spread$1({
                                    labelName: labelName
                                }, match) : null
                            ];
                    }
                });
            })();
        }
        function updateLabel(label) {
            return _async_to_generator(function() {
                var id, record, match;
                return _ts_generator(this, function(_state) {
                    switch(_state.label){
                        case 0:
                            if (stopped || appearances.isEmpty() || objc.className(label) !== 'DCDLabel') return [
                                2
                            ];
                            id = viewKey(objc, label);
                            if (!id || updating.has(id)) return [
                                2
                            ];
                            updating.add(id);
                            _state.label = 1;
                        case 1:
                            _state.trys.push([
                                1,
                                13,
                                14,
                                15
                            ]);
                            record = records.get(id);
                            return [
                                4,
                                readLabel(label, record)
                            ];
                        case 2:
                            match = _state.sent();
                            if (stopped) return [
                                2
                            ];
                            if (!!match) return [
                                3,
                                5
                            ];
                            if (!record) return [
                                3,
                                4
                            ];
                            return [
                                4,
                                removeRecord(record)
                            ];
                        case 3:
                            _state.sent();
                            _state.label = 4;
                        case 4:
                            return [
                                2
                            ];
                        case 5:
                            if (!(record && (record.labelName !== match.labelName || record.primaryColor !== match.primaryColor))) return [
                                3,
                                7
                            ];
                            return [
                                4,
                                removeRecord(record)
                            ];
                        case 6:
                            _state.sent();
                            record = undefined;
                            _state.label = 7;
                        case 7:
                            if (!!record) return [
                                3,
                                9
                            ];
                            return [
                                4,
                                createRecord(label, match.labelName, match.primaryColor, match.appearance)
                            ];
                        case 8:
                            _state.sent();
                            return [
                                2
                            ];
                        case 9:
                            return [
                                4,
                                painter.paint(record, match.appearance)
                            ];
                        case 10:
                            if (!!_state.sent()) return [
                                3,
                                12
                            ];
                            return [
                                4,
                                removeRecord(record)
                            ];
                        case 11:
                            _state.sent();
                            _state.label = 12;
                        case 12:
                            return [
                                3,
                                15
                            ];
                        case 13:
                            _state.sent();
                            return [
                                3,
                                15
                            ];
                        case 14:
                            updating.delete(id);
                            return [
                                7
                            ];
                        case 15:
                            return [
                                2
                            ];
                    }
                });
            })();
        }
        function runPendingUpdate(id, label) {
            return _async_to_generator(function() {
                return _ts_generator(this, function(_state) {
                    switch(_state.label){
                        case 0:
                            pending.delete(id);
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
                                track(updateLabel(label))
                            ];
                        case 2:
                            _state.sent();
                            return [
                                3,
                                4
                            ];
                        case 3:
                            release(label);
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
        }
        // Native hooks fire many times per layout; batch them into one update per label per tick.
        function scheduleLabelUpdate(label) {
            return _async_to_generator(function() {
                var retained, id, timer;
                return _ts_generator(this, function(_state) {
                    if (stopped || appearances.isEmpty() || objc.className(label) !== 'DCDLabel') return [
                        2
                    ];
                    // Keep the label alive until the deferred update has run.
                    try {
                        retained = objc.call(label, 'retain');
                    } catch (unused) {
                        return [
                            2
                        ];
                    }
                    id = viewKey(objc, retained);
                    if (!id || stopped || pending.has(id)) {
                        release(retained);
                        return [
                            2
                        ];
                    }
                    timer = setTimeout(function() {
                        return void runPendingUpdate(id, retained);
                    }, 0);
                    pending.set(id, {
                        label: retained,
                        timer: timer
                    });
                    return [
                        2
                    ];
                });
            })();
        }
        function updateTagView(view) {
            return _async_to_generator(function() {
                var retained, _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, label, err;
                return _ts_generator(this, function(_state) {
                    switch(_state.label){
                        case 0:
                            if (stopped || appearances.isEmpty()) return [
                                2
                            ];
                            retained = objc.call(view, 'retain');
                            _state.label = 1;
                        case 1:
                            _state.trys.push([
                                1,
                                11,
                                12,
                                13
                            ]);
                            _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
                            _state.label = 2;
                        case 2:
                            _state.trys.push([
                                2,
                                8,
                                9,
                                10
                            ]);
                            return [
                                4,
                                subviews(retained)
                            ];
                        case 3:
                            _iterator = _state.sent()[Symbol.iterator]();
                            _state.label = 4;
                        case 4:
                            if (!!(_iteratorNormalCompletion = (_step = _iterator.next()).done)) return [
                                3,
                                7
                            ];
                            label = _step.value;
                            return [
                                4,
                                scheduleLabelUpdate(label)
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
                                3,
                                13
                            ];
                        case 11:
                            _state.sent();
                            return [
                                3,
                                13
                            ];
                        case 12:
                            objc.call(retained, 'release');
                            return [
                                7
                            ];
                        case 13:
                            return [
                                2
                            ];
                    }
                });
            })();
        }
        // A recycled message cell keeps its labels, so drop their gradients before the cell shows another message.
        function clearReusedCell(cell) {
            return _async_to_generator(function() {
                var retained, queue, current, _viewKey, record, children, _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, child;
                return _ts_generator(this, function(_state) {
                    switch(_state.label){
                        case 0:
                            retained = objc.call(cell, 'retain');
                            queue = [
                                {
                                    view: retained,
                                    depth: 0
                                }
                            ];
                            _state.label = 1;
                        case 1:
                            _state.trys.push([
                                1,
                                9,
                                10,
                                11
                            ]);
                            current = queue.pop();
                            _state.label = 2;
                        case 2:
                            if (!(current && !stopped)) return [
                                3,
                                8
                            ];
                            if (!(objc.className(current.view) === 'DCDLabel')) return [
                                3,
                                5
                            ];
                            record = records.get((_viewKey = viewKey(objc, current.view)) !== null && _viewKey !== void 0 ? _viewKey : '');
                            if (!record) return [
                                3,
                                4
                            ];
                            return [
                                4,
                                removeRecord(record)
                            ];
                        case 3:
                            _state.sent();
                            _state.label = 4;
                        case 4:
                            return [
                                3,
                                7
                            ];
                        case 5:
                            if (current.depth >= 8) {
                                return [
                                    3,
                                    7
                                ];
                            }
                            return [
                                4,
                                subviews(current.view)
                            ];
                        case 6:
                            children = _state.sent();
                            _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
                            try {
                                for(_iterator = children.slice(0, 20)[Symbol.iterator](); !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                                    child = _step.value;
                                    queue.push({
                                        view: child,
                                        depth: current.depth + 1
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
                            _state.label = 7;
                        case 7:
                            current = queue.pop();
                            return [
                                3,
                                2
                            ];
                        case 8:
                            return [
                                3,
                                11
                            ];
                        case 9:
                            _state.sent();
                            return [
                                3,
                                11
                            ];
                        case 10:
                            objc.call(retained, 'release');
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
        function hook(className, selector, handler) {
            try {
                hooks.push(objc.hook(className, selector, {
                    after: function after(param) {
                        var self = param.self;
                        return track(handler(self));
                    }
                }));
                return true;
            } catch (unused) {
                return false;
            }
        }
        var installed = [
            hook('DCDLabel', 'setBackgroundColor:', scheduleLabelUpdate),
            hook('DCDLabel', 'setText:', scheduleLabelUpdate),
            hook('DiscordChat.MessageTagView', 'layoutSubviews', updateTagView)
        ];
        if (!installed.includes(true)) {
            console.error('[More User Tags: gradients] Skipped, native hooks unavailable.');
            return function() {};
        }
        if (objc.getClass('DCDMessageTableViewCell')) {
            hook('DCDMessageTableViewCell', 'prepareForReuse', clearReusedCell);
        }
        function removeAll() {
            return _async_to_generator(function() {
                var _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, record, err;
                return _ts_generator(this, function(_state) {
                    switch(_state.label){
                        case 0:
                            return [
                                4,
                                Promise.allSettled(_to_consumable_array$1(inFlight))
                            ];
                        case 1:
                            _state.sent();
                            _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
                            _state.label = 2;
                        case 2:
                            _state.trys.push([
                                2,
                                7,
                                8,
                                9
                            ]);
                            _iterator = _to_consumable_array$1(records.values())[Symbol.iterator]();
                            _state.label = 3;
                        case 3:
                            if (!!(_iteratorNormalCompletion = (_step = _iterator.next()).done)) return [
                                3,
                                6
                            ];
                            record = _step.value;
                            return [
                                4,
                                removeRecord(record).catch(function() {
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
                                3
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
                            appearances.clear();
                            return [
                                2
                            ];
                    }
                });
            })();
        }
        return function() {
            stopped = true;
            var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
            try {
                for(var _iterator = pending.values()[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                    var _step_value = _step.value, label = _step_value.label, timer = _step_value.timer;
                    clearTimeout(timer);
                    release(label);
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
            teardown = removeAll();
        };
    }
    return {
        start: start,
        settled: function settled() {
            return teardown;
        }
    };
}var DiscordConstants = window.unbound.metro.findByProps('Permissions', 'ThemeTypes', {
    lazy: true
});
var PermissionUtils = window.unbound.metro.findByProps('computePermissions', 'canEveryoneRole', {
    lazy: true
});
var TagProperties = window.unbound.metro.findByName('getTagProperties', {
    interop: false,
    lazy: true
});
var GuildMemberStore = window.unbound.metro.findStore('GuildMember', {
    lazy: true
});
var ChannelStore = window.unbound.metro.findStore('Channel', {
    lazy: true
});
var GuildStore = window.unbound.metro.stores.Guilds;
var settings = window.unbound.storage.getStore('unbound.more-user-tags');
var Patcher = window.unbound.patcher.createPatcher('unbound.more-user-tags');function _define_property(obj, key, value) {
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
/**
 * @description Joins Discord's original poster label with the plugin's tag, so both stay visible.
 * @param opTagText Discord's OP label, if the message has one.
 * @param tagName The plugin tag's display name.
 * @returns The text to show in the tag.
 */ function combineTagText(opTagText, tagName) {
    return opTagText ? "".concat(opTagText, " \xb7 ").concat(tagName) : tagName;
}
/**
 * @description Android's tag renderer reads colors as signed 32-bit integers, but `processColor` returns unsigned ones.
 * @param color A color returned by `processColor`.
 * @param platform The platform the plugin runs on.
 * @returns The color in the form the platform's renderer accepts.
 */ function toRendererColor(color, platform) {
    return platform === 'android' && typeof color === 'number' ? color | 0 : color;
}
/**
 * @description Rewrites Discord's tag properties to show the plugin's tag, as a normal tag or in the OP badge style.
 * @param result Discord's original tag properties.
 * @param text The tag text, from `combineTagText`.
 * @param colors The tag colors, or `undefined` to keep Discord's colors.
 * @param useOpTagStyle Whether to draw the tag with Discord's original poster badge styling.
 * @returns The new tag properties.
 */ function withTag(result, text, colors, useOpTagStyle) {
    if (useOpTagStyle) {
        return _object_spread(_object_spread_props(_object_spread({}, result), {
            tagText: null,
            tagAccessibilityLabel: text,
            tagVerified: false,
            tagTextColor: null,
            tagBackgroundColor: null,
            tagType: null,
            tagIconUrl: null,
            opTagText: text
        }), colors ? {
            opTagBackgroundColor: colors.background,
            opTagTextColor: colors.text
        } : {});
    }
    return _object_spread(_object_spread_props(_object_spread({}, result), {
        opTagText: null,
        opTagBackgroundColor: null,
        opTagTextColor: null,
        tagText: text,
        tagAccessibilityLabel: text,
        tagVerified: false
    }), colors ? {
        tagBackgroundColor: colors.background,
        tagTextColor: colors.text
    } : {});
}function _type_of(obj) {
    "@swc/helpers - typeof";
    return obj && typeof Symbol !== "undefined" && obj.constructor === Symbol ? "symbol" : typeof obj;
}
function hasPermission(user, guild, channel, names) {
    if (!guild) return false;
    var total;
    try {
        total = PermissionUtils.computePermissions({
            user: user,
            context: guild,
            overwrites: channel === null || channel === void 0 ? void 0 : channel.permissionOverwrites
        });
    } catch (unused) {
        return false;
    }
    return names.some(function(name) {
        var bit = DiscordConstants.Permissions[name];
        return (typeof bit === "undefined" ? "undefined" : _type_of(bit)) === 'bigint' && (total & bit) === bit;
    });
}
/**
 * @description Finds the first enabled tag the message author qualifies for.
 * @param message The message the tag is shown on.
 * @param user The message author.
 * @param guild The guild the message was sent in, if any.
 * @param channel The channel the message was sent in.
 * @returns The tag to show, or `undefined` when none applies.
 */ function resolveTag(message, user, guild, channel) {
    return TAGS.find(function(tag) {
        if (!settings.get("tag.".concat(tag.name), true)) return false;
        if ('condition' in tag) return tag.condition(message, user, guild);
        return !user.bot && hasPermission(user, guild, channel, tag.permissions);
    });
}/**
 * @description Picks a tag's colors: the first role color found in `sources`, else the tag's own color.
 * @param tagColor The tag's own color.
 * @param sources Places to read a role color from, in priority order (the guild member, then the message).
 * @param options The plugin's appearance settings.
 * @returns The colors and style to draw the tag with; no colors means Discord's default styling.
 */ function resolveTagColors(tagColor, sources, options) {
    if (options.useRoleColor) {
        var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
        try {
            for(var _iterator = sources[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                var source = _step.value;
                var appearance = getRoleColorAppearance(source === null || source === void 0 ? void 0 : source.colorStrings, source === null || source === void 0 ? void 0 : source.colorString, options.useEnhancedRoleColors);
                if (appearance.colors.length > 0) return appearance;
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
    return {
        colors: options.coloredTags ? [
            tagColor
        ] : [],
        style: 'solid'
    };
}function toTagColors(colors, platform) {
    if (!colors.length) return;
    return {
        background: toRendererColor(window.ReactNative.processColor(colors[0]), platform),
        text: toRendererColor(window.ReactNative.processColor(getContrastingTextColor(colors)), platform)
    };
}
/**
 * @description Adds the plugin's tag to every message header Discord builds tag properties for.
 * @param platform The platform the plugin runs on.
 * @param appearances Receives each tag's colors for the native gradient renderer.
 * @returns A function that removes the patch.
 */ function patchGetTagProperties(platform, appearances) {
    if (typeof TagProperties.default !== 'function') {
        console.error('[More User Tags] Skipped, getTagProperties is not a function.');
        return function() {};
    }
    return Patcher.after(TagProperties, 'default', function(param) {
        var args = param.args, result = param.result;
        var _args_, _GuildMemberStore_getMember;
        var message = (_args_ = args[0]) === null || _args_ === void 0 ? void 0 : _args_.message;
        var user = message === null || message === void 0 ? void 0 : message.author;
        if (!result || !message || !user) return;
        var channel = ChannelStore.getChannel(message.channel_id);
        var guild = (channel === null || channel === void 0 ? void 0 : channel.guild_id) ? GuildStore.getGuild(channel.guild_id) : undefined;
        var tag = resolveTag(message, user, guild, channel);
        if (!tag) return;
        // The member store is optional: without it a tag keeps its own color.
        var member = guild ? (_GuildMemberStore_getMember = GuildMemberStore.getMember) === null || _GuildMemberStore_getMember === void 0 ? void 0 : _GuildMemberStore_getMember.call(GuildMemberStore, guild.id, user.id) : undefined;
        var appearance = resolveTagColors(tag.color, [
            member,
            message
        ], {
            useRoleColor: settings.get('useRoleColor', true),
            useEnhancedRoleColors: settings.get('useEnhancedRoleColors', true),
            coloredTags: settings.get('coloredTags', true)
        });
        var text = combineTagText(result.opTagText, tag.displayName);
        // Only the iOS gradient renderer reads the appearances.
        if (platform === 'ios') appearances.set(text, appearance);
        return withTag(result, text, toTagColors(appearance.colors, platform), settings.get('useOpTagStyle', false));
    });
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
/**
 * @description Remembers the colors chosen for each tag text, so the native renderer can find a label's gradient.
 * @returns `set` records a tag's colors, `find` looks a native label up, `clear` forgets everything.
 */ function createLabelAppearances() {
    var entries = new Map();
    function set(label, appearance) {
        if (!label.trim()) return;
        var colors = appearance.colors.filter(function(color) {
            return HEX_COLOR.test(color);
        }).map(function(color) {
            return color.toLowerCase();
        });
        if (!colors.length) {
            var prefix = getRoleGradientKey(label, '');
            var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
            try {
                for(var _iterator = entries.keys()[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                    var key = _step.value;
                    if (key.startsWith(prefix)) entries.delete(key);
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
        entries.set(getRoleGradientKey(label, colors[0]), {
            colors: colors,
            style: appearance.style
        });
    }
    // A native label's background tells us its primary color; without one, only an unambiguous match counts.
    function find(label, primaryColor) {
        if (primaryColor) {
            var appearance = entries.get(getRoleGradientKey(label, primaryColor));
            if (appearance) return {
                primaryColor: primaryColor,
                appearance: appearance
            };
        }
        var prefix = getRoleGradientKey(label, '');
        var unique = new Map();
        var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
        try {
            for(var _iterator = entries[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                var _step_value = _sliced_to_array(_step.value, 2), key = _step_value[0], appearance1 = _step_value[1];
                if (!key.startsWith(prefix)) {
                    continue;
                }
                unique.set(JSON.stringify(appearance1), {
                    primaryColor: key.slice(prefix.length),
                    appearance: appearance1
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
        return unique.size === 1 ? _to_consumable_array(unique.values())[0] : null;
    }
    return {
        set: set,
        find: find,
        clear: function clear() {
            return entries.clear();
        },
        isEmpty: function isEmpty() {
            return entries.size === 0;
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
    return /*#__PURE__*/ React.createElement(Page, null, /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TableRowGroup, {
        title: "Tags"
    }, TAGS.map(function(tag) {
        return /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TableSwitchRow, {
            key: tag.name,
            label: tag.displayName,
            subLabel: tag.description,
            value: store.get("tag.".concat(tag.name), true),
            onValueChange: function onValueChange(value) {
                return store.set("tag.".concat(tag.name), value);
            }
        });
    })), /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TableRowGroup, {
        title: "Appearance"
    }, /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TableSwitchRow, {
        label: "Coloured Tags",
        subLabel: "Give each tag its own colour instead of the default styling",
        value: store.get('coloredTags', true),
        onValueChange: function onValueChange(value) {
            return store.set('coloredTags', value);
        }
    }), /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TableSwitchRow, {
        label: "Use Role Colour",
        subLabel: "Colour tags with the member's role colour where they have one",
        value: store.get('useRoleColor', true),
        onValueChange: function onValueChange(value) {
            return store.set('useRoleColor', value);
        }
    }), /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TableSwitchRow, {
        label: "Use Enhanced Role Colours",
        subLabel: "Use gradient and holographic role colours across all generated tags when available",
        value: store.get('useEnhancedRoleColors', true),
        onValueChange: function onValueChange(value) {
            return store.set('useEnhancedRoleColors', value);
        }
    }), /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TableSwitchRow, {
        label: "Use Original Poster Tag Style",
        subLabel: "Show staff tags with Discord’s original poster badge styling",
        value: store.get('useOpTagStyle', false),
        onValueChange: function onValueChange(value) {
            return store.set('useOpTagStyle', value);
        }
    })));
}var dispose = function dispose() {};
var settled = function settled() {
    return Promise.resolve();
};
function start(context) {
    var modules = {
        DiscordConstants: DiscordConstants,
        PermissionUtils: PermissionUtils,
        TagProperties: TagProperties,
        ChannelStore: ChannelStore,
        GuildStore: GuildStore
    };
    if (!ensureModules('More User Tags', modules)) return;
    var appearances = createLabelAppearances();
    var gradients = createTagGradients(context, appearances);
    settled = gradients.settled;
    dispose = applyFeatures('More User Tags', [
        function() {
            return gradients.start();
        },
        function() {
            return patchGetTagProperties(context.platform, appearances);
        }
    ]);
}
function stop() {
    dispose();
    dispose = function dispose() {};
    return settled();
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