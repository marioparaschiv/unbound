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
 * @description Runs `enable` while a boolean setting is on and its cleanup while it is off, so a feature's patches exist only when the user wants them.
 * @param store The plugin's settings store from `storage.getStore`.
 * @param key The boolean setting that gates the feature.
 * @param def The setting's default value.
 * @param enable Applies the feature and returns the function that removes it.
 * @returns A function that removes the feature and stops listening; call it in `stop`.
 */ function whileEnabled(store, key, def, enable) {
    var disable = null;
    function sync() {
        var enabled = store.get(key, def);
        if (enabled && !disable) {
            disable = enable();
        } else if (!enabled && disable) {
            disable();
            disable = null;
        }
    }
    var unsubscribe = store.addListener(function(payload) {
        return payload.key === null || payload.key === key;
    }, sync);
    sync();
    return function() {
        unsubscribe();
        disable === null || disable === void 0 ? void 0 : disable();
        disable = null;
    };
}/**
 * @description Checks that a value is a `#rrggbb` hex color.
 * @param color The value to check.
 * @returns Whether the value is a six-digit hex color string.
 */ function isHexColor(color) {
    return typeof color === 'string' && /^#[\da-f]{6}$/i.test(color);
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
/**
 * @description Samples a role gradient at a position, interpolating between neighbouring stops.
 * @param colors The gradient's hex stops.
 * @param position Where to sample, from 0 (first stop) to 1 (last stop).
 * @returns The hex color at that position, or `null` when there are no stops or one is invalid.
 */ function roleColorAt(colors, position) {
    if (!colors.length || !colors.every(isHexColor)) return null;
    if (colors.length === 1) {
        return colors[0];
    }
    var scaled = Math.min(1, Math.max(0, position)) * (colors.length - 1);
    var index = Math.min(colors.length - 2, Math.floor(scaled));
    var fraction = scaled - index;
    var first = Number.parseInt(colors[index].slice(1), 16);
    var second = Number.parseInt(colors[index + 1].slice(1), 16);
    var channels = [
        16,
        8,
        0
    ].map(function(shift) {
        return Math.round((first >> shift & 0xff) * (1 - fraction) + (second >> shift & 0xff) * fraction);
    });
    return "#".concat(channels.map(function(channel) {
        return channel.toString(16).padStart(2, '0');
    }).join(''));
}
/**
 * @description Splits text into runs painted along a role gradient: one run for a solid color, one per character otherwise.
 * @param text The text to paint.
 * @param colors The role's hex stops.
 * @returns The runs in order, each with the color to paint it.
 */ function roleColorRuns(text, colors) {
    if (colors.length === 1) {
        return [
            {
                text: text,
                color: colors[0]
            }
        ];
    }
    var characters = Array.from(text);
    var last = Math.max(1, characters.length - 1);
    return characters.map(function(character, index) {
        var _roleColorAt;
        return {
            text: character,
            color: (_roleColorAt = roleColorAt(colors, index / last)) !== null && _roleColorAt !== void 0 ? _roleColorAt : colors[0]
        };
    });
}var GuildMemberStore = window.unbound.metro.findStore('GuildMember', {
    lazy: true
});
var GuildRoleStore = window.unbound.metro.findStore('GuildRole', {
    lazy: true
});
var UserStore = window.unbound.metro.stores.Users;
var ChannelStore = window.unbound.metro.findStore('Channel', {
    lazy: true
});
var MessageStore = window.unbound.metro.findStore('Message', {
    lazy: true
});
var TypingStore = window.unbound.metro.findStore('Typing', {
    lazy: true
});
var RelationshipStore = window.unbound.metro.findStore('Relationship', {
    lazy: true
});
var SelectedChannelStore = window.unbound.metro.findStore('SelectedChannel', {
    lazy: true
});
var byRowManager = window.unbound.metro.filters.byName('RowManager');
var TYPING_INDICATOR_PATH = 'modules/chat/native/TypingIndicator.tsx';
var USERS_FAST_LIST_PATH = 'modules/main_tabs_v2/native/shared_components/user_list/UsersFastList.tsx';
var MessageReactionsContent = window.unbound.metro.findByFilePath('modules/reactions/native/MessageReactionsContent.tsx', {
    interop: false,
    lazy: true
});
var PollVotesActionSheet = window.unbound.metro.findByFilePath('modules/polls/native/PollVotesActionSheet.tsx', {
    interop: false,
    lazy: true
});
var VoiceUserNameItem = window.unbound.metro.findByFilePath('modules/guild_sidebar/native/VoiceUserNameItem.tsx', {
    interop: false,
    lazy: true
});
var settings = window.unbound.storage.getStore('unbound.role-color-everywhere');
var Patcher = window.unbound.patcher.createPatcher('unbound.role-color-everywhere');function onlyString(children) {
    if (typeof children === 'string') return children;
    if (Array.isArray(children) && children.length === 1 && typeof children[0] === 'string') {
        return children[0];
    }
    return null;
}
/**
 * @description Paints every text element in a tree whose whole content is a known name with that name's role colors.
 * @param node The rendered tree to paint.
 * @param appearances The role colors to use, keyed by the exact name text.
 * @param Text The text component used to paint a gradient one character at a time.
 * @param depth How deep the walk already is; it stops after 12 levels.
 * @returns The painted tree, or `node` itself when nothing matched.
 */ function paintRoleTextTree(node, appearances, Text) {
    var depth = arguments.length > 3 && arguments[3] !== void 0 ? arguments[3] : 0;
    if (depth > 12 || !node) return node;
    if (Array.isArray(node)) {
        var next = node.map(function(child) {
            return paintRoleTextTree(child, appearances, Text, depth + 1);
        });
        return next.some(function(child, index) {
            return child !== node[index];
        }) ? next : node;
    }
    if (!window.React.isValidElement(node)) return node;
    var _node_props = node.props, children = _node_props.children, style = _node_props.style;
    var name = onlyString(children);
    var appearance = name ? appearances.get(name) : undefined;
    if (name && (appearance === null || appearance === void 0 ? void 0 : appearance.colors.length) === 1) {
        return window.React.cloneElement(node, {
            style: [
                style,
                {
                    color: appearance.colors[0]
                }
            ]
        });
    }
    if (name && appearance) {
        var runs = roleColorRuns(name, appearance.colors).map(function(run, index) {
            return window.React.createElement(Text, {
                key: index,
                style: {
                    color: run.color
                }
            }, run.text);
        });
        return window.React.cloneElement(node, {
            children: runs
        });
    }
    var next1 = paintRoleTextTree(children, appearances, Text, depth + 1);
    return next1 === children ? node : window.React.cloneElement(node, {
        children: next1
    });
}
/**
 * @description Renders a name as text painted with a role's colors.
 * @param name The name to render.
 * @param appearance The role colors to paint it with.
 * @param Text The text component to render with.
 * @returns The painted text element.
 */ function paintRoleText(name, appearance, Text) {
    return paintRoleTextTree(window.React.createElement(Text, null, name), new Map([
        [
            name,
            appearance
        ]
    ]), Text);
}/**
 * @description Renders a Discord component in its place, then paints the names it shows with their role colors.
 * @param props The component to render, its props, and the colors for each name.
 * @returns The component's output with matching names painted.
 */ function RoleColoredRender(param) {
    var render = param.render, props = param.props, appearances = param.appearances;
    return paintRoleTextTree(render(props), appearances, window.ReactNative.Text);
}/**
 * @description Finds the guild a channel belongs to.
 * @param channelId The channel, if known.
 * @returns The guild ID, or `undefined` for a DM, an unknown channel, or no channel.
 */ function guildIdOf(channelId) {
    var _ChannelStore_getChannel;
    return channelId ? (_ChannelStore_getChannel = ChannelStore.getChannel(channelId)) === null || _ChannelStore_getChannel === void 0 ? void 0 : _ChannelStore_getChannel.guild_id : undefined;
}var PLUGIN_NAME = 'Role Color Everywhere';
// Discord lays out a newly opened channel over a few seconds, so visible cells are rescanned as it settles.
var CELL_SCAN_DELAYS = [
    0,
    100,
    500,
    1500,
    3000
];function _array_like_to_array$e(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_with_holes$a(arr) {
    if (Array.isArray(arr)) return arr;
}
function _iterable_to_array_limit$a(arr, i) {
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
function _non_iterable_rest$a() {
    throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _sliced_to_array$a(arr, i) {
    return _array_with_holes$a(arr) || _iterable_to_array_limit$a(arr, i) || _unsupported_iterable_to_array$e(arr, i) || _non_iterable_rest$a();
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
 * @description Keeps the names a user is shown by, dropping missing and empty ones.
 * @param names Candidate names, such as a nickname, global name and username.
 * @returns The non-empty names in order.
 */ function presentNames() {
    for(var _len = arguments.length, names = new Array(_len), _key = 0; _key < _len; _key++){
        names[_key] = arguments[_key];
    }
    return names.filter(function(name) {
        return !!name;
    });
}
/**
 * @description Maps each name to the one owner shown by it, leaving out names two owners share so a name is never colored for the wrong person.
 * @template T The owner, such as a user ID or a role appearance.
 * @param owners Each owner with the names it is shown by.
 * @returns The names that belong to exactly one owner.
 */ function uniqueNames(owners) {
    var result = new Map();
    var shared = new Set();
    var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
    try {
        for(var _iterator = owners[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
            var _step_value = _sliced_to_array$a(_step.value, 2), names = _step_value[0], owner = _step_value[1];
            var _iteratorNormalCompletion1 = true, _didIteratorError1 = false, _iteratorError1 = undefined;
            try {
                for(var _iterator1 = new Set(names)[Symbol.iterator](), _step1; !(_iteratorNormalCompletion1 = (_step1 = _iterator1.next()).done); _iteratorNormalCompletion1 = true){
                    var name = _step1.value;
                    if (shared.has(name)) {
                        continue;
                    }
                    if (result.has(name)) {
                        result.delete(name);
                        shared.add(name);
                    } else {
                        result.set(name, owner);
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
    return result;
}function _array_like_to_array$d(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_with_holes$9(arr) {
    if (Array.isArray(arr)) return arr;
}
function _array_without_holes$9(arr) {
    if (Array.isArray(arr)) return _array_like_to_array$d(arr);
}
function _iterable_to_array$9(iter) {
    if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) {
        return Array.from(iter);
    }
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
function _non_iterable_spread$9() {
    throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _sliced_to_array$9(arr, i) {
    return _array_with_holes$9(arr) || _iterable_to_array_limit$9(arr, i) || _unsupported_iterable_to_array$d(arr, i) || _non_iterable_rest$9();
}
function _to_array$1(arr) {
    return _array_with_holes$9(arr) || _iterable_to_array$9(arr) || _unsupported_iterable_to_array$d(arr) || _non_iterable_rest$9();
}
function _to_consumable_array$9(arr) {
    return _array_without_holes$9(arr) || _iterable_to_array$9(arr) || _unsupported_iterable_to_array$d(arr) || _non_iterable_spread$9();
}
function _unsupported_iterable_to_array$d(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _array_like_to_array$d(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(n);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _array_like_to_array$d(o, minLen);
}
function colorReactionRow(row, guildId) {
    var _row_props, _item_props, _label_props;
    var children = row === null || row === void 0 ? void 0 : (_row_props = row.props) === null || _row_props === void 0 ? void 0 : _row_props.children;
    if (!Array.isArray(children)) return row;
    var _children = _to_array$1(children), item = _children[0], rest = _children.slice(1);
    var label = item === null || item === void 0 ? void 0 : (_item_props = item.props) === null || _item_props === void 0 ? void 0 : _item_props.label;
    var user = label === null || label === void 0 ? void 0 : (_label_props = label.props) === null || _label_props === void 0 ? void 0 : _label_props.user;
    if (!(user === null || user === void 0 ? void 0 : user.id) || typeof label.type !== 'function') return row;
    var member = GuildMemberStore.getMember(guildId, user.id);
    var appearance = getRoleColorAppearance(member === null || member === void 0 ? void 0 : member.colorStrings, member === null || member === void 0 ? void 0 : member.colorString);
    if (!appearance.colors.length) return row;
    var names = presentNames(label.props.nick, user.globalName, user.username);
    var colored = /*#__PURE__*/ React.createElement(RoleColoredRender, {
        render: label.type,
        props: label.props,
        appearances: new Map(names.map(function(name) {
            return [
                name,
                appearance
            ];
        }))
    });
    return /*#__PURE__*/ window.React.cloneElement(row, {
        children: [
            /*#__PURE__*/ window.React.cloneElement(item, {
                label: colored
            })
        ].concat(_to_consumable_array$9(rest))
    });
}
/**
 * @description Paints the names in a message's reaction details list with their role colors.
 * @returns A function that removes the patch.
 */ function patchMessageReactionsContent() {
    var feature = "".concat(PLUGIN_NAME, ": reactions");
    if (!ensureModules(feature, {
        MessageReactionsContent: MessageReactionsContent,
        ChannelStore: ChannelStore
    })) return function() {};
    if (typeof MessageReactionsContent.MessageReactionsContent !== 'function') {
        console.error("[".concat(feature, "] Skipped, MessageReactionsContent is not a function."));
        return function() {};
    }
    return Patcher.after(MessageReactionsContent, 'MessageReactionsContent', function(param) {
        var _param_args = _sliced_to_array$9(param.args, 1), props = _param_args[0], result = param.result;
        var _result_props, _list_props;
        var guildId = guildIdOf(props === null || props === void 0 ? void 0 : props.channelId);
        var list = result === null || result === void 0 ? void 0 : (_result_props = result.props) === null || _result_props === void 0 ? void 0 : _result_props.children;
        var renderItem = list === null || list === void 0 ? void 0 : (_list_props = list.props) === null || _list_props === void 0 ? void 0 : _list_props.renderItem;
        if (!guildId || typeof renderItem !== 'function') return;
        return /*#__PURE__*/ window.React.cloneElement(result, {
            children: /*#__PURE__*/ window.React.cloneElement(list, {
                renderItem: function renderItem1(section, index) {
                    return colorReactionRow(renderItem(section, index), guildId);
                }
            })
        });
    });
}/**
 * @description Renders a poll answer's voters list in its place, painting each voter's name with their role colors.
 * @param props The `VotersList` component, its props, and the poll's guild.
 * @returns The voters list with painted names.
 */ function RoleColoredVotersList(param) {
    var render = param.render, props = param.props, guildId = param.guildId;
    var _result_props, _list_props;
    var result = render(props);
    var list = result === null || result === void 0 ? void 0 : (_result_props = result.props) === null || _result_props === void 0 ? void 0 : _result_props.children;
    var renderItem = list === null || list === void 0 ? void 0 : (_list_props = list.props) === null || _list_props === void 0 ? void 0 : _list_props.renderItem;
    if (typeof renderItem !== 'function') return result;
    return /*#__PURE__*/ window.React.cloneElement(result, {
        children: /*#__PURE__*/ window.React.cloneElement(list, {
            renderItem: function renderItem1(voter) {
                var _voter_item, _row_props;
                var row = renderItem(voter);
                var userId = voter === null || voter === void 0 ? void 0 : (_voter_item = voter.item) === null || _voter_item === void 0 ? void 0 : _voter_item.id;
                var label = row === null || row === void 0 ? void 0 : (_row_props = row.props) === null || _row_props === void 0 ? void 0 : _row_props.label;
                if (!userId || typeof label !== 'string') return row;
                var member = GuildMemberStore.getMember(guildId, userId);
                var appearance = getRoleColorAppearance(member === null || member === void 0 ? void 0 : member.colorStrings, member === null || member === void 0 ? void 0 : member.colorString);
                if (!appearance.colors.length) return row;
                return /*#__PURE__*/ window.React.cloneElement(row, {
                    label: paintRoleText(label, appearance, window.ReactNative.Text)
                });
            }
        })
    });
}function _array_like_to_array$c(arr, len) {
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
    return _array_with_holes$8(arr) || _iterable_to_array_limit$8(arr, i) || _unsupported_iterable_to_array$c(arr, i) || _non_iterable_rest$8();
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
 * @description Paints voters' names in poll result details with their role colors.
 * @returns A function that removes the patch.
 */ function patchPollVotesActionSheet() {
    var feature = "".concat(PLUGIN_NAME, ": poll results");
    if (!ensureModules(feature, {
        PollVotesActionSheet: PollVotesActionSheet,
        ChannelStore: ChannelStore
    })) return function() {};
    if (typeof PollVotesActionSheet.default !== 'function') {
        console.error("[".concat(feature, "] Skipped, PollVotesActionSheet is not a function."));
        return function() {};
    }
    return Patcher.after(PollVotesActionSheet, 'default', function(param) {
        var _param_args = _sliced_to_array$8(param.args, 1), props = _param_args[0], result = param.result;
        var _result_props, _sheet_props;
        var guildId = guildIdOf(props === null || props === void 0 ? void 0 : props.channelId);
        var sheet = result === null || result === void 0 ? void 0 : (_result_props = result.props) === null || _result_props === void 0 ? void 0 : _result_props.children;
        var children = sheet === null || sheet === void 0 ? void 0 : (_sheet_props = sheet.props) === null || _sheet_props === void 0 ? void 0 : _sheet_props.children;
        if (!guildId || !Array.isArray(children)) return;
        var voters = children.find(function(child) {
            return typeof (child === null || child === void 0 ? void 0 : child.type) === 'function' && child.type.name === 'VotersList';
        });
        if (!voters) return;
        var colored = /*#__PURE__*/ React.createElement(RoleColoredVotersList, {
            render: voters.type,
            props: voters.props,
            guildId: guildId
        });
        return /*#__PURE__*/ window.React.cloneElement(result, {
            children: /*#__PURE__*/ window.React.cloneElement(sheet, {
                children: children.map(function(child) {
                    return child === voters ? colored : child;
                })
            })
        });
    });
}function _array_like_to_array$b(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_with_holes$7(arr) {
    if (Array.isArray(arr)) return arr;
}
function _array_without_holes$8(arr) {
    if (Array.isArray(arr)) return _array_like_to_array$b(arr);
}
function _iterable_to_array$8(iter) {
    if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) {
        return Array.from(iter);
    }
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
function _non_iterable_spread$8() {
    throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _sliced_to_array$7(arr, i) {
    return _array_with_holes$7(arr) || _iterable_to_array_limit$7(arr, i) || _unsupported_iterable_to_array$b(arr, i) || _non_iterable_rest$7();
}
function _to_array(arr) {
    return _array_with_holes$7(arr) || _iterable_to_array$8(arr) || _unsupported_iterable_to_array$b(arr) || _non_iterable_rest$7();
}
function _to_consumable_array$8(arr) {
    return _array_without_holes$8(arr) || _iterable_to_array$8(arr) || _unsupported_iterable_to_array$b(arr) || _non_iterable_spread$8();
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
 * @description Paints members' names in voice channel user lists with their role colors.
 * @returns A function that removes the patch.
 */ function patchVoiceUserNameItem() {
    var feature = "".concat(PLUGIN_NAME, ": voice users");
    if (!ensureModules(feature, {
        VoiceUserNameItem: VoiceUserNameItem
    })) return function() {};
    if (typeof VoiceUserNameItem.default !== 'function') {
        console.error("[".concat(feature, "] Skipped, VoiceUserNameItem is not a function."));
        return function() {};
    }
    return Patcher.after(VoiceUserNameItem, 'default', function(param) {
        var _param_args = _sliced_to_array$7(param.args, 1), props = _param_args[0], result = param.result;
        var _result_props, _nameElement_props;
        var _ref = props !== null && props !== void 0 ? props : {}, guildId = _ref.guildId, user = _ref.user, member = _ref.member;
        if (!guildId || !(user === null || user === void 0 ? void 0 : user.id)) return;
        var resolved = member !== null && member !== void 0 ? member : GuildMemberStore.getMember(guildId, user.id);
        var appearance = getRoleColorAppearance(resolved === null || resolved === void 0 ? void 0 : resolved.colorStrings, resolved === null || resolved === void 0 ? void 0 : resolved.colorString);
        var children = result === null || result === void 0 ? void 0 : (_result_props = result.props) === null || _result_props === void 0 ? void 0 : _result_props.children;
        if (!appearance.colors.length || !Array.isArray(children)) return;
        var _children = _to_array(children), nameElement = _children[0], rest = _children.slice(1);
        var nameChildren = nameElement === null || nameElement === void 0 ? void 0 : (_nameElement_props = nameElement.props) === null || _nameElement_props === void 0 ? void 0 : _nameElement_props.children;
        var name = Array.isArray(nameChildren) ? nameChildren[0] : nameChildren;
        if (typeof name !== 'string') return;
        var colored = paintRoleText(name, appearance, window.ReactNative.Text);
        var styledName = window.React.cloneElement(nameElement, {
            children: Array.isArray(nameChildren) ? [
                colored
            ].concat(_to_consumable_array$8(nameChildren.slice(1))) : colored
        });
        return window.React.cloneElement(result, {
            children: [
                styledName
            ].concat(_to_consumable_array$8(rest))
        });
    });
}function _define_property$2(obj, key, value) {
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
function toFilter(source) {
    return typeof source === 'string' ? window.unbound.metro.filters.byFilePath(source) : source;
}
function findFirst(sources, options, signal) {
    var waits = [];
    var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
    try {
        for(var _iterator = sources[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
            var source = _step.value;
            var found = window.unbound.metro.findLazy(toFilter(source), _object_spread_props$1(_object_spread$2({}, options), {
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
}function _array_like_to_array$a(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_without_holes$7(arr) {
    if (Array.isArray(arr)) return _array_like_to_array$a(arr);
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
    return _array_without_holes$7(arr) || _iterable_to_array$7(arr) || _unsupported_iterable_to_array$a(arr) || _non_iterable_spread$7();
}
function _unsupported_iterable_to_array$a(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _array_like_to_array$a(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(n);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _array_like_to_array$a(o, minLen);
}
function typingAppearances() {
    var _TypingStore_getTypingUsers;
    var channelId = SelectedChannelStore.getChannelId();
    var guildId = guildIdOf(channelId);
    if (!channelId || !guildId) return new Map();
    var owners = [];
    var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
    try {
        for(var _iterator = Object.keys((_TypingStore_getTypingUsers = TypingStore.getTypingUsers(channelId)) !== null && _TypingStore_getTypingUsers !== void 0 ? _TypingStore_getTypingUsers : {}).slice(0, 8)[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
            var userId = _step.value;
            var // The relationship store is optional: without it friend nicknames are not matched.
            _RelationshipStore_getNickname;
            var member = GuildMemberStore.getMember(guildId, userId);
            var appearance = getRoleColorAppearance(member === null || member === void 0 ? void 0 : member.colorStrings, member === null || member === void 0 ? void 0 : member.colorString);
            if (!appearance.colors.length) {
                continue;
            }
            var user = UserStore.getUser(userId);
            var names = presentNames(member === null || member === void 0 ? void 0 : member.nick, (_RelationshipStore_getNickname = RelationshipStore.getNickname) === null || _RelationshipStore_getNickname === void 0 ? void 0 : _RelationshipStore_getNickname.call(RelationshipStore, userId), user === null || user === void 0 ? void 0 : user.globalName, user === null || user === void 0 ? void 0 : user.username);
            owners.push([
                names,
                appearance
            ]);
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
    return uniqueNames(owners);
}
function patchLoadedTypingIndicator(TypingIndicator) {
    var _TypingIndicator_default;
    var feature = "".concat(PLUGIN_NAME, ": typing");
    var modules = {
        TypingStore: TypingStore,
        UserStore: UserStore,
        ChannelStore: ChannelStore,
        SelectedChannelStore: SelectedChannelStore
    };
    if (!ensureModules(feature, modules)) return function() {};
    if (typeof ((_TypingIndicator_default = TypingIndicator.default) === null || _TypingIndicator_default === void 0 ? void 0 : _TypingIndicator_default.type) !== 'function') {
        console.error("[".concat(feature, "] Skipped, TypingIndicator is not a memo component."));
        return function() {};
    }
    // A list rendered while patched keeps calling this `renderItem` after the patch is removed.
    var active = true;
    var unpatch = Patcher.after(TypingIndicator.default, 'type', function(param) {
        var result = param.result;
        var _result_props;
        var renderItem = result === null || result === void 0 ? void 0 : (_result_props = result.props) === null || _result_props === void 0 ? void 0 : _result_props.renderItem;
        if (typeof renderItem !== 'function') return;
        return /*#__PURE__*/ window.React.cloneElement(result, {
            renderItem: function renderItem1() {
                for(var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++){
                    args[_key] = arguments[_key];
                }
                var item = renderItem.apply(void 0, _to_consumable_array$7(args));
                if (typeof (item === null || item === void 0 ? void 0 : item.type) !== 'function') return item;
                return /*#__PURE__*/ React.createElement(RoleColoredRender, {
                    key: item.key,
                    render: item.type,
                    props: item.props,
                    appearances: active ? typingAppearances() : new Map()
                });
            }
        });
    });
    return function() {
        active = false;
        unpatch();
    };
}
/**
 * @description Paints the names in the channel typing indicator with their role colors, once the indicator's module loads; Android loads it only when someone first types.
 * @returns A function that stops waiting or removes the patch.
 */ function patchTypingIndicator() {
    return whenLoaded(TYPING_INDICATOR_PATH, patchLoadedTypingIndicator);
}function _array_like_to_array$9(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_with_holes$6(arr) {
    if (Array.isArray(arr)) return arr;
}
function _array_without_holes$6(arr) {
    if (Array.isArray(arr)) return _array_like_to_array$9(arr);
}
function _iterable_to_array$6(iter) {
    if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) {
        return Array.from(iter);
    }
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
function _non_iterable_spread$6() {
    throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _sliced_to_array$6(arr, i) {
    return _array_with_holes$6(arr) || _iterable_to_array_limit$6(arr, i) || _unsupported_iterable_to_array$9(arr, i) || _non_iterable_rest$6();
}
function _to_consumable_array$6(arr) {
    return _array_without_holes$6(arr) || _iterable_to_array$6(arr) || _unsupported_iterable_to_array$9(arr) || _non_iterable_spread$6();
}
function _unsupported_iterable_to_array$9(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _array_like_to_array$9(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(n);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _array_like_to_array$9(o, minLen);
}
// A section's role is the first member's hoisted role, so two roles with the same name are told apart.
function sectionAppearance(props, section) {
    var _props_getSectionProps_props, _props_getSectionProps, _props_getSectionProps1, _props_getItemProps, _props_getItemProps1, _first_user, _GuildMemberStore_getMember;
    var title = (_props_getSectionProps1 = props.getSectionProps) === null || _props_getSectionProps1 === void 0 ? void 0 : (_props_getSectionProps = _props_getSectionProps1.call(props, section)) === null || _props_getSectionProps === void 0 ? void 0 : (_props_getSectionProps_props = _props_getSectionProps.props) === null || _props_getSectionProps_props === void 0 ? void 0 : _props_getSectionProps_props.title;
    var first = (_props_getItemProps1 = props.getItemProps) === null || _props_getItemProps1 === void 0 ? void 0 : (_props_getItemProps = _props_getItemProps1.call(props, section, 0)) === null || _props_getItemProps === void 0 ? void 0 : _props_getItemProps.props;
    var guildId = first === null || first === void 0 ? void 0 : first.guildId;
    var userId = first === null || first === void 0 ? void 0 : (_first_user = first.user) === null || _first_user === void 0 ? void 0 : _first_user.id;
    if (typeof title !== 'string' || !guildId || !userId) return null;
    var roleId = (_GuildMemberStore_getMember = GuildMemberStore.getMember(guildId, userId)) === null || _GuildMemberStore_getMember === void 0 ? void 0 : _GuildMemberStore_getMember.hoistRoleId;
    var role = roleId ? GuildRoleStore.getRole(guildId, roleId) : null;
    if (!(role === null || role === void 0 ? void 0 : role.name) || !title.includes(role.name)) return null;
    var appearance = getRoleColorAppearance(role.colorStrings, role.colorString);
    return appearance.colors.length ? appearance : null;
}
function paintSectionHeaders(props, result) {
    var _result_props;
    var renderHeader = result === null || result === void 0 ? void 0 : (_result_props = result.props) === null || _result_props === void 0 ? void 0 : _result_props.renderSectionHeader;
    if (typeof renderHeader !== 'function' || !props.getSectionProps || !props.getItemProps) {
        return;
    }
    return /*#__PURE__*/ window.React.cloneElement(result, {
        renderSectionHeader: function renderSectionHeader(section) {
            for(var _len = arguments.length, rest = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++){
                rest[_key - 1] = arguments[_key];
            }
            var _header_props;
            var header = renderHeader.apply(void 0, [
                section
            ].concat(_to_consumable_array$6(rest)));
            var title = header === null || header === void 0 ? void 0 : (_header_props = header.props) === null || _header_props === void 0 ? void 0 : _header_props.title;
            var appearance = sectionAppearance(props, section);
            if (!appearance || typeof title !== 'string') return header;
            return /*#__PURE__*/ window.React.cloneElement(header, {
                title: paintRoleText(title, appearance, window.ReactNative.Text)
            });
        }
    });
}
function patchLoadedUsersFastList(module) {
    var feature = "".concat(PLUGIN_NAME, ": member list");
    var list = module.UsersFastList;
    if (!ensureModules(feature, {
        GuildRoleStore: GuildRoleStore
    })) return function() {};
    if (typeof list === 'function') {
        return Patcher.after(module, 'UsersFastList', function(param) {
            var _param_args = _sliced_to_array$6(param.args, 1), props = _param_args[0], result = param.result;
            return paintSectionHeaders(props, result);
        });
    }
    if (typeof (list === null || list === void 0 ? void 0 : list.render) === 'function') {
        return Patcher.after(list, 'render', function(param) {
            var _param_args = _sliced_to_array$6(param.args, 1), props = _param_args[0], result = param.result;
            return paintSectionHeaders(props, result);
        });
    }
    console.error("[".concat(feature, "] Skipped, UsersFastList is neither a function nor a forwardRef component."));
    return function() {};
}
/**
 * @description Paints role section titles in the member list with the role's colors, once the list's module loads.
 * @returns A function that stops waiting or removes the patch.
 */ function patchUsersFastList() {
    return whenLoaded(USERS_FAST_LIST_PATH, patchLoadedUsersFastList);
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
}function SettingSwitch(param) {
    var setting = param.setting, label = param.label, subLabel = param.subLabel, fallback = param.fallback;
    var store = settings.useSettingsStore();
    return /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TableSwitchRow, {
        label: label,
        subLabel: subLabel,
        value: store.get(setting, fallback),
        onValueChange: function onValueChange(value) {
            return store.set(setting, value);
        }
    });
}
function SettingsPanel() {
    var store = settings.useSettingsStore();
    var saturation = store.get('messageSaturation', 30);
    return /*#__PURE__*/ React.createElement(Page, null, /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TableRowGroup, {
        title: "Chat"
    }, /*#__PURE__*/ React.createElement(SettingSwitch, {
        setting: "chatMentions",
        label: "Color Mentions",
        subLabel: "Show the mentioned member’s role colors in chat and the composer",
        fallback: true
    }), /*#__PURE__*/ React.createElement(SettingSwitch, {
        setting: "colorChatMessages",
        label: "Color Message Content",
        subLabel: "Tint message text with the author’s role color",
        fallback: false
    }), window.unbound.metro.components.Discord.Slider ? /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TableRow, {
        label: /*#__PURE__*/ React.createElement(window.ReactNative.View, {
            style: {
                width: '100%',
                flexDirection: 'row',
                alignItems: 'center'
            }
        }, /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.Text, {
            variant: "text-md/semibold",
            color: "mobile-text-heading-primary"
        }, "Message color intensity"), /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.Text, {
            variant: "text-sm/medium",
            color: "text-muted",
            style: {
                marginLeft: 'auto'
            }
        }, new Intl.NumberFormat(undefined, {
            style: 'percent'
        }).format(saturation / 100))),
        subLabel: /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.Slider, {
            minimumValue: 0,
            maximumValue: 100,
            value: saturation,
            onValueChange: function onValueChange(value) {
                return store.set('messageSaturation', Math.round(value / 10) * 10);
            }
        })
    }) : null), /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TableRowGroup, {
        title: "People and Roles"
    }, /*#__PURE__*/ React.createElement(SettingSwitch, {
        setting: "typingUsers",
        label: "Typing Names",
        subLabel: "Color names in the channel typing indicator",
        fallback: true
    }), /*#__PURE__*/ React.createElement(SettingSwitch, {
        setting: "memberList",
        label: "Member List Role Headers",
        subLabel: "Color role section titles in the member list",
        fallback: true
    }), /*#__PURE__*/ React.createElement(SettingSwitch, {
        setting: "reactorsList",
        label: "Reaction Users",
        subLabel: "Color names in the reaction details list",
        fallback: true
    }), /*#__PURE__*/ React.createElement(SettingSwitch, {
        setting: "pollResults",
        label: "Poll Voters",
        subLabel: "Color names in poll result details",
        fallback: true
    }), /*#__PURE__*/ React.createElement(SettingSwitch, {
        setting: "voiceUsers",
        label: "Voice Users",
        subLabel: "Color members’ names in voice user lists",
        fallback: true
    })));
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
}function _array_like_to_array$8(arr, len) {
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
/**
 * @description Lists the users a message's raw content mentions, in order.
 * @param content The message's raw content, with mentions as `<@id>` or `<@!id>`.
 * @returns The mentioned user IDs.
 */ function mentionedUserIds(content) {
    return Array.from(content.matchAll(/<@!?(\d+)>/g), function(match) {
        return match[1];
    });
}
/**
 * @description Finds which name an `@` mention at a position spells out, trying the longest names first.
 * @param text The text holding the mention.
 * @param at The index of the mention's `@`.
 * @param names The names to try, sorted longest first.
 * @param boundary Matches a character that may follow a complete mention.
 * @returns The matched name without the `@`, or `undefined` when none fits.
 */ function matchMention(text, at, names, boundary) {
    return names.find(function(name) {
        if (!text.startsWith("@".concat(name), at)) return false;
        var next = text[at + name.length + 1];
        return !next || boundary.test(next);
    });
}
/**
 * @description Sorts names longest first, so a mention of `@Ann Lee` is not matched as `@Ann`.
 * @param names The names to sort.
 * @returns A new, sorted array.
 */ function longestFirst(names) {
    return _to_consumable_array$5(names).sort(function(a, b) {
        return b.length - a.length;
    });
}/**
 * @description Reads the guild of the channel the user has open.
 * @returns The guild id, or `undefined` outside a server.
 */ function currentGuildId() {
    return guildIdOf(SelectedChannelStore.getChannelId());
}
/**
 * @description Lists every name a guild member can be mentioned by in the composer, which shows a mention as plain `@name` text.
 * @param guildId The guild.
 * @returns Each name's member, and the names longest first so a longer name wins over its prefix.
 */ function guildAliases(guildId) {
    var _GuildMemberStore_getMembers;
    var members = ((_GuildMemberStore_getMembers = GuildMemberStore.getMembers(guildId)) !== null && _GuildMemberStore_getMembers !== void 0 ? _GuildMemberStore_getMembers : []).slice(0, 5000);
    var owners = uniqueNames(members.map(function(member) {
        var user = UserStore.getUser(member.userId);
        var tag = (user === null || user === void 0 ? void 0 : user.username) && user.discriminator && user.discriminator !== '0' ? "".concat(user.username, "#").concat(user.discriminator) : null;
        return [
            presentNames(member.nick, user === null || user === void 0 ? void 0 : user.globalName, user === null || user === void 0 ? void 0 : user.username, tag),
            member.userId
        ];
    }));
    return {
        owners: owners,
        names: longestFirst(owners.keys())
    };
}var BOUNDARY = RegExp("[\\s,.!?;:]", "u");
/**
 * @description Finds every `@name` in composer text that names a guild member.
 * @param text The composer's text.
 * @param aliases The guild's mention names.
 * @returns Each mention's range, end exclusive, and the member it names.
 */ function composerMentions(text, aliases) {
    var mentions = [];
    for(var at = text.indexOf('@'); at >= 0; at = text.indexOf('@', at + 1)){
        var name = matchMention(text, at, aliases.names, BOUNDARY);
        var userId = name ? aliases.owners.get(name) : undefined;
        if (!name || !userId) continue;
        mentions.push({
            start: at,
            end: at + name.length + 1,
            userId: userId
        });
        at += name.length;
    }
    return mentions;
}function _array_like_to_array$7(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_with_holes$5(arr) {
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
    return _array_with_holes$5(arr) || _iterable_to_array_limit$5(arr, i) || _unsupported_iterable_to_array$7(arr, i) || _non_iterable_rest$5();
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
function _unsupported_iterable_to_array$7(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _array_like_to_array$7(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(n);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _array_like_to_array$7(o, minLen);
}
var CHAT_INPUT = 'com.discord.chat.input.views.DCDChatInput';
var MENTION_SPAN = 'com.discord.chat.input.spans.DCDColorSpan';
var COLOR_FIELD = 'mColor';
var PAINT_DELAYS_MS = [
    0,
    50,
    150,
    300,
    800,
    1500
];
function keyOf(view) {
    return 'value' in view ? String(view.value) : '';
}
/**
 * @description Converts a `#rrggbb` color to the signed ARGB `int` Android text spans take.
 * @param hex The color.
 * @returns The opaque color as a signed 32-bit integer.
 */ function androidColor(hex) {
    return 0xff000000 | Number.parseInt(hex.slice(1, 7), 16) | 0;
}
/**
 * @description Paints mentions typed in Discord's native Android chat input with the mentioned member's role color, by recoloring the mention span Discord puts on each `@name`.
 * @param native The Java and hooks bridges from `context.native`.
 * @returns A function that removes the hook and gives every recolored span its color back.
 */ function colorAndroidChatInputMentions(param) {
    var java = param.java, hooks = param.hooks;
    var mentionSpan = java.getClass(MENTION_SPAN);
    var reflectArray = java.getClass('java.lang.reflect.Array');
    if (!mentionSpan || !reflectArray) {
        console.error("[".concat(PLUGIN_NAME, ": composer mentions] Skipped, the mention span was not found."));
        return function() {
            return _async_to_generator$6(function() {
                return _ts_generator$6(this, function(_state) {
                    return [
                        2
                    ];
                });
            })();
        };
    }
    var inputs = new Map();
    var aliases = new Map();
    var recolored = new Map();
    var stopped = false;
    function aliasesFor(guildId) {
        var _aliases_get;
        var cached = (_aliases_get = aliases.get(guildId)) !== null && _aliases_get !== void 0 ? _aliases_get : guildAliases(guildId);
        aliases.set(guildId, cached);
        return cached;
    }
    function spansIn(editable, start, end) {
        var _javaNumber;
        var array = javaReference(java.invoke(editable, 'getSpans', [
            javaInt(start),
            javaInt(end),
            mentionSpan
        ]));
        var length = array ? (_javaNumber = javaNumber(java.invoke(reflectArray, 'getLength', [
            array
        ]))) !== null && _javaNumber !== void 0 ? _javaNumber : 0 : 0;
        var spans = [];
        for(var index = 0; index < length; index++){
            var span = javaReference(java.invoke(reflectArray, 'get', [
                array,
                javaInt(index)
            ]));
            if (span && javaNumber(java.invoke(editable, 'getSpanStart', [
                span
            ])) === start) {
                spans.push(span);
            }
        }
        return spans;
    }
    function recolor(span, color) {
        var current = javaNumber(java.getField(span, COLOR_FIELD));
        if (current === undefined || current === color) return false;
        var key = keyOf(span);
        if (!recolored.has(key)) recolored.set(key, {
            span: span,
            original: current
        });
        java.setField(span, COLOR_FIELD, javaInt(color));
        return true;
    }
    // The input caches its drawn text, so a span only redraws once it is set again.
    function refresh(editable, span) {
        return _async_to_generator$6(function() {
            var _javaNumber, start, end, flags;
            return _ts_generator$6(this, function(_state) {
                switch(_state.label){
                    case 0:
                        start = java.invoke(editable, 'getSpanStart', [
                            span
                        ]);
                        end = java.invoke(editable, 'getSpanEnd', [
                            span
                        ]);
                        flags = java.invoke(editable, 'getSpanFlags', [
                            span
                        ]);
                        if (((_javaNumber = javaNumber(start)) !== null && _javaNumber !== void 0 ? _javaNumber : -1) < 0) return [
                            2
                        ];
                        return [
                            4,
                            java.invokeAsync(editable, 'setSpan', [
                                span,
                                start,
                                end,
                                flags
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
    function paint(view) {
        return _async_to_generator$6(function() {
            var guildId, editable, text, _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, mention, member, _getRoleColorAppearance_colors, hex, _iteratorNormalCompletion1, _didIteratorError1, _iteratorError1, _iterator1, _step1, span, err, err;
            return _ts_generator$6(this, function(_state) {
                switch(_state.label){
                    case 0:
                        guildId = currentGuildId();
                        editable = javaReference(java.invoke(view, 'getText', []));
                        text = editable ? javaText(java.invoke(editable, 'toString', [])) : undefined;
                        if (!guildId || !editable || !(text === null || text === void 0 ? void 0 : text.includes('@')) || stopped) return [
                            2
                        ];
                        _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
                        _state.label = 1;
                    case 1:
                        _state.trys.push([
                            1,
                            12,
                            13,
                            14
                        ]);
                        _iterator = composerMentions(text, aliasesFor(guildId))[Symbol.iterator]();
                        _state.label = 2;
                    case 2:
                        if (!!(_iteratorNormalCompletion = (_step = _iterator.next()).done)) return [
                            3,
                            11
                        ];
                        mention = _step.value;
                        member = GuildMemberStore.getMember(guildId, mention.userId);
                        _getRoleColorAppearance_colors = _sliced_to_array$5(getRoleColorAppearance(member === null || member === void 0 ? void 0 : member.colorStrings, member === null || member === void 0 ? void 0 : member.colorString).colors, 1), hex = _getRoleColorAppearance_colors[0];
                        if (!hex) return [
                            3,
                            10
                        ];
                        _iteratorNormalCompletion1 = true, _didIteratorError1 = false, _iteratorError1 = undefined;
                        _state.label = 3;
                    case 3:
                        _state.trys.push([
                            3,
                            8,
                            9,
                            10
                        ]);
                        _iterator1 = spansIn(editable, mention.start, mention.end)[Symbol.iterator]();
                        _state.label = 4;
                    case 4:
                        if (!!(_iteratorNormalCompletion1 = (_step1 = _iterator1.next()).done)) return [
                            3,
                            7
                        ];
                        span = _step1.value;
                        if (!(recolor(span, androidColor(hex)) && !stopped)) return [
                            3,
                            6
                        ];
                        return [
                            4,
                            refresh(editable, span)
                        ];
                    case 5:
                        _state.sent();
                        _state.label = 6;
                    case 6:
                        _iteratorNormalCompletion1 = true;
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
                        _didIteratorError1 = true;
                        _iteratorError1 = err;
                        return [
                            3,
                            10
                        ];
                    case 9:
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
                    case 10:
                        _iteratorNormalCompletion = true;
                        return [
                            3,
                            2
                        ];
                    case 11:
                        return [
                            3,
                            14
                        ];
                    case 12:
                        err = _state.sent();
                        _didIteratorError = true;
                        _iteratorError = err;
                        return [
                            3,
                            14
                        ];
                    case 13:
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
                    case 14:
                        return [
                            2
                        ];
                }
            });
        })();
    }
    function schedule(view) {
        var _inputs_get;
        var key = keyOf(view);
        var state = (_inputs_get = inputs.get(key)) !== null && _inputs_get !== void 0 ? _inputs_get : {
            view: view,
            timers: []
        };
        inputs.set(key, state);
        var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
        try {
            for(var _iterator = state.timers[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
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
        state.timers = PAINT_DELAYS_MS.map(function(delay) {
            return setTimeout(function() {
                paint(view).catch(function(error) {
                    console.error("[".concat(PLUGIN_NAME, ": composer mentions] Failed to paint:"), error);
                });
            }, delay);
        });
    }
    var token = hooks.hook(CHAT_INPUT, 'onSelectionChanged', [
        'int',
        'int'
    ], {
        notify: true
    }, function(param) {
        var self = param.self;
        var view = javaReference(self);
        if (view && !stopped) schedule(view);
    });
    return function() {
        return _async_to_generator$6(function() {
            var _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, state, _iteratorNormalCompletion1, _didIteratorError1, _iteratorError1, _iterator1, _step1, timer, _iteratorNormalCompletion2, _didIteratorError2, _iteratorError2, _iterator2, _step2, _step_value, span, original, _iteratorNormalCompletion3, _didIteratorError3, _iteratorError3, _iterator3, _step3, state1, editable, _iteratorNormalCompletion4, _didIteratorError4, _iteratorError4, _iterator4, _step4, span1, err, err;
            return _ts_generator$6(this, function(_state) {
                switch(_state.label){
                    case 0:
                        stopped = true;
                        hooks.remove(token);
                        _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
                        try {
                            for(_iterator = inputs.values()[Symbol.iterator](); !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                                state = _step.value;
                                _iteratorNormalCompletion1 = true, _didIteratorError1 = false, _iteratorError1 = undefined;
                                try {
                                    for(_iterator1 = state.timers[Symbol.iterator](); !(_iteratorNormalCompletion1 = (_step1 = _iterator1.next()).done); _iteratorNormalCompletion1 = true){
                                        timer = _step1.value;
                                        clearTimeout(timer);
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
                        _iteratorNormalCompletion2 = true, _didIteratorError2 = false, _iteratorError2 = undefined;
                        try {
                            for(_iterator2 = recolored.values()[Symbol.iterator](); !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true){
                                _step_value = _step2.value, span = _step_value.span, original = _step_value.original;
                                try {
                                    java.setField(span, COLOR_FIELD, javaInt(original));
                                } catch (error) {
                                    console.warn("[".concat(PLUGIN_NAME, ": composer mentions] Could not restore a mention:"), error);
                                }
                            }
                        } catch (err) {
                            _didIteratorError2 = true;
                            _iteratorError2 = err;
                        } finally{
                            try {
                                if (!_iteratorNormalCompletion2 && _iterator2.return != null) {
                                    _iterator2.return();
                                }
                            } finally{
                                if (_didIteratorError2) {
                                    throw _iteratorError2;
                                }
                            }
                        }
                        _iteratorNormalCompletion3 = true, _didIteratorError3 = false, _iteratorError3 = undefined;
                        _state.label = 1;
                    case 1:
                        _state.trys.push([
                            1,
                            12,
                            13,
                            14
                        ]);
                        _iterator3 = inputs.values()[Symbol.iterator]();
                        _state.label = 2;
                    case 2:
                        if (!!(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done)) return [
                            3,
                            11
                        ];
                        state1 = _step3.value;
                        editable = javaReference(java.invoke(state1.view, 'getText', []));
                        _iteratorNormalCompletion4 = true, _didIteratorError4 = false, _iteratorError4 = undefined;
                        _state.label = 3;
                    case 3:
                        _state.trys.push([
                            3,
                            8,
                            9,
                            10
                        ]);
                        _iterator4 = recolored.values()[Symbol.iterator]();
                        _state.label = 4;
                    case 4:
                        if (!!(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done)) return [
                            3,
                            7
                        ];
                        span1 = _step4.value.span;
                        if (!editable) return [
                            3,
                            6
                        ];
                        return [
                            4,
                            refresh(editable, span1).catch(function() {
                                return undefined;
                            })
                        ];
                    case 5:
                        _state.sent();
                        _state.label = 6;
                    case 6:
                        _iteratorNormalCompletion4 = true;
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
                        _didIteratorError4 = true;
                        _iteratorError4 = err;
                        return [
                            3,
                            10
                        ];
                    case 9:
                        try {
                            if (!_iteratorNormalCompletion4 && _iterator4.return != null) {
                                _iterator4.return();
                            }
                        } finally{
                            if (_didIteratorError4) {
                                throw _iteratorError4;
                            }
                        }
                        return [
                            7
                        ];
                    case 10:
                        _iteratorNormalCompletion3 = true;
                        return [
                            3,
                            2
                        ];
                    case 11:
                        return [
                            3,
                            14
                        ];
                    case 12:
                        err = _state.sent();
                        _didIteratorError3 = true;
                        _iteratorError3 = err;
                        return [
                            3,
                            14
                        ];
                    case 13:
                        try {
                            if (!_iteratorNormalCompletion3 && _iterator3.return != null) {
                                _iterator3.return();
                            }
                        } finally{
                            if (_didIteratorError3) {
                                throw _iteratorError3;
                            }
                        }
                        return [
                            7
                        ];
                    case 14:
                        inputs.clear();
                        aliases.clear();
                        recolored.clear();
                        return [
                            2
                        ];
                }
            });
        })();
    };
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
}function _array_like_to_array$6(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_without_holes$4(arr) {
    if (Array.isArray(arr)) return _array_like_to_array$6(arr);
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
function _iterable_to_array$4(iter) {
    if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) {
        return Array.from(iter);
    }
}
function _non_iterable_spread$4() {
    throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _to_consumable_array$4(arr) {
    return _array_without_holes$4(arr) || _iterable_to_array$4(arr) || _unsupported_iterable_to_array$6(arr) || _non_iterable_spread$4();
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
function _unsupported_iterable_to_array$6(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _array_like_to_array$6(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(n);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _array_like_to_array$6(o, minLen);
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
    return _async_to_generator$5(function() {
        return _ts_generator$5(this, function(_state) {
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
}
/**
 * @description Calls a selector on the calling thread, so a native hook never waits on the main thread, treating a bridge error as no result.
 * @param objc The Objective-C bridge from `context.native`.
 * @param handle The receiver.
 * @param selector The selector to call.
 * @param args The selector's arguments.
 * @returns The selector's result, or `null` when the call failed.
 */ // UNKNOWN: returns whatever the Objective-C method returns; callers narrow it.
function safeCall(objc, handle, selector) {
    for(var _len = arguments.length, args = new Array(_len > 3 ? _len - 3 : 0), _key = 3; _key < _len; _key++){
        args[_key - 3] = arguments[_key];
    }
    try {
        var _objc;
        return (_objc = objc).call.apply(_objc, [
            handle,
            selector
        ].concat(_to_consumable_array$4(args)));
    } catch (unused) {
        return null;
    }
}var MESSAGE_TEXT_VIEW_CLASSES = [
    'DCDAttributedTextView',
    'DCDReusableYYLabel'
];function _array_like_to_array$5(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_with_holes$4(arr) {
    if (Array.isArray(arr)) return arr;
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
    return _array_with_holes$4(arr) || _iterable_to_array_limit$4(arr, i) || _unsupported_iterable_to_array$5(arr, i) || _non_iterable_rest$4();
}
function _unsupported_iterable_to_array$5(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _array_like_to_array$5(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(n);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _array_like_to_array$5(o, minLen);
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
                                var _param = _sliced_to_array$4(param, 1), cell = _param[0];
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
}function _array_like_to_array$4(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_with_holes$3(arr) {
    if (Array.isArray(arr)) return arr;
}
function _array_without_holes$3(arr) {
    if (Array.isArray(arr)) return _array_like_to_array$4(arr);
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
function _non_iterable_spread$3() {
    throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _sliced_to_array$3(arr, i) {
    return _array_with_holes$3(arr) || _iterable_to_array_limit$3(arr, i) || _unsupported_iterable_to_array$4(arr, i) || _non_iterable_rest$3();
}
function _to_consumable_array$3(arr) {
    return _array_without_holes$3(arr) || _iterable_to_array$3(arr) || _unsupported_iterable_to_array$4(arr) || _non_iterable_spread$3();
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
function _type_of$1(obj) {
    "@swc/helpers - typeof";
    return obj && typeof Symbol !== "undefined" && obj.constructor === Symbol ? "symbol" : typeof obj;
}
function _unsupported_iterable_to_array$4(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _array_like_to_array$4(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(n);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _array_like_to_array$4(o, minLen);
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
                    _ref = _sliced_to_array$3.apply(void 0, [
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
 * @description Paints role-colored runs into attributed strings, caching the `UIColor` for each hex color.
 * @param objc The Objective-C bridge from `context.native`.
 * @returns `paint` colors one mention in an attributed string, `clear` drops the color cache.
 */ function createMentionPainter(objc) {
    var colors = new Map();
    function uiColor(hex) {
        return _async_to_generator$3(function() {
            var cached, UIColor, value, color;
            return _ts_generator$3(this, function(_state) {
                switch(_state.label){
                    case 0:
                        cached = colors.get(hex);
                        UIColor = objc.getClass('UIColor');
                        if (cached || !UIColor) return [
                            2,
                            cached
                        ];
                        value = Number.parseInt(hex.slice(1), 16);
                        return [
                            4,
                            safeInvokeAsync(objc, UIColor, 'colorWithRed:green:blue:alpha:', (value >> 16 & 0xff) / 255, (value >> 8 & 0xff) / 255, (value & 0xff) / 255, 1)
                        ];
                    case 1:
                        color = _state.sent();
                        if (colors.size >= 256) colors.clear();
                        if (color) colors.set(hex, color);
                        return [
                            2,
                            color
                        ];
                }
            });
        })();
    }
    function paint(attributed, text, location, stops) {
        return _async_to_generator$3(function() {
            var position, _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, run, color, range, err;
            return _ts_generator$3(this, function(_state) {
                switch(_state.label){
                    case 0:
                        position = location;
                        _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
                        _state.label = 1;
                    case 1:
                        _state.trys.push([
                            1,
                            6,
                            7,
                            8
                        ]);
                        _iterator = roleColorRuns(text, stops)[Symbol.iterator]();
                        _state.label = 2;
                    case 2:
                        if (!!(_iteratorNormalCompletion = (_step = _iterator.next()).done)) return [
                            3,
                            5
                        ];
                        run = _step.value;
                        return [
                            4,
                            uiColor(run.color)
                        ];
                    case 3:
                        color = _state.sent();
                        if (color) {
                            range = objc.struct('NSRange', {
                                location: position,
                                length: run.text.length
                            });
                            safeCall(objc, attributed, 'addAttribute:value:range:', 'NSColor', color, range);
                        }
                        position += run.text.length;
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
    return {
        paint: paint,
        clear: function clear() {
            return colors.clear();
        }
    };
}function _array_like_to_array$3(arr, len) {
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
function _iterable_to_array$2(iter) {
    if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) {
        return Array.from(iter);
    }
}
function _non_iterable_spread$2() {
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
function mentionsIn(message, guildId) {
    var _message_content;
    var mentions = [];
    var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
    try {
        for(var _iterator = mentionedUserIds((_message_content = message.content) !== null && _message_content !== void 0 ? _message_content : '')[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
            var userId = _step.value;
            var member = GuildMemberStore.getMember(guildId, userId);
            var appearance = getRoleColorAppearance(member === null || member === void 0 ? void 0 : member.colorStrings, member === null || member === void 0 ? void 0 : member.colorString);
            if (!appearance.colors.length) {
                continue;
            }
            var user = UserStore.getUser(userId);
            var names = presentNames(member === null || member === void 0 ? void 0 : member.nick, user === null || user === void 0 ? void 0 : user.globalName, user === null || user === void 0 ? void 0 : user.username);
            if (names.length) mentions.push({
                colors: appearance.colors,
                names: longestFirst(names)
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
    return mentions;
}
/**
 * @description Paints mentions in native chat message cells with the mentioned member's role colors.
 * @param objc The Objective-C bridge from `context.native`.
 * @returns A function that removes the hooks and restores every painted text view.
 */ function colorMessageMentions(objc) {
    var feature = "".concat(PLUGIN_NAME, ": chat mentions");
    var modules = {
        MessageStore: MessageStore,
        ChannelStore: ChannelStore,
        UserStore: UserStore,
        SelectedChannelStore: SelectedChannelStore
    };
    if (!ensureModules(feature, modules) || !ensureClasses(feature, objc, [
        'DCDMessageTableViewCell'
    ])) {
        return function() {
            return _async_to_generator$2(function() {
                return _ts_generator$2(this, function(_state) {
                    return [
                        2
                    ];
                });
            })();
        };
    }
    var painter = createMentionPainter(objc);
    var textViews = new Map();
    var pendingCells = new Set();
    var dirtyCells = new Set();
    var timers = new Set();
    var cellTextViews = new Map();
    var cellRevisions = new Map();
    var currentChannelId = SelectedChannelStore.getChannelId();
    var channelRevision = 0;
    var stopped = false;
    function messageIdFor(cell) {
        var message = safeCall(objc, objc.getIvar(cell, 'viewModel'), 'message');
        var identifier = safeCall(objc, message, 'id');
        if (typeof identifier === 'string') return identifier;
        var description = safeCall(objc, identifier, 'description');
        return typeof description === 'string' ? description : undefined;
    }
    function isCurrent(render) {
        var _cellRevisions_get;
        return !stopped && currentChannelId === render.channelId && channelRevision === render.channelRevision && ((_cellRevisions_get = cellRevisions.get(render.cellKey)) !== null && _cellRevisions_get !== void 0 ? _cellRevisions_get : 0) === render.cellRevision && messageIdFor(render.cell) === render.messageId;
    }
    function textViewsIn(cell) {
        return _async_to_generator$2(function() {
            var nodes;
            return _ts_generator$2(this, function(_state) {
                switch(_state.label){
                    case 0:
                        return [
                            4,
                            objc.snapshot(cell, {
                                maxDepth: 12,
                                maxNodes: 80
                            })
                        ];
                    case 1:
                        nodes = _state.sent();
                        return [
                            2,
                            nodes.map(function(node) {
                                return node.view;
                            }).filter(function(view) {
                                return objc.respondsTo(view, 'attributedText') && objc.respondsTo(view, 'setAttributedText:');
                            })
                        ];
                }
            });
        })();
    }
    function paintView(render, view) {
        return _async_to_generator$2(function() {
            var key, current, state, text, painted, offset, changed, _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, mention, at, name, attributes, length, err, latest, views;
            return _ts_generator$2(this, function(_state) {
                switch(_state.label){
                    case 0:
                        key = viewKey(objc, view);
                        if (!key) return [
                            2
                        ];
                        return [
                            4,
                            safeInvokeAsync(objc, view, 'attributedText')
                        ];
                    case 1:
                        current = _state.sent();
                        if (!current) return [
                            2
                        ];
                        state = textViews.get(key);
                        if ((state === null || state === void 0 ? void 0 : state.messageId) === render.messageId && safeCall(objc, current, 'isEqual:', state.applied)) {
                            return [
                                2
                            ];
                        }
                        if (state) textViews.delete(key);
                        text = safeCall(objc, current, 'string');
                        if (typeof text !== 'string' || !text.includes('@')) return [
                            2
                        ];
                        painted = objc.alloc('NSMutableAttributedString');
                        if (!safeCall(objc, painted, 'initWithAttributedString:', current)) return [
                            2
                        ];
                        offset = 0;
                        changed = false;
                        _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
                        _state.label = 2;
                    case 2:
                        _state.trys.push([
                            2,
                            9,
                            10,
                            11
                        ]);
                        _iterator = render.mentions[Symbol.iterator]();
                        _state.label = 3;
                    case 3:
                        if (!!(_iteratorNormalCompletion = (_step = _iterator.next()).done)) return [
                            3,
                            8
                        ];
                        mention = _step.value;
                        at = text.indexOf('@', offset);
                        _state.label = 4;
                    case 4:
                        if (!(at >= 0)) return [
                            3,
                            7
                        ];
                        name = matchMention(text, at, mention.names, RegExp("[\\s\\u2068\\u2069]", "u"));
                        if (!name) {
                            return [
                                3,
                                6
                            ];
                        }
                        attributes = safeCall(objc, current, 'attributesAtIndex:effectiveRange:', at, null);
                        // Only Discord's tappable mention spans carry a highlight; plain "@name" text stays as is.
                        if (!(attributes === null || attributes === void 0 ? void 0 : attributes.YYTextHighlight)) {
                            return [
                                3,
                                6
                            ];
                        }
                        length = name.length + 1;
                        return [
                            4,
                            painter.paint(painted, text.slice(at, at + length), at, mention.colors)
                        ];
                    case 5:
                        _state.sent();
                        offset = at + length;
                        changed = true;
                        return [
                            3,
                            7
                        ];
                    case 6:
                        at = text.indexOf('@', at + 1);
                        return [
                            3,
                            4
                        ];
                    case 7:
                        _iteratorNormalCompletion = true;
                        return [
                            3,
                            3
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
                        if (!changed || stopped) return [
                            2
                        ];
                        return [
                            4,
                            safeInvokeAsync(objc, view, 'attributedText')
                        ];
                    case 12:
                        latest = _state.sent();
                        if (!latest || !safeCall(objc, latest, 'isEqual:', current) || !isCurrent(render)) return [
                            2
                        ];
                        textViews.set(key, {
                            applied: painted,
                            messageId: render.messageId,
                            original: current,
                            view: view
                        });
                        views = cellTextViews.get(render.cellKey);
                        if (!views) {
                            views = new Set();
                            cellTextViews.set(render.cellKey, views);
                        }
                        views.add(key);
                        return [
                            4,
                            safeInvokeAsync(objc, view, 'setAttributedText:', painted)
                        ];
                    case 13:
                        _state.sent();
                        return [
                            2
                        ];
                }
            });
        })();
    }
    function paintCell(cell) {
        return _async_to_generator$2(function() {
            var _cellRevisions_get, _message_guildId, _ChannelStore_getChannel, cellKey, channelId, render, cellRevision, messageId, message, guildId, mentions, _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, view, err;
            return _ts_generator$2(this, function(_state) {
                switch(_state.label){
                    case 0:
                        if (stopped || !currentChannelId) return [
                            2
                        ];
                        cellKey = viewKey(objc, cell);
                        if (!cellKey) return [
                            2
                        ];
                        return [
                            4,
                            safeInvokeAsync(objc, cell, 'window')
                        ];
                    case 1:
                        if (!_state.sent()) {
                            forgetCell(cell);
                            return [
                                2
                            ];
                        }
                        channelId = currentChannelId;
                        render = {
                            cell: cell,
                            cellKey: cellKey,
                            channelId: channelId,
                            channelRevision: channelRevision
                        };
                        cellRevision = (_cellRevisions_get = cellRevisions.get(cellKey)) !== null && _cellRevisions_get !== void 0 ? _cellRevisions_get : 0;
                        messageId = messageIdFor(cell);
                        message = messageId ? MessageStore.getMessage(channelId, messageId) : null;
                        if (!messageId || !message) return [
                            2
                        ];
                        guildId = (_message_guildId = message.guildId) !== null && _message_guildId !== void 0 ? _message_guildId : (_ChannelStore_getChannel = ChannelStore.getChannel(channelId)) === null || _ChannelStore_getChannel === void 0 ? void 0 : _ChannelStore_getChannel.guild_id;
                        if (!guildId) return [
                            2
                        ];
                        mentions = mentionsIn(message, guildId);
                        if (!mentions.length) return [
                            2
                        ];
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
                            textViewsIn(cell)
                        ];
                    case 3:
                        _iterator = _state.sent()[Symbol.iterator]();
                        _state.label = 4;
                    case 4:
                        if (!!(_iteratorNormalCompletion = (_step = _iterator.next()).done)) return [
                            3,
                            7
                        ];
                        view = _step.value;
                        return [
                            4,
                            paintView(_object_spread_props(_object_spread$1({}, render), {
                                cellRevision: cellRevision,
                                messageId: messageId,
                                mentions: mentions
                            }), view)
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
                            2
                        ];
                }
            });
        })();
    }
    function scheduleCell(cell) {
        if (stopped) return;
        var key = viewKey(objc, cell);
        if (!key) return;
        if (pendingCells.has(key)) {
            dirtyCells.add(key);
            return;
        }
        pendingCells.add(key);
        var timer = setTimeout(function() {
            timers.delete(timer);
            void paintCell(cell).catch(function(error) {
                if (stopped) return;
                console.error("[".concat(PLUGIN_NAME, "] Failed to paint native mentions:"), error);
            }).finally(function() {
                pendingCells.delete(key);
                if (dirtyCells.delete(key) && !stopped) scheduleCell(cell);
            });
        }, 0);
        timers.add(timer);
    }
    function forgetCell(cell) {
        var _cellRevisions_get, _cellTextViews_get;
        var cellKey = viewKey(objc, cell);
        if (!cellKey) return;
        cellRevisions.set(cellKey, ((_cellRevisions_get = cellRevisions.get(cellKey)) !== null && _cellRevisions_get !== void 0 ? _cellRevisions_get : 0) + 1);
        var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
        try {
            for(var _iterator = ((_cellTextViews_get = cellTextViews.get(cellKey)) !== null && _cellTextViews_get !== void 0 ? _cellTextViews_get : [])[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                var key = _step.value;
                textViews.delete(key);
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
        cellTextViews.delete(cellKey);
    }
    function scanVisibleCells() {
        return _async_to_generator$2(function() {
            var cells, _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, cell;
            return _ts_generator$2(this, function(_state) {
                switch(_state.label){
                    case 0:
                        if (stopped) return [
                            2
                        ];
                        return [
                            4,
                            findVisibleCells(objc, 'DCDMessageTableViewCell')
                        ];
                    case 1:
                        cells = _state.sent();
                        _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
                        try {
                            for(_iterator = cells[Symbol.iterator](); !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                                cell = _step.value;
                                scheduleCell(cell);
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
    function scheduleScans() {
        var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
        try {
            var _loop = function() {
                var delay = _step.value;
                var timer = setTimeout(function() {
                    timers.delete(timer);
                    void scanVisibleCells().catch(function(error) {
                        console.error("[".concat(PLUGIN_NAME, "] Failed to scan visible message cells:"), error);
                    });
                }, delay);
                timers.add(timer);
            };
            for(var _iterator = CELL_SCAN_DELAYS[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true)_loop();
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
    function onChannelChange() {
        var channelId = SelectedChannelStore.getChannelId();
        if (!channelId || channelId === currentChannelId) return;
        currentChannelId = channelId;
        channelRevision++;
        var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
        try {
            for(var _iterator = pendingCells[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                var key = _step.value;
                dirtyCells.add(key);
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
        textViews.clear();
        cellTextViews.clear();
        scheduleScans();
    }
    function restoreView(state) {
        return _async_to_generator$2(function() {
            var current;
            return _ts_generator$2(this, function(_state) {
                switch(_state.label){
                    case 0:
                        return [
                            4,
                            safeInvokeAsync(objc, state.view, 'attributedText')
                        ];
                    case 1:
                        current = _state.sent();
                        if (!safeCall(objc, current, 'isEqual:', state.applied)) return [
                            3,
                            3
                        ];
                        return [
                            4,
                            safeInvokeAsync(objc, state.view, 'setAttributedText:', state.original)
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
    var unhook = hookMessageCells(objc, {
        shown: scheduleCell,
        laidOut: scheduleCell,
        reused: forgetCell
    });
    SelectedChannelStore.addChangeListener(onChannelChange);
    scheduleScans();
    return function() {
        return _async_to_generator$2(function() {
            var _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, timer, painted;
            return _ts_generator$2(this, function(_state) {
                switch(_state.label){
                    case 0:
                        stopped = true;
                        SelectedChannelStore.removeChangeListener(onChannelChange);
                        unhook();
                        _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
                        try {
                            for(_iterator = timers[Symbol.iterator](); !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                                timer = _step.value;
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
                        painted = _to_consumable_array$2(textViews.values());
                        textViews.clear();
                        return [
                            4,
                            Promise.all(painted.map(restoreView))
                        ];
                    case 1:
                        _state.sent();
                        pendingCells.clear();
                        dirtyCells.clear();
                        cellTextViews.clear();
                        cellRevisions.clear();
                        painter.clear();
                        return [
                            2
                        ];
                }
            });
        })();
    };
}function _array_like_to_array$2(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_with_holes$2(arr) {
    if (Array.isArray(arr)) return arr;
}
function _array_without_holes$1(arr) {
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
function _iterable_to_array$1(iter) {
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
function _non_iterable_spread$1() {
    throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _sliced_to_array$2(arr, i) {
    return _array_with_holes$2(arr) || _iterable_to_array_limit$2(arr, i) || _unsupported_iterable_to_array$2(arr, i) || _non_iterable_rest$2();
}
function _to_consumable_array$1(arr) {
    return _array_without_holes$1(arr) || _iterable_to_array$1(arr) || _unsupported_iterable_to_array$2(arr) || _non_iterable_spread$1();
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
function _unsupported_iterable_to_array$2(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _array_like_to_array$2(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(n);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _array_like_to_array$2(o, minLen);
}
/**
 * @description Paints mentions typed in the native chat input with the mentioned member's role colors.
 * @param objc The Objective-C bridge from `context.native`.
 * @returns A function that removes the hooks and restores the input's text and selection.
 */ function colorChatInputMentions(objc) {
    var feature = "".concat(PLUGIN_NAME, ": composer mentions");
    if (!ensureModules(feature, {
        UserStore: UserStore,
        ChannelStore: ChannelStore,
        SelectedChannelStore: SelectedChannelStore
    }) || !ensureClasses(feature, objc, [
        'DCDChatInputComponentView'
    ])) {
        return function() {
            return _async_to_generator$1(function() {
                return _ts_generator$1(this, function(_state) {
                    return [
                        2
                    ];
                });
            })();
        };
    }
    var painter = createMentionPainter(objc);
    var states = new Map();
    var pending = new Map();
    var updating = new Set();
    var dirty = new Set();
    var aliases = new Map();
    var stopped = false;
    function aliasesFor(guildId) {
        var _aliases_get;
        var cached = (_aliases_get = aliases.get(guildId)) !== null && _aliases_get !== void 0 ? _aliases_get : guildAliases(guildId);
        aliases.set(guildId, cached);
        return cached;
    }
    function paint(view, key) {
        return _async_to_generator$1(function() {
            var guildId, original, state, text, painted, known, refreshed, changed, at, attributes, fontName, name, userId, member, appearance, selection, latest;
            return _ts_generator$1(this, function(_state) {
                switch(_state.label){
                    case 0:
                        return [
                            4,
                            safeInvokeAsync(objc, view, 'window')
                        ];
                    case 1:
                        if (!_state.sent() || stopped) return [
                            2
                        ];
                        guildId = currentGuildId();
                        if (!guildId) return [
                            2
                        ];
                        return [
                            4,
                            safeInvokeAsync(objc, view, 'attributedText')
                        ];
                    case 2:
                        original = _state.sent();
                        if (!original) return [
                            2
                        ];
                        state = states.get(key);
                        if (state && safeCall(objc, original, 'isEqual:', state.applied)) return [
                            2
                        ];
                        if (state) states.delete(key);
                        text = safeCall(objc, original, 'string');
                        if (typeof text !== 'string' || !text.includes('@')) return [
                            2
                        ];
                        painted = objc.alloc('NSMutableAttributedString');
                        if (!safeCall(objc, painted, 'initWithAttributedString:', original)) return [
                            2
                        ];
                        known = aliasesFor(guildId);
                        refreshed = false;
                        changed = false;
                        at = text.indexOf('@');
                        _state.label = 3;
                    case 3:
                        if (!(at >= 0)) return [
                            3,
                            6
                        ];
                        attributes = safeCall(objc, original, 'attributesAtIndex:effectiveRange:', at, null);
                        fontName = safeCall(objc, attributes === null || attributes === void 0 ? void 0 : attributes.NSFont, 'fontName');
                        // The composer bolds a completed mention; unbolded "@text" is still being typed.
                        if (typeof fontName !== 'string' || !/bold|semibold/i.test(fontName)) {
                            return [
                                3,
                                5
                            ];
                        }
                        name = matchMention(text, at, known.names, RegExp("[\\s,.!?;:]", "u"));
                        if (!name && !refreshed) {
                            aliases.delete(guildId);
                            known = aliasesFor(guildId);
                            refreshed = true;
                            name = matchMention(text, at, known.names, RegExp("[\\s,.!?;:]", "u"));
                        }
                        if (!name) {
                            return [
                                3,
                                5
                            ];
                        }
                        userId = known.owners.get(name);
                        member = userId ? GuildMemberStore.getMember(guildId, userId) : null;
                        appearance = getRoleColorAppearance(member === null || member === void 0 ? void 0 : member.colorStrings, member === null || member === void 0 ? void 0 : member.colorString);
                        if (!appearance.colors.length) {
                            return [
                                3,
                                5
                            ];
                        }
                        return [
                            4,
                            painter.paint(painted, "@".concat(name), at, appearance.colors)
                        ];
                    case 4:
                        _state.sent();
                        at += name.length;
                        changed = true;
                        _state.label = 5;
                    case 5:
                        at = text.indexOf('@', at + 1);
                        return [
                            3,
                            3
                        ];
                    case 6:
                        if (!changed || stopped) return [
                            2
                        ];
                        return [
                            4,
                            safeInvokeAsync(objc, view, 'selectedRange')
                        ];
                    case 7:
                        selection = _state.sent();
                        return [
                            4,
                            safeInvokeAsync(objc, view, 'attributedText')
                        ];
                    case 8:
                        latest = _state.sent();
                        if (!latest || !safeCall(objc, latest, 'isEqual:', original)) {
                            dirty.add(key);
                            return [
                                2
                            ];
                        }
                        if (stopped || guildId !== currentGuildId()) return [
                            2
                        ];
                        states.set(key, {
                            applied: painted,
                            original: original,
                            view: view
                        });
                        return [
                            4,
                            safeInvokeAsync(objc, view, 'setAttributedText:', painted)
                        ];
                    case 9:
                        _state.sent();
                        if (stopped) return [
                            2
                        ];
                        if (!selection) return [
                            3,
                            11
                        ];
                        return [
                            4,
                            safeInvokeAsync(objc, view, 'setSelectedRange:', selection)
                        ];
                    case 10:
                        _state.sent();
                        _state.label = 11;
                    case 11:
                        return [
                            2
                        ];
                }
            });
        })();
    }
    function update(view) {
        return _async_to_generator$1(function() {
            var key;
            return _ts_generator$1(this, function(_state) {
                switch(_state.label){
                    case 0:
                        if (stopped) return [
                            2
                        ];
                        key = viewKey(objc, view);
                        if (!key) return [
                            2
                        ];
                        if (updating.has(key)) {
                            dirty.add(key);
                            return [
                                2
                            ];
                        }
                        updating.add(key);
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
                            paint(view, key)
                        ];
                    case 2:
                        _state.sent();
                        return [
                            3,
                            4
                        ];
                    case 3:
                        updating.delete(key);
                        if (dirty.delete(key) && !stopped) schedule(view);
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
    function schedule(view) {
        if (stopped) return;
        var key = viewKey(objc, view);
        if (!key || pending.has(key)) return;
        var timer = setTimeout(function() {
            pending.delete(key);
            void update(view).catch(function(error) {
                console.error("[".concat(PLUGIN_NAME, "] Failed to paint composer mentions:"), error);
            });
        }, 0);
        pending.set(key, timer);
    }
    function restore(key, state) {
        return _async_to_generator$1(function() {
            var current, selection;
            return _ts_generator$1(this, function(_state) {
                switch(_state.label){
                    case 0:
                        return [
                            4,
                            safeInvokeAsync(objc, state.view, 'attributedText')
                        ];
                    case 1:
                        current = _state.sent();
                        if (!safeCall(objc, current, 'isEqual:', state.applied)) return [
                            2
                        ];
                        return [
                            4,
                            safeInvokeAsync(objc, state.view, 'selectedRange')
                        ];
                    case 2:
                        selection = _state.sent();
                        updating.add(key);
                        _state.label = 3;
                    case 3:
                        _state.trys.push([
                            3,
                            ,
                            7,
                            8
                        ]);
                        return [
                            4,
                            safeInvokeAsync(objc, state.view, 'setAttributedText:', state.original)
                        ];
                    case 4:
                        _state.sent();
                        if (!selection) return [
                            3,
                            6
                        ];
                        return [
                            4,
                            safeInvokeAsync(objc, state.view, 'setSelectedRange:', selection)
                        ];
                    case 5:
                        _state.sent();
                        _state.label = 6;
                    case 6:
                        return [
                            3,
                            8
                        ];
                    case 7:
                        updating.delete(key);
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
    var hooks = [];
    try {
        for(var _i = 0, _iter = [
            'setAttributedText:',
            'setText:',
            'textViewDidChange:',
            'layoutSubviews',
            'didMoveToWindow'
        ]; _i < _iter.length; _i++){
            var selector = _iter[_i];
            hooks.push(objc.hook('DCDChatInputComponentView', selector, {
                after: function after(param) {
                    var self = param.self;
                    return schedule(self);
                }
            }));
        }
    } catch (error) {
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
        throw error;
    }
    void findVisibleCells(objc, 'DCDChatInputComponentView').then(function(views) {
        var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
        try {
            for(var _iterator = views[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
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
    }).catch(function(error) {
        console.error("[".concat(PLUGIN_NAME, "] Failed to scan the composer:"), error);
    });
    return function() {
        return _async_to_generator$1(function() {
            var _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, hook, _iteratorNormalCompletion1, _didIteratorError1, _iteratorError1, _iterator1, _step1, timer, painted;
            return _ts_generator$1(this, function(_state) {
                switch(_state.label){
                    case 0:
                        stopped = true;
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
                        _iteratorNormalCompletion1 = true, _didIteratorError1 = false, _iteratorError1 = undefined;
                        try {
                            for(_iterator1 = pending.values()[Symbol.iterator](); !(_iteratorNormalCompletion1 = (_step1 = _iterator1.next()).done); _iteratorNormalCompletion1 = true){
                                timer = _step1.value;
                                clearTimeout(timer);
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
                        painted = _to_consumable_array$1(states);
                        states.clear();
                        return [
                            4,
                            Promise.all(painted.map(function(param) {
                                var _param = _sliced_to_array$2(param, 2), key = _param[0], state = _param[1];
                                return restore(key, state);
                            }))
                        ];
                    case 1:
                        _state.sent();
                        pending.clear();
                        dirty.clear();
                        aliases.clear();
                        painter.clear();
                        return [
                            2
                        ];
                }
            });
        })();
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
 * @description Colors mentions in native message cells and the chat input on iOS, and in the chat input on Android, queueing each enable after the previous teardown so views are restored before they are painted again.
 * @param context The plugin context, whose Objective-C or Java bridge paints the mentions.
 * @returns `enable`, which applies both features and returns their removal, and `settled`, which resolves once queued work finishes.
 */ function createNativeMentions(context) {
    var queue = Promise.resolve();
    function enqueue(step) {
        queue = queue.then(step).catch(function(error) {
            console.error("[".concat(PLUGIN_NAME, "] Failed to update native mentions:"), error);
        });
    }
    function enable() {
        if (!ensureCapabilities(PLUGIN_NAME, context.native, context.capabilities)) {
            return function() {};
        }
        if (context.platform === 'android') {
            var removeAndroid = colorAndroidChatInputMentions(context.native);
            return function() {
                return enqueue(removeAndroid);
            };
        }
        var objc = context.native.objc;
        var removers = [];
        enqueue(function() {
            for(var _i = 0, _iter = [
                colorMessageMentions,
                colorChatInputMentions
            ]; _i < _iter.length; _i++){
                var apply = _iter[_i];
                try {
                    removers.push(apply(objc));
                } catch (error) {
                    console.error("[".concat(PLUGIN_NAME, "] Failed to color native mentions:"), error);
                }
            }
        });
        return function() {
            return enqueue(function() {
                return _async_to_generator(function() {
                    var _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, result, err;
                    return _ts_generator(this, function(_state) {
                        switch(_state.label){
                            case 0:
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
                                    Promise.allSettled(removers.map(function(remove) {
                                        return remove();
                                    }))
                                ];
                            case 2:
                                _iterator = _state.sent()[Symbol.iterator]();
                                _state.label = 3;
                            case 3:
                                if (!!(_iteratorNormalCompletion = (_step = _iterator.next()).done)) return [
                                    3,
                                    5
                                ];
                                result = _step.value;
                                if (result.status === 'rejected') {
                                    console.error("[".concat(PLUGIN_NAME, "] Failed to restore native mentions:"), result.reason);
                                }
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
            });
        };
    }
    return {
        enable: enable,
        settled: function settled() {
            return queue;
        }
    };
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
 * @description Converts a `#rrggbb` color to the signed 32-bit opaque ARGB integer Discord's chat renderer uses.
 * @param hex The hex color.
 * @returns The ARGB color, or `null` when `hex` is not a hex color.
 */ function hexToArgb(hex) {
    if (!isHexColor(hex)) return null;
    return 0xff000000 | Number.parseInt(hex.slice(1), 16);
}
function toLinear(channel) {
    var value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
}
function fromLinear(value) {
    var clamped = Math.min(1, Math.max(0, value));
    var encoded = clamped <= 0.0031308 ? clamped * 12.92 : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
    return Math.round(encoded * 255);
}
function toOklab(color) {
    var red = toLinear(color >>> 16 & 0xff);
    var green = toLinear(color >>> 8 & 0xff);
    var blue = toLinear(color & 0xff);
    var light = Math.cbrt(0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue);
    var medium = Math.cbrt(0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue);
    var short = Math.cbrt(0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue);
    return [
        0.2104542553 * light + 0.793617785 * medium - 0.0040720468 * short,
        1.9779984951 * light - 2.428592205 * medium + 0.4505937099 * short,
        0.0259040371 * light + 0.7827717662 * medium - 0.808675766 * short
    ];
}
function fromOklab(param, alpha) {
    var _param = _sliced_to_array$1(param, 3), lightness = _param[0], a = _param[1], b = _param[2];
    var light = Math.pow(lightness + 0.3963377774 * a + 0.2158037573 * b, 3);
    var medium = Math.pow(lightness - 0.1055613458 * a - 0.0638541728 * b, 3);
    var short = Math.pow(lightness - 0.0894841775 * a - 1.291485548 * b, 3);
    var red = fromLinear(4.0767416621 * light - 3.3077115913 * medium + 0.2309699292 * short);
    var green = fromLinear(-1.2684380046 * light + 2.6097574011 * medium - 0.3413193965 * short);
    var blue = fromLinear(-0.0041960863 * light - 0.7034186147 * medium + 1.707614701 * short);
    return alpha & 0xff000000 | red << 16 | green << 8 | blue;
}
/**
 * @description Tints an ARGB color toward a role color in Oklab, keeping the base color's alpha.
 * @param base The color to tint.
 * @param role The role color to tint toward.
 * @param saturation How far to tint, from 0 (unchanged) to 100 (the role color).
 * @returns The tinted signed 32-bit ARGB color.
 */ function blendArgb(base, role, saturation) {
    var ratio = Math.min(100, Math.max(0, saturation)) / 100;
    if (ratio === 0) return base | 0;
    if (ratio === 1) return base & 0xff000000 | role & 0x00ffffff;
    var original = toOklab(base);
    var tint = toOklab(role);
    var mixed = original.map(function(value, index) {
        return value * (1 - ratio) + tint[index] * ratio;
    });
    return fromOklab([
        mixed[0],
        mixed[1],
        mixed[2]
    ], base);
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
function _sliced_to_array(arr, i) {
    return _array_with_holes(arr) || _iterable_to_array_limit(arr, i) || _unsupported_iterable_to_array(arr, i) || _non_iterable_rest();
}
function _to_consumable_array(arr) {
    return _array_without_holes(arr) || _iterable_to_array(arr) || _unsupported_iterable_to_array(arr) || _non_iterable_spread();
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
// Discord reuses message objects across row generations, so remember the untinted color to avoid compounding.
var tints = new WeakMap();
function memberRgbColors(member) {
    return memberArgbColors(member).map(function(color) {
        return color & 0xffffff;
    });
}
function memberArgbColors(member) {
    if (!member) return [];
    return getRoleColorAppearance(member.colorStrings, member.colorString).colors.map(hexToArgb).filter(function(value) {
        return value !== null;
    });
}
function colorMentions(content, members, defaultGuildId, asRoleMention) {
    if (!Array.isArray(content)) return;
    var pending = _to_consumable_array(content);
    var visited = new Set();
    while(pending.length && visited.size < 400){
        var _pending, _pending1;
        var _node_guildId;
        var value = pending.pop();
        if (!value || (typeof value === "undefined" ? "undefined" : _type_of(value)) !== 'object' || visited.has(value)) {
            continue;
        }
        visited.add(value);
        var node = value;
        var guildId = (_node_guildId = node.guildId) !== null && _node_guildId !== void 0 ? _node_guildId : defaultGuildId;
        if (node.type === 'mention' && node.userId && guildId) {
            var _ref;
            var member = members.getMember(guildId, node.userId);
            var _memberRgbColors = _sliced_to_array(memberRgbColors(member), 3), primary = _memberRgbColors[0], secondary = _memberRgbColors[1], tertiary = _memberRgbColors[2];
            var roleId = (_ref = member === null || member === void 0 ? void 0 : member.colorRoleId) !== null && _ref !== void 0 ? _ref : member === null || member === void 0 ? void 0 : member.hoistRoleId;
            if (primary !== undefined && asRoleMention && roleId && !node.roleId) {
                node.roleId = roleId;
            }
            if (primary !== undefined) {
                node.roleColor = primary;
                node.color = primary;
                node.colorString = "#".concat(primary.toString(16).padStart(6, '0'));
                node.roleColors = _object_spread({
                    primaryColor: primary
                }, secondary === undefined ? {} : {
                    secondaryColor: secondary
                }, tertiary === undefined ? {} : {
                    tertiaryColor: tertiary
                });
            }
        }
        if (Array.isArray(node.content)) (_pending = pending).push.apply(_pending, _to_consumable_array(node.content));
        if (Array.isArray(node.items)) (_pending1 = pending).push.apply(_pending1, _to_consumable_array(node.items));
    }
}
function roleTextColor(message, members, options) {
    var guildId = message.guildId, authorId = message.authorId;
    if (!options.colorChatMessages || options.messageSaturation <= 0) return;
    if (!guildId || !authorId || message.state === 'SEND_FAILED') return;
    return memberArgbColors(members.getMember(guildId, authorId))[0];
}
function tintMessage(message, members, options) {
    if (typeof message.textColor !== 'number') return;
    var previous = tints.get(message);
    var unchanged = (previous === null || previous === void 0 ? void 0 : previous.applied) === message.textColor;
    var base = unchanged ? previous.base : message.textColor;
    var role = roleTextColor(message, members, options);
    if (role === undefined) {
        message.textColor = base;
        tints.delete(message);
        return;
    }
    if (unchanged && previous.role === role && previous.saturation === options.messageSaturation) {
        return;
    }
    var applied = blendArgb(base, role, options.messageSaturation);
    message.textColor = applied;
    tints.set(message, {
        base: base,
        applied: applied,
        role: role,
        saturation: options.messageSaturation
    });
}
/**
 * @description Colors a generated chat row in place: mentions take the member's role colors and the text can be tinted with the author's.
 * @param row The row Discord's `RowManager` generated.
 * @param members Looks up the guild members whose colors to use.
 * @param options The user's chat settings.
 */ function applyChatRoleColors(row, members, options) {
    var message = row.message;
    if (!message) return;
    if (options.chatMentions) {
        var _options_roleMentionColors, _message_embeds;
        var _message_referencedMessage;
        var asRoleMention = (_options_roleMentionColors = options.roleMentionColors) !== null && _options_roleMentionColors !== void 0 ? _options_roleMentionColors : false;
        colorMentions(message.content, members, message.guildId, asRoleMention);
        var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
        try {
            for(var _iterator = ((_message_embeds = message.embeds) !== null && _message_embeds !== void 0 ? _message_embeds : [])[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                var embed = _step.value;
                colorMentions(embed.description, members, message.guildId, asRoleMention);
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
        var referenced = (_message_referencedMessage = message.referencedMessage) === null || _message_referencedMessage === void 0 ? void 0 : _message_referencedMessage.message;
        if (referenced) {
            colorMentions(referenced.content, members, referenced.guildId, asRoleMention);
        }
    }
    tintMessage(message, members, options);
}/**
 * @description Colors mentions and, when enabled, message text in every chat row Discord generates, once `RowManager` loads.
 * @returns A function that stops waiting for `RowManager` and removes the patch.
 */ function patchRowManager() {
    return whenLoaded(byRowManager, function(RowManager) {
        var _RowManager_prototype;
        if (typeof ((_RowManager_prototype = RowManager.prototype) === null || _RowManager_prototype === void 0 ? void 0 : _RowManager_prototype.generate) !== 'function') {
            console.error("[".concat(PLUGIN_NAME, ": chat] Skipped, RowManager has no generate method."));
            return;
        }
        // Always on, even with both chat settings off, so turning tinting off restores reused rows.
        return Patcher.after(RowManager.prototype, 'generate', function(param) {
            var result = param.result;
            applyChatRoleColors(result, GuildMemberStore, {
                chatMentions: settings.get('chatMentions', true),
                roleMentionColors: window.ReactNative.Platform.OS === 'ios',
                colorChatMessages: settings.get('colorChatMessages', false),
                messageSaturation: settings.get('messageSaturation', 30)
            });
        });
    });
}var dispose = function dispose() {};
var settled = function settled() {
    return Promise.resolve();
};
function start(context) {
    if (!ensureModules(PLUGIN_NAME, {
        GuildMemberStore: GuildMemberStore
    })) return;
    var nativeMentions = createNativeMentions(context);
    settled = nativeMentions.settled;
    dispose = applyFeatures(PLUGIN_NAME, [
        patchRowManager,
        function() {
            return whileEnabled(settings, 'typingUsers', true, patchTypingIndicator);
        },
        function() {
            return whileEnabled(settings, 'memberList', true, patchUsersFastList);
        },
        function() {
            return whileEnabled(settings, 'reactorsList', true, patchMessageReactionsContent);
        },
        function() {
            return whileEnabled(settings, 'pollResults', true, patchPollVotesActionSheet);
        },
        function() {
            return whileEnabled(settings, 'voiceUsers', true, patchVoiceUserNameItem);
        },
        function() {
            return whileEnabled(settings, 'chatMentions', true, nativeMentions.enable);
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