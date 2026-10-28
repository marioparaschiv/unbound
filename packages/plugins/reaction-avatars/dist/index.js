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
}var MESSAGE_TEXT_VIEW_CLASSES = [
    'DCDAttributedTextView',
    'DCDReusableYYLabel'
];function _array_like_to_array$e(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_with_holes$8(arr) {
    if (Array.isArray(arr)) return arr;
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
function _sliced_to_array$8(arr, i) {
    return _array_with_holes$8(arr) || _iterable_to_array_limit$8(arr, i) || _unsupported_iterable_to_array$e(arr, i) || _non_iterable_rest$8();
}
function _unsupported_iterable_to_array$e(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _array_like_to_array$e(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(n);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _array_like_to_array$e(o, minLen);
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
                                var _param = _sliced_to_array$8(param, 1), cell = _param[0];
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
}var ReactionActions = window.unbound.metro.findByFilePath('modules/reactions/ReactionActionCreators.tsx', {
    lazy: true
});
var UserSummaryItemModule = window.unbound.metro.findByFilePath('components_native/common/UserSummaryItem.tsx', {
    lazy: true
});
var SelectedChannelStore = window.unbound.metro.findStore('SelectedChannel', {
    lazy: true
});
var MessageStore = window.unbound.metro.findStore('Message', {
    lazy: true
});
var ChannelStore = window.unbound.metro.findStore('Channel', {
    lazy: true
});
var UserStore = window.unbound.metro.stores.Users;
/**
 * @description Finds Discord's `UserSummaryItem`, by its file and else by its name.
 * @returns The component, or `undefined` when neither lookup finds it.
 */ function findUserSummaryItem() {
    var _UserSummaryItemModule_default;
    var exported = (_UserSummaryItemModule_default = UserSummaryItemModule.default) !== null && _UserSummaryItemModule_default !== void 0 ? _UserSummaryItemModule_default : UserSummaryItemModule.module;
    var component = typeof exported === 'function' ? exported : window.unbound.metro.findByName('UserSummaryItem');
    return typeof component === 'function' ? component : undefined;
}function _type_of$5(obj) {
    "@swc/helpers - typeof";
    return obj && typeof Symbol !== "undefined" && obj.constructor === Symbol ? "symbol" : typeof obj;
}
// UNKNOWN: `hash` and `description` come back from the bridge untyped.
function scalar(value) {
    if (typeof value === 'number' || (typeof value === "undefined" ? "undefined" : _type_of$5(value)) === 'bigint') {
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
 */ function viewKey$1(objc, view) {
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
}function _array_like_to_array$d(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_without_holes$8(arr) {
    if (Array.isArray(arr)) return _array_like_to_array$d(arr);
}
function _iterable_to_array$8(iter) {
    if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) {
        return Array.from(iter);
    }
}
function _non_iterable_spread$8() {
    throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _to_consumable_array$8(arr) {
    return _array_without_holes$8(arr) || _iterable_to_array$8(arr) || _unsupported_iterable_to_array$d(arr) || _non_iterable_spread$8();
}
function _unsupported_iterable_to_array$d(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _array_like_to_array$d(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(n);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _array_like_to_array$d(o, minLen);
}
function average(values) {
    return values.length ? values.reduce(function(total, value) {
        return total + value;
    }, 0) / values.length : 0;
}
/**
 * @description Checks whether two frames are the same to within half a point.
 * @param current The frame a view has now, or `undefined` when it could not be read.
 * @param target The frame it should have.
 * @returns `true` when no update is needed.
 */ function framesMatch(current, target) {
    return Boolean(current && Math.abs(current.x - target.x) < 0.5 && Math.abs(current.y - target.y) < 0.5 && Math.abs(current.width - target.width) < 0.5 && Math.abs(current.height - target.height) < 0.5);
}
/**
 * @description Lays reaction pills out again left to right, wrapping rows, after some of them grew wider.
 * @param items The pills' original frames and how much each grew.
 * @param containerWidth The width of the reaction list.
 * @returns The new frames in index order, keeping the original spacing between pills and rows.
 */ function reflowReactionItems(items, containerWidth) {
    var _Math, _Math1;
    if (items.length === 0 || containerWidth <= 0) return [];
    var ordered = _to_consumable_array$8(items).sort(function(first, second) {
        return first.index - second.index;
    });
    var startX = (_Math = Math).min.apply(_Math, _to_consumable_array$8(ordered.map(function(item) {
        return item.x;
    })));
    var startY = (_Math1 = Math).min.apply(_Math1, _to_consumable_array$8(ordered.map(function(item) {
        return item.y;
    })));
    var horizontalGap = average(ordered.flatMap(function(item, position) {
        var next = ordered[position + 1];
        if (!next || Math.abs(next.y - item.y) >= 1) return [];
        return [
            Math.max(0, next.x - item.x - item.width)
        ];
    }));
    var rowTops = _to_consumable_array$8(new Set(ordered.map(function(item) {
        return item.y;
    }))).sort(function(first, second) {
        return first - second;
    });
    var verticalGap = average(rowTops.flatMap(function(top, index) {
        var _Math;
        var nextTop = rowTops[index + 1];
        if (nextTop === undefined) return [];
        var rowBottom = (_Math = Math).max.apply(_Math, _to_consumable_array$8(ordered.filter(function(item) {
            return item.y === top;
        }).map(function(item) {
            return item.y + item.height;
        })));
        return [
            Math.max(0, nextTop - rowBottom)
        ];
    }));
    var frames = [];
    var x = startX;
    var y = startY;
    var rowHeight = 0;
    var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
    try {
        for(var _iterator = ordered[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
            var item = _step.value;
            var _item_extraWidth;
            var width = item.width + Math.max(0, (_item_extraWidth = item.extraWidth) !== null && _item_extraWidth !== void 0 ? _item_extraWidth : 0);
            if (x > startX && x + width > startX + containerWidth) {
                x = startX;
                y += rowHeight + verticalGap;
                rowHeight = 0;
            }
            frames.push({
                height: item.height,
                index: item.index,
                width: width,
                x: x,
                y: y
            });
            x += width + horizontalGap;
            rowHeight = Math.max(rowHeight, item.height);
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
    return frames;
}
/**
 * @description Recovers a reaction view's original width after native cell reuse left it widened.
 * @param layoutWidth The pill's width in the collection layout.
 * @param cellWidth The collection cell's current width.
 * @param viewWidth The reaction view's current width.
 * @returns The view's width without any avatar extra.
 */ function reactionBaseViewWidth(layoutWidth, cellWidth, viewWidth) {
    var inset = Math.max(0, cellWidth - viewWidth);
    return Math.max(0, Math.min(viewWidth, layoutWidth - inset));
}
/**
 * @description Places the avatar surface right after the reaction pill's content.
 * @param contentFrame The pill's original frame.
 * @param surfaceWidth The avatar stack's width.
 * @param inset How far the surface overlaps the pill's trailing edge.
 * @returns The surface's x position and width.
 */ function reactionAvatarFrame(contentFrame, surfaceWidth) {
    var inset = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : 0;
    return {
        x: Math.max(0, contentFrame.x + contentFrame.width - inset),
        width: Math.max(0, surfaceWidth)
    };
}function _type_of$4(obj) {
    "@swc/helpers - typeof";
    return obj && typeof Symbol !== "undefined" && obj.constructor === Symbol ? "symbol" : typeof obj;
}
var unkeyed = 0;
// UNKNOWN: selectors return untyped values; this reads a number from one.
function toNumber(value) {
    if (value === null || value === undefined) return;
    var number = Number(value);
    return Number.isFinite(number) ? number : undefined;
}
function isHandle(value) {
    return (typeof value === "undefined" ? "undefined" : _type_of$4(value)) === 'object' && value !== null;
}
/**
 * @description Builds a stable identity for a native object, so it can key a map across bridge handles.
 * @param objc The Objective-C bridge.
 * @param handle The object.
 * @returns Its view key, or a key of its own when it has none, so it never shares another view's state.
 */ function key(objc, handle) {
    var _viewKey;
    return (_viewKey = viewKey$1(objc, handle)) !== null && _viewKey !== void 0 ? _viewKey : "native:".concat(++unkeyed);
}
/**
 * @description Reads an `NSArray` of objects.
 * @param objc The Objective-C bridge.
 * @param value The array, as a selector returned it.
 * @returns Its object elements, or `[]` when it is not an array.
 */ // UNKNOWN: selectors return untyped values.
function toHandles(objc, value) {
    if (Array.isArray(value)) return value;
    if (!isHandle(value)) return [];
    try {
        return objc.array(value).filter(isHandle);
    } catch (unused) {
        return [];
    }
}
/**
 * @description Reads a `CGRect`.
 * @param value The struct, as a selector returned it.
 * @returns The rect, or `undefined` when a field is missing.
 */ // UNKNOWN: selectors return untyped values.
function readRect(value) {
    var _fields_origin, _fields_origin1, _fields_size, _fields_size1;
    var fields = value === null || value === void 0 ? void 0 : value.value;
    var x = toNumber(fields === null || fields === void 0 ? void 0 : (_fields_origin = fields.origin) === null || _fields_origin === void 0 ? void 0 : _fields_origin.x);
    var y = toNumber(fields === null || fields === void 0 ? void 0 : (_fields_origin1 = fields.origin) === null || _fields_origin1 === void 0 ? void 0 : _fields_origin1.y);
    var width = toNumber(fields === null || fields === void 0 ? void 0 : (_fields_size = fields.size) === null || _fields_size === void 0 ? void 0 : _fields_size.width);
    var height = toNumber(fields === null || fields === void 0 ? void 0 : (_fields_size1 = fields.size) === null || _fields_size1 === void 0 ? void 0 : _fields_size1.height);
    if (x === undefined || y === undefined || width === undefined || height === undefined) return;
    return {
        height: height,
        width: width,
        x: x,
        y: y
    };
}
/**
 * @description Reads a `CGSize`.
 * @param value The struct, as a selector returned it.
 * @returns The size, with a missing field left `undefined`.
 */ // UNKNOWN: selectors return untyped values.
function readSize(value) {
    var fields = value === null || value === void 0 ? void 0 : value.value;
    return {
        height: toNumber(fields === null || fields === void 0 ? void 0 : fields.height),
        width: toNumber(fields === null || fields === void 0 ? void 0 : fields.width)
    };
}
/**
 * @description Reads a view's frame.
 * @param objc The Objective-C bridge.
 * @param view The view.
 * @returns Its frame, or `undefined` when it could not be read.
 */ function frameOf(objc, view) {
    return readRect(safeInvoke(objc, view, 'frame'));
}
/**
 * @description Moves or resizes a view, skipping the call when it is already there.
 * @param objc The Objective-C bridge.
 * @param view The view.
 * @param frame Its new frame.
 */ function setFrame(objc, view, frame) {
    if (framesMatch(frameOf(objc, view), frame)) return;
    safeInvoke(objc, view, 'setFrame:', objc.struct('CGRect', {
        origin: {
            x: frame.x,
            y: frame.y
        },
        size: {
            height: frame.height,
            width: frame.width
        }
    }));
}
/**
 * @description Sets a scroll view's content size.
 * @param objc The Objective-C bridge.
 * @param view The scroll view.
 * @param size Its new content size.
 */ function setContentSize(objc, view, size) {
    safeInvoke(objc, view, 'setContentSize:', objc.struct('CGSize', size));
}
/**
 * @description Finds the nearest view, itself included, whose class name contains `className`.
 * @param objc The Objective-C bridge.
 * @param view The view to start from.
 * @param className Part of the class name to match.
 * @returns The ancestor within 12 levels, or `null`.
 */ function ancestorOfClass(objc, view, className) {
    var current = view;
    for(var depth = 0; current && depth < 12; depth++){
        var _objc_className;
        if ((_objc_className = objc.className(current)) === null || _objc_className === void 0 ? void 0 : _objc_className.includes(className)) return current;
        current = safeInvoke(objc, current, 'superview');
    }
    return null;
}
/**
 * @description Finds the reaction pill's view inside a reaction collection cell.
 * @param objc The Objective-C bridge.
 * @param cell The collection cell.
 * @returns The first `ReactionView` within 5 levels and 40 views, breadth first, or `null`.
 */ function reactionViewOf(objc, cell) {
    var queue = [
        {
            depth: 0,
            view: cell
        }
    ];
    for(var visited = 0; visited < 40; visited++){
        var _objc_className;
        var node = queue.shift();
        if (!node) return null;
        if ((_objc_className = objc.className(node.view)) === null || _objc_className === void 0 ? void 0 : _objc_className.includes('ReactionView')) return node.view;
        if (node.depth >= 5) {
            continue;
        }
        var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
        try {
            for(var _iterator = toHandles(objc, safeInvoke(objc, node.view, 'subviews'))[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                var child = _step.value;
                queue.push({
                    depth: node.depth + 1,
                    view: child
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
    }
    return null;
}
/**
 * @description Counts a collection view's sections.
 * @param objc The Objective-C bridge.
 * @param collection The collection view.
 * @returns The section count, `1` when it could not be read.
 */ function sectionCount(objc, collection) {
    var _toNumber;
    return (_toNumber = toNumber(safeInvoke(objc, collection, 'numberOfSections'))) !== null && _toNumber !== void 0 ? _toNumber : 1;
}
/**
 * @description Counts the items in one section of a collection view.
 * @param objc The Objective-C bridge.
 * @param collection The collection view.
 * @param section The section.
 * @returns The item count.
 */ function sectionItemCount(objc, collection, section) {
    var _toNumber;
    return (_toNumber = toNumber(safeInvoke(objc, collection, 'numberOfItemsInSection:', section))) !== null && _toNumber !== void 0 ? _toNumber : 0;
}
/**
 * @description Counts the items across a collection view's sections.
 * @param objc The Objective-C bridge.
 * @param collection The collection view.
 * @returns The item count.
 */ function itemCount(objc, collection) {
    var sections = sectionCount(objc, collection);
    var count = 0;
    for(var section = 0; section < sections; section++){
        count += sectionItemCount(objc, collection, section);
    }
    return count;
}
/**
 * @description Finds which item a collection cell shows.
 * @param objc The Objective-C bridge.
 * @param collection The collection view.
 * @param cell One of its cells.
 * @returns The item index, or `undefined` when the cell is not in the collection.
 */ function itemOfCell(objc, collection, cell) {
    var _toNumber;
    var indexPath = safeInvoke(objc, collection, 'indexPathForCell:', cell);
    if (!indexPath) return;
    var item = (_toNumber = toNumber(safeInvoke(objc, indexPath, 'item'))) !== null && _toNumber !== void 0 ? _toNumber : toNumber(safeInvoke(objc, indexPath, 'row'));
    return item === undefined ? undefined : Math.floor(item);
}var Avatar = {
    // At most this many faces are shown; the rest collapse into a `+N` badge.
    limit: 5,
    size: 18,
    // Horizontal offset between overlapping faces.
    step: 5,
    // The stack overlaps the reaction pill's trailing padding by this much.
    leadingInset: 4,
    trailingPadding: 4
};
var SURFACE_HEIGHT = 36;
var NativeClass = {
    messageCell: 'DCDMessageTableViewCell',
    table: 'DCDTableView'
};
var REACTION_ACTIONS = [
    'MESSAGE_REACTION_ADD',
    'MESSAGE_REACTION_REMOVE',
    'MESSAGE_REACTION_REMOVE_ALL',
    'MESSAGE_REACTION_REMOVE_EMOJI'
];function _array_like_to_array$c(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_with_holes$7(arr) {
    if (Array.isArray(arr)) return arr;
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
    return _array_with_holes$7(arr) || _iterable_to_array_limit$7(arr, i) || _unsupported_iterable_to_array$c(arr, i) || _non_iterable_rest$7();
}
function _unsupported_iterable_to_array$c(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _array_like_to_array$c(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(n);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _array_like_to_array$c(o, minLen);
}
/**
 * @description Gets the row-height bookkeeping for a message table, creating it on first use.
 * @param session The running session.
 * @param table The `DCDTableView`.
 * @returns Its entry.
 */ function tableLayout(session, table) {
    var tableKey = key(session.objc, table);
    var existing = session.tables.get(tableKey);
    if (existing) return existing;
    var entry = {
        dirty: true,
        hooked: false,
        pending: null,
        scheduled: false,
        table: table
    };
    session.tables.set(tableKey, entry);
    return entry;
}
/**
 * @description Marks a table's row heights as stale.
 * @param session The running session.
 * @param tableKey The table's key.
 * @returns The table's entry, or `undefined` when it is not tracked.
 */ function markTableDirty(session, tableKey) {
    var entry = session.tables.get(tableKey);
    if (entry) entry.dirty = true;
    return entry;
}
function applyTableLayout(session, entry) {
    if (!entry.dirty || entry.pending) return;
    var signal = session.signal;
    entry.dirty = false;
    try {
        var pending = session.objc.batch([
            {
                target: entry.table,
                selector: 'beginUpdates',
                args: []
            },
            {
                target: entry.table,
                selector: 'endUpdates',
                args: []
            }
        ]);
        entry.pending = pending;
        void pending.then(function() {
            if (entry.pending !== pending) return;
            entry.pending = null;
            if (!signal.aborted && entry.dirty) scheduleTableLayout(session, entry);
        }, function() {
            if (entry.pending !== pending) return;
            entry.pending = null;
            if (!signal.aborted) entry.dirty = true;
        });
    } catch (unused) {
        entry.dirty = true;
    }
}
/**
 * @description Re-measures a table's rows on the next tick, once however often it is asked.
 * @param session The running session.
 * @param entry The table's entry.
 */ function scheduleTableLayout(session, entry) {
    if (entry.scheduled) return;
    entry.scheduled = true;
    setTimeout(function() {
        entry.scheduled = false;
        if (!session.signal.aborted && entry.dirty) applyTableLayout(session, entry);
    }, 0);
}
/**
 * @description Re-measures a table's rows when they were marked stale.
 * @param session The running session.
 * @param tableKey The table's key.
 */ function flushTableLayout(session, tableKey) {
    var entry = session.tables.get(tableKey);
    if (entry === null || entry === void 0 ? void 0 : entry.dirty) scheduleTableLayout(session, entry);
}
/**
 * @description Re-measures a table's stale rows after each of its own layout passes.
 * @param session The running session.
 * @param table The `DCDTableView`.
 */ function hookTableLayout(session, table) {
    var entry = tableLayout(session, table);
    if (entry.hooked) return;
    try {
        session.tableHooks.push(session.objc.hook(NativeClass.table, 'layoutSubviews', {
            after: function after() {
                if (entry.dirty) scheduleTableLayout(session, entry);
            }
        }, {
            instance: table,
            thread: 'main'
        }));
        entry.hooked = true;
    } catch (unused) {
    // Without the hook the rows still re-measure when a reaction layout schedules it.
    }
}
/**
 * @description Unhooks every table and re-measures its rows once their reaction layouts are restored.
 * @param session The running session.
 * @param restoreRows Restores the reaction layouts inside one table.
 */ function restoreTables(session, restoreRows) {
    var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
    try {
        for(var _iterator = session.tableHooks.splice(0)[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
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
    var _iteratorNormalCompletion1 = true, _didIteratorError1 = false, _iteratorError1 = undefined;
    try {
        for(var _iterator1 = session.tables[Symbol.iterator](), _step1; !(_iteratorNormalCompletion1 = (_step1 = _iterator1.next()).done); _iteratorNormalCompletion1 = true){
            var _step_value = _sliced_to_array$7(_step1.value, 2), tableKey = _step_value[0], entry = _step_value[1];
            var _entry_pending;
            (_entry_pending = entry.pending) === null || _entry_pending === void 0 ? void 0 : _entry_pending.cancel();
            entry.pending = null;
            restoreRows(tableKey);
            entry.dirty = false;
            safeInvoke(session.objc, entry.table, 'beginUpdates');
            safeInvoke(session.objc, entry.table, 'endUpdates');
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
    session.tables.clear();
}function _array_like_to_array$b(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_without_holes$7(arr) {
    if (Array.isArray(arr)) return _array_like_to_array$b(arr);
}
function _iterable_to_array$7(iter) {
    if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) {
        return Array.from(iter);
    }
}
function _non_iterable_spread$7() {
    throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _to_consumable_array$7(arr) {
    return _array_without_holes$7(arr) || _iterable_to_array$7(arr) || _unsupported_iterable_to_array$b(arr) || _non_iterable_spread$7();
}
function _unsupported_iterable_to_array$b(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _array_like_to_array$b(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(n);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _array_like_to_array$b(o, minLen);
}
function sizeArgs(session, height) {
    return [
        session.objc.struct('CGSize', {
            width: height.width,
            height: 0
        })
    ];
}
function highest(contributions) {
    var _Math;
    return (_Math = Math).max.apply(_Math, [
        0
    ].concat(_to_consumable_array$7(contributions.values())));
}
function removeFloor(session, height) {
    try {
        var _session_sizeHook;
        (_session_sizeHook = session.sizeHook) === null || _session_sizeHook === void 0 ? void 0 : _session_sizeHook.removeSizeHeightFloor(height.cell, sizeArgs(session, height));
    } catch (unused) {
    // Best effort: every floor goes away with the hook when the plugin stops.
    }
}
function forget(session, cellKey, height) {
    removeFloor(session, height);
    session.cellHeights.delete(cellKey);
}
function setFloor(session, hook, cellKey, height, floor) {
    try {
        hook.setSizeHeightFloor(height.cell, sizeArgs(session, height), floor);
        height.floor = floor;
        return true;
    } catch (unused) {
        forget(session, cellKey, height);
        return false;
    }
}
function hookCellSize(session) {
    if (session.sizeHook) return session.sizeHook;
    var hook = session.objc.hook(NativeClass.messageCell, 'sizeThatFits:', {}, {
        cacheOnly: true,
        thread: 'main'
    });
    // Older loaders cannot hold a height floor; the rows then keep Discord's height.
    if (typeof hook.setSizeHeightFloor !== 'function') {
        hook.remove();
        return null;
    }
    session.sizeHook = hook;
    return hook;
}
// The collection's planned bottom edge in the message cell's coordinates, plus a 2pt margin.
function collectionBottomInCell(session, entry) {
    if (!entry.ownerCell || !entry.plan) return;
    var objc = session.objc;
    var offset = 0;
    var current = entry.collection;
    for(var depth = 0; current && depth < 12; depth++){
        if (key(objc, current) === entry.ownerCellKey) return offset + entry.plan.height + 2;
        var frame = frameOf(objc, current);
        if (!frame) return;
        offset += frame.y;
        current = safeInvoke(objc, current, 'superview');
    }
}
/**
 * @description Drops a reaction collection's height request from its message cell.
 * @param session The running session.
 * @param entry The collection's layout.
 * @returns `true` when the cell's height changed and its table needs to re-measure.
 */ function clearCellHeight(session, entry) {
    var height = session.cellHeights.get(entry.ownerCellKey);
    if (!height || height.messageKey !== entry.ownerMessageKey) return false;
    if (!height.contributions.delete(key(session.objc, entry.collection))) return false;
    if (height.contributions.size === 0) {
        forget(session, entry.ownerCellKey, height);
        return true;
    }
    var floor = highest(height.contributions);
    if (Math.abs(height.floor - floor) < 0.5) return false;
    if (!session.sizeHook) {
        session.cellHeights.delete(entry.ownerCellKey);
        return true;
    }
    setFloor(session, session.sizeHook, entry.ownerCellKey, height, floor);
    return true;
}
/**
 * @description Makes a message cell tall enough for its reflowed reaction collection.
 * @param session The running session.
 * @param entry The collection's layout, with a plan.
 * @returns `true` when the cell's height changed and its table needs to re-measure.
 */ function updateCellHeight(session, entry) {
    var _entry_ancestorFrames_;
    if (!entry.ownerCell || !entry.plan) return false;
    var baselineHeight = (_entry_ancestorFrames_ = entry.ancestorFrames[0]) === null || _entry_ancestorFrames_ === void 0 ? void 0 : _entry_ancestorFrames_.frame.height;
    var cellFrame = frameOf(session.objc, entry.ownerCell);
    if (baselineHeight === undefined || !cellFrame || cellFrame.width <= 0) return false;
    if (entry.plan.height - baselineHeight < 1) return clearCellHeight(session, entry);
    var floor = collectionBottomInCell(session, entry);
    if (floor === undefined || floor <= 0 || floor > 4096) return false;
    var height = session.cellHeights.get(entry.ownerCellKey);
    if (height && (height.messageKey !== entry.ownerMessageKey || Math.abs(height.width - cellFrame.width) >= 0.5)) {
        forget(session, entry.ownerCellKey, height);
        height = undefined;
    }
    var hook;
    try {
        hook = hookCellSize(session);
    } catch (unused) {
        return false;
    }
    if (!hook) return false;
    if (!height) {
        height = {
            cell: entry.ownerCell,
            contributions: new Map(),
            floor: 0,
            messageKey: entry.ownerMessageKey,
            width: cellFrame.width
        };
        session.cellHeights.set(entry.ownerCellKey, height);
    }
    height.contributions.set(key(session.objc, entry.collection), floor);
    var target = highest(height.contributions);
    if (Math.abs(height.floor - target) < 0.5) return false;
    return setFloor(session, hook, entry.ownerCellKey, height, target);
}
/**
 * @description Removes every height floor and the `sizeThatFits:` hook.
 * @param session The running session.
 */ function clearCellHeights(session) {
    var _session_sizeHook;
    (_session_sizeHook = session.sizeHook) === null || _session_sizeHook === void 0 ? void 0 : _session_sizeHook.remove();
    session.sizeHook = null;
    session.cellHeights.clear();
}/** What each mounted avatar surface renders, by surface id; Fabric only passes surfaces serializable props. */ var surfaceStates = new Map();function _array_like_to_array$a(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_with_holes$6(arr) {
    if (Array.isArray(arr)) return arr;
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
            _define_property$4(target, key, source[key]);
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
function _sliced_to_array$6(arr, i) {
    return _array_with_holes$6(arr) || _iterable_to_array_limit$6(arr, i) || _unsupported_iterable_to_array$a(arr, i) || _non_iterable_rest$6();
}
function _unsupported_iterable_to_array$a(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _array_like_to_array$a(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(n);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _array_like_to_array$a(o, minLen);
}
/**
 * @description Unmounts a pill's avatar surface and gives the pill its original frame back.
 * @param session The running session.
 * @param state The pill.
 */ function unmountSurface(session, state) {
    surfaceStates.delete(state.surfaceId);
    if (state.surface) {
        try {
            session.fabric.unmount(state.surface);
        } catch (unused) {
        // The surface already went away with its container.
        }
    }
    state.surface = null;
    state.surfaceFrame = null;
    setFrame(session.objc, state.view, state.baseFrame);
}
/**
 * @description Stops tracking a pill, leaving the layout it reserved to the caller.
 * @param session The running session.
 * @param viewKey The pill's key in `session.reactions`.
 * @param state The pill.
 */ function releaseState(session, viewKey, state) {
    if (state.retryTimer) clearTimeout(state.retryTimer);
    state.requestGeneration++;
    unmountSurface(session, state);
    session.reactions.delete(viewKey);
}
/**
 * @description Stops tracking every pill that matches.
 * @param session The running session.
 * @param matches Picks the pills to release.
 * @returns `true` when any pill was released.
 */ function releaseStates(session, matches) {
    var released = false;
    var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
    try {
        for(var _iterator = session.reactions[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
            var _step_value = _sliced_to_array$6(_step.value, 2), viewKey = _step_value[0], state = _step_value[1];
            if (!matches(state, viewKey)) {
                continue;
            }
            releaseState(session, viewKey, state);
            released = true;
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
    return released;
}
/**
 * @description Widens a pill's view by its avatar extra, after native layout reset it.
 * @param session The running session.
 * @param state The pill.
 */ function fitReactionView(session, state) {
    if (state.extraWidth === 0) return;
    var width = state.baseFrame.width + state.extraWidth;
    var current = frameOf(session.objc, state.view);
    if (!current || Math.abs(current.width - width) < 1) return;
    setFrame(session.objc, state.view, _object_spread_props$3(_object_spread$3({}, current), {
        width: width
    }));
}function count(value) {
    return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}
/**
 * @description Works out how many people reacted and which reaction types to fetch them for.
 * @param reaction The message reaction's counts.
 * @param type The reaction type the pill shows, or `undefined` when it shows both.
 * @returns The reactor count and the types to request.
 */ function reactionAvatarSelection(reaction, type) {
    var _ref, _ref1;
    var _reaction_count_details, _reaction_count_details1;
    var burstCount = count((_ref = (_reaction_count_details = reaction.count_details) === null || _reaction_count_details === void 0 ? void 0 : _reaction_count_details.burst) !== null && _ref !== void 0 ? _ref : reaction.burst_count);
    var normalCount = count((_ref1 = (_reaction_count_details1 = reaction.count_details) === null || _reaction_count_details1 === void 0 ? void 0 : _reaction_count_details1.normal) !== null && _ref1 !== void 0 ? _ref1 : Math.max(0, count(reaction.count) - burstCount));
    if (type === 0) return {
        count: normalCount,
        types: normalCount ? [
            0
        ] : []
    };
    if (type === 1) return {
        count: burstCount,
        types: burstCount ? [
            1
        ] : []
    };
    var types = [];
    if (normalCount) types.push(0);
    if (burstCount) types.push(1);
    return {
        count: normalCount + burstCount,
        types: types
    };
}
/**
 * @description Builds the cache key for one reaction's reactor list.
 * @param channelId The message's channel.
 * @param messageId The message.
 * @param emoji The reaction's emoji.
 * @param types The reaction types the list covers.
 * @returns A key that starts with {@link reactionAvatarPrefix} for the same message.
 */ function reactionAvatarKey(channelId, messageId, emoji, types) {
    var _emoji_id;
    return [
        channelId,
        messageId,
        (_emoji_id = emoji.id) !== null && _emoji_id !== void 0 ? _emoji_id : emoji.name,
        types.join(',')
    ].map(function(part) {
        return encodeURIComponent(part);
    }).join(':');
}
/**
 * @description Builds the prefix every reactor cache key of one message starts with.
 * @param channelId The message's channel.
 * @param messageId The message.
 * @returns The key prefix.
 */ function reactionAvatarPrefix(channelId, messageId) {
    return "".concat(encodeURIComponent(channelId), ":").concat(encodeURIComponent(messageId), ":");
}
/**
 * @description Picks the faces to draw and the count for the `+N` badge.
 * @template T The reactor type.
 * @param users The loaded reactors, in API order.
 * @param totalCount How many people reacted in total.
 * @returns The faces to draw and how many people the badge stands for.
 */ function reactionAvatarStack(users, totalCount) {
    var total = Math.max(0, Math.floor(totalCount));
    var visible = users.slice(0, Math.min(Avatar.limit, total));
    return {
        overflowCount: Math.max(0, total - visible.length),
        users: visible
    };
}
/**
 * @description Counts the slots to reserve before reactors load: one per face plus one for the badge.
 * @param totalCount How many people reacted in total.
 * @returns The slot count.
 */ function reactionAvatarReservedSlotCount(totalCount) {
    var total = Math.max(0, Math.floor(totalCount));
    return Math.min(total, Avatar.limit) + Number(total > Avatar.limit);
}
/**
 * @description Measures the width of an overlapping stack of avatar slots.
 * @param slotCount The number of slots.
 * @returns The width in points.
 */ function reactionAvatarStackWidth(slotCount) {
    return Avatar.size + Math.max(0, slotCount - 1) * Avatar.step;
}
/**
 * @description Lists the left offset of each slot in an avatar stack.
 * @param slotCount The number of slots.
 * @returns One offset per slot.
 */ function reactionAvatarStackPositions(slotCount) {
    return Array.from({
        length: Math.max(0, Math.floor(slotCount))
    }, function(_, index) {
        return index * Avatar.step;
    });
}
/**
 * @description Works out how much wider a reaction pill gets to fit its avatar stack.
 * @param width The avatar stack's width.
 * @param measured Whether there is a stack at all.
 * @returns The extra width in whole points.
 */ function reactionAvatarExtraWidth(width, measured) {
    if (!measured || !Number.isFinite(width) || width <= 0) return 0;
    return Math.max(0, Math.ceil(width + Avatar.trailingPadding - Avatar.leadingInset));
}
/**
 * @description Works out the extra pill width to reserve from the reaction count, before the stack is measured.
 * @param totalCount How many people reacted in total.
 * @returns The extra width in whole points.
 */ function reactionAvatarReservedExtraWidth(totalCount) {
    var width = reactionAvatarStackWidth(reactionAvatarReservedSlotCount(totalCount));
    return reactionAvatarExtraWidth(width, totalCount > 0);
}
/**
 * @description Decides whether a measured stack width replaces the reserved one.
 * @param measured Whether the stack was already measured.
 * @param currentWidth The width in use.
 * @param nextWidth The newly measured width.
 * @returns `true` for the first measurement, unless it would shrink the reserved width.
 */ function shouldMeasureReactionAvatarWidth(measured, currentWidth, nextWidth) {
    return !measured && nextWidth >= currentWidth - 0.5;
}/**
 * @description Identifies one message for layout ownership.
 * @param channelId The message's channel.
 * @param messageId The message.
 * @returns The message's key.
 */ function messageKey(channelId, messageId) {
    return "".concat(channelId, ":").concat(messageId);
}
function reactionEmoji$1(param) {
    var emoji = param.emoji;
    if (typeof emoji === 'string') return emoji ? {
        id: null,
        name: emoji
    } : null;
    var name = emoji.name || emoji.animatedName;
    return name ? {
        id: emoji.id ? String(emoji.id) : null,
        name: name
    } : null;
}
/**
 * @description Describes the reactor list one reaction pill should show.
 * @param channelId The message's channel.
 * @param messageId The message.
 * @param reaction The message reaction the pill renders.
 * @returns The context, or `null` when the reaction has no emoji name or no reactors.
 */ function reactionContext(channelId, messageId, reaction) {
    var emoji = reactionEmoji$1(reaction);
    if (!emoji) return null;
    var selection = reactionAvatarSelection(reaction, reaction.type);
    if (selection.count === 0 || selection.types.length === 0) return null;
    return {
        channelId: channelId,
        emoji: emoji,
        key: reactionAvatarKey(channelId, messageId, emoji, selection.types),
        messageId: messageId,
        reaction: reaction,
        reactionType: reaction.type
    };
}function _array_like_to_array$9(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_with_holes$5(arr) {
    if (Array.isArray(arr)) return arr;
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
function _type_of$3(obj) {
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
    return _async_to_generator$7(function() {
        var direct, handle;
        return _ts_generator$7(this, function(_state) {
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
    return _async_to_generator$7(function() {
        var channelId, channel;
        return _ts_generator$7(this, function(_state) {
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
    return _async_to_generator$7(function() {
        var fallbackChannelId, _ref, viewModel, _ref1, message, id, messageId, channelId, currentViewModel, _tmp;
        return _ts_generator$7(this, function(_state) {
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
                    _ref1 = _sliced_to_array$5.apply(void 0, [
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
}function _array_like_to_array$8(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_with_holes$4(arr) {
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
    return _array_with_holes$4(arr) || _iterable_to_array_limit$4(arr, i) || _unsupported_iterable_to_array$8(arr, i) || _non_iterable_rest$4();
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
function _type_of$2(obj) {
    "@swc/helpers - typeof";
    return obj && typeof Symbol !== "undefined" && obj.constructor === Symbol ? "symbol" : typeof obj;
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
 * @description Finds a message cell's reaction list, its collection view and that collection's layout.
 * @param objc The Objective-C bridge.
 * @param cell The `DCDMessageTableViewCell`.
 * @returns The views, or `undefined` when the message shows no reactions.
 */ function readReactionCellViews(objc, cell) {
    return _async_to_generator$6(function() {
        var _ref, list, _ref1, collection, _ref2, layout, visibleCells;
        return _ts_generator$6(this, function(_state) {
            switch(_state.label){
                case 0:
                    return [
                        4,
                        objc.findViews(cell, 'DCDReactionListView', {
                            maxDepth: 8,
                            maxVisited: 70,
                            maxResults: 1,
                            stopAtMatch: true
                        })
                    ];
                case 1:
                    _ref = _sliced_to_array$4.apply(void 0, [
                        _state.sent(),
                        1
                    ]), list = _ref[0];
                    if (!list) return [
                        2
                    ];
                    return [
                        4,
                        objc.findViews(list, 'UICollectionView', {
                            maxDepth: 3,
                            maxVisited: 100,
                            maxResults: 1,
                            stopAtMatch: true
                        })
                    ];
                case 2:
                    _ref1 = _sliced_to_array$4.apply(void 0, [
                        _state.sent(),
                        1
                    ]), collection = _ref1[0];
                    if (!collection) return [
                        2
                    ];
                    return [
                        4,
                        objc.batch([
                            {
                                target: collection,
                                selector: 'collectionViewLayout',
                                args: []
                            },
                            {
                                target: collection,
                                selector: 'visibleCells',
                                args: []
                            }
                        ])
                    ];
                case 3:
                    _ref2 = _sliced_to_array$4.apply(void 0, [
                        _state.sent(),
                        2
                    ]), layout = _ref2[0], visibleCells = _ref2[1];
                    if (!layout || (typeof layout === "undefined" ? "undefined" : _type_of$2(layout)) !== 'object') return [
                        2
                    ];
                    return [
                        2,
                        {
                            collection: collection,
                            layout: layout,
                            list: list,
                            visibleCells: visibleCells
                        }
                    ];
            }
        });
    })();
}/**
 * @description Reads the channel the user is looking at.
 * @returns The selected channel, else the last selected one, else `undefined`.
 */ function selectedChannelId() {
    return SelectedChannelStore.getChannelId() || SelectedChannelStore.getLastSelectedChannelId() || undefined;
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
function readCell(session, cell) {
    return _async_to_generator$5(function() {
        var objc, viewModel, message, info, views, _tmp, current, _tmp1;
        return _ts_generator$5(this, function(_state) {
            switch(_state.label){
                case 0:
                    objc = session.objc;
                    viewModel = objc.getIvar(cell, 'viewModel');
                    return [
                        4,
                        readNativeMessageInfo(cell, objc, selectedChannelId)
                    ];
                case 1:
                    message = _state.sent();
                    info = (message === null || message === void 0 ? void 0 : message.channelId) ? {
                        channelId: message.channelId,
                        messageId: message.messageId
                    } : undefined;
                    if (!info) return [
                        3,
                        3
                    ];
                    return [
                        4,
                        readReactionCellViews(objc, cell)
                    ];
                case 2:
                    _tmp = _state.sent();
                    return [
                        3,
                        4
                    ];
                case 3:
                    _tmp = undefined;
                    _state.label = 4;
                case 4:
                    views = _tmp;
                    if (!(info && viewModel)) return [
                        3,
                        7
                    ];
                    current = objc.getIvar(cell, 'viewModel');
                    _tmp1 = !current;
                    if (_tmp1) return [
                        3,
                        6
                    ];
                    return [
                        4,
                        objc.invokeAsync(viewModel, 'isEqual:', [
                            current
                        ])
                    ];
                case 5:
                    _tmp1 = !_state.sent();
                    _state.label = 6;
                case 6:
                    if (_tmp1) return [
                        2
                    ];
                    _state.label = 7;
                case 7:
                    return [
                        2,
                        {
                            info: info,
                            views: views
                        }
                    ];
            }
        });
    })();
}
/**
 * @description Renders a message cell's avatars on the next tick, at most every 250ms unless forced.
 * @param session The running session.
 * @param cell The `DCDMessageTableViewCell`.
 * @param force Render even if the cell rendered moments ago.
 */ function scheduleCell(session, cell) {
    var force = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : false;
    var _lastRenders_get;
    var cells = session.cells, forcedCells = session.forcedCells, lastRenders = session.lastRenders, scheduledCells = session.scheduledCells, signal = session.signal;
    var cellKey = key(session.objc, cell);
    cells.set(cellKey, cell);
    if (!force && Date.now() - ((_lastRenders_get = lastRenders.get(cellKey)) !== null && _lastRenders_get !== void 0 ? _lastRenders_get : 0) < 250) return;
    if (scheduledCells.has(cellKey)) {
        if (force) forcedCells.add(cellKey);
        return;
    }
    scheduledCells.add(cellKey);
    setTimeout(function() {
        if (signal.aborted) {
            scheduledCells.delete(cellKey);
            return;
        }
        void readCell(session, cell).then(function(result) {
            if (!result || signal.aborted || !cells.has(cellKey)) return;
            lastRenders.set(cellKey, Date.now());
            session.render(session, cell, result.info, result.views);
        }).catch(function() {
            return undefined;
        }).finally(function() {
            if (signal.aborted) return;
            scheduledCells.delete(cellKey);
            if (forcedCells.delete(cellKey)) rescheduleCell(session, cellKey);
        });
    }, 0);
}
/**
 * @description Renders a message cell seen earlier again, now.
 * @param session The running session.
 * @param cellKey The cell's key.
 */ function rescheduleCell(session, cellKey) {
    var cell = session.cells.get(cellKey);
    if (cell) scheduleCell(session, cell, true);
}
/**
 * @description Forgets a message cell, so it renders fresh next time.
 * @param session The running session.
 * @param cellKey The cell's key.
 */ function forgetCell(session, cellKey) {
    session.cells.delete(cellKey);
    session.lastRenders.delete(cellKey);
}
/**
 * @description Forgets every message cell seen so far.
 * @param session The running session.
 */ function forgetCells(session) {
    session.cells.clear();
    session.lastRenders.clear();
}function _array_like_to_array$7(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_with_holes$3(arr) {
    if (Array.isArray(arr)) return arr;
}
function _array_without_holes$6(arr) {
    if (Array.isArray(arr)) return _array_like_to_array$7(arr);
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
function _iterable_to_array$6(iter) {
    if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) {
        return Array.from(iter);
    }
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
function _non_iterable_spread$6() {
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
function _sliced_to_array$3(arr, i) {
    return _array_with_holes$3(arr) || _iterable_to_array_limit$3(arr, i) || _unsupported_iterable_to_array$7(arr, i) || _non_iterable_rest$3();
}
function _to_consumable_array$6(arr) {
    return _array_without_holes$6(arr) || _iterable_to_array$6(arr) || _unsupported_iterable_to_array$7(arr) || _non_iterable_spread$6();
}
function _unsupported_iterable_to_array$7(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _array_like_to_array$7(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(n);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _array_like_to_array$7(o, minLen);
}
function captureAncestorFrames(session, list) {
    var objc = session.objc;
    var frames = [];
    var current = list;
    while(current && frames.length < 8){
        var _objc_className;
        var className = (_objc_className = objc.className(current)) !== null && _objc_className !== void 0 ? _objc_className : '';
        if (className.includes(NativeClass.messageCell) || className.includes(NativeClass.table)) {
            break;
        }
        var frame = frameOf(objc, current);
        if (frame) frames.push({
            frame: frame,
            view: current
        });
        if (className.includes('UITableViewCellContentView')) break;
        current = safeInvoke(objc, current, 'superview');
    }
    return frames;
}
function markChanged(session, entry) {
    entry.appliedCells.clear();
    entry.plan = null;
    entry.revision++;
    markTableDirty(session, entry.ownerTableKey);
}
function setAncestorFrames(session, entry, delta) {
    var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
    try {
        for(var _iterator = entry.ancestorFrames[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
            var _step_value = _step.value, frame = _step_value.frame, view = _step_value.view;
            setFrame(session.objc, view, _object_spread_props$2(_object_spread$2({}, frame), {
                height: frame.height + delta
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
function planLayout(session, entry) {
    var _Math, _Math1;
    var _readRect, _entry_plan;
    var width = (_readRect = readRect(safeInvoke(session.objc, entry.collection, 'bounds'))) === null || _readRect === void 0 ? void 0 : _readRect.width;
    if (width === undefined || width <= 0 || entry.baseItems.size < entry.itemCount) return;
    if (((_entry_plan = entry.plan) === null || _entry_plan === void 0 ? void 0 : _entry_plan.revision) === entry.revision && entry.plan.width === width) return entry.plan;
    var items = _to_consumable_array$6(entry.baseItems.values()).map(function(item) {
        var _entry_extraWidths_get;
        return _object_spread_props$2(_object_spread$2({}, item), {
            extraWidth: (_entry_extraWidths_get = entry.extraWidths.get(item.index)) !== null && _entry_extraWidths_get !== void 0 ? _entry_extraWidths_get : 0
        });
    });
    var frames = reflowReactionItems(items, width);
    if (frames.length === 0) return;
    entry.plan = {
        baseHeight: (_Math = Math).max.apply(_Math, _to_consumable_array$6(items.map(function(item) {
            return item.y + item.height;
        }))),
        frames: new Map(frames.map(function(frame) {
            return [
                frame.index,
                frame
            ];
        })),
        height: (_Math1 = Math).max.apply(_Math1, _to_consumable_array$6(frames.map(function(frame) {
            return frame.y + frame.height;
        }))),
        revision: entry.revision,
        width: width
    };
    return entry.plan;
}
function restoreLayout(session, entry) {
    var _Math;
    var _entry_plan;
    var objc = session.objc;
    clearCellHeight(session, entry);
    setAncestorFrames(session, entry, 0);
    var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
    try {
        for(var _iterator = toHandles(objc, safeInvoke(objc, entry.collection, 'visibleCells'))[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
            var cell = _step.value;
            var index = itemOfCell(objc, entry.collection, cell);
            var frame = index === undefined ? undefined : entry.baseItems.get(index);
            if (frame) setFrame(objc, cell, frame);
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
    var baseItems = _to_consumable_array$6(entry.baseItems.values());
    var baseHeight = baseItems.length ? (_Math = Math).max.apply(_Math, _to_consumable_array$6(baseItems.map(function(item) {
        return item.y + item.height;
    }))) : (_entry_plan = entry.plan) === null || _entry_plan === void 0 ? void 0 : _entry_plan.baseHeight;
    if (baseHeight !== undefined) {
        var _ref, _size_width;
        var size = readSize(safeInvoke(objc, entry.collection, 'contentSize'));
        var frame1 = frameOf(objc, entry.collection);
        setContentSize(objc, entry.collection, {
            height: baseHeight,
            width: (_ref = (_size_width = size.width) !== null && _size_width !== void 0 ? _size_width : frame1 === null || frame1 === void 0 ? void 0 : frame1.width) !== null && _ref !== void 0 ? _ref : 0
        });
        if (frame1) setFrame(objc, entry.collection, _object_spread_props$2(_object_spread$2({}, frame1), {
            height: baseHeight
        }));
    }
    var table = markTableDirty(session, entry.ownerTableKey);
    if (table) scheduleTableLayout(session, table);
}
/**
 * @description Gets the layout of a message's reaction collection, resetting it when the view now shows another message.
 * @param session The running session.
 * @param layout The collection's `UICollectionViewLayout`.
 * @param collection The `UICollectionView`.
 * @param list The `DCDReactionListView` holding it.
 * @param ownerMessageKey The message the collection shows.
 * @returns The collection's layout entry.
 */ function layoutEntry(session, layout, collection, list, ownerMessageKey) {
    var objc = session.objc;
    var layoutKey = key(objc, collection);
    var count = itemCount(objc, collection);
    var ownerCell = ancestorOfClass(objc, list, NativeClass.messageCell);
    var ownerTable = ancestorOfClass(objc, list, NativeClass.table);
    var ownerCellKey = ownerCell ? key(objc, ownerCell) : '';
    var ownerTableKey = ownerTable ? key(objc, ownerTable) : '';
    var existing = session.layouts.get(layoutKey);
    if (!existing) {
        var entry = {
            ancestorFrames: captureAncestorFrames(session, list),
            appliedCells: new Map(),
            appliedRevision: -1,
            appliedWidth: -1,
            baseItems: new Map(),
            collection: collection,
            extraWidths: new Map(),
            invalidationScheduled: false,
            itemCount: count,
            layout: layout,
            list: list,
            ownerCell: ownerCell,
            ownerCellKey: ownerCellKey,
            ownerMessageKey: ownerMessageKey,
            ownerTableKey: ownerTableKey,
            plan: null,
            revision: 0
        };
        session.layouts.set(layoutKey, entry);
        return entry;
    }
    // UIKit reuses the collection for another message; drop everything measured for the old one.
    if (existing.ownerMessageKey !== ownerMessageKey || existing.itemCount !== count || existing.ownerCellKey !== ownerCellKey) {
        var released = releaseStates(session, function(state) {
            return state.layoutKey === layoutKey;
        });
        if (released) invalidateLayout(session, layoutKey);
        restoreLayout(session, existing);
        existing.baseItems.clear();
        existing.appliedCells.clear();
        existing.extraWidths.clear();
        existing.itemCount = count;
        existing.ancestorFrames = captureAncestorFrames(session, list);
        existing.ownerMessageKey = ownerMessageKey;
        existing.plan = null;
        existing.revision++;
    }
    existing.collection = collection;
    existing.layout = layout;
    existing.list = list;
    existing.ownerCell = ownerCell;
    existing.ownerCellKey = ownerCellKey;
    existing.ownerTableKey = ownerTableKey;
    return existing;
}
/**
 * @description Records a pill's frame as Discord laid it out, if it changed.
 * @param session The running session.
 * @param entry The collection's layout.
 * @param index The pill's item index.
 * @param frame Its frame, or `undefined` when it could not be read.
 */ function captureLayoutItem(session, entry, index, frame) {
    if (!frame) return;
    var previous = entry.baseItems.get(index);
    if ((previous === null || previous === void 0 ? void 0 : previous.x) === frame.x && previous.y === frame.y && previous.width === frame.width && previous.height === frame.height) {
        return;
    }
    entry.baseItems.set(index, {
        height: frame.height,
        index: index,
        width: frame.width,
        x: frame.x,
        y: frame.y
    });
    markChanged(session, entry);
}
/**
 * @description Reads every pill's frame from the collection layout, including pills scrolled out of view.
 * @param session The running session.
 * @param entry The collection's layout.
 */ function captureLayoutItems(session, entry) {
    if (entry.baseItems.size >= entry.itemCount) return;
    var objc = session.objc;
    var indexPathClass = objc.getClass('NSIndexPath');
    if (!indexPathClass) return;
    for(var section = 0, sections = sectionCount(objc, entry.collection); section < sections; section++){
        for(var item = 0, count = sectionItemCount(objc, entry.collection, section); item < count; item++){
            var indexPath = safeInvoke(objc, indexPathClass, 'indexPathForItem:inSection:', item, section);
            if (!indexPath) {
                continue;
            }
            var attributes = safeInvoke(objc, entry.layout, 'layoutAttributesForItemAtIndexPath:', indexPath);
            if (!attributes) {
                continue;
            }
            captureLayoutItem(session, entry, item, readRect(safeInvoke(objc, attributes, 'frame')));
        }
    }
}
/**
 * @description Reads a pill's width as Discord laid it out.
 * @param session The running session.
 * @param layoutKey The collection's key.
 * @param index The pill's item index.
 * @returns The width, or `undefined` before it was captured.
 */ function baseItemWidth(session, layoutKey, index) {
    var _session_layouts_get_baseItems_get, _session_layouts_get;
    return (_session_layouts_get = session.layouts.get(layoutKey)) === null || _session_layouts_get === void 0 ? void 0 : (_session_layouts_get_baseItems_get = _session_layouts_get.baseItems.get(index)) === null || _session_layouts_get_baseItems_get === void 0 ? void 0 : _session_layouts_get_baseItems_get.width;
}
/**
 * @description Sets how much wider a pill is for its avatar stack.
 * @param session The running session.
 * @param layoutKey The collection's key.
 * @param index The pill's item index.
 * @param width The extra width, `0` for none.
 */ function setExtraWidth(session, layoutKey, index, width) {
    var _entry_extraWidths_get;
    var entry = session.layouts.get(layoutKey);
    if (!entry) return;
    if (Math.abs(((_entry_extraWidths_get = entry.extraWidths.get(index)) !== null && _entry_extraWidths_get !== void 0 ? _entry_extraWidths_get : 0) - width) < 1) return;
    if (width > 0) entry.extraWidths.set(index, width);
    else entry.extraWidths.delete(index);
    markChanged(session, entry);
}
/**
 * @description Asks UIKit to lay the collection out again on the next tick, then re-renders its message cell.
 * @param session The running session.
 * @param layoutKey The collection's key.
 */ function invalidateLayout(session, layoutKey) {
    var layouts = session.layouts, objc = session.objc, signal = session.signal;
    var entry = layouts.get(layoutKey);
    if (!entry || entry.invalidationScheduled) return;
    entry.invalidationScheduled = true;
    setTimeout(function() {
        if (signal.aborted || layouts.get(layoutKey) !== entry) {
            entry.invalidationScheduled = false;
            return;
        }
        try {
            void objc.batch([
                {
                    target: entry.layout,
                    selector: 'invalidateLayout',
                    args: []
                },
                {
                    target: entry.collection,
                    selector: 'setNeedsLayout',
                    args: []
                },
                {
                    target: entry.list,
                    selector: 'invalidateIntrinsicContentSize',
                    args: []
                },
                {
                    target: entry.list,
                    selector: 'setNeedsLayout',
                    args: []
                }
            ]).then(function() {
                entry.invalidationScheduled = false;
                if (signal.aborted || layouts.get(layoutKey) !== entry || !entry.ownerCell) {
                    return;
                }
                scheduleCell(session, entry.ownerCell, true);
                var table = ancestorOfClass(objc, entry.ownerCell, NativeClass.table);
                if (table) scheduleTableLayout(session, tableLayout(session, table));
            }, function() {
                entry.invalidationScheduled = false;
            });
        } catch (unused) {
            entry.invalidationScheduled = false;
        }
    }, 0);
}
/**
 * @description Re-measures a message's reaction pills shortly after its reactions changed.
 * @param session The running session.
 * @param messageId The message.
 * @param channelId Its channel, when the event carried one.
 */ function scheduleLayoutRefresh(session, messageId, channelId) {
    var layoutRefreshes = session.layoutRefreshes, objc = session.objc, signal = session.signal;
    var refreshKey = "".concat(channelId !== null && channelId !== void 0 ? channelId : '*', ":").concat(messageId);
    clearTimeout(layoutRefreshes.get(refreshKey));
    layoutRefreshes.set(refreshKey, setTimeout(function() {
        layoutRefreshes.delete(refreshKey);
        if (signal.aborted) return;
        var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
        try {
            for(var _iterator = session.layouts.values()[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                var entry = _step.value;
                var owned = channelId ? entry.ownerMessageKey === messageKey(channelId, messageId) : entry.ownerMessageKey.endsWith(":".concat(messageId));
                if (!owned) {
                    continue;
                }
                restoreLayout(session, entry);
                entry.itemCount = itemCount(objc, entry.collection);
                entry.baseItems.clear();
                entry.appliedCells.clear();
                entry.appliedRevision = -1;
                entry.appliedWidth = -1;
                entry.plan = null;
                entry.revision++;
                safeInvoke(objc, entry.layout, 'invalidateLayout');
                safeInvoke(objc, entry.collection, 'layoutIfNeeded');
                if (entry.ownerCell) scheduleCell(session, entry.ownerCell, true);
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
    }, 100));
}
/**
 * @description Cancels every pending layout refresh.
 * @param session The running session.
 */ function cancelLayoutRefreshes(session) {
    var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
    try {
        for(var _iterator = session.layoutRefreshes.values()[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
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
    session.layoutRefreshes.clear();
}
/**
 * @description Re-measures the message table's rows after each of its layout passes, while a layout is stale.
 * @param session The running session.
 * @param entry The collection's layout.
 */ function hookOwnerTable(session, entry) {
    var table = entry.ownerCell && ancestorOfClass(session.objc, entry.ownerCell, NativeClass.table);
    if (table) hookTableLayout(session, table);
}
/**
 * @description Applies the reflowed layout: pill frames, collection height, ancestor heights and the cell's height.
 * @param session The running session.
 * @param entry The collection's layout.
 */ function applyLayout(session, entry) {
    var _size_height, _ref;
    var _entry_ancestorFrames_;
    var objc = session.objc;
    if (entry.extraWidths.size === 0) {
        if (entry.appliedRevision >= 0) restoreLayout(session, entry);
        else setAncestorFrames(session, entry, 0);
        entry.appliedCells.clear();
        entry.appliedRevision = -1;
        entry.appliedWidth = -1;
        flushTableLayout(session, entry.ownerTableKey);
        return;
    }
    captureLayoutItems(session, entry);
    var plan = planLayout(session, entry);
    if (!plan) return;
    var planChanged = entry.appliedRevision !== plan.revision || Math.abs(entry.appliedWidth - plan.width) >= 0.5;
    if (planChanged) markTableDirty(session, entry.ownerTableKey);
    if (updateCellHeight(session, entry)) markTableDirty(session, entry.ownerTableKey);
    var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
    try {
        for(var _iterator = toHandles(objc, safeInvoke(objc, entry.collection, 'visibleCells'))[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
            var cell = _step.value;
            var index = itemOfCell(objc, entry.collection, cell);
            var frame = index === undefined ? undefined : plan.frames.get(index);
            if (index === undefined || !frame) {
                continue;
            }
            var cellKey = key(objc, cell);
            var applied = entry.appliedCells.get(cellKey);
            if (!framesMatch(frameOf(objc, cell), frame) || !applied || applied.index !== index || applied.revision !== plan.revision) {
                setFrame(objc, cell, frame);
                entry.appliedCells.set(cellKey, {
                    index: index,
                    revision: plan.revision
                });
            }
            var reactionView = reactionViewOf(objc, cell);
            var state = reactionView ? session.reactions.get(key(objc, reactionView)) : undefined;
            if (state) fitReactionView(session, state);
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
    var size = readSize(safeInvoke(objc, entry.collection, 'contentSize'));
    var frame1 = frameOf(objc, entry.collection);
    var contentHeight = (_size_height = size.height) !== null && _size_height !== void 0 ? _size_height : 0;
    var frameHeight = (_ref = frame1 === null || frame1 === void 0 ? void 0 : frame1.height) !== null && _ref !== void 0 ? _ref : 0;
    var contentChanged = Math.abs(contentHeight - plan.height) >= 1;
    var frameChanged = Math.abs(frameHeight - plan.height) >= 1;
    if (contentChanged) {
        var _size_width;
        setContentSize(objc, entry.collection, {
            height: plan.height,
            width: (_size_width = size.width) !== null && _size_width !== void 0 ? _size_width : plan.width
        });
    }
    if (planChanged && (contentChanged || frameChanged)) {
        safeInvoke(objc, entry.collection, 'invalidateIntrinsicContentSize');
        safeInvoke(objc, entry.list, 'invalidateIntrinsicContentSize');
        safeInvoke(objc, entry.list, 'setNeedsLayout');
    }
    if (frameChanged) {
        var _ref1, _ref2, _ref3;
        setFrame(objc, entry.collection, {
            height: plan.height,
            width: (_ref1 = frame1 === null || frame1 === void 0 ? void 0 : frame1.width) !== null && _ref1 !== void 0 ? _ref1 : plan.width,
            x: (_ref2 = frame1 === null || frame1 === void 0 ? void 0 : frame1.x) !== null && _ref2 !== void 0 ? _ref2 : 0,
            y: (_ref3 = frame1 === null || frame1 === void 0 ? void 0 : frame1.y) !== null && _ref3 !== void 0 ? _ref3 : 0
        });
    }
    var baselineHeight = (_entry_ancestorFrames_ = entry.ancestorFrames[0]) === null || _entry_ancestorFrames_ === void 0 ? void 0 : _entry_ancestorFrames_.frame.height;
    if (baselineHeight !== undefined) {
        setAncestorFrames(session, entry, Math.max(0, plan.height - baselineHeight));
    }
    if (planChanged) {
        entry.appliedRevision = plan.revision;
        entry.appliedWidth = plan.width;
    }
    flushTableLayout(session, entry.ownerTableKey);
}
/**
 * @description Restores and forgets the reaction layouts inside one message cell.
 * @param session The running session.
 * @param cellKey The message cell's key.
 */ function restoreCellLayouts(session, cellKey) {
    var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
    try {
        for(var _iterator = session.layouts[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
            var _step_value = _sliced_to_array$3(_step.value, 2), layoutKey = _step_value[0], entry = _step_value[1];
            if (entry.ownerCellKey !== cellKey) {
                continue;
            }
            restoreLayout(session, entry);
            session.layouts.delete(layoutKey);
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
 * @description Restores and forgets every reaction layout.
 * @param session The running session.
 */ function restoreAllLayouts(session) {
    var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
    try {
        for(var _iterator = session.layouts.values()[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
            var entry = _step.value;
            restoreLayout(session, entry);
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
    session.layouts.clear();
}
/**
 * @description Restores every table's reaction layouts and row heights, then forgets all layout state.
 * @param session The running session.
 */ function disposeLayouts(session) {
    restoreTables(session, function(tableKey) {
        var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
        try {
            for(var _iterator = session.layouts.values()[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                var entry = _step.value;
                if (entry.ownerTableKey === tableKey) restoreLayout(session, entry);
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
    clearCellHeights(session);
    cancelLayoutRefreshes(session);
    session.layouts.clear();
}function _array_like_to_array$6(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_without_holes$5(arr) {
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
function _iterable_to_array$5(iter) {
    if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) {
        return Array.from(iter);
    }
}
function _non_iterable_spread$5() {
    throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _to_consumable_array$5(arr) {
    return _array_without_holes$5(arr) || _iterable_to_array$5(arr) || _unsupported_iterable_to_array$6(arr) || _non_iterable_spread$5();
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
 * @description Fetches the first reactors of a reaction, across its reaction types, and shares them with Discord's stores.
 * @param context The reaction to fetch for.
 * @returns Up to `Avatar.limit` distinct reactors, in API order.
 */ function fetchReactors(context) {
    return _async_to_generator$4(function() {
        var types, users, _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, type, remaining, _ref, result, _iteratorNormalCompletion1, _didIteratorError1, _iteratorError1, _iterator1, _step1, user, error, err;
        return _ts_generator$4(this, function(_state) {
            switch(_state.label){
                case 0:
                    types = reactionAvatarSelection(context.reaction, context.reactionType).types;
                    users = new Map();
                    _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
                    _state.label = 1;
                case 1:
                    _state.trys.push([
                        1,
                        8,
                        9,
                        10
                    ]);
                    _iterator = types[Symbol.iterator]();
                    _state.label = 2;
                case 2:
                    if (!!(_iteratorNormalCompletion = (_step = _iterator.next()).done)) return [
                        3,
                        7
                    ];
                    type = _step.value;
                    remaining = Avatar.limit - users.size;
                    if (remaining <= 0) return [
                        3,
                        7
                    ];
                    _state.label = 3;
                case 3:
                    _state.trys.push([
                        3,
                        5,
                        ,
                        6
                    ]);
                    return [
                        4,
                        ReactionActions.getReactors({
                            channelId: context.channelId,
                            emoji: context.emoji,
                            limit: remaining,
                            messageId: context.messageId,
                            type: type
                        })
                    ];
                case 4:
                    result = ((_ref = _state.sent()) !== null && _ref !== void 0 ? _ref : []).slice(0, remaining);
                    window.unbound.metro.common.Dispatcher.dispatch({
                        type: 'MESSAGE_REACTION_ADD_USERS',
                        channelId: context.channelId,
                        emoji: context.emoji,
                        messageId: context.messageId,
                        reactionType: type,
                        users: result
                    });
                    _iteratorNormalCompletion1 = true, _didIteratorError1 = false, _iteratorError1 = undefined;
                    try {
                        for(_iterator1 = result[Symbol.iterator](); !(_iteratorNormalCompletion1 = (_step1 = _iterator1.next()).done); _iteratorNormalCompletion1 = true){
                            user = _step1.value;
                            // The API can answer with `null` for a deleted user.
                            if (!(user === null || user === void 0 ? void 0 : user.id) || users.has(user.id)) {
                                continue;
                            }
                            users.set(user.id, user);
                            window.unbound.metro.common.Dispatcher.dispatch({
                                type: 'USER_UPDATE',
                                user: user
                            });
                            if (users.size >= Avatar.limit) break;
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
                    return [
                        3,
                        6
                    ];
                case 5:
                    error = _state.sent();
                    console.error('[Reaction Avatars] Failed to fetch reactors:', error);
                    return [
                        3,
                        6
                    ];
                case 6:
                    _iteratorNormalCompletion = true;
                    return [
                        3,
                        2
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
                        _to_consumable_array$5(users.values())
                    ];
            }
        });
    })();
}function _array_like_to_array$5(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_without_holes$4(arr) {
    if (Array.isArray(arr)) return _array_like_to_array$5(arr);
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
function _iterable_to_array$4(iter) {
    if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) {
        return Array.from(iter);
    }
}
function _non_iterable_spread$4() {
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
function _to_consumable_array$4(arr) {
    return _array_without_holes$4(arr) || _iterable_to_array$4(arr) || _unsupported_iterable_to_array$5(arr) || _non_iterable_spread$4();
}
function _unsupported_iterable_to_array$5(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _array_like_to_array$5(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(n);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _array_like_to_array$5(o, minLen);
}
function renderSurface(session, state) {
    var _ChannelStore_getChannel;
    surfaceStates.set(state.surfaceId, {
        guildId: (_ChannelStore_getChannel = ChannelStore.getChannel(state.context.channelId)) === null || _ChannelStore_getChannel === void 0 ? void 0 : _ChannelStore_getChannel.guild_id,
        height: state.baseFrame.height || SURFACE_HEIGHT,
        measured: state.widthMeasured,
        onWidth: function onWidth(width) {
            return updateAvatarWidth(session, state, width);
        },
        totalCount: state.totalCount,
        users: state.users,
        width: state.avatarWidth
    });
}
function updateSurfaceFrame(session, state) {
    var _state_surfaceFrame;
    if (!state.surface) return;
    var position = reactionAvatarFrame(state.baseFrame, state.avatarWidth || 120, Avatar.leadingInset);
    var frame = {
        height: state.baseFrame.height || SURFACE_HEIGHT,
        width: position.width,
        x: position.x,
        y: state.baseFrame.y
    };
    if (framesMatch((_state_surfaceFrame = state.surfaceFrame) !== null && _state_surfaceFrame !== void 0 ? _state_surfaceFrame : undefined, frame)) return;
    try {
        session.fabric.setFrame(state.surface, frame);
        state.surfaceFrame = frame;
    } catch (unused) {
    // The surface keeps its last frame until the next render moves it.
    }
}
function reserveWidth(state) {
    state.avatarWidth = reactionAvatarStackWidth(reactionAvatarReservedSlotCount(state.totalCount));
    state.extraWidth = reactionAvatarReservedExtraWidth(state.totalCount);
    state.widthMeasured = false;
}
function updateAvatarWidth(session, state, width) {
    if (!Number.isFinite(width) || width <= 0) return;
    if (!shouldMeasureReactionAvatarWidth(state.widthMeasured, state.avatarWidth, width)) return;
    var firstMeasurement = !state.widthMeasured;
    var widthChanged = Math.abs(width - state.avatarWidth) >= 1;
    var extraWidth = reactionAvatarExtraWidth(width, true);
    var extraWidthChanged = Math.abs(extraWidth - state.extraWidth) >= 1;
    state.widthMeasured = true;
    state.avatarWidth = width;
    state.extraWidth = extraWidth;
    if (extraWidthChanged) setExtraWidth(session, state.layoutKey, state.itemIndex, extraWidth);
    if (!firstMeasurement && !widthChanged && !extraWidthChanged) return;
    state.revision++;
    renderSurface(session, state);
    if (state.surface) {
        try {
            session.fabric.update(state.surface, {
                revision: state.revision,
                surfaceId: state.surfaceId
            });
        } catch (unused) {
            return;
        }
    }
    if (extraWidthChanged) invalidateLayout(session, state.layoutKey);
}
function removeSurface(session, state) {
    unmountSurface(session, state);
    state.avatarWidth = 0;
    state.extraWidth = 0;
    state.widthMeasured = false;
    setExtraWidth(session, state.layoutKey, state.itemIndex, 0);
    invalidateLayout(session, state.layoutKey);
}
function createSurface(session, state) {
    if (state.surface || state.users.length === 0) return;
    renderSurface(session, state);
    try {
        state.surface = session.fabric.mount(state.collectionCell, session.surfaceName, {
            revision: state.revision,
            surfaceId: state.surfaceId
        });
    } catch (unused) {
        state.surface = null;
        return;
    }
    updateSurfaceFrame(session, state);
}
function updateSurface(session, state) {
    if (state.users.length === 0) {
        removeSurface(session, state);
        return;
    }
    state.revision++;
    renderSurface(session, state);
    if (!state.surface) {
        createSurface(session, state);
    } else {
        try {
            session.fabric.update(state.surface, {
                revision: state.revision,
                surfaceId: state.surfaceId
            });
        } catch (unused) {
            removeSurface(session, state);
            return;
        }
    }
    updateSurfaceFrame(session, state);
}
function isTracked(session, state) {
    return session.reactions.get(key(session.objc, state.view)) === state;
}
// Discord sometimes answers with no reactors right after a reaction lands, so an empty result retries twice.
function scheduleEmptyRetry(session, state) {
    if (state.totalCount <= 0 || state.retryTimer || state.retryCount >= 2) return;
    state.retryCount++;
    state.retryTimer = setTimeout(function() {
        state.retryTimer = null;
        if (session.signal.aborted || !isTracked(session, state) || state.users.length > 0 || state.loading) {
            return;
        }
        session.reactors.invalidate(state.context.key);
        loadReactors(session, state);
    }, 1000);
}
function loadReactors(session, state) {
    if (state.loading) return;
    state.loading = true;
    var requestKey = state.context.key;
    var requestGeneration = state.requestGeneration;
    function isCurrent() {
        return !session.signal.aborted && isTracked(session, state) && requestKey === state.context.key && requestGeneration === state.requestGeneration;
    }
    void session.reactors.load(requestKey, function() {
        return fetchReactors(state.context);
    }).then(function(reactors) {
        if (!isCurrent()) return;
        state.loading = false;
        state.users = reactors;
        updateSurface(session, state);
        if (reactors.length === 0) {
            scheduleEmptyRetry(session, state);
            return;
        }
        if (state.retryTimer) clearTimeout(state.retryTimer);
        state.retryTimer = null;
        state.retryCount = 0;
    }).catch(function() {
        if (!isCurrent()) return;
        state.loading = false;
        scheduleEmptyRetry(session, state);
    });
}
function createState(session, target, context) {
    var fabric = session.fabric;
    var measured = fabric.measure(target.view);
    var layoutWidth = baseItemWidth(session, target.layoutKey, target.itemIndex);
    var baseFrame = _object_spread_props$1(_object_spread$1({}, measured), {
        width: layoutWidth === undefined ? measured.width : reactionBaseViewWidth(layoutWidth, fabric.measure(target.collectionCell).width, measured.width)
    });
    var state = _object_spread_props$1(_object_spread$1({}, target), {
        avatarWidth: 0,
        baseFrame: baseFrame,
        context: context,
        extraWidth: 0,
        loading: false,
        requestGeneration: 0,
        retryCount: 0,
        retryTimer: null,
        revision: 0,
        surface: null,
        surfaceFrame: null,
        surfaceId: "".concat(target.cellKey, ":").concat(context.key),
        totalCount: reactionAvatarSelection(context.reaction, context.reactionType).count,
        users: [],
        widthMeasured: false
    });
    reserveWidth(state);
    return state;
}
/**
 * @description Stops showing avatars on a pill and gives its layout space back.
 * @param session The running session.
 * @param viewKey The pill's key.
 * @param state The pill.
 */ function disposeState(session, viewKey, state) {
    releaseState(session, viewKey, state);
    setExtraWidth(session, state.layoutKey, state.itemIndex, 0);
    invalidateLayout(session, state.layoutKey);
}
/**
 * @description Brings a pill's avatars in line with the reaction it now shows.
 * @param session The running session.
 * @param target The pill's views and position.
 * @param context The reaction, or `null` to stop showing avatars on the pill.
 */ function syncReactionView(session, target, context) {
    var objc = session.objc, reactions = session.reactions, reactors = session.reactors;
    var viewKey = key(objc, target.view);
    var existing = reactions.get(viewKey);
    if (!context) {
        if (existing) disposeState(session, viewKey, existing);
        return;
    }
    if ((existing === null || existing === void 0 ? void 0 : existing.context.key) !== context.key || existing.cellKey !== target.cellKey || key(objc, existing.collectionCell) !== key(objc, target.collectionCell)) {
        if (existing) disposeState(session, viewKey, existing);
        var state = createState(session, target, context);
        reactions.set(viewKey, state);
        setExtraWidth(session, state.layoutKey, state.itemIndex, state.extraWidth);
        var cached = reactors.get(context.key);
        if (cached === undefined) {
            loadReactors(session, state);
            return;
        }
        state.users = cached;
        updateSurface(session, state);
        if (cached.length === 0) scheduleEmptyRetry(session, state);
        return;
    }
    if (existing.layoutKey !== target.layoutKey || existing.itemIndex !== target.itemIndex) {
        setExtraWidth(session, existing.layoutKey, existing.itemIndex, 0);
        existing.layoutKey = target.layoutKey;
        existing.itemIndex = target.itemIndex;
        setExtraWidth(session, existing.layoutKey, existing.itemIndex, existing.extraWidth);
    }
    existing.context = context;
    var totalCount = reactionAvatarSelection(context.reaction, context.reactionType).count;
    if (existing.totalCount !== totalCount) {
        existing.totalCount = totalCount;
        reserveWidth(existing);
        setExtraWidth(session, existing.layoutKey, existing.itemIndex, existing.extraWidth);
        if (existing.users.length > 0) updateSurface(session, existing);
        else renderSurface(session, existing);
    }
    if (existing.loading || existing.users.length > 0) return;
    var cached1 = reactors.get(context.key);
    if (cached1 === undefined) {
        loadReactors(session, existing);
        return;
    }
    existing.users = cached1;
    if (cached1.length > 0) updateSurface(session, existing);
    else scheduleEmptyRetry(session, existing);
}
/**
 * @description Moves a pill's avatar surface to follow the pill.
 * @param session The running session.
 * @param viewKey The pill's key.
 */ function followReactionView(session, viewKey) {
    var state = session.reactions.get(viewKey);
    if (state === null || state === void 0 ? void 0 : state.surface) updateSurfaceFrame(session, state);
}
/**
 * @description Fetches the reactors of the matching pills again and re-renders their message cells.
 * @param session The running session.
 * @param matches Picks the pills to refresh.
 */ function reloadReactors(session, matches) {
    var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
    try {
        for(var _iterator = _to_consumable_array$4(session.reactions.values()).filter(matches)[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
            var state = _step.value;
            state.requestGeneration++;
            state.loading = false;
            loadReactors(session, state);
            rescheduleCell(session, state.cellKey);
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
 * @description Stops showing avatars in a message cell and restores its reaction layouts.
 * @param session The running session.
 * @param cellKey The message cell's key.
 */ function clearCell(session, cellKey) {
    forgetCell(session, cellKey);
    var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
    try {
        for(var _iterator = session.reactions[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
            var _step_value = _sliced_to_array$2(_step.value, 2), viewKey = _step_value[0], state = _step_value[1];
            if (state.cellKey === cellKey) disposeState(session, viewKey, state);
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
    restoreCellLayouts(session, cellKey);
}
/**
 * @description Shows avatars on every visible reaction pill of a message cell and reflows the pills.
 * @param session The running session.
 * @param cell The `DCDMessageTableViewCell`.
 * @param info The message it shows, or `undefined` when it shows none.
 * @param views Its reaction views, or `undefined` when it has no reactions.
 */ function renderCell(session, cell, info, views) {
    var _message_reactions;
    var objc = session.objc;
    var cellKey = key(objc, cell);
    var message = info && MessageStore.getMessage(info.channelId, info.messageId);
    if (!info || !message || !views) {
        clearCell(session, cellKey);
        return;
    }
    var collection = views.collection;
    var layoutKey = key(objc, collection);
    var entry = layoutEntry(session, views.layout, collection, views.list, messageKey(info.channelId, info.messageId));
    hookOwnerTable(session, entry);
    captureLayoutItems(session, entry);
    var reactions = (_message_reactions = message.reactions) !== null && _message_reactions !== void 0 ? _message_reactions : [];
    var visibleKeys = new Set();
    var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
    try {
        for(var _iterator = toHandles(objc, views.visibleCells)[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
            var collectionCell = _step.value;
            var index = itemOfCell(objc, collection, collectionCell);
            if (index === undefined) {
                continue;
            }
            if (!entry.baseItems.has(index)) {
                captureLayoutItem(session, entry, index, session.fabric.measure(collectionCell));
            }
            var view = reactionViewOf(objc, collectionCell);
            if (!view) {
                continue;
            }
            var reaction = reactions[index];
            var viewKey = key(objc, view);
            visibleKeys.add(viewKey);
            syncReactionView(session, {
                cellKey: cellKey,
                collectionCell: collectionCell,
                itemIndex: index,
                layoutKey: layoutKey,
                view: view
            }, reaction ? reactionContext(info.channelId, info.messageId, reaction) : null);
            followReactionView(session, viewKey);
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
    releaseStates(session, function(state, viewKey) {
        return state.cellKey === cellKey && !visibleKeys.has(viewKey);
    });
    applyLayout(session, entry);
}
/**
 * @description Renders a message cell's avatars when it appears, is reused or lays out.
 * @param session The running session.
 * @returns The handlers for the shared message cell hooks.
 */ function messageCellHandlers(session) {
    return {
        // A detached cell keeps its avatars until it is reused.
        shown: function shown(cell) {
            return scheduleCell(session, cell, true);
        },
        laidOut: function laidOut(cell) {
            return scheduleCell(session, cell);
        },
        reused: function reused(cell) {
            clearCell(session, key(session.objc, cell));
            scheduleCell(session, cell, true);
        }
    };
}
/**
 * @description Stops showing avatars everywhere, for a channel switch.
 * @param session The running session.
 */ function clearRenderedCells(session) {
    releaseStates(session, function() {
        return true;
    });
    restoreAllLayouts(session);
    forgetCells(session);
}
/**
 * @description Removes every avatar and restores every reaction layout and row height, for `stop`.
 * @param session The running session.
 */ function disposeRenderer(session) {
    releaseStates(session, function() {
        return true;
    });
    disposeLayouts(session);
    session.reactors.clear();
    forgetCells(session);
    session.scheduledCells.clear();
    session.forcedCells.clear();
    surfaceStates.clear();
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
function stopPropagation(event) {
    var _event_stopPropagation;
    (_event_stopPropagation = event.stopPropagation) === null || _event_stopPropagation === void 0 ? void 0 : _event_stopPropagation.call(event);
}
function ReactionAvatarSurface(param) {
    var surfaceId = param.surfaceId;
    var _positions_stack_users_length;
    var state = surfaceStates.get(surfaceId);
    var Summary = findUserSummaryItem();
    if (!state || !Summary) return null;
    var users = state.users.map(function(user) {
        var _UserStore_getUser;
        return (_UserStore_getUser = UserStore.getUser(user.id)) !== null && _UserStore_getUser !== void 0 ? _UserStore_getUser : user;
    });
    var stack = reactionAvatarStack(users, state.totalCount);
    var positions = reactionAvatarStackPositions(reactionAvatarReservedSlotCount(state.totalCount));
    var measured = state.measured, onWidth = state.onWidth, reservedWidth = state.width;
    // Taps on the faces open their profiles instead of toggling the reaction underneath. These
    // pointer events are missing from React Native's `View` typings.
    var pointerHandlers = {
        onClick: stopPropagation,
        onKeyDown: stopPropagation
    };
    function onLayout(event) {
        var width = event.nativeEvent.layout.width;
        if (!Number.isFinite(width) || width <= 0) return;
        if (shouldMeasureReactionAvatarWidth(measured, reservedWidth, width)) onWidth(width);
    }
    return /*#__PURE__*/ React.createElement(window.ReactNative.View, _object_spread_props(_object_spread({}, pointerHandlers), {
        pointerEvents: "box-none",
        style: {
            alignItems: 'flex-start',
            height: state.height,
            justifyContent: 'center',
            marginLeft: 0,
            transform: [
                {
                    scale: 0.9
                }
            ]
        }
    }), /*#__PURE__*/ React.createElement(window.ReactNative.View, {
        onLayout: onLayout,
        pointerEvents: "box-none",
        style: {
            height: Avatar.size,
            position: 'relative',
            justifyContent: 'center',
            width: reactionAvatarStackWidth(positions.length)
        }
    }, stack.users.map(function(user, index) {
        var _positions_index;
        return /*#__PURE__*/ React.createElement(window.ReactNative.View, {
            key: "avatar-".concat(user.id),
            pointerEvents: "box-none",
            style: {
                height: Avatar.size,
                left: (_positions_index = positions[index]) !== null && _positions_index !== void 0 ? _positions_index : 0,
                position: 'absolute',
                top: 0,
                width: Avatar.size,
                zIndex: index + 1
            }
        }, /*#__PURE__*/ React.createElement(Summary, {
            guildId: state.guildId,
            max: 1,
            renderIcon: false,
            showDefaultAvatarsForNullUsers: true,
            showUserPopout: true,
            users: [
                user
            ]
        }));
    }), stack.overflowCount > 0 ? /*#__PURE__*/ React.createElement(window.ReactNative.View, {
        style: {
            alignItems: 'center',
            backgroundColor: '#000',
            borderRadius: Avatar.size / 2,
            height: Avatar.size,
            justifyContent: 'center',
            left: (_positions_stack_users_length = positions[stack.users.length]) !== null && _positions_stack_users_length !== void 0 ? _positions_stack_users_length : 0,
            position: 'absolute',
            top: 0,
            zIndex: Avatar.limit + 1,
            width: Avatar.size
        }
    }, /*#__PURE__*/ React.createElement(window.ReactNative.Text, {
        adjustsFontSizeToFit: true,
        minimumFontScale: 0.5,
        numberOfLines: 1,
        style: {
            color: '#fff',
            fontSize: 8,
            fontWeight: '600',
            height: Avatar.size,
            includeFontPadding: false,
            lineHeight: Avatar.size,
            textAlign: 'center',
            width: Avatar.size
        }
    }, "+".concat(stack.overflowCount))) : null));
}function _array_like_to_array$3(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_with_holes$1(arr) {
    if (Array.isArray(arr)) return arr;
}
function _array_without_holes$3(arr) {
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
function _iterable_to_array$3(iter) {
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
function _non_iterable_spread$3() {
    throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _sliced_to_array$1(arr, i) {
    return _array_with_holes$1(arr) || _iterable_to_array_limit$1(arr, i) || _unsupported_iterable_to_array$3(arr, i) || _non_iterable_rest$1();
}
function _to_consumable_array$3(arr) {
    return _array_without_holes$3(arr) || _iterable_to_array$3(arr) || _unsupported_iterable_to_array$3(arr) || _non_iterable_spread$3();
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
function _type_of$1(obj) {
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
    return _async_to_generator$3(function() {
        var UIApplication, _ref, windowList, keyWindow, windows, cells, seen, _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, window, _cells, found, err;
        return _ts_generator$3(this, function(_state) {
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
                    _ref = _sliced_to_array$1.apply(void 0, [
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
                    if (!once(seen, viewKey$1(objc, window))) {
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
                        return once(seen, viewKey$1(objc, cell));
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
/**
 * @description Abandons any visible-cell scan in progress.
 * @param session The running session.
 */ function cancelVisibleScans(session) {
    session.scanRevision++;
}
/**
 * @description Renders every message cell on screen, for cells that appeared before the hooks.
 * @param session The running session.
 */ function scanVisibleCells(session) {
    return _async_to_generator$2(function() {
        var scan, channelId, cells, _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, cell;
        return _ts_generator$2(this, function(_state) {
            switch(_state.label){
                case 0:
                    scan = ++session.scanRevision;
                    channelId = selectedChannelId();
                    return [
                        4,
                        findVisibleCells(session.objc, NativeClass.messageCell, session.signal)
                    ];
                case 1:
                    cells = _state.sent();
                    if (scan !== session.scanRevision || channelId !== selectedChannelId()) return [
                        2
                    ];
                    _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
                    try {
                        for(_iterator = cells[Symbol.iterator](); !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                            cell = _step.value;
                            scheduleCell(session, cell, true);
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
                    return [
                        2
                    ];
            }
        });
    })();
}
/**
 * @description Renders the cells already on screen on the next tick.
 * @param session The running session.
 * @returns A function that cancels the scan if it has not run.
 */ function scanInitialCells(session) {
    var timer = setTimeout(function() {
        return void scanVisibleCells(session);
    }, 0);
    return function() {
        return clearTimeout(timer);
    };
}/**
 * @description Drops every avatar when the user switches channel, then renders the new channel's cells as they settle.
 * @param session The running session.
 * @returns A function that stops listening and cancels pending scans.
 */ function subscribeChannelChanges(session) {
    var scans = new Set();
    var channelId = selectedChannelId();
    function cancelScans() {
        var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
        try {
            for(var _iterator = scans[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
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
        scans.clear();
    }
    function onChange() {
        var _loop = function(_i, _iter) {
            var delay = _iter[_i];
            var timer = setTimeout(function() {
                scans.delete(timer);
                session.reactors.cancelQueuedOutsideChannel(selectedChannelId());
                void scanVisibleCells(session);
            }, delay);
            scans.add(timer);
        };
        var next = selectedChannelId();
        if (!next || next === channelId) return;
        channelId = next;
        cancelVisibleScans(session);
        cancelScans();
        cancelLayoutRefreshes(session);
        clearRenderedCells(session);
        session.reactors.cancelQueuedOutsideChannel(selectedChannelId());
        // The new channel's message list mounts over several frames, so scan a few times.
        for(var _i = 0, _iter = [
            100,
            500,
            1500,
            3000
        ]; _i < _iter.length; _i++)_loop(_i, _iter);
    }
    SelectedChannelStore.addChangeListener(onChange);
    return function() {
        SelectedChannelStore.removeChangeListener(onChange);
        cancelScans();
    };
}/**
 * @description Refetches a message's reactors and reflows its pills whenever its reactions change, for every `MESSAGE_REACTION_*` action.
 * @param session The running session.
 * @returns A function that unsubscribes.
 */ function subscribeReactionChanges(session) {
    function onReactionChange(event) {
        var _event_messageId, _event_channelId;
        var messageId = (_event_messageId = event.messageId) !== null && _event_messageId !== void 0 ? _event_messageId : event.message_id;
        if (!messageId) return;
        var channelId = (_event_channelId = event.channelId) !== null && _event_channelId !== void 0 ? _event_channelId : event.channel_id;
        session.reactors.invalidateMessage(messageId, channelId);
        scheduleLayoutRefresh(session, messageId, channelId);
        reloadReactors(session, function(param) {
            var context = param.context;
            return context.messageId === messageId && (!channelId || context.channelId === channelId);
        });
    }
    var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
    try {
        for(var _iterator = REACTION_ACTIONS[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
            var action = _step.value;
            window.unbound.metro.common.Dispatcher.subscribe(action, onReactionChange);
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
            for(var _iterator = REACTION_ACTIONS[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                var action = _step.value;
                window.unbound.metro.common.Dispatcher.unsubscribe(action, onReactionChange);
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
 * @description Refetches every shown reactor list after the gateway reconnects, since reactions changed while it was away.
 * @param session The running session.
 * @returns A function that unsubscribes.
 */ function subscribeConnectionOpen(session) {
    function onConnectionOpen() {
        session.reactors.clear();
        reloadReactors(session, function() {
            return true;
        });
    }
    window.unbound.metro.common.Dispatcher.subscribe('CONNECTION_OPEN', onConnectionOpen);
    return function() {
        return window.unbound.metro.common.Dispatcher.unsubscribe('CONNECTION_OPEN', onConnectionOpen);
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
var MAX_ANCESTOR_DEPTH = 12;
var MEASURE_EXACTLY = 1 << 30;
/**
 * @description Lays out the recycler view a reserved row sits in at its current bounds. React Native views ignore layout requests from native children, so a row that grew would otherwise keep its old height.
 * @param java The plugin's Java bridge.
 * @param view A view inside the row.
 * @returns Resolves once the list has been laid out on the main thread, or at once when there is no list above the view.
 */ function layoutHostingList(java, view) {
    return _async_to_generator$1(function() {
        var recycler, current, depth, parent, isList, _javaNumber, _javaNumber1, _javaNumber2, _javaNumber3, left, top, width, height;
        return _ts_generator$1(this, function(_state) {
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
    return _async_to_generator$1(function() {
        var parent;
        return _ts_generator$1(this, function(_state) {
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
};function _array_like_to_array$2(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_without_holes$2(arr) {
    if (Array.isArray(arr)) return _array_like_to_array$2(arr);
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
function _unsupported_iterable_to_array$2(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _array_like_to_array$2(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(n);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _array_like_to_array$2(o, minLen);
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
    var owner = className !== null && className !== void 0 ? className : DISCORD_SHAPES[name].owner;
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
    ].concat(_to_consumable_array$2(matches.map(function(match) {
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
    var matches = describeJavaClass(java, ownerOf(name, className)).methods.filter(function(method) {
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
    var matches = describeJavaClass(java, ownerOf(name, className)).fields.filter(function(field) {
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
}/**
 * @description Marks a Java class name that only older Discord builds have, for code that finds its replacement structurally on newer ones. The compat scan reports a marked name as covered instead of broken.
 * @param name The class name.
 * @returns The same name.
 */ function legacyJavaClass(name) {
    return name;
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
}function _array_like_to_array$1(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_without_holes$1(arr) {
    if (Array.isArray(arr)) return _array_like_to_array$1(arr);
}
function _class_call_check(instance, Constructor) {
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
/**
 * @description A recently-used cache of reactor lists that deduplicates and rate-limits their requests.
 * @template T The reactor type.
 */ var ReactionUserCache = /*#__PURE__*/ function() {
    function ReactionUserCache() {
        var maximumEntries = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : 400, maximumConcurrentRequests = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : 3, cacheLifetime = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : 60000, // An empty list is usually Discord not having the reactors yet, so it expires quickly.
        emptyCacheLifetime = arguments.length > 3 && arguments[3] !== void 0 ? arguments[3] : 3000;
        _class_call_check(this, ReactionUserCache);
        _define_property(this, "maximumEntries", void 0);
        _define_property(this, "maximumConcurrentRequests", void 0);
        _define_property(this, "cacheLifetime", void 0);
        _define_property(this, "emptyCacheLifetime", void 0);
        _define_property(this, "entries", void 0);
        _define_property(this, "pending", void 0);
        _define_property(this, "queue", void 0);
        _define_property(this, "activeRequests", void 0);
        _define_property(this, "generation", void 0);
        this.maximumEntries = maximumEntries;
        this.maximumConcurrentRequests = maximumConcurrentRequests;
        this.cacheLifetime = cacheLifetime;
        this.emptyCacheLifetime = emptyCacheLifetime;
        this.entries = new Map();
        this.pending = new Map();
        this.queue = [];
        this.activeRequests = 0;
        this.generation = 0;
    }
    _create_class(ReactionUserCache, [
        {
            key: "get",
            value: function get(key) {
                var now = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : Date.now();
                var entry = this.entries.get(key);
                if (!entry) return;
                this.entries.delete(key);
                if (entry.expiresAt <= now) return;
                this.entries.set(key, entry);
                return entry.users;
            }
        },
        {
            key: "load",
            value: function load(key, load) {
                var _this = this;
                var now = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : Date.now();
                var cached = this.get(key, now);
                if (cached) return Promise.resolve(cached);
                var pending = this.pending.get(key);
                if (pending) return pending;
                var generation = this.generation;
                var request = new Promise(function(resolve, reject) {
                    _this.queue.push({
                        generation: generation,
                        key: key,
                        load: load,
                        reject: reject,
                        resolve: resolve
                    });
                    _this.processQueue();
                }).then(function(users) {
                    if (generation !== _this.generation || _this.pending.get(key) !== request) return [];
                    _this.cache(key, users, Date.now());
                    return users;
                });
                this.pending.set(key, request);
                void request.then(function() {
                    return _this.settle(key, request);
                }, function() {
                    return _this.settle(key, request);
                });
                return request;
            }
        },
        {
            key: "invalidate",
            value: function invalidate(prefix) {
                this.invalidateMatching(function(key) {
                    return key.startsWith(prefix);
                });
            }
        },
        {
            key: "invalidateMessage",
            value: function invalidateMessage(messageId, channelId) {
                var channelPrefix = channelId ? reactionAvatarPrefix(channelId, messageId) : null;
                var encodedMessageId = encodeURIComponent(messageId);
                this.invalidateMatching(function(key) {
                    return channelPrefix ? key.startsWith(channelPrefix) : key.split(':')[1] === encodedMessageId;
                });
            }
        },
        {
            key: "cancelQueuedOutsideChannel",
            value: function cancelQueuedOutsideChannel(channelId) {
                var channelPrefix = channelId ? "".concat(encodeURIComponent(channelId), ":") : null;
                var remaining = [];
                var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
                try {
                    for(var _iterator = this.queue[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                        var request = _step.value;
                        if (channelPrefix && request.key.startsWith(channelPrefix)) {
                            remaining.push(request);
                            continue;
                        }
                        this.pending.delete(request.key);
                        request.resolve([]);
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
                this.queue = remaining;
            }
        },
        {
            key: "clear",
            value: function clear() {
                this.generation++;
                this.entries.clear();
                this.pending.clear();
                var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
                try {
                    for(var _iterator = this.queue[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                        var request = _step.value;
                        request.resolve([]);
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
                this.queue = [];
            }
        },
        {
            key: "invalidateMatching",
            value: function invalidateMatching(matches) {
                var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
                try {
                    for(var _iterator = new Set(_to_consumable_array$1(this.entries.keys()).concat(_to_consumable_array$1(this.pending.keys())))[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                        var key = _step.value;
                        if (!matches(key)) {
                            continue;
                        }
                        this.entries.delete(key);
                        this.pending.delete(key);
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
                var remaining = [];
                var _iteratorNormalCompletion1 = true, _didIteratorError1 = false, _iteratorError1 = undefined;
                try {
                    for(var _iterator1 = this.queue[Symbol.iterator](), _step1; !(_iteratorNormalCompletion1 = (_step1 = _iterator1.next()).done); _iteratorNormalCompletion1 = true){
                        var request = _step1.value;
                        if (matches(request.key)) request.resolve([]);
                        else remaining.push(request);
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
                this.queue = remaining;
            }
        },
        {
            key: "settle",
            value: function settle(key, request) {
                if (this.pending.get(key) === request) this.pending.delete(key);
            }
        },
        {
            key: "cache",
            value: function cache(key, users, now) {
                var lifetime = users.length > 0 ? this.cacheLifetime : this.emptyCacheLifetime;
                this.entries.delete(key);
                this.entries.set(key, {
                    expiresAt: now + lifetime,
                    users: users
                });
                var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
                try {
                    // Maps iterate in insertion order, and `get` re-inserts, so the first key is the least recently used.
                    for(var _iterator = this.entries.keys()[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                        var oldest = _step.value;
                        if (this.entries.size <= this.maximumEntries) return;
                        this.entries.delete(oldest);
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
        },
        {
            key: "processQueue",
            value: function processQueue() {
                var _this = this;
                while(this.activeRequests < this.maximumConcurrentRequests){
                    var request = this.queue.shift();
                    if (!request) return;
                    if (request.generation !== this.generation) {
                        request.resolve([]);
                        continue;
                    }
                    this.activeRequests++;
                    void Promise.resolve().then(request.load).then(request.resolve, request.reject).finally(function() {
                        _this.activeRequests--;
                        _this.processQueue();
                    });
                }
            }
        }
    ]);
    return ReactionUserCache;
}();function _array_like_to_array(arr, len) {
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
function _ts_values(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) {
        return m.call(o);
    }
    if (o && typeof o.length === "number") {
        return {
            next: function() {
                if (o && i >= o.length) {
                    o = void 0;
                }
                return {
                    value: o && o[i++],
                    done: !o
                };
            }
        };
    }
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
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
var REACTION_VIEW = legacyJavaClass('com.discord.reactions.ReactionView');
var REACTION_ROW = 'com.discord.reactions.ShortcutsFlexbox';
var ADD_REACTION_VIEW = 'com.discord.reactions.AddReactionView';
var LINEAR_PARAMS = 'android.widget.LinearLayout$LayoutParams';
var CENTER_VERTICAL = 16;
var VISIBLE = 0;
var HOST_HEIGHT = 20;
var AVATAR_GAP = 4;
var MAX_SEARCH_DEPTH = 6;
var SIZE_PARAMETERS = [
    'int',
    'int',
    'int',
    'int'
];
var UNMOUNT_WAIT_MS = 1000;
function settledWithin(pending, timeout) {
    if (!pending) return Promise.resolve(null);
    return Promise.race([
        pending.catch(function() {
            return null;
        }),
        new Promise(function(resolve) {
            return setTimeout(function() {
                return resolve(null);
            }, timeout);
        })
    ]);
}
function viewKey(view) {
    return view.type === 'handle' ? view.value : undefined;
}
function emojiKey(reaction) {
    var _reaction_emoji_name;
    if (typeof reaction.emoji === 'string') return reaction.emoji;
    return reaction.emoji.id ? String(reaction.emoji.id) : (_reaction_emoji_name = reaction.emoji.name) !== null && _reaction_emoji_name !== void 0 ? _reaction_emoji_name : undefined;
}
/**
 * @description Shows the first reactors inside each reaction pill of Discord's Android message rows, the way the iOS client does.
 * @param native The plugin's Java, hook and Fabric bridges.
 * @param surfaceName The registered avatar surface to mount in each pill.
 * @returns `dispose`, which removes every avatar stack and resolves once the pills are restored.
 */ function createAndroidReactions(param, surfaceName) {
    var java = param.java, hooks = param.hooks, fabric = param.fabric;
    var reactors = new ReactionUserCache();
    var pills = new Map();
    var bound = new Map();
    var queues = new Map();
    var awaitingSize = new Map();
    var nextId = 0;
    var disposed = false;
    function isA(className, view) {
        return javaFlag(java.invoke(java.getClass(className), 'isInstance', [
            view
        ]));
    }
    function children(view) {
        var _javaNumber;
        var count = (_javaNumber = javaNumber(java.invoke(view, 'getChildCount', []))) !== null && _javaNumber !== void 0 ? _javaNumber : 0;
        return Array.from({
            length: count
        }, function(_, index) {
            return javaReference(java.invoke(view, 'getChildAt', [
                javaInt(index)
            ]));
        }).filter(function(child) {
            return child !== null;
        });
    }
    var reactionViewNamed = function() {
        try {
            java.getClass(REACTION_VIEW);
            return true;
        } catch (unused) {
            return false;
        }
    }();
    var emojiFields = new Map();
    function isReactionView(view) {
        if (reactionViewNamed) return isA(REACTION_VIEW, view);
        return isA('android.view.View', view) && javaText(java.className(view)) !== ADD_REACTION_VIEW;
    }
    function emojiField(reactionView) {
        var className = javaText(java.className(reactionView));
        if (!className) return undefined;
        var cached = emojiFields.get(className);
        if (cached) return cached;
        var field = shapeField(java, 'reactionEmoji', className);
        if (!field) return undefined;
        emojiFields.set(className, field.name);
        return field.name;
    }
    function reactionRow(messageView) {
        var accessories = viewByIdName(java, messageView, 'accessories_view');
        var level = accessories ? [
            accessories
        ] : [];
        for(var depth = 0; depth < MAX_SEARCH_DEPTH && level.length; depth++){
            var row = level.find(function(view) {
                return isA(REACTION_ROW, view);
            });
            if (row) return row;
            level = level.filter(function(view) {
                return isA('android.view.ViewGroup', view);
            }).flatMap(function(view) {
                return children(view);
            });
        }
        return null;
    }
    function density(view) {
        var _javaNumber;
        var resources = javaReference(java.invoke(view, 'getResources', []));
        var metrics = resources ? javaReference(java.invoke(resources, 'getDisplayMetrics', [])) : null;
        return metrics ? (_javaNumber = javaNumber(java.getField(metrics, 'density'))) !== null && _javaNumber !== void 0 ? _javaNumber : 1 : 1;
    }
    function removePill(pill) {
        return _async_to_generator(function() {
            var _viewKey, mounted;
            return _ts_generator(this, function(_state) {
                switch(_state.label){
                    case 0:
                        pill.disposed = true;
                        pills.delete((_viewKey = viewKey(pill.reactionView)) !== null && _viewKey !== void 0 ? _viewKey : '');
                        surfaceStates.delete(pill.id);
                        return [
                            4,
                            settledWithin(pill.mounting, UNMOUNT_WAIT_MS)
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
                            removeHost(java, pill.host).catch(function() {
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
    function describe(pill, context, users) {
        var _ChannelStore_getChannel;
        surfaceStates.set(pill.id, {
            guildId: (_ChannelStore_getChannel = ChannelStore.getChannel(context.channelId)) === null || _ChannelStore_getChannel === void 0 ? void 0 : _ChannelStore_getChannel.guild_id,
            height: HOST_HEIGHT,
            measured: true,
            onWidth: function onWidth() {
                return undefined;
            },
            totalCount: reactionAvatarSelection(context.reaction, context.reactionType).count,
            users: users,
            width: reactionAvatarStackWidth(reactionAvatarReservedSlotCount(reactionAvatarSelection(context.reaction, context.reactionType).count))
        });
    }
    function addPill(reactionView, context, users) {
        return _async_to_generator(function() {
            var _viewKey, scale, total, width, viewContext, host, params, pill;
            return _ts_generator(this, function(_state) {
                switch(_state.label){
                    case 0:
                        scale = density(reactionView);
                        total = reactionAvatarSelection(context.reaction, context.reactionType).count;
                        width = reactionAvatarStackWidth(reactionAvatarReservedSlotCount(total));
                        viewContext = javaReference(java.invoke(reactionView, 'getContext', []));
                        host = java.construct('android.widget.FrameLayout', viewContext ? [
                            viewContext
                        ] : []);
                        params = java.construct(LINEAR_PARAMS, [
                            javaInt(Math.round(width * scale)),
                            javaInt(Math.round(HOST_HEIGHT * scale))
                        ]);
                        pill = {
                            id: "reaction-avatars-android-".concat(nextId++),
                            reactionView: reactionView,
                            host: host,
                            contextKey: context.key,
                            mounting: null,
                            revision: 0,
                            disposed: false
                        };
                        java.invoke(params, 'setMargins', [
                            javaInt(Math.round(AVATAR_GAP * scale)),
                            javaInt(0),
                            javaInt(Math.round((Avatar.trailingPadding - Avatar.leadingInset) * scale)),
                            javaInt(0)
                        ]);
                        java.setField(params, 'gravity', javaInt(CENTER_VERTICAL));
                        describe(pill, context, users);
                        pills.set((_viewKey = viewKey(reactionView)) !== null && _viewKey !== void 0 ? _viewKey : '', pill);
                        return [
                            4,
                            java.invokeAsync(reactionView, 'addView', [
                                host,
                                params
                            ])
                        ];
                    case 1:
                        _state.sent();
                        return [
                            2,
                            pill
                        ];
                }
            });
        })();
    }
    function mount(pill) {
        return _async_to_generator(function() {
            return _ts_generator(this, function(_state) {
                switch(_state.label){
                    case 0:
                        if (pill.disposed || pill.mounting) return [
                            2
                        ];
                        pill.mounting = fabric.mountAsync(pill.host, surfaceName, {
                            surfaceId: pill.id,
                            revision: pill.revision
                        });
                        return [
                            4,
                            pill.mounting.catch(function(error) {
                                pill.mounting = null;
                                throw error;
                            })
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
    function refresh(pill) {
        return _async_to_generator(function() {
            var _pill_mounting, mounted;
            return _ts_generator(this, function(_state) {
                switch(_state.label){
                    case 0:
                        return [
                            4,
                            (_pill_mounting = pill.mounting) === null || _pill_mounting === void 0 ? void 0 : _pill_mounting.catch(function() {
                                return null;
                            })
                        ];
                    case 1:
                        mounted = _state.sent();
                        if (!(mounted && !pill.disposed)) return [
                            3,
                            3
                        ];
                        pill.revision++;
                        return [
                            4,
                            fabric.updateAsync(mounted, {
                                surfaceId: pill.id,
                                revision: pill.revision
                            }).catch(function() {
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
                }
            });
        })();
    }
    function render(messageView, messageId) {
        return _async_to_generator(function() {
            var _ref, _viewKey, channelId, message, row, views, reactions, used, changed, _iteratorNormalCompletion, _didIteratorError, _iteratorError, _loop, _iterator, _step, _ret, err, messageKey, _iteratorNormalCompletion1, _didIteratorError1, _iteratorError1, _iterator1, _step1, pill, err;
            return _ts_generator(this, function(_state) {
                switch(_state.label){
                    case 0:
                        channelId = selectedChannelId();
                        message = channelId ? MessageStore.getMessage(channelId, messageId) : undefined;
                        row = reactionRow(messageView);
                        views = row ? children(row).filter(isReactionView) : [];
                        reactions = (_ref = message === null || message === void 0 ? void 0 : message.reactions) !== null && _ref !== void 0 ? _ref : [];
                        used = new Set();
                        changed = [];
                        _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
                        _state.label = 1;
                    case 1:
                        _state.trys.push([
                            1,
                            6,
                            7,
                            8
                        ]);
                        _loop = function() {
                            var reactionView, _viewKey, key, existing, shown, field, emoji, index, context, users, _;
                            return _ts_generator(this, function(_state) {
                                switch(_state.label){
                                    case 0:
                                        reactionView = _step.value;
                                        key = (_viewKey = viewKey(reactionView)) !== null && _viewKey !== void 0 ? _viewKey : '';
                                        existing = pills.get(key);
                                        shown = javaNumber(java.invoke(reactionView, 'getVisibility', [])) === VISIBLE;
                                        field = shown ? emojiField(reactionView) : undefined;
                                        emoji = field ? javaText(java.getField(reactionView, field)) : undefined;
                                        index = reactions.findIndex(function(reaction, position) {
                                            return !used.has(position) && emojiKey(reaction) === emoji;
                                        });
                                        if (index >= 0) used.add(index);
                                        context = channelId && index >= 0 ? reactionContext(channelId, messageId, reactions[index]) : null;
                                        if (!!context) return [
                                            3,
                                            3
                                        ];
                                        if (!existing) return [
                                            3,
                                            2
                                        ];
                                        return [
                                            4,
                                            removePill(existing)
                                        ];
                                    case 1:
                                        _state.sent();
                                        changed.push(existing);
                                        _state.label = 2;
                                    case 2:
                                        return [
                                            2,
                                            "continue"
                                        ];
                                    case 3:
                                        return [
                                            4,
                                            reactors.load(context.key, function() {
                                                return fetchReactors(context);
                                            }).catch(function() {
                                                return [];
                                            })
                                        ];
                                    case 4:
                                        users = _state.sent();
                                        if (disposed) return [
                                            2,
                                            {
                                                v: void 0
                                            }
                                        ];
                                        if (!!users.length) return [
                                            3,
                                            7
                                        ];
                                        if (!existing) return [
                                            3,
                                            6
                                        ];
                                        return [
                                            4,
                                            removePill(existing)
                                        ];
                                    case 5:
                                        _state.sent();
                                        changed.push(existing);
                                        _state.label = 6;
                                    case 6:
                                        return [
                                            2,
                                            "continue"
                                        ];
                                    case 7:
                                        if (!(existing && existing.contextKey === context.key && !existing.disposed)) return [
                                            3,
                                            9
                                        ];
                                        describe(existing, context, users);
                                        return [
                                            4,
                                            refresh(existing)
                                        ];
                                    case 8:
                                        _state.sent();
                                        return [
                                            2,
                                            "continue"
                                        ];
                                    case 9:
                                        if (!existing) return [
                                            3,
                                            11
                                        ];
                                        return [
                                            4,
                                            removePill(existing)
                                        ];
                                    case 10:
                                        _state.sent();
                                        _state.label = 11;
                                    case 11:
                                        if (disposed) return [
                                            2,
                                            {
                                                v: void 0
                                            }
                                        ];
                                        _ = changed.push;
                                        return [
                                            4,
                                            addPill(reactionView, context, users)
                                        ];
                                    case 12:
                                        _.apply(changed, [
                                            _state.sent()
                                        ]);
                                        return [
                                            2
                                        ];
                                }
                            });
                        };
                        _iterator = views[Symbol.iterator]();
                        _state.label = 2;
                    case 2:
                        if (!!(_iteratorNormalCompletion = (_step = _iterator.next()).done)) return [
                            3,
                            5
                        ];
                        return [
                            5,
                            _ts_values(_loop())
                        ];
                    case 3:
                        _ret = _state.sent();
                        if (_type_of(_ret) === "object") return [
                            2,
                            _ret.v
                        ];
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
                        messageKey = (_viewKey = viewKey(messageView)) !== null && _viewKey !== void 0 ? _viewKey : '';
                        if (reactions.length && !used.size) {
                            awaitingSize.set(messageKey, {
                                messageView: messageView,
                                messageId: messageId
                            });
                        } else {
                            awaitingSize.delete(messageKey);
                        }
                        if (!changed.length) return [
                            2
                        ];
                        return [
                            4,
                            java.invokeAsync(messageView, 'requestLayout', [])
                        ];
                    case 9:
                        _state.sent();
                        return [
                            4,
                            layoutHostingList(java, messageView)
                        ];
                    case 10:
                        _state.sent();
                        _iteratorNormalCompletion1 = true, _didIteratorError1 = false, _iteratorError1 = undefined;
                        _state.label = 11;
                    case 11:
                        _state.trys.push([
                            11,
                            16,
                            17,
                            18
                        ]);
                        _iterator1 = changed[Symbol.iterator]();
                        _state.label = 12;
                    case 12:
                        if (!!(_iteratorNormalCompletion1 = (_step1 = _iterator1.next()).done)) return [
                            3,
                            15
                        ];
                        pill = _step1.value;
                        return [
                            4,
                            mount(pill)
                        ];
                    case 13:
                        _state.sent();
                        _state.label = 14;
                    case 14:
                        _iteratorNormalCompletion1 = true;
                        return [
                            3,
                            12
                        ];
                    case 15:
                        return [
                            3,
                            18
                        ];
                    case 16:
                        err = _state.sent();
                        _didIteratorError1 = true;
                        _iteratorError1 = err;
                        return [
                            3,
                            18
                        ];
                    case 17:
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
                    case 18:
                        return [
                            4,
                            layoutHostingList(java, messageView)
                        ];
                    case 19:
                        _state.sent();
                        return [
                            2
                        ];
                }
            });
        })();
    }
    function schedule(messageView, messageId) {
        var _queues_get;
        var key = viewKey(messageView);
        if (!key || disposed) return;
        bound.set(key, {
            messageView: messageView,
            messageId: messageId
        });
        var next = ((_queues_get = queues.get(key)) !== null && _queues_get !== void 0 ? _queues_get : Promise.resolve()).then(function() {
            var _bound_get;
            return ((_bound_get = bound.get(key)) === null || _bound_get === void 0 ? void 0 : _bound_get.messageId) === messageId ? render(messageView, messageId) : undefined;
        }).catch(function(error) {
            console.error('[Reaction Avatars] Failed to draw Android reactors:', error);
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
    function onReactionChange(event) {
        var _event_messageId;
        var messageId = (_event_messageId = event.messageId) !== null && _event_messageId !== void 0 ? _event_messageId : event.message_id;
        if (!messageId) return;
        reactors.invalidateMessage(messageId, event.channelId);
        var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
        try {
            var _loop = function() {
                var entry = _step.value;
                if (entry.messageId === messageId) {
                    setTimeout(function() {
                        return schedule(entry.messageView, messageId);
                    }, 0);
                }
            };
            for(var _iterator = bound.values()[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true)_loop();
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
    var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
    try {
        for(var _iterator = REACTION_ACTIONS[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
            var action = _step.value;
            window.unbound.metro.common.Dispatcher.subscribe(action, onReactionChange);
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
            return _async_to_generator(function() {
                var _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, scan, _iteratorNormalCompletion1, _didIteratorError1, _iteratorError1, _iterator1, _step1, action, views, _views, first;
                return _ts_generator(this, function(_state) {
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
                            hooks.remove(sizeToken);
                            awaitingSize.clear();
                            _iteratorNormalCompletion1 = true, _didIteratorError1 = false, _iteratorError1 = undefined;
                            try {
                                for(_iterator1 = REACTION_ACTIONS[Symbol.iterator](); !(_iteratorNormalCompletion1 = (_step1 = _iterator1.next()).done); _iteratorNormalCompletion1 = true){
                                    action = _step1.value;
                                    window.unbound.metro.common.Dispatcher.unsubscribe(action, onReactionChange);
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
                            views = _to_consumable_array(bound.values());
                            return [
                                4,
                                Promise.all(_to_consumable_array(pills.values()).map(removePill))
                            ];
                        case 1:
                            _state.sent();
                            _views = _sliced_to_array(views, 1), first = _views[0];
                            if (!first) return [
                                3,
                                3
                            ];
                            return [
                                4,
                                layoutHostingList(java, first.messageView).catch(function() {
                                    return undefined;
                                })
                            ];
                        case 2:
                            _state.sent();
                            _state.label = 3;
                        case 3:
                            bound.clear();
                            return [
                                2
                            ];
                    }
                });
            })();
        }
    };
}/**
 * @description Opens a session on the plugin's native bridge.
 * @param native The bridge from the plugin context.
 * @param surfaceName The registered name of the avatar stack's root component.
 * @param render Renders one message cell's avatars.
 * @returns The session, and `close`, which ends it so callbacks still in flight do nothing.
 */ function createSession(native, surfaceName, render) {
    var controller = new AbortController();
    var session = {
        objc: native.objc,
        fabric: native.fabric,
        signal: controller.signal,
        surfaceName: surfaceName,
        render: render,
        reactors: new ReactionUserCache(),
        cells: new Map(),
        lastRenders: new Map(),
        scheduledCells: new Set(),
        forcedCells: new Set(),
        reactions: new Map(),
        layouts: new Map(),
        layoutRefreshes: new Map(),
        tables: new Map(),
        tableHooks: [],
        cellHeights: new Map(),
        sizeHook: null,
        scanRevision: 0
    };
    return {
        session: session,
        close: function close() {
            return controller.abort();
        }
    };
}var dispose = function dispose() {
    return undefined;
};
function start(context) {
    var modules = {
        getReactors: ReactionActions.getReactors,
        UserSummaryItem: findUserSummaryItem(),
        ChannelStore: ChannelStore,
        MessageStore: MessageStore,
        SelectedChannelStore: SelectedChannelStore,
        UserStore: UserStore
    };
    if (!ensureCapabilities('Reaction Avatars', context.native, context.capabilities) || !ensureModules('Reaction Avatars', modules)) {
        return;
    }
    var surfaceName = registerAppSurface('ReactionAvatarSurface', ReactionAvatarSurface);
    if (!surfaceName) {
        console.error('[Reaction Avatars] Skipped, the avatar surface did not register.');
        return;
    }
    if (context.platform === 'android') {
        var reactions = createAndroidReactions(context.native, surfaceName);
        dispose = applyFeatures('Reaction Avatars', [
            function() {
                return reactions.dispose;
            }
        ]);
        return;
    }
    var _createSession = createSession(context.native, surfaceName, renderCell), session = _createSession.session, close = _createSession.close;
    dispose = applyFeatures('Reaction Avatars', [
        function() {
            return function() {
                return disposeRenderer(session);
            };
        },
        function() {
            return hookMessageCells(session.objc, messageCellHandlers(session));
        },
        function() {
            return subscribeReactionChanges(session);
        },
        function() {
            return subscribeConnectionOpen(session);
        },
        function() {
            return subscribeChannelChanges(session);
        },
        function() {
            return scanInitialCells(session);
        },
        function() {
            return close;
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