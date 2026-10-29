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
}function _array_like_to_array$5(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_without_holes$1(arr) {
    if (Array.isArray(arr)) return _array_like_to_array$5(arr);
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
    return _array_without_holes$1(arr) || _iterable_to_array$1(arr) || _unsupported_iterable_to_array$5(arr) || _non_iterable_spread$1();
}
function _unsupported_iterable_to_array$5(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _array_like_to_array$5(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(n);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _array_like_to_array$5(o, minLen);
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
}// Messages sent to the Vencord Text Replace rules channel are shared rules, so they are never rewritten.
var RULES_CHANNEL_ID = '1102784112584040479';
var RULESET_VERSION = 1;
var RuleKinds = {
    stringRules: {
        noun: 'text',
        title: 'Text rules',
        description: 'Simple text replacements that work as you type.',
        tag: '',
        findLabel: 'Find text',
        findPlaceholder: 'What should change?',
        help: 'This replaces every matching piece of text before the message is sent.'
    },
    regexRules: {
        noun: 'regex',
        title: 'Regex rules',
        description: 'Powerful pattern replacements for advanced rules.',
        tag: 'Regex · ',
        findLabel: 'Pattern',
        findPlaceholder: '/pattern/gi',
        help: 'Use a JavaScript pattern such as /hello/gi. Invalid patterns are skipped when sending.'
    }
};function _type_of$1(obj) {
    "@swc/helpers - typeof";
    return obj && typeof Symbol !== "undefined" && obj.constructor === Symbol ? "symbol" : typeof obj;
}
/**
 * @description Checks whether a rule has any field filled in.
 * @param rule The rule to check.
 * @returns `false` for a rule left completely blank.
 */ function hasRuleContent(rule) {
    return Boolean(rule.find || rule.replace || rule.onlyIfIncludes);
}
function exportRules(rules) {
    return rules.filter(hasRuleContent).map(function(param) {
        var find = param.find, replace = param.replace, onlyIfIncludes = param.onlyIfIncludes;
        return {
            find: find,
            replace: replace,
            onlyIfIncludes: onlyIfIncludes
        };
    });
}
/**
 * @description Encodes both rule lists as portable JSON, without the device-local rule ids.
 * @param ruleset The text and regex rules.
 * @returns Pretty-printed JSON.
 */ function serializeRuleset(param) {
    var stringRules = param.stringRules, regexRules = param.regexRules;
    return JSON.stringify({
        version: RULESET_VERSION,
        stringRules: exportRules(stringRules),
        regexRules: exportRules(regexRules)
    }, null, 2);
}
/**
 * @description Decodes a ruleset exported by {@link serializeRuleset}, giving each rule a fresh id.
 * @param value The JSON text.
 * @returns The non-blank text and regex rules. Throws an `Error` with a user-facing message when the JSON is invalid or unsupported.
 */ function parseRuleset(value) {
    var parsed;
    try {
        parsed = JSON.parse(value);
    } catch (unused) {
        throw new Error('This is not valid JSON.');
    }
    if (!parsed || (typeof parsed === "undefined" ? "undefined" : _type_of$1(parsed)) !== 'object') {
        throw new Error('This is not a Text Replace ruleset.');
    }
    var version = parsed.version, stringRules = parsed.stringRules, regexRules = parsed.regexRules;
    if (version !== RULESET_VERSION || !Array.isArray(stringRules) || !Array.isArray(regexRules)) {
        throw new Error('This Text Replace ruleset is unsupported.');
    }
    return {
        stringRules: normalizeRules(stringRules).filter(hasRuleContent),
        regexRules: normalizeRules(regexRules).filter(hasRuleContent)
    };
}var Messages = window.unbound.metro.api.Messages;
var settings = window.unbound.storage.getStore('unbound.text-replace');
var Patcher = window.unbound.patcher.createPatcher('unbound.text-replace');function _array_like_to_array$4(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_without_holes(arr) {
    if (Array.isArray(arr)) return _array_like_to_array$4(arr);
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
    return _array_without_holes(arr) || _iterable_to_array(arr) || _unsupported_iterable_to_array$4(arr) || _non_iterable_spread();
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
 * @description Rewrites both stored rule lists in their normalized shape, so every rule has an id.
 */ function normalizeStoredRules() {
    for(var _i = 0, _iter = [
        'stringRules',
        'regexRules'
    ]; _i < _iter.length; _i++){
        var kind = _iter[_i];
        settings.set(kind, normalizeRules(settings.get(kind, [])));
    }
}
/**
 * @description Reads one stored rule list, without blank rules.
 * @param kind Which list to read.
 * @param store The store to read through; pass the `useSettingsStore` result to re-render on changes.
 * @returns The rules.
 */ function readRules(kind) {
    var store = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : settings;
    return normalizeRules(store.get(kind, [])).filter(hasRuleContent);
}
/**
 * @description Reads both stored rule lists, without blank rules.
 * @param store The store to read through; pass the `useSettingsStore` result to re-render on changes.
 * @returns The text and regex rules.
 */ function readRuleset() {
    var store = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : settings;
    return {
        stringRules: readRules('stringRules', store),
        regexRules: readRules('regexRules', store)
    };
}
// An empty list is stored as one blank rule.
function saveRules(kind, rules) {
    settings.set(kind, rules.length ? rules : [
        createRule()
    ]);
}
/**
 * @description Replaces both stored rule lists.
 * @param ruleset The text and regex rules.
 */ function saveRuleset(param) {
    var stringRules = param.stringRules, regexRules = param.regexRules;
    saveRules('stringRules', stringRules);
    saveRules('regexRules', regexRules);
}
/**
 * @description Stores a rule: a new rule is appended, an edited one replaces the rule with its id.
 * @param kind Which list the rule belongs to.
 * @param rule The rule to store.
 * @param isNew Whether the rule was just created.
 */ function saveRule(kind, rule, isNew) {
    var rules = readRules(kind);
    saveRules(kind, isNew ? _to_consumable_array(rules).concat([
        rule
    ]) : rules.map(function(current) {
        return current.id === rule.id ? rule : current;
    }));
}
/**
 * @description Removes a stored rule.
 * @param kind Which list the rule belongs to.
 * @param id The rule's id.
 */ function deleteRule(kind, id) {
    saveRules(kind, readRules(kind).filter(function(rule) {
        return rule.id !== id;
    }));
}function _type_of(obj) {
    "@swc/helpers - typeof";
    return obj && typeof Symbol !== "undefined" && obj.constructor === Symbol ? "symbol" : typeof obj;
}
function isMessage(argument) {
    return (typeof argument === "undefined" ? "undefined" : _type_of(argument)) === 'object' && typeof (argument === null || argument === void 0 ? void 0 : argument.content) === 'string';
}
/**
 * @description Rewrites each outgoing message with the stored rules before Discord sends it.
 * @returns A function that removes the patch.
 */ function patchMessageActions() {
    return Patcher.before(Messages, 'sendMessage', function(param) {
        var args = param.args;
        if (args[0] === RULES_CHANNEL_ID) return;
        var message = args.find(isMessage);
        if (!(message === null || message === void 0 ? void 0 : message.content)) return;
        message.content = applyRules(message.content, readRules('stringRules'), readRules('regexRules'));
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
function copy(value) {
    return _async_to_generator$1(function() {
        return _ts_generator$1(this, function(_state) {
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
                        window.unbound.metro.common.Clipboard.setString(value)
                    ];
                case 1:
                    _state.sent();
                    return [
                        2,
                        true
                    ];
                case 2:
                    _state.sent();
                    return [
                        2,
                        false
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
 * @description Copies the ruleset JSON to the clipboard and opens the share sheet with it.
 * @param ruleset The text and regex rules.
 * @returns Resolves once the share sheet closes and the result toast is shown.
 */ function shareRuleset(ruleset) {
    return _async_to_generator$1(function() {
        var value, copied, content;
        return _ts_generator$1(this, function(_state) {
            switch(_state.label){
                case 0:
                    value = serializeRuleset(ruleset);
                    return [
                        4,
                        copy(value)
                    ];
                case 1:
                    copied = _state.sent();
                    _state.label = 2;
                case 2:
                    _state.trys.push([
                        2,
                        4,
                        ,
                        5
                    ]);
                    return [
                        4,
                        window.ReactNative.Share.share({
                            message: value
                        })
                    ];
                case 3:
                    _state.sent();
                    content = copied ? 'Ruleset copied and ready to share.' : 'Ruleset shared.';
                    return [
                        3,
                        5
                    ];
                case 4:
                    _state.sent();
                    content = copied ? 'Ruleset copied to your clipboard.' : 'Sharing is unavailable on this client build.';
                    return [
                        3,
                        5
                    ];
                case 5:
                    window.unbound.toasts.showToast({
                        title: 'Text Replace',
                        content: content
                    });
                    return [
                        2
                    ];
            }
        });
    })();
}
/**
 * @description Reads the clipboard's text.
 * @returns The text, or an empty string when the clipboard cannot be read.
 */ function readClipboard() {
    return _async_to_generator$1(function() {
        return _ts_generator$1(this, function(_state) {
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
                        window.unbound.metro.common.Clipboard.getString()
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
                        ''
                    ];
                case 3:
                    return [
                        2
                    ];
            }
        });
    })();
}function _array_like_to_array$3(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_with_holes$3(arr) {
    if (Array.isArray(arr)) return arr;
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
function _instanceof(left, right) {
    "@swc/helpers - instanceof";
    if (right != null && typeof Symbol !== "undefined" && right[Symbol.hasInstance]) {
        return !!right[Symbol.hasInstance](left);
    } else return left instanceof right;
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
    return _array_with_holes$3(arr) || _iterable_to_array_limit$3(arr, i) || _unsupported_iterable_to_array$3(arr, i) || _non_iterable_rest$3();
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
function _unsupported_iterable_to_array$3(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _array_like_to_array$3(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(n);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _array_like_to_array$3(o, minLen);
}
function importRuleset(value) {
    try {
        saveRuleset(parseRuleset(value));
        window.unbound.toasts.showToast({
            title: 'Text Replace',
            content: 'Ruleset imported.'
        });
        return true;
    } catch (error) {
        window.unbound.toasts.showToast({
            title: 'Text Replace',
            content: _instanceof(error, Error) ? error.message : 'Could not import ruleset.'
        });
        return false;
    }
}
function RulesetTransfer(param) {
    var ruleset = param.ruleset;
    var _useState = _sliced_to_array$3(window.React.useState(''), 2), pasted = _useState[0], setPasted = _useState[1];
    function importValue(value) {
        if (importRuleset(value)) {
            setPasted('');
        }
    }
    function importClipboard() {
        return _async_to_generator(function() {
            var value;
            return _ts_generator(this, function(_state) {
                switch(_state.label){
                    case 0:
                        return [
                            4,
                            readClipboard()
                        ];
                    case 1:
                        value = _state.sent();
                        if (!value.trim()) {
                            window.unbound.toasts.showToast({
                                title: 'Text Replace',
                                content: 'Your clipboard does not contain a ruleset.'
                            });
                            return [
                                2
                            ];
                        }
                        importValue(value);
                        return [
                            2
                        ];
                }
            });
        })();
    }
    return /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.Stack, {
        spacing: 12
    }, /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TableRowGroup, {
        title: "Share rules",
        description: "Export or import both rule lists as portable JSON."
    }, /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TableRow, {
        label: "Export & share",
        onPress: function onPress() {
            return void shareRuleset(ruleset);
        }
    }), /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TableRow, {
        label: "Import clipboard",
        onPress: function onPress() {
            return void importClipboard();
        }
    })), /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TextInput, {
        label: "Paste JSON",
        placeholder: "Paste exported Text Replace JSON here",
        autoCapitalize: "none",
        autoCorrect: false,
        multiline: true,
        value: pasted,
        onChange: setPasted
    }), /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.Button, {
        text: "Import pasted",
        variant: "secondary",
        disabled: !pasted.trim(),
        onPress: function onPress() {
            return importValue(pasted);
        }
    }));
}function _array_like_to_array$2(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_with_holes$2(arr) {
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
function RuleEditor(param) {
    var kind = param.kind, rule = param.rule, isNew = param.isNew, onClose = param.onClose;
    var _useState = _sliced_to_array$2(window.React.useState(rule), 2), draft = _useState[0], setDraft = _useState[1];
    var _RuleKinds_kind = RuleKinds[kind], noun = _RuleKinds_kind.noun, findLabel = _RuleKinds_kind.findLabel, findPlaceholder = _RuleKinds_kind.findPlaceholder, help = _RuleKinds_kind.help;
    function update(field, value) {
        setDraft(function(current) {
            return _object_spread_props$1(_object_spread$1({}, current), _define_property$1({}, field, value));
        });
    }
    function save() {
        saveRule(kind, draft, isNew);
        onClose();
    }
    function remove() {
        deleteRule(kind, rule.id);
        onClose();
    }
    return /*#__PURE__*/ React.createElement(Page, null, /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.Stack, {
        spacing: 8,
        align: "start"
    }, /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.Button, {
        text: "‹ Back to rules",
        variant: "tertiary",
        size: "sm",
        onPress: onClose
    }), /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.Text, {
        variant: "heading-xl/bold"
    }, isNew ? "New ".concat(noun, " rule") : 'Edit rule'), /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.Text, {
        variant: "text-md/normal",
        color: "text-muted"
    }, help)), /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TextInput, {
        label: findLabel,
        placeholder: findPlaceholder,
        autoCapitalize: "none",
        autoCorrect: false,
        value: draft.find,
        onChange: function onChange(value) {
            return update('find', value);
        }
    }), /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TextInput, {
        label: "Replace with",
        placeholder: "What should it become? Use \\\\n for a new line.",
        autoCapitalize: "none",
        autoCorrect: false,
        multiline: true,
        value: draft.replace,
        onChange: function onChange(value) {
            return update('replace', value);
        }
    }), /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TextInput, {
        label: "Only when the message contains",
        placeholder: "Optional condition",
        description: "Leave this blank to apply the rule everywhere.",
        autoCapitalize: "none",
        autoCorrect: false,
        value: draft.onlyIfIncludes,
        onChange: function onChange(value) {
            return update('onlyIfIncludes', value);
        }
    }), /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.Stack, {
        spacing: 12
    }, /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.Button, {
        text: "Save rule",
        disabled: !draft.find.trim(),
        onPress: save
    }), isNew ? null : /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.Button, {
        text: "Delete rule",
        variant: "destructive",
        onPress: remove
    })));
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
function RuleTester(param) {
    var ruleset = param.ruleset;
    var _useState = _sliced_to_array$1(window.React.useState(true), 2), shown = _useState[0], setShown = _useState[1];
    var _useState1 = _sliced_to_array$1(window.React.useState(''), 2), example = _useState1[0], setExample = _useState1[1];
    return /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.Stack, {
        spacing: 12
    }, /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TableRowGroup, {
        title: "Try your rules"
    }, /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TableRow, {
        label: "Test your rules",
        trailing: /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TableRow.TrailingText, {
            text: shown ? '⌃' : '⌄'
        }),
        onPress: function onPress() {
            return setShown(function(value) {
                return !value;
            });
        }
    })), shown ? /*#__PURE__*/ React.createElement(React.Fragment, null, /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TextInput, {
        label: "Example message",
        placeholder: "Type a message to test",
        autoCapitalize: "none",
        autoCorrect: false,
        multiline: true,
        value: example,
        onChange: setExample
    }), /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TableRowGroup, {
        title: "Result"
    }, /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TableRow, {
        label: applyRules(example, ruleset.stringRules, ruleset.regexRules) || 'Your transformed message will appear here.'
    }))) : null);
}function RuleSummary(param) {
    var rule = param.rule, tag = param.tag;
    var condition = rule.onlyIfIncludes ? "Only when it includes “".concat(rule.onlyIfIncludes, "”") : 'Applies to every message';
    return /*#__PURE__*/ React.createElement(window.ReactNative.View, null, /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.Text, {
        variant: "text-xs/medium",
        color: "text-muted",
        lineClamp: 1
    }, "→ ", rule.replace || 'Remove it'), /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.Text, {
        variant: "text-xs/medium",
        color: "text-muted",
        lineClamp: 1
    }, tag, condition));
}
function RuleList(param) {
    var kind = param.kind, rules = param.rules, onAdd = param.onAdd, onEdit = param.onEdit;
    var _RuleKinds_kind = RuleKinds[kind], noun = _RuleKinds_kind.noun, title = _RuleKinds_kind.title, description = _RuleKinds_kind.description, tag = _RuleKinds_kind.tag;
    return /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TableRowGroup, {
        title: "".concat(title, " \xb7 ").concat(rules.length),
        description: description
    }, rules.length ? rules.map(function(rule) {
        return /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TableRow, {
            key: rule.id,
            label: rule.find,
            subLabel: /*#__PURE__*/ React.createElement(RuleSummary, {
                rule: rule,
                tag: tag
            }),
            labelLineClamp: 1,
            arrow: true,
            onPress: function onPress() {
                return onEdit(rule);
            }
        });
    }) : /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TableRow, {
        label: "No rules yet",
        subLabel: "Add one when you are ready."
    }), /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TableRow, {
        label: "Add ".concat(noun, " rule"),
        onPress: onAdd
    }));
}function _array_like_to_array(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_with_holes(arr) {
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
    var _useState = _sliced_to_array(window.React.useState('stringRules'), 2), kind = _useState[0], setKind = _useState[1];
    var _useState1 = _sliced_to_array(window.React.useState(null), 2), editing = _useState1[0], setEditing = _useState1[1];
    var ruleset = readRuleset(store);
    if (editing) {
        return /*#__PURE__*/ React.createElement(RuleEditor, _object_spread_props(_object_spread({}, editing), {
            onClose: function onClose() {
                return setEditing(null);
            }
        }));
    }
    return /*#__PURE__*/ React.createElement(Page, null, /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.Stack, {
        spacing: 8
    }, /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.Text, {
        variant: "heading-xl/bold"
    }, "Text Replace"), /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.Text, {
        variant: "text-md/normal",
        color: "text-muted"
    }, "Automatically rewrite messages before you send them.")), /*#__PURE__*/ React.createElement(RuleTester, {
        ruleset: ruleset
    }), /*#__PURE__*/ React.createElement(RulesetTransfer, {
        ruleset: ruleset
    }), /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TableRadioGroup, {
        title: "Rule type",
        value: kind,
        onChange: setKind
    }, /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TableRadioRow, {
        label: "Text",
        value: "stringRules"
    }), /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TableRadioRow, {
        label: "Regex",
        value: "regexRules"
    })), /*#__PURE__*/ React.createElement(RuleList, {
        kind: kind,
        rules: ruleset[kind],
        onAdd: function onAdd() {
            return setEditing({
                kind: kind,
                rule: createRule(),
                isNew: true
            });
        },
        onEdit: function onEdit(rule) {
            return setEditing({
                kind: kind,
                rule: rule,
                isNew: false
            });
        }
    }));
}var dispose = function dispose() {};
function start() {
    normalizeStoredRules();
    if (!ensureModules('Text Replace', {
        Messages: Messages
    })) return;
    dispose = applyFeatures('Text Replace', [
        patchMessageActions
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