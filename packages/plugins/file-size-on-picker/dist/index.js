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
}/**
 * @description Reads the activity the loader's `ActivityTracker` saw resume last.
 * @param java The plugin's Java bridge.
 * @returns The activity, or `null` while no activity is resumed.
 */ function currentActivity(java) {
    var tracker = javaReference(java.getField(java.getClass('app.unbound.android.ActivityTracker'), 'INSTANCE'));
    return tracker ? javaReference(java.invoke(tracker, 'currentActivity', [])) : null;
}/**
 * @description Reads media file sizes from Android's content resolver, which Discord's picker leaves out, and remembers each answer.
 * @param java The plugin's Java bridge.
 * @returns A lookup for content URIs and a function that releases the resolver.
 */ function createAndroidFileSizes(java) {
    var sizes = new Map();
    var resolver = null;
    var application = null;
    function contentResolver() {
        if (resolver) return resolver;
        var activity = application ? null : currentActivity(java);
        application !== null && application !== void 0 ? application : application = activity ? javaReference(java.invoke(activity, 'getApplicationContext', [])) : null;
        resolver = application ? javaReference(java.invoke(application, 'getContentResolver', [])) : null;
        return resolver;
    }
    function statSize(uri) {
        var owner = contentResolver();
        if (!owner) return undefined;
        var parsed = javaReference(java.invoke(java.getClass('android.net.Uri'), 'parse', [
            javaString(uri)
        ]));
        var descriptor = parsed ? javaReference(java.invoke(owner, 'openFileDescriptor', [
            parsed,
            javaString('r')
        ])) : null;
        try {
            var size = descriptor ? javaNumber(java.invoke(descriptor, 'getStatSize', [])) : undefined;
            return size !== undefined && size >= 0 ? size : undefined;
        } finally{
            if (descriptor) {
                java.invoke(descriptor, 'close', []);
                java.release(descriptor);
            }
            if (parsed) java.release(parsed);
        }
    }
    function lookup(uri) {
        if (!uri.startsWith('content://')) return undefined;
        if (!sizes.has(uri)) {
            try {
                sizes.set(uri, statSize(uri));
            } catch (error) {
                sizes.set(uri, undefined);
                console.error("[File Size On Picker] Could not read the size of ".concat(uri, ":"), error);
            }
        }
        return sizes.get(uri);
    }
    function dispose() {
        sizes.clear();
        for(var _i = 0, _iter = [
            resolver,
            application
        ]; _i < _iter.length; _i++){
            var handle = _iter[_i];
            if (handle) java.release(handle);
        }
        resolver = null;
        application = null;
    }
    return {
        lookup: lookup,
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
}var PLUGIN_NAME = 'File Size On Picker';
var BADGE_INSET = 3;
var BYTE_UNITS = [
    'Bytes',
    'KB',
    'MB',
    'GB',
    'TB',
    'PB',
    'EB',
    'ZB',
    'YB'
];
var BYTE_FORMAT = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
    useGrouping: false
});function _array_like_to_array$1(arr, len) {
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
/**
 * @description Formats a byte count in binary (1024-based) units with up to two decimals.
 * @param bytes A non-negative byte count.
 * @returns A label such as `1.5 MB`, or `0 Bytes` for an empty file.
 */ function formatBytes(bytes) {
    if (!bytes) return '0 Bytes';
    var index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), BYTE_UNITS.length - 1);
    return "".concat(BYTE_FORMAT.format(bytes / Math.pow(1024, index)), " ").concat(BYTE_UNITS[index]);
}
/**
 * @description Places a size badge in the top-left corner of each media item in a picker row.
 * @param items The row's media item elements in slot order, with an empty slot as `null`.
 * @param padding The row's horizontal padding.
 * @param separator The gap between items.
 * @param lookup Finds the size of an item Discord reports without one, as on Android.
 * @returns One badge per item with a known file size and a positive layout size.
 */ function sizeBadgesForRow(items, padding, separator, lookup) {
    var badges = [];
    var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
    try {
        for(var _iterator = items.entries()[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
            var _step_value = _sliced_to_array(_step.value, 2), slot = _step_value[0], item = _step_value[1];
            var _ref, _item_key;
            var _item_props_item_node, _item_props_item;
            if (!item) {
                continue;
            }
            var image = (_item_props_item = item.props.item) === null || _item_props_item === void 0 ? void 0 : (_item_props_item_node = _item_props_item.node) === null || _item_props_item_node === void 0 ? void 0 : _item_props_item_node.image;
            var bytes = (_ref = image === null || image === void 0 ? void 0 : image.fileSize) !== null && _ref !== void 0 ? _ref : (image === null || image === void 0 ? void 0 : image.uri) ? lookup === null || lookup === void 0 ? void 0 : lookup(image.uri) : undefined;
            var size = item.props.size;
            if (typeof bytes !== 'number' || !Number.isSafeInteger(bytes) || bytes < 0) {
                continue;
            }
            if (typeof size !== 'number' || !Number.isFinite(size) || size <= 0) {
                continue;
            }
            badges.push({
                key: "file-size-".concat((_item_key = item.key) !== null && _item_key !== void 0 ? _item_key : slot),
                label: formatBytes(bytes),
                left: padding + slot * (size + separator) + BADGE_INSET
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
    return badges;
}function SizeBadge(param) {
    var label = param.label, left = param.left;
    return /*#__PURE__*/ React.createElement(window.ReactNative.View, {
        pointerEvents: "none",
        style: {
            backgroundColor: '#1e1f2280',
            borderRadius: 4,
            left: left,
            paddingHorizontal: 4,
            paddingVertical: 2,
            position: 'absolute',
            top: BADGE_INSET
        }
    }, /*#__PURE__*/ React.createElement(window.ReactNative.Text, {
        style: {
            color: 'white',
            fontFamily: window.unbound.metro.common.Constants.Fonts.PRIMARY_BOLD,
            fontSize: 10,
            includeFontPadding: false
        }
    }, label));
}var Patcher = window.unbound.patcher.createPatcher('unbound.file-size-on-picker');function _array_like_to_array(arr, len) {
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
function patchRow(module, lookup) {
    var _module_default;
    if (typeof ((_module_default = module.default) === null || _module_default === void 0 ? void 0 : _module_default.type) !== 'function') {
        console.error('[File Size On Picker] Skipped, MediaKeyboardItem has no row component.');
        return function() {};
    }
    return Patcher.after(module.default, 'type', function(param) {
        var result = param.result;
        var _ref, _module_SEPARATOR_SIZE;
        var _result_props, _result_props_style;
        var children = result === null || result === void 0 ? void 0 : (_result_props = result.props) === null || _result_props === void 0 ? void 0 : _result_props.children;
        if (!Array.isArray(children) || !children.length) return;
        var badges = sizeBadgesForRow(children, (_ref = (_result_props_style = result.props.style) === null || _result_props_style === void 0 ? void 0 : _result_props_style.paddingHorizontal) !== null && _ref !== void 0 ? _ref : 12, (_module_SEPARATOR_SIZE = module.SEPARATOR_SIZE) !== null && _module_SEPARATOR_SIZE !== void 0 ? _module_SEPARATOR_SIZE : 4, lookup);
        if (!badges.length) return;
        return /*#__PURE__*/ window.React.cloneElement(result, {}, _to_consumable_array(children).concat(_to_consumable_array(badges.map(function(param) {
            var key = param.key, label = param.label, left = param.left;
            return /*#__PURE__*/ React.createElement(SizeBadge, {
                key: key,
                label: label,
                left: left
            });
        }))));
    });
}
/**
 * @description Overlays each media picker thumbnail with its file size, once the picker's row module loads.
 * @param lookup Finds the size of a thumbnail Discord reports without one.
 * @returns A function that stops waiting for the module, or removes the patch.
 */ function patchMediaKeyboardItem(lookup) {
    return whenLoaded('modules/media_keyboard/native/components/MediaKeyboardItem.tsx', function(module) {
        return patchRow(module, lookup);
    });
}var dispose = function dispose() {};
function androidLookup(context) {
    if (context.platform !== 'android' || !ensureCapabilities(PLUGIN_NAME, context.native, context.capabilities)) {
        return {
            dispose: function dispose() {}
        };
    }
    return createAndroidFileSizes(context.native.java);
}
function start(context) {
    var sizes = androidLookup(context);
    dispose = applyFeatures(PLUGIN_NAME, [
        function() {
            return sizes.dispose;
        },
        function() {
            return patchMediaKeyboardItem(sizes.lookup);
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