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
}var PLUGIN_NAME = 'Avatar Radius';
var DEFAULT_RADIUS = 8;
var MAXIMUM_RADIUS = 64;
var AvatarClass = {
    ios: 'DCDAvatarView',
    android: 'com.facebook.drawee.view.SimpleDraweeView'
};/**
 * @description Reads a stored radius, falling back to the default for anything that is not a usable number.
 * @param value The stored setting.
 * @returns The radius in points, between 0 and the maximum.
 */ function storedRadius(value) {
    var radius = typeof value === 'number' ? value : Number(value);
    if (value === null || value === undefined || value === '' || !Number.isFinite(radius)) {
        return DEFAULT_RADIUS;
    }
    return Math.max(0, Math.min(MAXIMUM_RADIUS, Math.round(radius)));
}
/**
 * @description Picks the corner radius for an avatar, never rounder than a circle.
 * @param radius The chosen radius.
 * @param width The avatar's width.
 * @returns The corner radius to draw.
 */ function cornerRadius(radius, width) {
    return width > 0 ? Math.min(radius, width / 2) : radius;
}var settings = window.unbound.storage.getStore('unbound.avatar-radius');function _array_like_to_array$1(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_with_holes$1(arr) {
    if (Array.isArray(arr)) return arr;
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
    return _array_with_holes$1(arr) || _iterable_to_array_limit$1(arr, i) || _unsupported_iterable_to_array$1(arr, i) || _non_iterable_rest$1();
}
function _unsupported_iterable_to_array$1(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _array_like_to_array$1(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(n);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _array_like_to_array$1(o, minLen);
}
function SettingsPanel() {
    var store = settings.useSettingsStore();
    var _useState = _sliced_to_array$1(window.React.useState(String(storedRadius(store.get('radius', undefined)))), 2), radius = _useState[0], setRadius = _useState[1];
    function saveRadius() {
        var value = storedRadius(radius);
        store.set('radius', value);
        setRadius(String(value));
    }
    return /*#__PURE__*/ React.createElement(Page, null, /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TextInput, {
        label: "Corner radius",
        description: "How round avatar corners are, from 0 for square to ".concat(MAXIMUM_RADIUS, ". A radius past half an avatar's size keeps it a circle."),
        value: radius,
        onChange: setRadius,
        onEndEditing: saveRadius,
        onSubmitEditing: saveRadius,
        keyboardType: "number-pad"
    }));
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
}var MAX_VISITED = 4000;
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
var PROBE_SIZE = 100;
var MAX_TRACKED = 512;
var CORNER_PROBE = 0.135;
var SIZE_RETRIES = 3;
var SIZE_RETRY_MS = 50;
var SQUARE_TOLERANCE = 1;
function isMissing(value) {
    return !value || value.type === 'null';
}
function isBorderRadiusSetter(method) {
    return !method.static && method.name === 'setBorderRadius' && method.parameters.length === 1 && method.parameters[0] === 'float';
}
/**
 * @description Rounds Discord's circular avatars to the chosen radius as they attach to a window: the native chat avatars through their outline, and React Native images everywhere else through their border radius.
 * @param native The plugin's Java and hook bridges.
 * @param radius Reads the chosen radius in density-independent pixels.
 * @returns `refresh`, which re-rounds the avatars it rounded, and `dispose`, which brings back the circles.
 */ function roundAndroidAvatars(param, radius) {
    var java = param.java, hooks = param.hooks;
    var _java_describe_superclass;
    var avatarClass = java.getClass(AvatarClass.android);
    var attachClass = (_java_describe_superclass = java.describe(AvatarClass.android).superclass) !== null && _java_describe_superclass !== void 0 ? _java_describe_superclass : AvatarClass.android;
    var backgroundOutline = java.getField(java.getClass('android.view.ViewOutlineProvider'), 'BACKGROUND');
    var originalOutline = java.createAssociationKey();
    var originalBackground = java.createAssociationKey();
    var circles = new Map();
    var borderClasses = new Map();
    var tracked = [];
    var disposed = false;
    function isCircle(provider, view) {
        var _javaText;
        var name = (_javaText = javaText(java.className(provider))) !== null && _javaText !== void 0 ? _javaText : '';
        var known = circles.get(name);
        if (known !== undefined) return known;
        var context = javaReference(java.invoke(view, 'getContext', []));
        var probe = java.construct('android.view.View', context ? [
            context
        ] : []);
        var outline = java.construct('android.graphics.Outline', []);
        var bounds = java.construct('android.graphics.Rect', []);
        java.invoke(probe, 'layout', [
            javaInt(0),
            javaInt(0),
            javaInt(PROBE_SIZE),
            javaInt(PROBE_SIZE)
        ]);
        java.invoke(provider, 'getOutline', [
            probe,
            outline
        ]);
        var circle = javaFlag(java.invoke(outline, 'getRect', [
            bounds
        ])) && javaNumber(java.invoke(bounds, 'width', [])) === PROBE_SIZE && javaNumber(java.invoke(bounds, 'height', [])) === PROBE_SIZE && javaNumber(java.invoke(outline, 'getRadius', [])) === PROBE_SIZE / 2;
        circles.set(name, circle);
        return circle;
    }
    function track(rounded) {
        tracked.push(rounded);
        if (tracked.length > MAX_TRACKED) tracked.shift();
    }
    function adoptOutline(view) {
        if (!isMissing(java.getAssociatedObject(view, originalOutline))) {
            return {
                kind: 'outline',
                view: view
            };
        }
        var provider = javaReference(java.invoke(view, 'getOutlineProvider', []));
        if (!provider || !isCircle(provider, view)) return null;
        java.setAssociatedObject(view, originalOutline, provider);
        java.setAssociatedObject(view, originalBackground, java.invoke(view, 'getBackground', []));
        var rounded = {
            kind: 'outline',
            view: view
        };
        track(rounded);
        return rounded;
    }
    function hasBorderRadius(view) {
        var _javaText;
        var name = (_javaText = javaText(java.className(view))) !== null && _javaText !== void 0 ? _javaText : '';
        var known = borderClasses.get(name);
        if (known !== undefined) return known;
        var supported = false;
        for(var current = name; current && current !== attachClass;){
            var description = java.describe(current);
            supported = description.methods.some(isBorderRadiusSetter);
            if (supported) break;
            current = description.superclass;
        }
        borderClasses.set(name, supported);
        return supported;
    }
    function regionContains(region, x, y) {
        return javaFlag(java.invoke(region, 'contains', [
            javaInt(x),
            javaInt(y)
        ]));
    }
    function clipsToCircle(view, size) {
        var background = javaReference(java.invoke(view, 'getBackground', []));
        if (!background) return false;
        var outline = java.construct('android.graphics.Outline', []);
        java.invoke(background, 'getOutline', [
            outline
        ]);
        var path = javaReference(java.getField(outline, 'mPath'));
        if (!path) return false;
        var bounds = java.construct('android.graphics.Region', [
            javaInt(0),
            javaInt(0),
            javaInt(size),
            javaInt(size)
        ]);
        var region = java.construct('android.graphics.Region', []);
        java.invoke(region, 'setPath', [
            path,
            bounds
        ]);
        var corner = Math.floor(size * CORNER_PROBE);
        var center = Math.floor(size / 2);
        return !regionContains(region, corner, corner) && regionContains(region, center, center);
    }
    function squareSize(view) {
        var _javaNumber, _javaNumber1;
        var width = (_javaNumber = javaNumber(java.invoke(view, 'getWidth', []))) !== null && _javaNumber !== void 0 ? _javaNumber : 0;
        var height = (_javaNumber1 = javaNumber(java.invoke(view, 'getHeight', []))) !== null && _javaNumber1 !== void 0 ? _javaNumber1 : 0;
        return Math.abs(width - height) <= SQUARE_TOLERANCE ? Math.min(width, height) : -1;
    }
    function adoptBorder(view) {
        return _async_to_generator$2(function() {
            var size, retry, rounded;
            return _ts_generator$2(this, function(_state) {
                switch(_state.label){
                    case 0:
                        if (!hasBorderRadius(view)) return [
                            2,
                            null
                        ];
                        size = squareSize(view);
                        retry = 0;
                        _state.label = 1;
                    case 1:
                        if (!(size === 0 && retry < SIZE_RETRIES)) return [
                            3,
                            4
                        ];
                        return [
                            4,
                            new Promise(function(resolve) {
                                return setTimeout(resolve, SIZE_RETRY_MS);
                            })
                        ];
                    case 2:
                        _state.sent();
                        size = squareSize(view);
                        _state.label = 3;
                    case 3:
                        retry++;
                        return [
                            3,
                            1
                        ];
                    case 4:
                        if (size <= 0 || disposed || !clipsToCircle(view, size)) return [
                            2,
                            null
                        ];
                        rounded = {
                            kind: 'border',
                            view: view,
                            circle: size / 2
                        };
                        track(rounded);
                        return [
                            2,
                            rounded
                        ];
                }
            });
        })();
    }
    function adopt(view) {
        if (javaFlag(java.invoke(avatarClass, 'isInstance', [
            view
        ]))) return adoptOutline(view);
        return adoptBorder(view);
    }
    function density(view) {
        var _javaNumber;
        var resources = javaReference(java.invoke(view, 'getResources', []));
        var metrics = resources ? javaReference(java.invoke(resources, 'getDisplayMetrics', [])) : null;
        return metrics ? (_javaNumber = javaNumber(java.getField(metrics, 'density'))) !== null && _javaNumber !== void 0 ? _javaNumber : 1 : 1;
    }
    function apply(rounded) {
        return _async_to_generator$2(function() {
            var view, corner, background;
            return _ts_generator$2(this, function(_state) {
                switch(_state.label){
                    case 0:
                        if (disposed) return [
                            2
                        ];
                        view = rounded.view;
                        corner = radius() * density(view);
                        if (!(rounded.kind === 'border')) return [
                            3,
                            2
                        ];
                        return [
                            4,
                            java.invokeAsync(view, 'setBorderRadius', [
                                javaFloat(corner)
                            ])
                        ];
                    case 1:
                        _state.sent();
                        return [
                            2
                        ];
                    case 2:
                        background = java.construct('android.graphics.drawable.GradientDrawable', []);
                        java.invoke(background, 'setCornerRadius', [
                            javaFloat(corner)
                        ]);
                        java.invoke(background, 'setColor', [
                            javaInt(0)
                        ]);
                        return [
                            4,
                            java.invokeAsync(view, 'setBackground', [
                                background
                            ])
                        ];
                    case 3:
                        _state.sent();
                        return [
                            4,
                            java.invokeAsync(view, 'setOutlineProvider', [
                                backgroundOutline
                            ])
                        ];
                    case 4:
                        _state.sent();
                        return [
                            4,
                            java.invokeAsync(view, 'setClipToOutline', [
                                javaBoolean(true)
                            ])
                        ];
                    case 5:
                        _state.sent();
                        return [
                            4,
                            java.invokeAsync(view, 'invalidateOutline', [])
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
    function round(view) {
        return _async_to_generator$2(function() {
            var rounded;
            return _ts_generator$2(this, function(_state) {
                switch(_state.label){
                    case 0:
                        if (disposed) return [
                            2
                        ];
                        return [
                            4,
                            adopt(view)
                        ];
                    case 1:
                        rounded = _state.sent();
                        if (!rounded) return [
                            3,
                            3
                        ];
                        return [
                            4,
                            apply(rounded)
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
    function restore(rounded) {
        return _async_to_generator$2(function() {
            var view, provider, background;
            return _ts_generator$2(this, function(_state) {
                switch(_state.label){
                    case 0:
                        view = rounded.view;
                        if (!(rounded.kind === 'border')) return [
                            3,
                            2
                        ];
                        return [
                            4,
                            java.invokeAsync(view, 'setBorderRadius', [
                                javaFloat(rounded.circle)
                            ])
                        ];
                    case 1:
                        _state.sent();
                        return [
                            2
                        ];
                    case 2:
                        provider = java.getAssociatedObject(view, originalOutline);
                        if (isMissing(provider)) return [
                            2
                        ];
                        background = java.getAssociatedObject(view, originalBackground);
                        return [
                            4,
                            java.invokeAsync(view, 'setBackground', [
                                isMissing(background) ? {
                                    type: 'null',
                                    class: 'android.graphics.drawable.Drawable'
                                } : background
                            ])
                        ];
                    case 3:
                        _state.sent();
                        return [
                            4,
                            java.invokeAsync(view, 'setOutlineProvider', [
                                provider
                            ])
                        ];
                    case 4:
                        _state.sent();
                        return [
                            4,
                            java.invokeAsync(view, 'invalidateOutline', [])
                        ];
                    case 5:
                        _state.sent();
                        return [
                            2
                        ];
                }
            });
        })();
    }
    function report(error) {
        console.error("[".concat(PLUGIN_NAME, "] Failed to round an avatar:"), error);
    }
    var token = hooks.hook(attachClass, 'onAttachedToWindow', [], {
        notify: true
    }, function(param) {
        var self = param.self;
        var view = javaReference(self);
        if (view) round(view).catch(report);
    });
    var root = currentDecorView(java);
    if (root) {
        var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
        try {
            for(var _iterator = findViewsOfClass(java, root, attachClass)[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                var view = _step.value;
                round(view).catch(report);
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
        refresh: function refresh() {
            var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
            try {
                for(var _iterator = tracked[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                    var rounded = _step.value;
                    apply(rounded).catch(report);
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
        },
        dispose: function dispose() {
            return _async_to_generator$2(function() {
                return _ts_generator$2(this, function(_state) {
                    switch(_state.label){
                        case 0:
                            disposed = true;
                            hooks.remove(token);
                            return [
                                4,
                                Promise.all(tracked.splice(0).map(function(rounded) {
                                    return restore(rounded).catch(report);
                                }))
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
}function _type_of$1(obj) {
    "@swc/helpers - typeof";
    return obj && typeof Symbol !== "undefined" && obj.constructor === Symbol ? "symbol" : typeof obj;
}
// UNKNOWN: `hash` and `description` come back from the bridge untyped.
function scalar(value) {
    if (typeof value === 'number' || (typeof value === "undefined" ? "undefined" : _type_of$1(value)) === 'bigint') {
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
function _type_of(obj) {
    "@swc/helpers - typeof";
    return obj && typeof Symbol !== "undefined" && obj.constructor === Symbol ? "symbol" : typeof obj;
}
function _unsupported_iterable_to_array(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _array_like_to_array(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(n);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _array_like_to_array(o, minLen);
}
// UNKNOWN: `windows` comes back as a JS array or an `NSArray` handle.
function handles(objc, value) {
    if (Array.isArray(value)) {
        return value;
    }
    if (!value || (typeof value === "undefined" ? "undefined" : _type_of(value)) !== 'object') {
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
    return _async_to_generator$1(function() {
        var UIApplication, _ref, windowList, keyWindow, windows, cells, seen, _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, window, _cells, found, err;
        return _ts_generator$1(this, function(_state) {
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
                    _ref = _sliced_to_array.apply(void 0, [
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
                    (_cells = cells).push.apply(_cells, _to_consumable_array(found.filter(function(cell) {
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
                        cells
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
function round(objc, avatar, radius) {
    var width = readRect(objc.call(avatar, 'bounds')).width;
    var layer = objc.call(avatar, 'layer');
    if (layer) objc.call(layer, 'setCornerRadius:', cornerRadius(radius, width));
}
function roundVisible(objc, radius) {
    return _async_to_generator(function() {
        var _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, avatar, width, layer, err;
        return _ts_generator(this, function(_state) {
            switch(_state.label){
                case 0:
                    _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
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
                        findVisibleCells(objc, AvatarClass.ios)
                    ];
                case 2:
                    _iterator = _state.sent()[Symbol.iterator]();
                    _state.label = 3;
                case 3:
                    if (!!(_iteratorNormalCompletion = (_step = _iterator.next()).done)) return [
                        3,
                        6
                    ];
                    avatar = _step.value;
                    width = readRect(objc.call(avatar, 'bounds')).width;
                    layer = objc.call(avatar, 'layer');
                    if (!layer) return [
                        3,
                        5
                    ];
                    return [
                        4,
                        objc.invokeAsync(layer, 'setCornerRadius:', [
                            cornerRadius(radius, width)
                        ])
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
                    return [
                        2
                    ];
            }
        });
    })();
}
/**
 * @description Rounds every `DCDAvatarView` to the chosen radius each time Discord lays it out.
 * @param objc The Objective-C bridge.
 * @param radius Reads the chosen radius.
 * @returns `refresh`, which re-rounds the avatars on screen, and `dispose`, which brings back the circles.
 */ function roundIOSAvatars(objc, radius) {
    var hook = objc.hook(AvatarClass.ios, 'layoutSubviews', {
        after: function after(param) {
            var self = param.self;
            return round(objc, self, radius());
        }
    });
    var refresh = function refresh() {
        return void roundVisible(objc, radius());
    };
    refresh();
    return {
        refresh: refresh,
        dispose: function dispose() {
            return _async_to_generator(function() {
                return _ts_generator(this, function(_state) {
                    switch(_state.label){
                        case 0:
                            hook.remove();
                            return [
                                4,
                                roundVisible(objc, Number.POSITIVE_INFINITY)
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
}var dispose = function dispose() {};
function start(context) {
    if (!ensureCapabilities(PLUGIN_NAME, context.native, context.capabilities)) return;
    var radius = function radius() {
        return storedRadius(settings.get('radius', undefined));
    };
    var avatars = context.platform === 'android' ? roundAndroidAvatars(context.native, radius) : roundIOSAvatars(context.native.objc, radius);
    var unsubscribe = settings.addListener(function(param) {
        var key = param.key;
        return key === 'radius';
    }, function() {
        return avatars.refresh();
    });
    dispose = function dispose() {
        unsubscribe();
        return avatars.dispose();
    };
}
function stop() {
    var stopping = dispose();
    dispose = function dispose() {};
    return stopping;
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