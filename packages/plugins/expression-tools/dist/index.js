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
}// UNKNOWN: a component may render any node.
function _type_of$3(obj) {
    "@swc/helpers - typeof";
    return obj && typeof Symbol !== "undefined" && obj.constructor === Symbol ? "symbol" : typeof obj;
}
var MAX_DEPTH = 15;
/**
 * @description Checks whether a value can be read as a rendered React element.
 * @param value Any node from a render result.
 * @returns `true` for any non-null object, including arrays of children.
 */ function isElementNode(value) {
    return (typeof value === "undefined" ? "undefined" : _type_of$3(value)) === 'object' && value !== null;
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
}var PLUGIN_NAME = 'Expression Tools';
var StickerFormat = {
    Lottie: 3,
    GIF: 4
};function _type_of$2(obj) {
    "@swc/helpers - typeof";
    return obj && typeof Symbol !== "undefined" && obj.constructor === Symbol ? "symbol" : typeof obj;
}
function isStickerRecord(value) {
    return 'id' in value && typeof value.id === 'string' && 'format_type' in value && typeof value.format_type === 'number';
}
// UNKNOWN: sheet props and render results are Discord internals of any shape.
function findStickerRecord(value) {
    var depth = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : 0;
    if (depth > 8 || !value || (typeof value === "undefined" ? "undefined" : _type_of$2(value)) !== 'object') return null;
    if (!Array.isArray(value) && isStickerRecord(value)) return value;
    var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
    try {
        for(var _iterator = (Array.isArray(value) ? value : Object.values(value))[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
            var child = _step.value;
            var found = findStickerRecord(child, depth + 1);
            if (found) return found;
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
    return null;
}
/**
 * @description Tells which expression an action sheet shows from the key it was opened with.
 * @param key The action sheet key passed to `openLazy`.
 * @returns The expression kind, or `null` for sheets about something else.
 */ function getSheetKind(key) {
    if (/emoji/i.test(key)) return 'emoji';
    if (/sticker/i.test(key)) return 'sticker';
    return null;
}
/**
 * @description Reads a custom emoji from the emoji detail sheet's props, falling back to its image URL.
 * @param props The emoji detail sheet's props.
 * @returns The emoji, or `null` for a unicode emoji.
 */ function parseEmoji(props) {
    var _ref, _ref1, _ref2, _ref3;
    var _props_emojiNode, _props_emoji, _props_emoji1, _props_emojiNode_alt, _props_emojiNode1, _props_emoji2;
    var match = /\/emojis\/(\d+)\.(gif|png|webp)/.exec((_ref = props === null || props === void 0 ? void 0 : (_props_emojiNode = props.emojiNode) === null || _props_emojiNode === void 0 ? void 0 : _props_emojiNode.src) !== null && _ref !== void 0 ? _ref : '');
    var id = (_ref1 = props === null || props === void 0 ? void 0 : (_props_emoji = props.emoji) === null || _props_emoji === void 0 ? void 0 : _props_emoji.id) !== null && _ref1 !== void 0 ? _ref1 : match === null || match === void 0 ? void 0 : match[1];
    if (!id) return null;
    return {
        kind: 'emoji',
        id: id,
        name: (_ref2 = (_ref3 = props === null || props === void 0 ? void 0 : (_props_emoji1 = props.emoji) === null || _props_emoji1 === void 0 ? void 0 : _props_emoji1.name) !== null && _ref3 !== void 0 ? _ref3 : props === null || props === void 0 ? void 0 : (_props_emojiNode1 = props.emojiNode) === null || _props_emojiNode1 === void 0 ? void 0 : (_props_emojiNode_alt = _props_emojiNode1.alt) === null || _props_emojiNode_alt === void 0 ? void 0 : _props_emojiNode_alt.replace(/:/g, '')) !== null && _ref2 !== void 0 ? _ref2 : 'emoji',
        animated: (props === null || props === void 0 ? void 0 : (_props_emoji2 = props.emoji) === null || _props_emoji2 === void 0 ? void 0 : _props_emoji2.animated) === true || (match === null || match === void 0 ? void 0 : match[2]) === 'gif'
    };
}
/**
 * @description Finds a sticker anywhere inside a sticker sheet's props or render result.
 * @param value The value to search.
 * @returns The sticker, or `null` when none is found within 8 levels.
 */ // UNKNOWN: sheet props and render results are Discord internals of any shape.
function parseSticker(value) {
    var _sticker_name, _sticker_description, _ref, _sticker_tags;
    var sticker = findStickerRecord(value);
    if (!sticker) return null;
    return {
        kind: 'sticker',
        id: sticker.id,
        name: (_sticker_name = sticker.name) !== null && _sticker_name !== void 0 ? _sticker_name : 'sticker',
        description: (_sticker_description = sticker.description) !== null && _sticker_description !== void 0 ? _sticker_description : '',
        formatType: sticker.format_type,
        tags: (_ref = (_sticker_tags = sticker.tags) !== null && _sticker_tags !== void 0 ? _sticker_tags : sticker.name) !== null && _ref !== void 0 ? _ref : 'sticker'
    };
}
/**
 * @description Reads the expression an emoji or sticker sheet shows.
 * @param kind Which kind of sheet it is.
 * @param props The sheet's props.
 * @returns The expression, or `null` when the sheet holds none the plugin can act on.
 */ function parseExpression(kind, props) {
    return kind === 'emoji' ? parseEmoji(props) : parseSticker(props);
}
/**
 * @description Picks the file a sticker is stored as on Discord's CDN.
 * @param formatType The sticker's `format_type`.
 * @returns The file extension and its MIME type.
 */ function getStickerFile(formatType) {
    switch(formatType){
        case StickerFormat.Lottie:
            {
                return {
                    extension: 'json',
                    mimeType: 'application/json'
                };
            }
        case StickerFormat.GIF:
            {
                return {
                    extension: 'gif',
                    mimeType: 'image/gif'
                };
            }
        default:
            {
                return {
                    extension: 'png',
                    mimeType: 'image/png'
                };
            }
    }
}
/**
 * @description Builds the URL of an expression's image at 160px.
 * @param expression The emoji or sticker.
 * @returns The CDN URL.
 */ function getAssetUrl(expression) {
    if (expression.kind === 'emoji') {
        var extension = expression.animated ? 'gif' : 'png';
        return "https://cdn.discordapp.com/emojis/".concat(expression.id, ".").concat(extension, "?size=160&quality=lossless");
    }
    var extension1 = getStickerFile(expression.formatType).extension;
    return "https://media.discordapp.net/stickers/".concat(expression.id, ".").concat(extension1, "?size=160&quality=lossless");
}
/**
 * @description Builds the link "Copy URL" puts on the clipboard.
 * @param expression The emoji or sticker.
 * @returns The emoji's image URL, or the sticker's page on discord.com.
 */ function getExpressionLink(expression) {
    if (expression.kind === 'emoji') return getAssetUrl(expression);
    return "https://discord.com/stickers/".concat(expression.id);
}
/**
 * @description Builds the message markup that renders an emoji.
 * @param emoji The custom emoji.
 * @returns Markup such as `<a:name:id>`.
 */ function getEmojiMarkup(emoji) {
    return "<".concat(emoji.animated ? 'a' : '', ":").concat(emoji.name, ":").concat(emoji.id, ">");
}var ActionSheets = window.unbound.metro.api.ActionSheets;
var _metro_common = window.unbound.metro.common;
var Clipboard = _metro_common.Clipboard, Dispatcher = _metro_common.Dispatcher;
var _metro_stores = window.unbound.metro.stores;
var Guilds = _metro_stores.Guilds, Users = _metro_stores.Users;
var StickerDetailActionSheet = window.unbound.metro.findByFilePath('modules/stickers/native/StickerDetailActionSheet.tsx', {
    lazy: true
});
// Each is checked where it is used, so a missing one only disables its button.
var StickerSheets = window.unbound.metro.findByProps('hideStickerDetailActionSheet', {
    lazy: true
});
var StickerActions = window.unbound.metro.findByProps('favoriteSticker', 'unfavoriteSticker', {
    lazy: true
});
var StickerFavorites = window.unbound.metro.findByProps('isFavoriteSticker', {
    lazy: true
});
var EmojiActions = window.unbound.metro.findByProps('uploadEmoji', {
    lazy: true
});
var Auth = window.unbound.metro.findByProps('getToken', {
    lazy: true
});
var Patcher = window.unbound.patcher.createPatcher('unbound.expression-tools');function _instanceof(left, right) {
    "@swc/helpers - instanceof";
    if (right != null && typeof Symbol !== "undefined" && right[Symbol.hasInstance]) {
        return !!right[Symbol.hasInstance](left);
    } else return left instanceof right;
}
function _type_of$1(obj) {
    "@swc/helpers - typeof";
    return obj && typeof Symbol !== "undefined" && obj.constructor === Symbol ? "symbol" : typeof obj;
}
/**
 * @description Picks a readable message from an error thrown by Discord's HTTP client, the clipboard, or `fetch`.
 * @param error The rejection value.
 * @returns The API's error message, the error's own message, or a generic sentence.
 */ // UNKNOWN: rejections from Discord's modules carry no declared type.
function getErrorMessage(error) {
    if (_instanceof(error, Error)) return error.message;
    if (!error || (typeof error === "undefined" ? "undefined" : _type_of$1(error)) !== 'object') return 'The operation could not be completed.';
    var body = error.body, message = error.message, text = error.text;
    for(var _i = 0, _iter = [
        body === null || body === void 0 ? void 0 : body.message,
        message,
        text
    ]; _i < _iter.length; _i++){
        var candidate = _iter[_i];
        if (typeof candidate === 'string') return candidate;
    }
    return 'The operation could not be completed.';
}/**
 * @description Shows a toast titled with the plugin's name.
 * @param content The toast's text.
 */ function notify(content) {
    window.unbound.toasts.showToast({
        title: PLUGIN_NAME,
        content: content
    });
}
/**
 * @description Shows a failed action's error as a toast.
 * @param error The rejection value.
 */ // UNKNOWN: rejections from Discord's modules carry no declared type.
function notifyError(error) {
    notify(getErrorMessage(error));
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
/**
 * @description Copies text to the clipboard and confirms it with a toast.
 * @param text The text to copy.
 * @param confirmation The toast shown once it is copied.
 */ function copyText(text, confirmation) {
    void Promise.resolve(Clipboard.setString(text)).then(function() {
        return notify(confirmation);
    }).catch(notifyError);
}
/**
 * @description Tells whether the current user has favorited a sticker.
 * @param sticker The sticker.
 * @returns Whether it is in the user's favorites.
 */ function isFavoriteSticker(sticker) {
    var _ref;
    var _StickerFavorites_isFavoriteSticker;
    return (_ref = (_StickerFavorites_isFavoriteSticker = StickerFavorites.isFavoriteSticker) === null || _StickerFavorites_isFavoriteSticker === void 0 ? void 0 : _StickerFavorites_isFavoriteSticker.call(StickerFavorites, sticker.id)) !== null && _ref !== void 0 ? _ref : false;
}
/**
 * @description Adds a sticker to the user's favorites or removes it, then confirms with a toast.
 * @param sticker The sticker.
 * @param favorite `true` to favorite it, `false` to unfavorite it.
 * @returns A promise that settles once Discord saved the change.
 */ function setFavoriteSticker(sticker, favorite) {
    return _async_to_generator$1(function() {
        return _ts_generator$1(this, function(_state) {
            switch(_state.label){
                case 0:
                    if (!StickerActions.favoriteSticker) {
                        throw new Error('Favorites are unavailable on this client build.');
                    }
                    if (!favorite) return [
                        3,
                        2
                    ];
                    return [
                        4,
                        StickerActions.favoriteSticker(sticker.id)
                    ];
                case 1:
                    _state.sent();
                    notify("".concat(sticker.name, " added to favorites."));
                    return [
                        3,
                        4
                    ];
                case 2:
                    return [
                        4,
                        StickerActions.unfavoriteSticker(sticker.id)
                    ];
                case 3:
                    _state.sent();
                    notify("".concat(sticker.name, " removed from favorites."));
                    _state.label = 4;
                case 4:
                    return [
                        2
                    ];
            }
        });
    })();
}/**
 * @description Lists the servers the current user owns, where they can upload emojis and stickers.
 * @returns The owned servers, sorted by name.
 */ function getOwnedGuilds() {
    var _Users_getCurrentUser;
    var id = (_Users_getCurrentUser = Users.getCurrentUser()) === null || _Users_getCurrentUser === void 0 ? void 0 : _Users_getCurrentUser.id;
    if (!id) return [];
    var guilds = Object.values(Guilds.getGuilds());
    return guilds.filter(function(guild) {
        return guild.ownerId === id;
    }).sort(function(first, second) {
        return first.name.localeCompare(second.name);
    });
}
/**
 * @description Builds the URL of a server's icon at 64px.
 * @param guild A server that has an icon.
 * @returns The CDN URL.
 */ function getGuildIconUrl(guild) {
    return "https://cdn.discordapp.com/icons/".concat(guild.id, "/").concat(guild.icon, ".png?size=64");
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
function readDataUrl(emoji) {
    return _async_to_generator(function() {
        var response, blob, reader;
        return _ts_generator(this, function(_state) {
            switch(_state.label){
                case 0:
                    return [
                        4,
                        fetch(getAssetUrl(emoji))
                    ];
                case 1:
                    response = _state.sent();
                    if (!response.ok) {
                        throw new Error("Could not fetch ".concat(emoji.name, "."));
                    }
                    return [
                        4,
                        response.blob()
                    ];
                case 2:
                    blob = _state.sent();
                    reader = new FileReader();
                    return [
                        2,
                        new Promise(function(resolve, reject) {
                            reader.onerror = function() {
                                var _reader_error;
                                return reject((_reader_error = reader.error) !== null && _reader_error !== void 0 ? _reader_error : new Error('Could not read the expression file.'));
                            };
                            // `readAsDataURL` always produces a string result.
                            reader.onload = function() {
                                return resolve(reader.result);
                            };
                            reader.readAsDataURL(blob);
                        })
                    ];
            }
        });
    })();
}
function uploadEmoji(emoji, guild, name) {
    return _async_to_generator(function() {
        var _, _tmp;
        return _ts_generator(this, function(_state) {
            switch(_state.label){
                case 0:
                    if (!EmojiActions.uploadEmoji) {
                        throw new Error('Emoji uploads are unavailable on this client build.');
                    }
                    _ = EmojiActions.uploadEmoji;
                    _tmp = {
                        guildId: guild.id
                    };
                    return [
                        4,
                        readDataUrl(emoji)
                    ];
                case 1:
                    return [
                        4,
                        _.apply(EmojiActions, [
                            (_tmp.image = _state.sent(), _tmp.name = name, _tmp)
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
function postSticker(guild, form, token) {
    return new Promise(function(resolve, reject) {
        var request = new XMLHttpRequest();
        request.open('POST', "https://discord.com/api/v10/guilds/".concat(guild.id, "/stickers"));
        request.setRequestHeader('Authorization', token);
        request.onerror = function() {
            return reject(new Error('Sticker upload failed.'));
        };
        request.onload = function() {
            var body;
            try {
                body = JSON.parse(request.responseText);
            } catch (unused) {
                reject(new Error('Sticker upload returned an invalid response.'));
                return;
            }
            if (request.status >= 200 && request.status < 300) {
                resolve(body);
            } else {
                reject(new Error(getErrorMessage({
                    body: body
                })));
            }
        };
        request.send(form);
    });
}
function uploadSticker(sticker, guild, name) {
    return _async_to_generator(function() {
        var _Auth_getToken, token, _getStickerFile, extension, mimeType, form, file, body;
        return _ts_generator(this, function(_state) {
            switch(_state.label){
                case 0:
                    token = (_Auth_getToken = Auth.getToken) === null || _Auth_getToken === void 0 ? void 0 : _Auth_getToken.call(Auth);
                    if (!token) {
                        throw new Error('Sticker uploads are unavailable on this client build.');
                    }
                    _getStickerFile = getStickerFile(sticker.formatType), extension = _getStickerFile.extension, mimeType = _getStickerFile.mimeType;
                    form = new FormData();
                    form.append('name', name);
                    form.append('tags', sticker.tags || name);
                    form.append('description', sticker.description);
                    file = {
                        name: "".concat(name, ".").concat(extension),
                        type: mimeType,
                        uri: "https://cdn.discordapp.com/stickers/".concat(sticker.id, ".").concat(extension)
                    };
                    // React Native uploads a `{ uri, name, type }` part by downloading `uri`; the DOM typings only know `Blob`.
                    form.append('file', file);
                    return [
                        4,
                        postSticker(guild, form, token)
                    ];
                case 1:
                    body = _state.sent();
                    Dispatcher.dispatch({
                        type: 'GUILD_STICKERS_CREATE_SUCCESS',
                        guildId: guild.id,
                        sticker: _object_spread_props(_object_spread({}, body), {
                            user: Users.getCurrentUser()
                        })
                    });
                    return [
                        2
                    ];
            }
        });
    })();
}
/**
 * @description Uploads a copy of an emoji or sticker to a server the user owns, then confirms with a toast.
 * @param expression The emoji or sticker to copy.
 * @param guild The server to upload it to.
 * @param name The name to give the copy.
 * @returns A promise that rejects with Discord's error when the upload fails.
 */ function cloneExpression(expression, guild, name) {
    return _async_to_generator(function() {
        return _ts_generator(this, function(_state) {
            switch(_state.label){
                case 0:
                    if (!(expression.kind === 'emoji')) return [
                        3,
                        2
                    ];
                    return [
                        4,
                        uploadEmoji(expression, guild, name)
                    ];
                case 1:
                    _state.sent();
                    return [
                        3,
                        4
                    ];
                case 2:
                    return [
                        4,
                        uploadSticker(expression, guild, name)
                    ];
                case 3:
                    _state.sent();
                    _state.label = 4;
                case 4:
                    notify("Cloned ".concat(expression.name, " to ").concat(guild.name, "."));
                    return [
                        2
                    ];
            }
        });
    })();
}var styles$2 = window.ReactNative.StyleSheet.create({
    container: {
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 16
    },
    header: {
        alignItems: 'center',
        flexDirection: 'row',
        marginBottom: 16
    },
    preview: {
        borderRadius: 12,
        height: 48,
        marginRight: 12,
        width: 48
    },
    headerText: {
        flex: 1
    },
    title: {
        color: '#f2f3f5',
        fontSize: 18,
        fontWeight: '700'
    },
    subtitle: {
        color: '#b5bac1',
        fontSize: 13,
        marginTop: 2
    },
    label: {
        color: '#b5bac1',
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 7
    },
    spacedLabel: {
        marginTop: 16
    },
    guilds: {
        gap: 8,
        marginTop: 12
    },
    empty: {
        color: '#b5bac1',
        paddingVertical: 16,
        textAlign: 'center'
    }
});var styles$1 = window.ReactNative.StyleSheet.create({
    row: {
        alignItems: 'center',
        backgroundColor: '#2b2d31',
        borderRadius: 12,
        flexDirection: 'row',
        minHeight: 58,
        paddingHorizontal: 12
    },
    pressed: {
        backgroundColor: '#35373c'
    },
    disabled: {
        opacity: 0.5
    },
    icon: {
        borderRadius: 18,
        height: 36,
        marginRight: 12,
        width: 36
    },
    acronym: {
        alignItems: 'center',
        backgroundColor: '#5865f2',
        justifyContent: 'center'
    },
    acronymText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '700'
    },
    name: {
        color: '#f2f3f5',
        flex: 1,
        fontSize: 15,
        fontWeight: '600'
    },
    chevron: {
        color: '#949ba4',
        fontSize: 18
    }
});function GuildIcon(param) {
    var guild = param.guild;
    if (guild.icon) {
        return /*#__PURE__*/ React.createElement(window.ReactNative.Image, {
            source: {
                uri: getGuildIconUrl(guild)
            },
            style: styles$1.icon
        });
    }
    return /*#__PURE__*/ React.createElement(window.ReactNative.View, {
        style: [
            styles$1.icon,
            styles$1.acronym
        ]
    }, /*#__PURE__*/ React.createElement(window.ReactNative.Text, {
        style: styles$1.acronymText
    }, guild.name.slice(0, 1).toUpperCase()));
}
function GuildRow(param) {
    var guild = param.guild, busy = param.busy, disabled = param.disabled, onPress = param.onPress;
    return /*#__PURE__*/ React.createElement(window.ReactNative.Pressable, {
        disabled: disabled,
        onPress: onPress,
        style: function style(param) {
            var pressed = param.pressed;
            return [
                styles$1.row,
                pressed && styles$1.pressed,
                disabled && styles$1.disabled
            ];
        }
    }, /*#__PURE__*/ React.createElement(GuildIcon, {
        guild: guild
    }), /*#__PURE__*/ React.createElement(window.ReactNative.Text, {
        numberOfLines: 1,
        style: styles$1.name
    }, guild.name), /*#__PURE__*/ React.createElement(window.ReactNative.Text, {
        style: styles$1.chevron
    }, busy ? '…' : '›'));
}function _array_like_to_array$3(arr, len) {
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
    return _array_with_holes$3(arr) || _iterable_to_array_limit$3(arr, i) || _unsupported_iterable_to_array$3(arr, i) || _non_iterable_rest$3();
}
function _unsupported_iterable_to_array$3(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _array_like_to_array$3(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(n);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _array_like_to_array$3(o, minLen);
}
function CloneSheet(param) {
    var expression = param.expression, onClose = param.onClose;
    var _useState = _sliced_to_array$3(window.React.useState(expression.name), 2), name = _useState[0], setName = _useState[1];
    var _useState1 = _sliced_to_array$3(window.React.useState(''), 2), query = _useState1[0], setQuery = _useState1[1];
    var _useState2 = _sliced_to_array$3(window.React.useState(false), 2), busy = _useState2[0], setBusy = _useState2[1];
    var guilds = window.React.useMemo(function() {
        return getOwnedGuilds();
    }, []);
    var visibleGuilds = window.React.useMemo(function() {
        var search = query.trim().toLowerCase();
        return guilds.filter(function(guild) {
            return guild.name.toLowerCase().includes(search);
        });
    }, [
        guilds,
        query
    ]);
    var trimmedName = name.trim();
    var disabled = busy || !trimmedName;
    function clone(guild) {
        if (disabled) return;
        setBusy(true);
        onClose();
        void cloneExpression(expression, guild, trimmedName).catch(notifyError).finally(function() {
            return setBusy(false);
        });
    }
    return /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.ActionSheet, null, /*#__PURE__*/ React.createElement(window.ReactNative.View, {
        style: styles$2.container
    }, /*#__PURE__*/ React.createElement(window.ReactNative.View, {
        style: styles$2.header
    }, /*#__PURE__*/ React.createElement(window.ReactNative.Image, {
        source: {
            uri: getAssetUrl(expression)
        },
        style: styles$2.preview
    }), /*#__PURE__*/ React.createElement(window.ReactNative.View, {
        style: styles$2.headerText
    }, /*#__PURE__*/ React.createElement(window.ReactNative.Text, {
        style: styles$2.title
    }, "Clone to a server"), /*#__PURE__*/ React.createElement(window.ReactNative.Text, {
        numberOfLines: 1,
        style: styles$2.subtitle
    }, expression.name))), /*#__PURE__*/ React.createElement(window.ReactNative.Text, {
        style: styles$2.label
    }, "NAME"), /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TextField, {
        value: name,
        onChange: setName,
        placeholder: "Expression name"
    }), /*#__PURE__*/ React.createElement(window.ReactNative.Text, {
        style: [
            styles$2.label,
            styles$2.spacedLabel
        ]
    }, "YOUR SERVERS"), /*#__PURE__*/ React.createElement(window.unbound.metro.components.Discord.TextField, {
        value: query,
        onChange: setQuery,
        placeholder: "Search servers",
        isClearable: true
    }), /*#__PURE__*/ React.createElement(window.ReactNative.View, {
        style: styles$2.guilds
    }, visibleGuilds.map(function(guild) {
        return /*#__PURE__*/ React.createElement(GuildRow, {
            key: guild.id,
            guild: guild,
            busy: busy,
            disabled: disabled,
            onPress: function onPress() {
                return clone(guild);
            }
        });
    }), guilds.length === 0 ? /*#__PURE__*/ React.createElement(window.ReactNative.Text, {
        style: styles$2.empty
    }, "You do not own any servers.") : null, guilds.length > 0 && visibleGuilds.length === 0 ? /*#__PURE__*/ React.createElement(window.ReactNative.Text, {
        style: styles$2.empty
    }, "No servers match that search.") : null)));
}/**
 * @description Opens the sheet that clones an expression to one of the user's servers.
 * @param expression The emoji or sticker to clone.
 */ function openCloneSheet(expression) {
    var key = "unbound.expression-tools-sheet-clone-".concat(Date.now());
    function close() {
        ActionSheets.hideActionSheet(key);
    }
    ActionSheets.openLazy(Promise.resolve({
        default: function _default() {
            return /*#__PURE__*/ React.createElement(CloneSheet, {
                expression: expression,
                onClose: close
            });
        }
    }), key, {
        onClose: close
    });
}
/**
 * @description Closes the emoji or sticker sheet the action bar sits in.
 * @param expression The expression the sheet shows.
 * @param sheetKey The key the sheet was opened with.
 */ function closeExpressionSheet(expression, sheetKey) {
    if (expression.kind === 'sticker' && StickerSheets.hideStickerDetailActionSheet) {
        StickerSheets.hideStickerDetailActionSheet();
        return;
    }
    ActionSheets.hideActionSheet(sheetKey);
}var styles = window.ReactNative.StyleSheet.create({
    bar: {
        flexDirection: 'row',
        gap: 6,
        marginHorizontal: 12,
        marginTop: 10
    },
    button: {
        alignItems: 'center',
        backgroundColor: '#5865f2',
        borderRadius: 9,
        flex: 1,
        justifyContent: 'center',
        minHeight: 38,
        paddingHorizontal: 6
    },
    pressed: {
        backgroundColor: '#4752c4'
    },
    disabled: {
        opacity: 0.55
    },
    label: {
        color: '#f2f3f5',
        fontSize: 12,
        fontWeight: '700'
    }
});function _array_like_to_array$2(arr, len) {
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
function BarButton(param) {
    var label = param.label, onPress = param.onPress, _param_disabled = param.disabled, disabled = _param_disabled === void 0 ? false : _param_disabled;
    return /*#__PURE__*/ React.createElement(window.ReactNative.Pressable, {
        disabled: disabled,
        onPress: onPress,
        style: function style(param) {
            var pressed = param.pressed;
            return [
                styles.button,
                pressed && styles.pressed,
                disabled && styles.disabled
            ];
        }
    }, /*#__PURE__*/ React.createElement(window.ReactNative.Text, {
        numberOfLines: 1,
        style: styles.label
    }, label));
}
function ExpressionActionBar(param) {
    var expression = param.expression, sheetKey = param.sheetKey;
    var _useState = _sliced_to_array$2(window.React.useState(function() {
        return expression.kind === 'sticker' && isFavoriteSticker(expression);
    }), 2), favorite = _useState[0], setFavorite = _useState[1];
    var _useState1 = _sliced_to_array$2(window.React.useState(false), 2), updatingFavorite = _useState1[0], setUpdatingFavorite = _useState1[1];
    function close() {
        closeExpressionSheet(expression, sheetKey);
    }
    return /*#__PURE__*/ React.createElement(window.ReactNative.View, {
        style: styles.bar
    }, /*#__PURE__*/ React.createElement(BarButton, {
        label: "Copy URL",
        onPress: function onPress() {
            close();
            copyText(getExpressionLink(expression), 'URL copied to the clipboard.');
        }
    }), expression.kind === 'emoji' ? /*#__PURE__*/ React.createElement(BarButton, {
        label: "Copy markup",
        onPress: function onPress() {
            close();
            copyText(getEmojiMarkup(expression), 'Emoji markup copied to the clipboard.');
        }
    }) : /*#__PURE__*/ React.createElement(BarButton, {
        label: favorite ? 'Unfavorite' : 'Favorite',
        disabled: updatingFavorite,
        onPress: function onPress() {
            if (updatingFavorite) return;
            close();
            setUpdatingFavorite(true);
            void setFavoriteSticker(expression, !favorite).then(function() {
                return setFavorite(function(value) {
                    return !value;
                });
            }).catch(notifyError).finally(function() {
                return setUpdatingFavorite(false);
            });
        }
    }), /*#__PURE__*/ React.createElement(BarButton, {
        label: "Clone",
        onPress: function onPress() {
            close();
            openCloneSheet(expression);
        }
    }));
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
// UNKNOWN: a render result can be any React node.
function findChildren(node) {
    var depth = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : 0;
    if (depth > 12 || !isElementNode(node)) return null;
    if (Array.isArray(node)) return node;
    var props = node.props;
    if (Array.isArray(props === null || props === void 0 ? void 0 : props.children)) return props.children;
    return findChildren(props === null || props === void 0 ? void 0 : props.children, depth + 1);
}
// UNKNOWN: a child can be any React node.
function isActionBar(child) {
    return isElementNode(child) && child.type === ExpressionActionBar;
}
// UNKNOWN: a render result can be any React node.
function appendActionBar(result, expression, sheetKey) {
    var children = findChildren(result);
    if (!children || children.some(isActionBar)) return;
    children.push(window.React.createElement(ExpressionActionBar, {
        expression: expression,
        key: 'unbound.expression-tools-action',
        sheetKey: sheetKey
    }));
}
function isDetailSheet(param) {
    var props = param.props;
    // The shared element props do not declare these, so `in` narrows them.
    if (!props || !('emojiNode' in props) || !('nonce' in props)) return false;
    return Boolean(props.emojiNode) && props.nonce !== undefined;
}
/**
 * @description Creates the patches that add the action bar to emoji and sticker detail sheets. Discord creates these components lazily, so each one is patched when it first appears.
 * @returns Functions that patch a sheet module or a detail element once, and `dispose`, which removes every patch and ignores sheets that load later.
 */ function createExpressionSheetPatches() {
    var patched = new WeakSet();
    var unpatches = [];
    var disposed = false;
    function afterOnce(owner, method, callback) {
        if (disposed || patched.has(owner) || typeof owner[method] !== 'function') return;
        patched.add(owner);
        unpatches.push(Patcher.after(owner, method, callback));
    }
    function patchDetailSheet(detail, expression, sheetKey) {
        afterOnce(detail, 'type', function(param) {
            var result = param.result;
            return appendActionBar(result, expression, sheetKey);
        });
    }
    function patchExpressionSheet(module, kind, sheetKey) {
        afterOnce(module, 'default', function(param) {
            var _param_args = _sliced_to_array$1(param.args, 1), props = _param_args[0], result = param.result;
            var expression = parseExpression(kind, props);
            if (!expression || !result || (typeof result === "undefined" ? "undefined" : _type_of(result)) !== 'object') return;
            appendActionBar(result, expression, sheetKey);
            afterOnce(result, 'type', function(param) {
                var content = param.result;
                var detail = findElement(content, isDetailSheet);
                if (detail) patchDetailSheet(detail, expression, sheetKey);
                appendActionBar(content, expression, sheetKey);
            });
        });
    }
    function dispose() {
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
    }
    return {
        patchExpressionSheet: patchExpressionSheet,
        patchDetailSheet: patchDetailSheet,
        dispose: dispose
    };
}
/**
 * @description Watches `openLazy` for emoji and sticker sheets, and patches each sheet's component once it loads.
 * @param sheets The patches that add the action bar to a loaded sheet.
 * @returns A function that removes the patch.
 */ function patchActionSheets(sheets) {
    return Patcher.before(ActionSheets, 'openLazy', function(param) {
        var _param_args = _sliced_to_array$1(param.args, 2), load = _param_args[0], key = _param_args[1];
        if (typeof key !== 'string' || !(load === null || load === void 0 ? void 0 : load.then)) return;
        var kind = getSheetKind(key);
        if (!kind) return;
        load.then(function(module) {
            if (module && (typeof module === "undefined" ? "undefined" : _type_of(module)) === 'object') sheets.patchExpressionSheet(module, kind, key);
        }).catch(function() {
            return undefined;
        });
    });
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
function isGuildStickerDetail(element) {
    return getElementName(element) === 'GuildStickerDetail';
}
/**
 * @description Adds the action bar to the sticker sheet Discord opens from a message, which does not go through `openLazy`.
 * @param sheets The patches that add the action bar to a detail element.
 * @returns A function that removes the patch.
 */ function patchStickerDetailActionSheet(sheets) {
    var _StickerDetailActionSheet_default;
    if (typeof ((_StickerDetailActionSheet_default = StickerDetailActionSheet.default) === null || _StickerDetailActionSheet_default === void 0 ? void 0 : _StickerDetailActionSheet_default.type) !== 'function') {
        console.error("[".concat(PLUGIN_NAME, "] Skipped message stickers, their sheet is not a memo."));
        return function() {};
    }
    return Patcher.after(StickerDetailActionSheet.default, 'type', function(param) {
        var _param_args = _sliced_to_array(param.args, 1), props = _param_args[0], result = param.result;
        var _parseSticker;
        var sticker = (_parseSticker = parseSticker(props)) !== null && _parseSticker !== void 0 ? _parseSticker : parseSticker(result);
        var detail = findElement(result, isGuildStickerDetail);
        if (sticker && detail) sheets.patchDetailSheet(detail, sticker, 'StickerDetailActionSheet');
    });
}var dispose = function dispose() {};
function start() {
    if (!ensureModules(PLUGIN_NAME, {
        ActionSheets: ActionSheets
    })) return;
    var sheets = createExpressionSheetPatches();
    dispose = applyFeatures(PLUGIN_NAME, [
        function() {
            return sheets.dispose;
        },
        function() {
            return patchActionSheets(sheets);
        },
        function() {
            return patchStickerDetailActionSheet(sheets);
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