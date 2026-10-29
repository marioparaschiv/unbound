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
}var PLUGIN_NAME = 'Chat Bubbles';
var BubbleStyle = {
    radius: 10,
    horizontalPadding: 8,
    verticalPadding: 4,
    dark: {
        red: 0,
        green: 0,
        blue: 0,
        alpha: 0.4
    },
    light: {
        red: 1,
        green: 1,
        blue: 1,
        alpha: 0.4
    }
};
var IOSClass = {
    messageCell: 'DCDMessageTableViewCell',
    separatorCell: 'DCDSeparatorTableViewCell',
    avatar: 'DCDAvatarView',
    attributedText: 'DCDAttributedTextView',
    reactions: 'DCDReactionListView'
};
var MEDIA_VIEW_CLASSES = [
    'DiscordChat.MediaMosaicView',
    'DiscordChat.EmbedView',
    'DiscordChatComponentsSwift.ThumbnailView',
    'DCDMediaView',
    'DiscordChat.AttachmentView'
];
var AndroidClass = {
    messageView: 'com.discord.chat.presentation.message.MessageView',
    accessories: 'com.discord.chat.presentation.message.MessageAccessoriesView',
    content: 'com.discord.chat.presentation.message.view.MessageContentView',
    recycler: 'androidx.recyclerview.widget.RecyclerView'
};
var CONTENT_COLUMN_SEARCH_DEPTH = 6;
var CONTENT_COLUMN_WIDTH_RATIO = 3;
var CONTENT_COLUMN_MINIMUM_WIDTH = 100;function _array_like_to_array$3(arr, len) {
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
/**
 * @description Narrows a message body to its content and grows it by the bubble padding.
 * @param body The message body's frame.
 * @param contentWidth How far the body's text and media reach from its left edge, or 0 when unknown.
 * @param scale Multiplies the padding, such as the display density.
 * @returns The bubble's frame.
 */ function bubbleFrame(body, contentWidth) {
    var scale = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : 1;
    var width = contentWidth > 0 && contentWidth < body.width ? contentWidth : body.width;
    var horizontal = BubbleStyle.horizontalPadding * scale;
    var vertical = BubbleStyle.verticalPadding * scale;
    return {
        x: body.x - horizontal,
        y: body.y - vertical,
        width: width + horizontal * 2,
        height: body.height + vertical * 2
    };
}
/**
 * @description Unions edge rectangles.
 * @param boxes The rectangles.
 * @returns Their bounding rectangle, or `undefined` when there are none.
 */ function union(boxes) {
    var _Math, _Math1, _Math2, _Math3;
    if (!boxes.length) return;
    return {
        left: (_Math = Math).min.apply(_Math, _to_consumable_array$3(boxes.map(function(box) {
            return box.left;
        }))),
        top: (_Math1 = Math).min.apply(_Math1, _to_consumable_array$3(boxes.map(function(box) {
            return box.top;
        }))),
        right: (_Math2 = Math).max.apply(_Math2, _to_consumable_array$3(boxes.map(function(box) {
            return box.right;
        }))),
        bottom: (_Math3 = Math).max.apply(_Math3, _to_consumable_array$3(boxes.map(function(box) {
            return box.bottom;
        })))
    };
}
/**
 * @description Turns a bubble's frame into the insets that place it inside a row's bounds.
 * @param bubble The bubble's frame in the row.
 * @param width The row's width.
 * @param height The row's height.
 * @returns The insets from each edge, never negative.
 */ function rowInsets(bubble, width, height) {
    return {
        left: Math.max(0, Math.round(bubble.x)),
        top: Math.max(0, Math.round(bubble.y)),
        right: Math.max(0, Math.round(width - bubble.x - bubble.width)),
        bottom: Math.max(0, Math.round(height - bubble.y - bubble.height))
    };
}var ThemeStore = window.unbound.metro.findStore('Theme', {
    lazy: true
});/**
 * @description Picks the bubble color for the theme Discord is showing.
 * @returns A translucent black on dark themes and a translucent white on the light theme.
 */ function bubbleColor() {
    return ThemeStore.theme === 'light' ? BubbleStyle.light : BubbleStyle.dark;
}
/**
 * @description Packs a bubble color into an Android ARGB integer.
 * @param color The color.
 * @returns The signed 32-bit ARGB value.
 */ function argb(param) {
    var red = param.red, green = param.green, blue = param.blue, alpha = param.alpha;
    var channel = function channel(value) {
        return Math.round(value * 255);
    };
    return channel(alpha) << 24 | channel(red) << 16 | channel(green) << 8 | channel(blue) | 0;
}
/**
 * @description Calls `listener` whenever the theme changes.
 * @param listener The function to call.
 * @returns A function that stops listening.
 */ function subscribeTheme(listener) {
    if (!ThemeStore.addChangeListener) return function() {};
    ThemeStore.addChangeListener(listener);
    return function() {
        return ThemeStore.removeChangeListener(listener);
    };
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
var MAX_TRACKED = 256;
var MAX_ANCESTORS = 16;
var VISIBLE = 0;
var LAYOUT_PARAMETERS = [
    'boolean',
    'int',
    'int',
    'int',
    'int'
];
/**
 * @description Draws a rounded bubble behind each Android message as the row's background, sized to its content without changing the row's padding.
 * @param native The plugin's Java and hook bridges.
 * @returns `refresh`, which repaints the bubbles it drew, and `dispose`, which brings back the rows' own backgrounds.
 */ function drawAndroidBubbles(param) {
    var java = param.java, hooks = param.hooks;
    var accessoriesClass = java.getClass(AndroidClass.accessories);
    var messageClass = java.getClass(AndroidClass.messageView);
    var contentClass = java.getClass(AndroidClass.content);
    var ours = java.createAssociationKey();
    var original = java.createAssociationKey();
    var tracked = [];
    var pending = [];
    var scheduled = false;
    var disposed = false;
    var number = function number(view, method) {
        var _javaNumber;
        return (_javaNumber = javaNumber(java.invoke(view, method, []))) !== null && _javaNumber !== void 0 ? _javaNumber : 0;
    };
    var isInstance = function isInstance(type, view) {
        return javaFlag(java.invoke(type, 'isInstance', [
            view
        ]));
    };
    function children(group) {
        var count = number(group, 'getChildCount');
        return Array.from({
            length: count
        }, function(_, index) {
            return javaReference(java.invoke(group, 'getChildAt', [
                javaInt(index)
            ]));
        }).filter(function(child) {
            return Boolean(child);
        });
    }
    function textWidth(view) {
        var layout = javaReference(java.invoke(view, 'getLayout', []));
        if (!layout) return number(view, 'getWidth');
        var widest = 0;
        for(var line = 0; line < number(layout, 'getLineCount'); line++){
            var _javaNumber;
            widest = Math.max(widest, (_javaNumber = javaNumber(java.invoke(layout, 'getLineWidth', [
                javaInt(line)
            ]))) !== null && _javaNumber !== void 0 ? _javaNumber : 0);
        }
        return Math.ceil(widest) + number(view, 'getTotalPaddingLeft') + number(view, 'getTotalPaddingRight');
    }
    function contentArea(row) {
        var accessories = children(row).find(function(child) {
            return isInstance(accessoriesClass, child);
        });
        if (!accessories) return;
        var shown = children(accessories).filter(function(child) {
            return number(child, 'getVisibility') === VISIBLE && number(child, 'getWidth') > 0 && number(child, 'getHeight') > 0;
        });
        var area = union(shown.map(function(child) {
            var left = number(child, 'getLeft');
            var right = number(child, 'getRight');
            var tightened = shown.length === 1 && isInstance(contentClass, child) ? Math.min(right, left + textWidth(child)) : right;
            return {
                left: left,
                top: number(child, 'getTop'),
                right: tightened,
                bottom: number(child, 'getBottom')
            };
        }));
        if (!area) return;
        var x = number(accessories, 'getLeft');
        var y = number(accessories, 'getTop');
        return {
            left: area.left + x,
            top: area.top + y,
            right: area.right + x,
            bottom: area.bottom + y
        };
    }
    function isNested(row) {
        var current = javaReference(java.invoke(row, 'getParent', []));
        for(var depth = 0; current && depth < MAX_ANCESTORS; depth++){
            if (isInstance(messageClass, current)) return true;
            current = javaReference(java.invoke(current, 'getParent', []));
        }
        return false;
    }
    function density(row) {
        var _javaNumber;
        var resources = javaReference(java.invoke(row, 'getResources', []));
        var metrics = resources ? javaReference(java.invoke(resources, 'getDisplayMetrics', [])) : null;
        return metrics ? (_javaNumber = javaNumber(java.getField(metrics, 'density'))) !== null && _javaNumber !== void 0 ? _javaNumber : 1 : 1;
    }
    function track(row) {
        if (tracked.some(function(entry) {
            return sameJavaReference(entry, row);
        })) return;
        tracked.push(row);
        if (tracked.length > MAX_TRACKED) tracked.shift();
    }
    function restore(row) {
        return _async_to_generator$2(function() {
            var drawn, background;
            return _ts_generator$2(this, function(_state) {
                switch(_state.label){
                    case 0:
                        drawn = javaReference(java.getAssociatedObject(row, ours));
                        if (!drawn) return [
                            2
                        ];
                        background = javaReference(java.getAssociatedObject(row, original));
                        java.setAssociatedObject(row, ours, {
                            type: 'null'
                        });
                        return [
                            4,
                            java.invokeAsync(row, 'setBackground', [
                                background !== null && background !== void 0 ? background : {
                                    type: 'null',
                                    class: 'android.graphics.drawable.Drawable'
                                }
                            ])
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
    function place(row) {
        return _async_to_generator$2(function() {
            var area, scale, frame, insets, shape, bubble, current, drawn;
            return _ts_generator$2(this, function(_state) {
                switch(_state.label){
                    case 0:
                        area = contentArea(row);
                        if (!area) return [
                            2,
                            restore(row)
                        ];
                        scale = density(row);
                        frame = bubbleFrame({
                            x: area.left,
                            y: area.top,
                            width: area.right - area.left,
                            height: area.bottom - area.top
                        }, 0, scale);
                        insets = rowInsets(frame, number(row, 'getWidth'), number(row, 'getHeight'));
                        shape = java.construct('android.graphics.drawable.GradientDrawable', []);
                        java.invoke(shape, 'setCornerRadius', [
                            javaFloat(BubbleStyle.radius * scale)
                        ]);
                        java.invoke(shape, 'setColor', [
                            javaInt(argb(bubbleColor()))
                        ]);
                        bubble = java.construct('android.graphics.drawable.LayerDrawable', [
                            {
                                type: 'array',
                                componentType: 'android.graphics.drawable.Drawable',
                                value: [
                                    shape
                                ]
                            }
                        ]);
                        java.invoke(bubble, 'setLayerInset', [
                            javaInt(0),
                            javaInt(insets.left),
                            javaInt(insets.top),
                            javaInt(insets.right),
                            javaInt(insets.bottom)
                        ]);
                        java.invoke(bubble, 'setPadding', [
                            javaInt(0),
                            javaInt(0),
                            javaInt(0),
                            javaInt(0)
                        ]);
                        current = javaReference(java.invoke(row, 'getBackground', []));
                        drawn = javaReference(java.getAssociatedObject(row, ours));
                        if (!drawn || !current || !sameJavaReference(current, drawn)) {
                            java.setAssociatedObject(row, original, current !== null && current !== void 0 ? current : {
                                type: 'null'
                            });
                        }
                        java.setAssociatedObject(row, ours, bubble);
                        track(row);
                        return [
                            4,
                            java.invokeAsync(row, 'setBackground', [
                                bubble
                            ])
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
    function flush() {
        return _async_to_generator$2(function() {
            var _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, row, err;
            return _ts_generator$2(this, function(_state) {
                switch(_state.label){
                    case 0:
                        scheduled = false;
                        _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
                        _state.label = 1;
                    case 1:
                        _state.trys.push([
                            1,
                            6,
                            7,
                            8
                        ]);
                        _iterator = pending.splice(0)[Symbol.iterator]();
                        _state.label = 2;
                    case 2:
                        if (!!(_iteratorNormalCompletion = (_step = _iterator.next()).done)) return [
                            3,
                            5
                        ];
                        row = _step.value;
                        if (disposed) return [
                            2
                        ];
                        return [
                            4,
                            place(row).catch(function(error) {
                                console.error("[".concat(PLUGIN_NAME, "] Failed to place a bubble:"), error);
                            })
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
                        return [
                            2
                        ];
                }
            });
        })();
    }
    function schedule(row) {
        if (disposed || pending.some(function(entry) {
            return sameJavaReference(entry, row);
        })) return;
        pending.push(row);
        if (!scheduled) {
            scheduled = true;
            setTimeout(function() {
                return void flush();
            }, 0);
        }
    }
    var token = hooks.hook(AndroidClass.recycler, 'onLayout', LAYOUT_PARAMETERS, {
        notify: true
    }, function(param) {
        var self = param.self;
        var accessories = javaReference(self);
        if (!accessories || !isInstance(accessoriesClass, accessories)) return;
        var row = javaReference(java.invoke(accessories, 'getParent', []));
        if (row && isInstance(messageClass, row) && !isNested(row)) schedule(row);
    });
    function refreshVisible() {
        var root = currentDecorView(java);
        if (!root) return;
        var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
        try {
            for(var _iterator = findViewsOfClass(java, root, AndroidClass.messageView)[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                var row = _step.value;
                if (!isNested(row)) schedule(row);
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
    refreshVisible();
    return {
        refresh: function refresh() {
            var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
            try {
                for(var _iterator = tracked[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                    var row = _step.value;
                    schedule(row);
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
            refreshVisible();
        },
        dispose: function dispose() {
            return _async_to_generator$2(function() {
                return _ts_generator$2(this, function(_state) {
                    switch(_state.label){
                        case 0:
                            disposed = true;
                            hooks.remove(token);
                            pending.length = 0;
                            return [
                                4,
                                Promise.all(tracked.splice(0).map(function(row) {
                                    return restore(row).catch(function(error) {
                                        console.error("[".concat(PLUGIN_NAME, "] Failed to restore a row:"), error);
                                    });
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
}function _array_like_to_array$2(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_with_holes$2(arr) {
    if (Array.isArray(arr)) return arr;
}
function _array_without_holes$2(arr) {
    if (Array.isArray(arr)) return _array_like_to_array$2(arr);
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
    return _array_with_holes$2(arr) || _iterable_to_array_limit$2(arr, i) || _unsupported_iterable_to_array$2(arr, i) || _non_iterable_rest$2();
}
function _to_consumable_array$2(arr) {
    return _array_without_holes$2(arr) || _iterable_to_array$2(arr) || _unsupported_iterable_to_array$2(arr) || _non_iterable_spread$2();
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
function _type_of$1(obj) {
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
// UNKNOWN: `windows` comes back as a JS array or an `NSArray` handle.
function handles(objc, value) {
    if (Array.isArray(value)) {
        return value;
    }
    if (!value || (typeof value === "undefined" ? "undefined" : _type_of$1(value)) !== 'object') {
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
                    _ref = _sliced_to_array$2.apply(void 0, [
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
                    (_cells = cells).push.apply(_cells, _to_consumable_array$2(found.filter(function(cell) {
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
function _type_of(obj) {
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
function shows(node) {
    return node.visible && node.frame.width > 0 && node.frame.height > 0;
}
function isMedia(node) {
    return MEDIA_VIEW_CLASSES.includes(node.className) || node.className.includes('Sticker');
}
function isText(node) {
    return node.className === IOSClass.attributedText && Boolean(node.text);
}
function childrenOf(nodes, parent) {
    return nodes.flatMap(function(node, index) {
        return node.parent === parent ? [
            index
        ] : [];
    });
}
function absolute(nodes, index) {
    var _nodes_index_frame = nodes[index].frame, width = _nodes_index_frame.width, height = _nodes_index_frame.height;
    var x = 0;
    var y = 0;
    for(var current = index; current > 0; current = nodes[current].parent){
        x += nodes[current].frame.x;
        y += nodes[current].frame.y;
    }
    return {
        x: x,
        y: y,
        width: width,
        height: height
    };
}
function hasContent(nodes, index) {
    var node = nodes[index];
    if (!shows(node) || node.className === IOSClass.reactions) return false;
    if (isMedia(node) || isText(node)) return true;
    return childrenOf(nodes, index).some(function(child) {
        return hasContent(nodes, child);
    });
}
function largestAvatar(nodes) {
    var best;
    var bestArea = 0;
    nodes.forEach(function(node, index) {
        var area = node.frame.width * node.frame.height;
        if (node.className === IOSClass.avatar && area > bestArea) {
            best = index;
            bestArea = area;
        }
    });
    return best;
}
function contentColumn(nodes, avatar) {
    var _loop = function(level) {
        var parent = nodes[node].parent;
        var branch = nodes[node].frame.width;
        var column = childrenOf(nodes, parent).find(function(sibling) {
            var width = nodes[sibling].frame.width;
            return sibling !== node && width > branch * CONTENT_COLUMN_WIDTH_RATIO && width > CONTENT_COLUMN_MINIMUM_WIDTH;
        });
        if (column !== undefined) return {
            v: column
        };
        node = parent;
    };
    var node = avatar;
    for(var level = 0; level < CONTENT_COLUMN_SEARCH_DEPTH && nodes[node].parent >= 0; level++){
        var _ret = _loop();
        if (_type_of(_ret) === "object") return _ret.v;
    }
}
function descendants(nodes, index, stop) {
    var found = [];
    var queue = childrenOf(nodes, index);
    while(queue.length){
        var _queue;
        var current = queue.shift();
        if (!shows(nodes[current]) || nodes[current].className === IOSClass.reactions) continue;
        if (stop(nodes[current])) {
            found.push(current);
            continue;
        }
        (_queue = queue).unshift.apply(_queue, _to_consumable_array$1(childrenOf(nodes, current)));
    }
    return found;
}
/**
 * @description Finds a message cell's body, the view its bubble wraps, from a snapshot of the cell.
 * @param nodes The cell's snapshot, the cell first, each frame in its parent's coordinates.
 * @returns The body's frame in the cell, its first text view and how far its media reaches, or `undefined` for rows without an author column.
 */ function messageLayout(nodes) {
    var _Math;
    var avatar = largestAvatar(nodes);
    var column = avatar === undefined ? undefined : contentColumn(nodes, avatar);
    if (column === undefined) return;
    var body = childrenOf(nodes, column).reverse().find(function(child) {
        return hasContent(nodes, child);
    });
    if (body === undefined) return;
    var frame = absolute(nodes, body);
    var _descendants = _sliced_to_array$1(descendants(nodes, body, isText), 1), text = _descendants[0];
    var mediaRight = (_Math = Math).max.apply(_Math, [
        0
    ].concat(_to_consumable_array$1(descendants(nodes, body, isMedia).map(function(media) {
        var box = absolute(nodes, media);
        return box.x + box.width - frame.x;
    }))));
    return {
        body: frame,
        text: text === undefined ? undefined : {
            index: text,
            offset: absolute(nodes, text).x - frame.x
        },
        mediaRight: mediaRight
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
function _unsupported_iterable_to_array(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _array_like_to_array(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(n);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _array_like_to_array(o, minLen);
}
var SNAPSHOT = {
    maxDepth: 12,
    maxNodes: 512
};
var TEXT_MEASURE_HEIGHT = 100000;
var USES_LINE_FRAGMENT_ORIGIN = 1;
function clearColor(objc) {
    return objc.call(objc.getClass('UIColor'), 'clearColor');
}
function textWidth(objc, view, limit) {
    var text = objc.call(view, 'attributedText');
    if (!text) return 0;
    var measured = objc.call(text, 'boundingRectWithSize:options:context:', objc.struct('CGSize', {
        width: limit,
        height: TEXT_MEASURE_HEIGHT
    }), USES_LINE_FRAGMENT_ORIGIN, null);
    return Math.ceil(readRect(measured).width);
}
/**
 * @description Draws a rounded bubble behind each iOS message, sized to its text and media.
 * @param objc The Objective-C bridge.
 * @returns `refresh`, which repaints the bubbles on screen, and `dispose`, which removes them.
 */ function drawIOSBubbles(objc) {
    var bubbles = new Map();
    var pending = new Map();
    var clear = clearColor(objc);
    var flushing = false;
    var disposed = false;
    function color() {
        var _bubbleColor = bubbleColor(), red = _bubbleColor.red, green = _bubbleColor.green, blue = _bubbleColor.blue, alpha = _bubbleColor.alpha;
        return objc.call(objc.getClass('UIColor'), 'colorWithRed:green:blue:alpha:', red, green, blue, alpha);
    }
    function bubbleFor(key, cell) {
        return _async_to_generator(function() {
            var existing, bubble, layer;
            return _ts_generator(this, function(_state) {
                switch(_state.label){
                    case 0:
                        existing = bubbles.get(key);
                        if (existing) return [
                            2,
                            existing.bubble
                        ];
                        bubble = objc.alloc('UIView');
                        layer = objc.call(bubble, 'layer');
                        bubbles.set(key, {
                            cell: cell,
                            bubble: bubble
                        });
                        return [
                            4,
                            objc.invokeAsync(layer, 'setCornerRadius:', [
                                BubbleStyle.radius
                            ])
                        ];
                    case 1:
                        _state.sent();
                        return [
                            4,
                            objc.invokeAsync(layer, 'setMasksToBounds:', [
                                true
                            ])
                        ];
                    case 2:
                        _state.sent();
                        return [
                            4,
                            objc.invokeAsync(bubble, 'setUserInteractionEnabled:', [
                                false
                            ])
                        ];
                    case 3:
                        _state.sent();
                        return [
                            4,
                            objc.invokeAsync(cell, 'insertSubview:atIndex:', [
                                bubble,
                                0
                            ])
                        ];
                    case 4:
                        _state.sent();
                        return [
                            2,
                            bubble
                        ];
                }
            });
        })();
    }
    function isNested(cell) {
        return _async_to_generator(function() {
            var parent, _ref, outer;
            return _ts_generator(this, function(_state) {
                switch(_state.label){
                    case 0:
                        parent = objc.call(cell, 'superview');
                        if (!parent) return [
                            2,
                            false
                        ];
                        return [
                            4,
                            objc.findViews(parent, IOSClass.messageCell, {
                                direction: 'ancestors',
                                maxDepth: 24,
                                maxResults: 1,
                                stopAtMatch: true
                            })
                        ];
                    case 1:
                        _ref = _sliced_to_array.apply(void 0, [
                            _state.sent(),
                            1
                        ]), outer = _ref[0];
                        return [
                            2,
                            Boolean(outer)
                        ];
                }
            });
        })();
    }
    function place(key, cell) {
        return _async_to_generator(function() {
            var _nodes_layout_text_index, nodes, layout, existing, textView, text, frame, bubble;
            return _ts_generator(this, function(_state) {
                switch(_state.label){
                    case 0:
                        return [
                            4,
                            isNested(cell)
                        ];
                    case 1:
                        if (_state.sent()) return [
                            2
                        ];
                        return [
                            4,
                            objc.snapshot(cell, SNAPSHOT)
                        ];
                    case 2:
                        nodes = _state.sent();
                        if (disposed) return [
                            2
                        ];
                        layout = messageLayout(nodes);
                        if (!!layout) return [
                            3,
                            5
                        ];
                        existing = bubbles.get(key);
                        if (!existing) return [
                            3,
                            4
                        ];
                        return [
                            4,
                            objc.invokeAsync(existing.bubble, 'setHidden:', [
                                true
                            ])
                        ];
                    case 3:
                        _state.sent();
                        _state.label = 4;
                    case 4:
                        return [
                            2
                        ];
                    case 5:
                        textView = layout.text ? (_nodes_layout_text_index = nodes[layout.text.index]) === null || _nodes_layout_text_index === void 0 ? void 0 : _nodes_layout_text_index.view : undefined;
                        text = textView ? layout.text.offset + textWidth(objc, textView, layout.body.width) : 0;
                        frame = bubbleFrame(layout.body, Math.max(text, layout.mediaRight));
                        return [
                            4,
                            bubbleFor(key, cell)
                        ];
                    case 6:
                        bubble = _state.sent();
                        return [
                            4,
                            objc.invokeAsync(bubble, 'setBackgroundColor:', [
                                color()
                            ])
                        ];
                    case 7:
                        _state.sent();
                        return [
                            4,
                            objc.invokeAsync(bubble, 'setFrame:', [
                                objc.struct('CGRect', {
                                    origin: {
                                        x: frame.x,
                                        y: frame.y
                                    },
                                    size: {
                                        width: frame.width,
                                        height: frame.height
                                    }
                                })
                            ])
                        ];
                    case 8:
                        _state.sent();
                        return [
                            4,
                            objc.invokeAsync(bubble, 'setHidden:', [
                                false
                            ])
                        ];
                    case 9:
                        _state.sent();
                        return [
                            2
                        ];
                }
            });
        })();
    }
    function flush() {
        return _async_to_generator(function() {
            var _pending_entries_next_value, key, cell;
            return _ts_generator(this, function(_state) {
                switch(_state.label){
                    case 0:
                        flushing = true;
                        _state.label = 1;
                    case 1:
                        _state.trys.push([
                            1,
                            ,
                            5,
                            6
                        ]);
                        _state.label = 2;
                    case 2:
                        if (!(pending.size && !disposed)) return [
                            3,
                            4
                        ];
                        _pending_entries_next_value = _sliced_to_array(pending.entries().next().value, 2), key = _pending_entries_next_value[0], cell = _pending_entries_next_value[1];
                        pending.delete(key);
                        return [
                            4,
                            place(key, cell).catch(function(error) {
                                console.error("[".concat(PLUGIN_NAME, "] Failed to place a bubble:"), error);
                            })
                        ];
                    case 3:
                        _state.sent();
                        return [
                            3,
                            2
                        ];
                    case 4:
                        return [
                            3,
                            6
                        ];
                    case 5:
                        flushing = false;
                        return [
                            7
                        ];
                    case 6:
                        return [
                            2
                        ];
                }
            });
        })();
    }
    function schedule(cell) {
        var key = viewKey(objc, cell);
        if (disposed || key === undefined) return;
        pending.set(key, cell);
        if (!flushing) setTimeout(function() {
            return void flush();
        }, 0);
    }
    var hooks = [
        objc.hook(IOSClass.messageCell, 'setBackgroundColor:', {
            before: function before(context) {
                return context.replaceObjectArgument(0, clear);
            }
        }),
        objc.hook(IOSClass.separatorCell, 'setBackgroundColor:', {
            before: function before(context) {
                return context.replaceObjectArgument(0, clear);
            }
        }),
        objc.hook(IOSClass.messageCell, 'layoutSubviews', {
            after: function after(param) {
                var self = param.self;
                return schedule(self);
            }
        }),
        objc.hook(IOSClass.messageCell, 'prepareForReuse', {
            after: function after(param) {
                var self = param.self;
                return schedule(self);
            }
        })
    ];
    function refresh() {
        return _async_to_generator(function() {
            var _i, _iter, className, _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, cell, err;
            return _ts_generator(this, function(_state) {
                switch(_state.label){
                    case 0:
                        _i = 0, _iter = [
                            IOSClass.messageCell,
                            IOSClass.separatorCell
                        ];
                        _state.label = 1;
                    case 1:
                        if (!(_i < _iter.length)) return [
                            3,
                            11
                        ];
                        className = _iter[_i];
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
                            findVisibleCells(objc, className)
                        ];
                    case 3:
                        _iterator = _state.sent()[Symbol.iterator]();
                        _state.label = 4;
                    case 4:
                        if (!!(_iteratorNormalCompletion = (_step = _iterator.next()).done)) return [
                            3,
                            7
                        ];
                        cell = _step.value;
                        return [
                            4,
                            objc.invokeAsync(cell, 'setBackgroundColor:', [
                                clear
                            ])
                        ];
                    case 5:
                        _state.sent();
                        if (className === IOSClass.messageCell) schedule(cell);
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
                        _i++;
                        return [
                            3,
                            1
                        ];
                    case 11:
                        return [
                            2
                        ];
                }
            });
        })();
    }
    void refresh();
    return {
        refresh: function refresh1() {
            return void refresh();
        },
        dispose: function dispose() {
            return _async_to_generator(function() {
                var _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, hook;
                return _ts_generator(this, function(_state) {
                    switch(_state.label){
                        case 0:
                            disposed = true;
                            _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
                            try {
                                for(_iterator = hooks[Symbol.iterator](); !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                                    hook = _step.value;
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
                            pending.clear();
                            return [
                                4,
                                Promise.all(_to_consumable_array(bubbles.values()).map(function(param) {
                                    var bubble = param.bubble;
                                    return objc.invokeAsync(bubble, 'removeFromSuperview', []).catch(function() {
                                        return undefined;
                                    });
                                }))
                            ];
                        case 1:
                            _state.sent();
                            bubbles.clear();
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
    var bubbles = context.platform === 'android' ? drawAndroidBubbles(context.native) : drawIOSBubbles(context.native.objc);
    var unsubscribe = subscribeTheme(function() {
        return bubbles.refresh();
    });
    dispose = function dispose() {
        unsubscribe();
        return bubbles.dispose();
    };
}
function stop() {
    var stopping = dispose();
    dispose = function dispose() {};
    return stopping;
}
var index = {
    start: start,
    stop: stop
};
return index;
})();return this.__plugin;},start(context){const module=this.__load();const plugin=module?.default??module;if(plugin&&typeof plugin.start==='function')return plugin.start(context);},stop(){const module=this.__load();const plugin=module?.default??module;if(plugin&&typeof plugin.stop==='function')return plugin.stop();}})