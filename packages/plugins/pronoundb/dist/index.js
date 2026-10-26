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
}var MessageRowData = window.unbound.metro.findByProps('generateMessageRowData', {
    lazy: true
});
var UserProfileStore = window.unbound.metro.findStore('UserProfile', {
    lazy: true
});
var ChannelStore = window.unbound.metro.findStore('Channel', {
    lazy: true
});
var MessageStore = window.unbound.metro.findStore('Message', {
    lazy: true
});
var UserStore = window.unbound.metro.stores.Users;
var settings = window.unbound.storage.getStore('unbound.pronoundb');
var Patcher = window.unbound.patcher.createPatcher('unbound.pronoundb');var PronounLabels = {
    any: 'Any pronouns',
    ask: 'Ask me my pronouns',
    avoid: 'Avoid pronouns, use my name',
    he: 'He/Him',
    it: 'It/Its',
    other: 'Other pronouns',
    she: 'She/Her',
    they: 'They/Them',
    unspecified: 'No pronouns specified.'
};
// These labels are sentences, so they keep their capitals in the lowercase format.
var SENTENCE_CODES = [
    'any',
    'ask',
    'avoid',
    'other',
    'unspecified'
];
var Lookup = {
    batchSize: 50,
    interval: 2000
};function _array_like_to_array$1(arr, len) {
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
 * @description Turns PronounDB's pronoun codes into the label shown next to a message.
 * @param codes The user's English pronoun set from PronounDB, such as `['he', 'they']`.
 * @param capitalized Whether pronouns such as `He/Him` keep their capitals.
 * @returns The label, or `null` when the user has no pronouns set.
 */ function formatPronouns(codes, capitalized) {
    var _PronounLabels_code;
    if (!(codes === null || codes === void 0 ? void 0 : codes.length)) return null;
    if (codes.length > 1) {
        var pronouns = codes.map(function(code) {
            return code.charAt(0).toUpperCase() + code.slice(1);
        }).join('/');
        return capitalized ? pronouns : pronouns.toLowerCase();
    }
    var _codes = _sliced_to_array(codes, 1), code = _codes[0];
    var label = (_PronounLabels_code = PronounLabels[code]) !== null && _PronounLabels_code !== void 0 ? _PronounLabels_code : code;
    return capitalized || SENTENCE_CODES.includes(code) ? label : label.toLowerCase();
}
/**
 * @description Cleans the free-text pronouns field of a Discord profile.
 * @param pronouns The profile's `pronouns` field.
 * @returns The pronouns on one line, or `undefined` when the field is empty.
 */ function cleanProfilePronouns(pronouns) {
    return (pronouns === null || pronouns === void 0 ? void 0 : pronouns.trim().replace(/\n+/g, '')) || undefined;
}
/**
 * @description Picks which source's pronouns to show, falling back to the other source.
 * @param discord The pronouns from the user's Discord profile.
 * @param pronounDB The pronouns from PronounDB.
 * @param preferDiscord Whether Discord's pronouns win over PronounDB's.
 * @returns The pronouns to show, or `null` when neither source has any.
 */ function pickPronouns(discord, pronounDB, preferDiscord) {
    return (preferDiscord ? discord || pronounDB : pronounDB || discord) || null;
}
/**
 * @description Shortens pronouns to fit the message header, keeping only the first `|` or `•` separated part.
 * @param pronouns The full pronouns.
 * @returns At most 12 characters, ending in `…` when cut.
 */ function shortenPronouns(pronouns) {
    var _pronouns_split = _sliced_to_array(pronouns.split(/\s+[|•]\s+/), 1), first = _pronouns_split[0];
    var label = first.trim();
    if (label.length <= 12) return label;
    return "".concat(label.slice(0, 11).trimEnd(), "…");
}// Discord can later expand the name to `name (@username)`, so room is reserved for that.
function fitsHeader(row, label, authorUsername, width) {
    var _row_username, _ref, _row_tagText;
    var username = (_row_username = row.username) !== null && _row_username !== void 0 ? _row_username : '';
    var tag = (_ref = (_row_tagText = row.tagText) !== null && _row_tagText !== void 0 ? _row_tagText : row.opTagText) !== null && _ref !== void 0 ? _ref : '';
    var shownName = authorUsername && !username.includes("@".concat(authorUsername)) ? "".concat(username, " (@").concat(authorUsername, ")") : username;
    var length = shownName.length + tag.length + row.timestamp.length + label.length + 4 + (row.roleIcon ? 3 : 0);
    // About 8pt per character after the 55pt avatar column.
    return length <= Math.floor((width - 55) / 8);
}
/**
 * @description Adds pronouns to a message header: in full to its accessibility label, and shortened after the timestamp when the header has room.
 * @param row The message row Discord generated, changed in place.
 * @param pronouns The author's pronouns.
 * @param authorUsername The author's username, which Discord may add to the shown name.
 * @param width The window width in points.
 */ function addPronouns(row, pronouns, authorUsername, width) {
    if (typeof row.timestampAccessibilityLabel === 'string' && !row.timestampAccessibilityLabel.endsWith(" • ".concat(pronouns))) {
        row.timestampAccessibilityLabel += " • ".concat(pronouns);
    }
    var label = shortenPronouns(pronouns);
    if (!label || row.timestamp.endsWith(" • ".concat(label))) return;
    if (!fitsHeader(row, label, authorUsername, width)) return;
    row.timestamp += " • ".concat(label);
}// Default (0) and reply (19) messages; other types, such as poll results, have no author header.
function isChatMessage(message) {
    return message.type === 0 || message.type === 19;
}
function discordPronouns(userId, channelId) {
    var _cleanProfilePronouns;
    var _ChannelStore_getChannel, _ChannelStore_getChannel1, _UserProfileStore_getGuildMemberProfile, _UserProfileStore_getUserProfile;
    var guildId = channelId ? (_ChannelStore_getChannel1 = ChannelStore.getChannel) === null || _ChannelStore_getChannel1 === void 0 ? void 0 : (_ChannelStore_getChannel = _ChannelStore_getChannel1.call(ChannelStore, channelId)) === null || _ChannelStore_getChannel === void 0 ? void 0 : _ChannelStore_getChannel.guild_id : undefined;
    return (_cleanProfilePronouns = cleanProfilePronouns((_UserProfileStore_getGuildMemberProfile = UserProfileStore.getGuildMemberProfile(userId, guildId)) === null || _UserProfileStore_getGuildMemberProfile === void 0 ? void 0 : _UserProfileStore_getGuildMemberProfile.pronouns)) !== null && _cleanProfilePronouns !== void 0 ? _cleanProfilePronouns : cleanProfilePronouns((_UserProfileStore_getUserProfile = UserProfileStore.getUserProfile(userId)) === null || _UserProfileStore_getUserProfile === void 0 ? void 0 : _UserProfileStore_getUserProfile.pronouns);
}
function isShownFor(author) {
    var _UserStore_getCurrentUser;
    if (!(author === null || author === void 0 ? void 0 : author.id) || author.bot || author.system) return false;
    return settings.get('showSelf', true) || author.id !== ((_UserStore_getCurrentUser = UserStore.getCurrentUser()) === null || _UserStore_getCurrentUser === void 0 ? void 0 : _UserStore_getCurrentUser.id);
}
/**
 * @description Shows each message author's pronouns after the message timestamp.
 * @param lookup The PronounDB lookup that caches pronouns for the session.
 * @returns A function that removes the patch.
 */ function patchMessageRowData(lookup) {
    return Patcher.after(MessageRowData, 'generateMessageRowData', function(param) {
        var args = param.args, result = param.result;
        var _args_;
        var message = (_args_ = args[0]) === null || _args_ === void 0 ? void 0 : _args_.message;
        if (!message || !isChatMessage(message) || !isShownFor(message.author)) return;
        var _message_author = message.author, id = _message_author.id, username = _message_author.username;
        var pronouns = pickPronouns(discordPronouns(id, message.channel_id), lookup.get(id), settings.get('priority', 'pronoundb') === 'discord');
        var row = result === null || result === void 0 ? void 0 : result.message;
        if (!pronouns || typeof (row === null || row === void 0 ? void 0 : row.timestamp) !== 'string') return;
        addPronouns(row, pronouns, username, window.unbound.metro.common.ReactNative.Dimensions.get('window').width);
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
}function SettingsPanel() {
    var store = settings.useSettingsStore();
    return /*#__PURE__*/ React.createElement(Page, null, /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TableRadioGroup, {
        title: "Pronouns",
        value: store.get('format', 'lowercase'),
        onChange: function onChange(value) {
            return store.set('format', value);
        }
    }, /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TableRadioRow, {
        label: "Lowercase",
        value: "lowercase"
    }), /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TableRadioRow, {
        label: "Capitalized",
        value: "capitalized"
    })), /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TableRadioGroup, {
        title: "Source",
        value: store.get('priority', 'pronoundb'),
        onChange: function onChange(value) {
            return store.set('priority', value);
        }
    }, /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TableRadioRow, {
        label: "Prefer PronounDB",
        subLabel: "Fall back to Discord profile pronouns",
        value: "pronoundb"
    }), /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TableRadioRow, {
        label: "Prefer Discord",
        subLabel: "Fall back to PronounDB",
        value: "discord"
    })), /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TableRowGroup, {
        title: "Visibility"
    }, /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TableSwitchRow, {
        label: "Show for Yourself",
        value: store.get('showSelf', true),
        onValueChange: function onValueChange(value) {
            return store.set('showSelf', value);
        }
    })));
}function _array_like_to_array(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
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
function _non_iterable_spread() {
    throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
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
/**
 * @description Fetches users' pronouns from PronounDB in batches and caches them for the session.
 * @param onResolved Called after a batch of users got their pronouns.
 * @returns `get` reads a user's cached pronouns and queues a fetch on a miss, `dispose` cancels pending work.
 */ function createLookup(onResolved) {
    var cache = new Map();
    var queue = new Set();
    var scheduled;
    var wake;
    var draining = false;
    var disposed = false;
    function request(ids) {
        return _async_to_generator(function() {
            var query, response, _tmp;
            return _ts_generator(this, function(_state) {
                switch(_state.label){
                    case 0:
                        query = new URLSearchParams({
                            ids: ids.join(','),
                            platform: 'discord'
                        });
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
                            fetch("https://pronoundb.org/api/v2/lookup?".concat(query.toString()), {
                                headers: {
                                    Accept: 'application/json',
                                    'X-PronounDB-Source': 'Unbound/1.0.0'
                                }
                            })
                        ];
                    case 2:
                        response = _state.sent();
                        if (!response.ok) return [
                            3,
                            4
                        ];
                        return [
                            4,
                            response.json()
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
                        return [
                            2,
                            _tmp
                        ];
                    case 6:
                        _state.sent();
                        return [
                            2,
                            null
                        ];
                    case 7:
                        return [
                            2
                        ];
                }
            });
        })();
    }
    function fetchBatch(ids) {
        return _async_to_generator(function() {
            var _result_id_sets, _result_id, result, _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, id, capitalized, _iteratorNormalCompletion1, _didIteratorError1, _iteratorError1, _iterator1, _step1, id1;
            return _ts_generator(this, function(_state) {
                switch(_state.label){
                    case 0:
                        return [
                            4,
                            request(ids)
                        ];
                    case 1:
                        result = _state.sent();
                        if (disposed) return [
                            2
                        ];
                        if (!result) {
                            _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
                            try {
                                for(_iterator = ids[Symbol.iterator](); !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                                    id = _step.value;
                                    cache.set(id, null);
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
                        capitalized = settings.get('format', 'lowercase') === 'capitalized';
                        _iteratorNormalCompletion1 = true, _didIteratorError1 = false, _iteratorError1 = undefined;
                        try {
                            for(_iterator1 = ids[Symbol.iterator](); !(_iteratorNormalCompletion1 = (_step1 = _iterator1.next()).done); _iteratorNormalCompletion1 = true){
                                id1 = _step1.value;
                                cache.set(id1, formatPronouns((_result_id = result[id1]) === null || _result_id === void 0 ? void 0 : (_result_id_sets = _result_id.sets) === null || _result_id_sets === void 0 ? void 0 : _result_id_sets.en, capitalized));
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
                        onResolved();
                        return [
                            2
                        ];
                }
            });
        })();
    }
    function drain() {
        return _async_to_generator(function() {
            var ids, _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, id;
            return _ts_generator(this, function(_state) {
                switch(_state.label){
                    case 0:
                        if (draining) return [
                            2
                        ];
                        draining = true;
                        _state.label = 1;
                    case 1:
                        if (!(queue.size && !disposed)) return [
                            3,
                            5
                        ];
                        ids = _to_consumable_array(queue).slice(0, Lookup.batchSize);
                        _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
                        try {
                            for(_iterator = ids[Symbol.iterator](); !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                                id = _step.value;
                                queue.delete(id);
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
                            4,
                            fetchBatch(ids)
                        ];
                    case 2:
                        _state.sent();
                        if (!(queue.size && !disposed)) return [
                            3,
                            4
                        ];
                        return [
                            4,
                            new Promise(function(resolve) {
                                var timer = setTimeout(resolve, Lookup.interval);
                                wake = function wake() {
                                    clearTimeout(timer);
                                    resolve();
                                };
                            })
                        ];
                    case 3:
                        _state.sent();
                        _state.label = 4;
                    case 4:
                        return [
                            3,
                            1
                        ];
                    case 5:
                        draining = false;
                        return [
                            2
                        ];
                }
            });
        })();
    }
    function get(id) {
        var _cache_get;
        if (cache.has(id)) return (_cache_get = cache.get(id)) !== null && _cache_get !== void 0 ? _cache_get : null;
        queue.add(id);
        scheduled !== null && scheduled !== void 0 ? scheduled : scheduled = setTimeout(function() {
            scheduled = undefined;
            void drain();
        }, 0);
        return null;
    }
    function dispose() {
        disposed = true;
        clearTimeout(scheduled);
        wake === null || wake === void 0 ? void 0 : wake();
        queue.clear();
    }
    return {
        get: get,
        dispose: dispose
    };
}var dispose = function dispose() {};
function start() {
    if (!ensureModules('PronounDB', {
        MessageRowData: MessageRowData,
        UserProfileStore: UserProfileStore,
        UserStore: UserStore
    })) return;
    // Without the message store, fetched pronouns show on the next re-render instead of at once.
    var lookup = createLookup(function() {
        var _MessageStore_emitChange;
        return (_MessageStore_emitChange = MessageStore.emitChange) === null || _MessageStore_emitChange === void 0 ? void 0 : _MessageStore_emitChange.call(MessageStore);
    });
    dispose = applyFeatures('PronounDB', [
        function() {
            return lookup.dispose;
        },
        function() {
            return patchMessageRowData(lookup);
        }
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