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
 * @description Returns Discord's action sheet row, with the `Group` and `Icon` parts it carries, as Unbound's own sheets use it.
 * @returns The `ActionSheetRow` from Unbound's `BottomSheets` handle.
 */ function getActionSheetRow() {
    return window.unbound.metro.components.BottomSheets.ActionSheetRow;
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
function _instanceof$2(left, right) {
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
            if (!_instanceof$2(found, Promise)) {
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
var DIRECT_SHEETS = [
    [
        'modules/messages/native/long_press/LongPressMessageActionSheet.tsx',
        'MessageLongPressActionSheet'
    ]
];
/**
 * @description Lets a plugin change the action sheets Discord opens through `openLazy`, and the sheets it opens without it, such as Android's message long-press sheet, patching each sheet component once.
 * @template P The sheet props the plugin reads.
 * @param Patcher The plugin's patcher.
 * @param ActionSheets Discord's action sheet module.
 * @param onOpen Runs on every opened sheet and returns the render patch for its component, or `undefined` to leave it alone.
 * @returns A function that removes every patch and ignores sheets that finish loading afterwards.
 */ function patchLazySheets(Patcher, ActionSheets, onOpen) {
    var patchedModules = new WeakSet();
    var unpatches = [];
    var disposed = false;
    function patchModule(module, render) {
        if (disposed || !module || patchedModules.has(module)) return;
        patchedModules.add(module);
        var target = findRenderTarget(module);
        if (!target) return;
        unpatches.push(Patcher.after(target.holder, target.key, function(param) {
            var result = param.result;
            return render(result);
        }));
    }
    var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
    try {
        var _loop = function() {
            var _step_value = _sliced_to_array$3(_step.value, 2), path = _step_value[0], key = _step_value[1];
            unpatches.push(whenLoaded(path, function(module) {
                var target = findRenderTarget(module);
                if (disposed || !target || patchedModules.has(module)) return;
                patchedModules.add(module);
                return Patcher.after(target.holder, target.key, function(param) {
                    var _param_args = _sliced_to_array$3(param.args, 1), props = _param_args[0], result = param.result;
                    var render = props ? onOpen(key, props) : undefined;
                    return render ? render(result) : result;
                });
            }));
        };
        for(var _iterator = DIRECT_SHEETS[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true)_loop();
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
    unpatches.push(Patcher.before(ActionSheets, 'openLazy', function(param) {
        var _param_args = _sliced_to_array$3(param.args, 3), sheet = _param_args[0], key = _param_args[1], props = _param_args[2];
        if (typeof key !== 'string' || !(sheet === null || sheet === void 0 ? void 0 : sheet.then) || !props) return;
        var render = onOpen(key, props);
        if (!render) return;
        // Discord surfaces a sheet that fails to load; the plugin only skips patching it.
        sheet.then(function(module) {
            return patchModule(module, render);
        }).catch(function() {
            return undefined;
        });
    }));
    return function() {
        disposed = true;
        var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
        try {
            for(var _iterator = unpatches.splice(0)[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
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
}// UNKNOWN: a component may render any node.
function _type_of(obj) {
    "@swc/helpers - typeof";
    return obj && typeof Symbol !== "undefined" && obj.constructor === Symbol ? "symbol" : typeof obj;
}
var MAX_DEPTH = 15;
/**
 * @description Checks whether a value can be read as a rendered React element.
 * @param value Any node from a render result.
 * @returns `true` for any non-null object, including arrays of children.
 */ function isElementNode(value) {
    return (typeof value === "undefined" ? "undefined" : _type_of(value)) === 'object' && value !== null;
}
/**
 * @description Reads the component name of an element, looking through `memo` and `forwardRef` wrappers.
 * @param element The rendered element.
 * @returns The host tag, display name or function name, or `undefined` when the component is anonymous.
 */ function getElementName(element) {
    var _ref, _ref1, _ref2, _ref3, _ref4;
    var _type_render, _type_render1, _type_type, _type_type1;
    var type = element.type;
    if (typeof type === 'string') {
        return type;
    }
    if (typeof type === 'function') {
        var _type_displayName;
        return (_type_displayName = type.displayName) !== null && _type_displayName !== void 0 ? _type_displayName : type.name;
    }
    return (_ref = (_ref1 = (_ref2 = (_ref3 = (_ref4 = type === null || type === void 0 ? void 0 : type.displayName) !== null && _ref4 !== void 0 ? _ref4 : type === null || type === void 0 ? void 0 : type.name) !== null && _ref3 !== void 0 ? _ref3 : type === null || type === void 0 ? void 0 : (_type_render = type.render) === null || _type_render === void 0 ? void 0 : _type_render.displayName) !== null && _ref2 !== void 0 ? _ref2 : type === null || type === void 0 ? void 0 : (_type_render1 = type.render) === null || _type_render1 === void 0 ? void 0 : _type_render1.name) !== null && _ref1 !== void 0 ? _ref1 : type === null || type === void 0 ? void 0 : (_type_type = type.type) === null || _type_type === void 0 ? void 0 : _type_type.displayName) !== null && _ref !== void 0 ? _ref : type === null || type === void 0 ? void 0 : (_type_type1 = type.type) === null || _type_type1 === void 0 ? void 0 : _type_type1.name;
}
/**
 * @description Searches a render result depth-first for the first element matching a predicate, through children only.
 * @param node A render result: an element, an array of children, or anything else React accepts.
 * @param predicate Decides whether an element is the one being searched for.
 * @param depth The current depth; the search stops past 15 levels.
 * @returns The matching element, or `undefined` when none matches.
 */ function findElement(// UNKNOWN: a component may render any node, not only elements.
node, predicate) {
    var depth = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : 0;
    var _node_props;
    if (depth > MAX_DEPTH || !isElementNode(node)) return;
    if (Array.isArray(node)) {
        var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
        try {
            for(var _iterator = node[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                var child = _step.value;
                var match = findElement(child, predicate, depth + 1);
                if (match) {
                    return match;
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
        return;
    }
    if (predicate(node)) {
        return node;
    }
    return findElement((_node_props = node.props) === null || _node_props === void 0 ? void 0 : _node_props.children, predicate, depth + 1);
}function isRow(value) {
    if (!isElementNode(value) || !isElementNode(value.props) || Array.isArray(value.props)) {
        return false;
    }
    return typeof value.props.label === 'string' && typeof value.props.onPress === 'function';
}
/**
 * @description Recognizes the group that holds an action sheet's rows, including the anonymous group newer Discord builds render.
 * @param value Any node from an action sheet's render result.
 * @returns `true` for an `ActionSheetRowGroup`, or an unnamed element whose children are all labelled rows.
 */ function isActionSheetRowGroup(value) {
    var _value_props, _value_props1;
    if (!isElementNode(value) || Array.isArray(value)) {
        return false;
    }
    if (getElementName(value) === 'ActionSheetRowGroup') {
        return true;
    }
    var children = (_value_props = value.props) === null || _value_props === void 0 ? void 0 : _value_props.children;
    if (typeof ((_value_props1 = value.props) === null || _value_props1 === void 0 ? void 0 : _value_props1.hasIcons) !== 'boolean' || !Array.isArray(children)) {
        return false;
    }
    return children.length > 0 && children.every(isRow);
}var ActionSheets = window.unbound.metro.api.ActionSheets;
var settings = window.unbound.storage.getStore('unbound.translate');
var Patcher = window.unbound.patcher.createPatcher('unbound.translate');function asyncGeneratorStep$2(gen, resolve, reject, _next, _throw, key, arg) {
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
 * @description Builds a URL on the configured translate API.
 * @param path The endpoint path, starting with `/`.
 * @returns The absolute endpoint URL.
 */ function endpoint(path) {
    return settings.get('apiBaseUrl', 'https://translate.unbound.rip') + path;
}
/**
 * @description Stores the tokens the API returned from login or refresh.
 * @param payload The API's token response.
 * @returns The new access token, or `undefined` when the payload is malformed and nothing was stored.
 */ function saveSession(param) {
    var accessToken = param.accessToken, refreshToken = param.refreshToken, expiresIn = param.expiresIn;
    if (typeof accessToken !== 'string' || typeof refreshToken !== 'string' || typeof expiresIn !== 'number') {
        return;
    }
    settings.set('accessToken', accessToken);
    settings.set('refreshToken', refreshToken);
    settings.set('expiresAt', Date.now() + expiresIn * 1000);
    return accessToken;
}
function readSession() {
    var accessToken = settings.get('accessToken', '');
    var refreshToken = settings.get('refreshToken', '');
    var expiresAt = settings.get('expiresAt', 0);
    if (!accessToken || !refreshToken || !expiresAt) return null;
    return {
        accessToken: accessToken,
        refreshToken: refreshToken,
        expiresAt: expiresAt
    };
}
function clearSession() {
    settings.remove('accessToken');
    settings.remove('refreshToken');
    settings.remove('expiresAt');
}
/**
 * @description Exchanges the stored refresh token for new tokens, signing out when the API rejects it.
 * @returns The new access token.
 */ function refreshSession() {
    return _async_to_generator$2(function() {
        var refreshToken, response, reason, accessToken;
        return _ts_generator$2(this, function(_state) {
            switch(_state.label){
                case 0:
                    refreshToken = settings.get('refreshToken', '');
                    if (!refreshToken) {
                        throw new Error('No refresh token configured. Open plugin settings and complete login.');
                    }
                    return [
                        4,
                        fetch(endpoint('/auth/refresh'), {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                refreshToken: refreshToken
                            })
                        })
                    ];
                case 1:
                    response = _state.sent();
                    if (!!response.ok) return [
                        3,
                        3
                    ];
                    if (response.status === 401) clearSession();
                    return [
                        4,
                        response.text().catch(function() {
                            return 'refresh failed';
                        })
                    ];
                case 2:
                    reason = _state.sent();
                    throw new Error("Auth refresh failed (".concat(response.status, "): ").concat(reason));
                case 3:
                    return [
                        4,
                        response.json()
                    ];
                case 4:
                    accessToken = saveSession.apply(void 0, [
                        _state.sent()
                    ]);
                    if (!accessToken) {
                        throw new Error('Auth refresh returned an invalid payload.');
                    }
                    return [
                        2,
                        accessToken
                    ];
            }
        });
    })();
}
/**
 * @description Returns an access token that will not expire mid-request, refreshing it when needed.
 * @returns A usable access token.
 */ function getAccessToken() {
    return _async_to_generator$2(function() {
        var session;
        return _ts_generator$2(this, function(_state) {
            session = readSession();
            // Refresh 15 seconds early so the token cannot expire while a request is in flight.
            if (session && session.expiresAt - 15000 > Date.now()) return [
                2,
                session.accessToken
            ];
            return [
                2,
                refreshSession()
            ];
        });
    })();
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
function _instanceof$1(left, right) {
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
function readTranslation(param) {
    var translatedText = param.translatedText, translations = param.translations;
    var first = Array.isArray(translations) ? translations[0] : undefined;
    for(var _i = 0, _iter = [
        translatedText,
        first === null || first === void 0 ? void 0 : first.translatedText,
        first === null || first === void 0 ? void 0 : first.text
    ]; _i < _iter.length; _i++){
        var value = _iter[_i];
        if (typeof value === 'string') return value;
    }
}
/**
 * @description Translates text between the user's chosen languages, retrying once with fresh tokens on a 401.
 * @param text The text to translate.
 * @returns The translated text.
 */ function translateText(text) {
    return _async_to_generator$1(function() {
        var body, response, reason, translation;
        function request(token) {
            return fetch(endpoint('/translate'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: "Bearer ".concat(token)
                },
                body: body
            });
        }
        return _ts_generator$1(this, function(_state) {
            switch(_state.label){
                case 0:
                    body = JSON.stringify({
                        q: text,
                        source: settings.get('sourceLanguage', 'auto'),
                        target: settings.get('targetLanguage', 'en')
                    });
                    return [
                        4,
                        getAccessToken()
                    ];
                case 1:
                    return [
                        4,
                        request.apply(void 0, [
                            _state.sent()
                        ])
                    ];
                case 2:
                    response = _state.sent();
                    if (!(response.status === 401)) return [
                        3,
                        5
                    ];
                    return [
                        4,
                        refreshSession()
                    ];
                case 3:
                    return [
                        4,
                        request.apply(void 0, [
                            _state.sent()
                        ])
                    ];
                case 4:
                    response = _state.sent();
                    _state.label = 5;
                case 5:
                    if (!!response.ok) return [
                        3,
                        7
                    ];
                    return [
                        4,
                        response.text().catch(function() {
                            return 'translation failed';
                        })
                    ];
                case 6:
                    reason = _state.sent();
                    throw new Error("Translate failed (".concat(response.status, "): ").concat(reason));
                case 7:
                    return [
                        4,
                        response.json()
                    ];
                case 8:
                    translation = readTranslation.apply(void 0, [
                        _state.sent()
                    ]);
                    if (translation === undefined) {
                        throw new Error('Translation API returned an unexpected payload.');
                    }
                    return [
                        2,
                        translation
                    ];
            }
        });
    })();
}
/**
 * @description Translates a message, copies the result, and shows it in a toast.
 * @param content The message text.
 * @returns A promise that settles once the user has been told the outcome.
 */ function copyTranslation(content) {
    return _async_to_generator$1(function() {
        var translated, error;
        return _ts_generator$1(this, function(_state) {
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
                        translateText(content)
                    ];
                case 1:
                    translated = _state.sent();
                    return [
                        4,
                        window.unbound.metro.common.Clipboard.setString(translated)
                    ];
                case 2:
                    _state.sent();
                    window.unbound.toasts.showToast({
                        title: 'Translated',
                        content: translated
                    });
                    return [
                        3,
                        4
                    ];
                case 3:
                    error = _state.sent();
                    window.unbound.toasts.showToast({
                        title: 'Translate Error',
                        content: _instanceof$1(error, Error) ? error.message : String(error)
                    });
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
}/**
 * @description Adds a Translate row to the message long-press action sheet, patching each sheet module as Discord lazy-loads it.
 * @returns A function that removes the row and ignores sheets still loading.
 */ function patchActionSheets() {
    var message;
    var sheetKey;
    // UNKNOWN: an action sheet may render any node.
    function addTranslateRow(result) {
        var _findElement_props, _findElement;
        var rows = (_findElement = findElement(result, isActionSheetRowGroup)) === null || _findElement === void 0 ? void 0 : (_findElement_props = _findElement.props) === null || _findElement_props === void 0 ? void 0 : _findElement_props.children;
        if (!(message === null || message === void 0 ? void 0 : message.content.trim()) || !Array.isArray(rows)) return result;
        if (rows.some(function(row) {
            return (row === null || row === void 0 ? void 0 : row.key) === 'unbound-translate';
        })) return result;
        var ActionSheetRow = getActionSheetRow();
        var content = message.content;
        var icon = window.unbound.assets.getIDByName('LanguageIcon');
        function onPress() {
            if (sheetKey) ActionSheets.hideActionSheet(sheetKey);
            void copyTranslation(content);
        }
        rows.splice(1, 0, /*#__PURE__*/ React.createElement(ActionSheetRow, {
            key: "unbound-translate",
            label: "Translate",
            icon: icon ? /*#__PURE__*/ React.createElement(ActionSheetRow.Icon, {
                source: icon
            }) : undefined,
            onPress: onPress
        }));
        return result;
    }
    return patchLazySheets(Patcher, ActionSheets, function(key, props) {
        if (!key.endsWith('MessageLongPressActionSheet')) return;
        if (props.message) message = props.message;
        sheetKey = key;
        return addTranslateRow;
    });
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
 * @description Opens a component as a Discord action sheet that can close itself.
 * @template P The sheet's own props.
 * @param key A key unique to this sheet.
 * @param Sheet The sheet component, which also receives `onClose`.
 * @param props The sheet's own props.
 */ function openSheet(key, Sheet, props) {
    var ActionSheets = window.unbound.metro.api.ActionSheets;
    ActionSheets.openLazy(Promise.resolve({
        default: Sheet
    }), key, _object_spread_props(_object_spread({}, props), {
        onClose: function onClose() {
            return ActionSheets.hideActionSheet(key);
        }
    }));
}var LANGUAGES = [
    {
        code: 'ar',
        name: 'Arabic',
        nativeName: 'العربية'
    },
    {
        code: 'az',
        name: 'Azerbaijani',
        nativeName: 'Azərbaycanca'
    },
    {
        code: 'bg',
        name: 'Bulgarian',
        nativeName: 'Български'
    },
    {
        code: 'ca',
        name: 'Catalan',
        nativeName: 'Català'
    },
    {
        code: 'zh',
        name: 'Chinese',
        nativeName: '中文'
    },
    {
        code: 'cs',
        name: 'Czech',
        nativeName: 'Čeština'
    },
    {
        code: 'da',
        name: 'Danish',
        nativeName: 'Dansk'
    },
    {
        code: 'nl',
        name: 'Dutch',
        nativeName: 'Nederlands'
    },
    {
        code: 'en',
        name: 'English'
    },
    {
        code: 'eo',
        name: 'Esperanto'
    },
    {
        code: 'et',
        name: 'Estonian',
        nativeName: 'Eesti'
    },
    {
        code: 'fi',
        name: 'Finnish',
        nativeName: 'Suomi'
    },
    {
        code: 'fr',
        name: 'French',
        nativeName: 'Français'
    },
    {
        code: 'de',
        name: 'German',
        nativeName: 'Deutsch'
    },
    {
        code: 'el',
        name: 'Greek',
        nativeName: 'Ελληνικά'
    },
    {
        code: 'he',
        name: 'Hebrew',
        nativeName: 'עברית'
    },
    {
        code: 'hi',
        name: 'Hindi',
        nativeName: 'हिन्दी'
    },
    {
        code: 'hu',
        name: 'Hungarian',
        nativeName: 'Magyar'
    },
    {
        code: 'id',
        name: 'Indonesian',
        nativeName: 'Bahasa Indonesia'
    },
    {
        code: 'it',
        name: 'Italian',
        nativeName: 'Italiano'
    },
    {
        code: 'ja',
        name: 'Japanese',
        nativeName: '日本語'
    },
    {
        code: 'ko',
        name: 'Korean',
        nativeName: '한국어'
    },
    {
        code: 'lv',
        name: 'Latvian',
        nativeName: 'Latviešu'
    },
    {
        code: 'lt',
        name: 'Lithuanian',
        nativeName: 'Lietuvių'
    },
    {
        code: 'fa',
        name: 'Persian',
        nativeName: 'فارسی'
    },
    {
        code: 'pl',
        name: 'Polish',
        nativeName: 'Polski'
    },
    {
        code: 'pt',
        name: 'Portuguese',
        nativeName: 'Português'
    },
    {
        code: 'ro',
        name: 'Romanian',
        nativeName: 'Română'
    },
    {
        code: 'ru',
        name: 'Russian',
        nativeName: 'Русский'
    },
    {
        code: 'sk',
        name: 'Slovak',
        nativeName: 'Slovenčina'
    },
    {
        code: 'sl',
        name: 'Slovenian',
        nativeName: 'Slovenščina'
    },
    {
        code: 'es',
        name: 'Spanish',
        nativeName: 'Español'
    },
    {
        code: 'sv',
        name: 'Swedish',
        nativeName: 'Svenska'
    },
    {
        code: 'tr',
        name: 'Turkish',
        nativeName: 'Türkçe'
    },
    {
        code: 'uk',
        name: 'Ukrainian',
        nativeName: 'Українська'
    }
];function _array_like_to_array$3(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_without_holes(arr) {
    if (Array.isArray(arr)) return _array_like_to_array$3(arr);
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
    return _array_without_holes(arr) || _iterable_to_array(arr) || _unsupported_iterable_to_array$3(arr) || _non_iterable_spread();
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
 * @description Formats a language for the picker, adding its native name when it differs.
 * @param language The language to label.
 * @returns A label such as `German (Deutsch)`.
 */ function languageLabel(param) {
    var name = param.name, nativeName = param.nativeName;
    return nativeName && nativeName !== name ? "".concat(name, " (").concat(nativeName, ")") : name;
}
/**
 * @description Lists the languages whose code, name, or native name contains the query.
 * @param query The user's search text; blank matches every language.
 * @param includeAuto Whether to lead with the "Auto detect" choice, which ignores the query.
 * @returns The picker's rows in display order.
 */ function searchLanguages(query) {
    var includeAuto = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : false;
    var needle = query.trim().toLowerCase();
    var matches = LANGUAGES.filter(function(param) {
        var code = param.code, name = param.name, nativeName = param.nativeName;
        return code.toLowerCase().includes(needle) || name.toLowerCase().includes(needle) || (nativeName === null || nativeName === void 0 ? void 0 : nativeName.toLowerCase().includes(needle));
    });
    return includeAuto ? [
        {
            code: 'auto',
            name: 'Auto detect'
        }
    ].concat(_to_consumable_array(matches)) : matches;
}function _array_like_to_array$2(arr, len) {
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
    return _array_with_holes$2(arr) || _iterable_to_array_limit$2(arr, i) || _unsupported_iterable_to_array$2(arr, i) || _non_iterable_rest$2();
}
function _unsupported_iterable_to_array$2(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _array_like_to_array$2(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(n);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _array_like_to_array$2(o, minLen);
}
function LanguagePickerSheet(param) {
    var title = param.title, current = param.current, includeAuto = param.includeAuto, onSelect = param.onSelect, onClose = param.onClose;
    var _ref, _assets_getIDByName;
    var _useState = _sliced_to_array$2(window.React.useState(''), 2), query = _useState[0], setQuery = _useState[1];
    var ActionSheetRow = getActionSheetRow();
    var checkIcon = (_ref = (_assets_getIDByName = window.unbound.assets.getIDByName('CheckmarkLargeIcon')) !== null && _assets_getIDByName !== void 0 ? _assets_getIDByName : window.unbound.assets.getIDByName('CheckIcon')) !== null && _ref !== void 0 ? _ref : window.unbound.assets.getIDByName('CheckmarkIcon');
    var rows = searchLanguages(query, includeAuto);
    return /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.ActionSheet, null, /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.Text, {
        variant: "heading-lg/semibold",
        style: {
            paddingHorizontal: 16,
            paddingTop: 8,
            paddingBottom: 12
        }
    }, title), /*#__PURE__*/ React.createElement(window.ReactNative.View, {
        style: {
            paddingHorizontal: 16,
            paddingBottom: 12
        }
    }, /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TextField, {
        size: "md",
        value: query,
        onChange: setQuery,
        isClearable: true,
        isRound: true,
        placeholder: "Search languages"
    })), /*#__PURE__*/ React.createElement(ActionSheetRow.Group, null, rows.map(function(language) {
        return /*#__PURE__*/ React.createElement(ActionSheetRow, {
            key: language.code,
            label: languageLabel(language),
            subLabel: language.code,
            icon: language.code === current && checkIcon ? /*#__PURE__*/ React.createElement(ActionSheetRow.Icon, {
                source: checkIcon
            }) : undefined,
            onPress: function onPress() {
                onSelect(language.code);
                onClose();
            }
        });
    }), rows.length ? null : /*#__PURE__*/ React.createElement(ActionSheetRow, {
        label: "No matches",
        onPress: onClose
    })));
}
/**
 * @description Opens the language picker as a Discord action sheet.
 * @param options The sheet's title, the selected language, whether to offer auto detect, and the selection callback.
 */ function openLanguagePicker(options) {
    openSheet("unbound-translate-".concat(options.title, "-").concat(options.current), LanguagePickerSheet, options);
}/**
 * @description Opens Discord's in-app OAuth2 authorize screen and waits for the user's answer.
 * @param options The application's client ID, redirect URI, scopes and optional state.
 * @returns The redirect URL Discord produced, or `undefined` when the user cancelled or closed the screen.
 */ function authorize(param) {
    var clientId = param.clientId, redirectUri = param.redirectUri, scopes = param.scopes, state = param.state;
    return new Promise(function(resolve) {
        window.unbound.metro.api.OAuth2.openOAuth2Modal({
            clientId: clientId,
            redirectUri: redirectUri,
            scopes: scopes,
            state: state,
            responseType: 'code',
            permissions: 0n,
            cancelCompletesFlow: false,
            callback: function callback(param) {
                var location = param.location, canceled = param.canceled;
                resolve(canceled || !location ? undefined : location);
            },
            onClose: function onClose() {
                return resolve(undefined);
            }
        });
    });
}function _array_like_to_array$1(arr, len) {
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
/**
 * @description Reads the query parameters of a URL by hand, since `URL`'s query support differs across React Native versions.
 * @param location The URL to read.
 * @returns The decoded parameters; the first value wins for a repeated key.
 */ function readQuery(location) {
    var _ref;
    var _location_split_;
    var query = (_ref = (_location_split_ = location.split('#')[0]) === null || _location_split_ === void 0 ? void 0 : _location_split_.split('?')[1]) !== null && _ref !== void 0 ? _ref : '';
    var params = {};
    var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
    try {
        for(var _iterator = query.split('&')[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
            var pair = _step.value;
            var _pair_split = _sliced_to_array$1(pair.split('='), 2), tmp = _pair_split[0], key = tmp === void 0 ? '' : tmp, tmp1 = _pair_split[1], value = tmp1 === void 0 ? '' : tmp1;
            var name = decodeURIComponent(key);
            if (name && !(name in params)) {
                params[name] = decodeURIComponent(value.replace(/\+/g, ' '));
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
    return params;
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
function _instanceof(left, right) {
    "@swc/helpers - instanceof";
    if (right != null && typeof Symbol !== "undefined" && right[Symbol.hasInstance]) {
        return !!right[Symbol.hasInstance](left);
    } else return left instanceof right;
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
function notify(content) {
    window.unbound.toasts.showToast({
        title: 'Translate',
        content: content
    });
}
function finishLogin(location, redirectUri) {
    return _async_to_generator(function() {
        var params, response, raw, payload;
        return _ts_generator(this, function(_state) {
            switch(_state.label){
                case 0:
                    params = readQuery(location);
                    if (params.error) {
                        if (params.error !== 'access_denied') notify(params.error_description || params.error);
                        return [
                            2
                        ];
                    }
                    if (!location.startsWith(redirectUri) || !params.code || !params.state) return [
                        2
                    ];
                    return [
                        4,
                        fetch(location, {
                            headers: {
                                Accept: 'application/json'
                            }
                        })
                    ];
                case 1:
                    response = _state.sent();
                    return [
                        4,
                        response.text()
                    ];
                case 2:
                    raw = _state.sent();
                    try {
                        payload = JSON.parse(raw);
                    } catch (unused) {
                        throw new Error(response.ok ? 'Discord login returned an invalid payload.' : raw.trim() || 'Discord login failed.');
                    }
                    if (!response.ok) {
                        throw new Error(typeof payload.error === 'string' ? payload.error : 'Discord login failed.');
                    }
                    if (!saveSession(payload)) {
                        throw new Error('Discord login returned an invalid payload.');
                    }
                    notify('Discord login completed.');
                    return [
                        2
                    ];
            }
        });
    })();
}
/**
 * @description Signs the user in to the translate API through Discord's OAuth2 authorize screen.
 * @returns A promise that settles when the flow ends, whether it succeeded, failed, or was cancelled.
 */ function connectDiscord() {
    return _async_to_generator(function() {
        var redirectUri, _login_headers_get, login, _readQuery, clientId, state, location, error;
        return _ts_generator(this, function(_state) {
            switch(_state.label){
                case 0:
                    redirectUri = endpoint('/auth/callback');
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
                        fetch(endpoint('/auth/login'), {
                            redirect: 'manual'
                        })
                    ];
                case 2:
                    login = _state.sent();
                    _readQuery = readQuery((_login_headers_get = login.headers.get('location')) !== null && _login_headers_get !== void 0 ? _login_headers_get : login.url), clientId = _readQuery.client_id, state = _readQuery.state;
                    if (!clientId || !state) {
                        notify(login.ok ? 'OAuth configuration is incomplete.' : "The translate service is unavailable (HTTP ".concat(login.status, ")."));
                        return [
                            2
                        ];
                    }
                    return [
                        4,
                        authorize({
                            clientId: clientId,
                            redirectUri: redirectUri,
                            state: state,
                            scopes: [
                                'identify',
                                'email',
                                'guilds'
                            ]
                        })
                    ];
                case 3:
                    location = _state.sent();
                    if (!location) return [
                        3,
                        5
                    ];
                    return [
                        4,
                        finishLogin(location, redirectUri)
                    ];
                case 4:
                    _state.sent();
                    _state.label = 5;
                case 5:
                    return [
                        3,
                        7
                    ];
                case 6:
                    error = _state.sent();
                    notify(_instanceof(error, Error) ? error.message : 'Connect flow failed unexpectedly.');
                    return [
                        3,
                        7
                    ];
                case 7:
                    return [
                        2
                    ];
            }
        });
    })();
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
function SettingsPanel() {
    var store = settings.useSettingsStore();
    var _useState = _sliced_to_array(window.React.useState(false), 2), connecting = _useState[0], setConnecting = _useState[1];
    var signedIn = Boolean(store.get('refreshToken', ''));
    var sourceLanguage = store.get('sourceLanguage', 'auto');
    var targetLanguage = store.get('targetLanguage', 'en');
    function connect() {
        setConnecting(true);
        void connectDiscord().finally(function() {
            return setConnecting(false);
        });
    }
    return /*#__PURE__*/ React.createElement(Page, null, /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TableRowGroup, {
        title: "Translate API"
    }, /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TableRow, {
        label: connecting ? 'Connecting Discord account…' : signedIn ? 'Reconnect Discord account' : 'Connect Discord account',
        subLabel: connecting ? 'Finishing Discord authorization' : signedIn ? 'Re-authenticate with Discord' : 'Sign in to enable translation',
        disabled: connecting,
        onPress: connect
    })), /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TableRowGroup, {
        title: "Languages"
    }, /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TableRow, {
        label: "Source Language",
        subLabel: sourceLanguage,
        arrow: true,
        disabled: !signedIn,
        onPress: function onPress() {
            return openLanguagePicker({
                title: 'Select source language',
                current: sourceLanguage,
                includeAuto: true,
                onSelect: function onSelect(code) {
                    return store.set('sourceLanguage', code);
                }
            });
        }
    }), /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TableRow, {
        label: "Target Language",
        subLabel: targetLanguage,
        arrow: true,
        disabled: !signedIn,
        onPress: function onPress() {
            return openLanguagePicker({
                title: 'Select target language',
                current: targetLanguage,
                onSelect: function onSelect(code) {
                    return store.set('targetLanguage', code);
                }
            });
        }
    })));
}var dispose = function dispose() {};
function start() {
    if (!ensureModules('Translate', {
        ActionSheets: ActionSheets
    })) return;
    dispose = applyFeatures('Translate', [
        patchActionSheets
    ]);
}
function stop() {
    dispose();
    dispose = function dispose() {};
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