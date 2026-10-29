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
}var DISCORD_ANDROID_PACKAGE = 'com.discord';
/**
 * @description Names the Android drawable React Native bundles a packager asset as, which is how Discord's APK ships its images.
 * @param asset The asset from the asset registry.
 * @returns The drawable's resource name, such as `images_native_icons_ic_crown_16px`.
 */ function androidResourceName(asset) {
    return "".concat(asset.httpServerLocation.slice(1), "/").concat(asset.name).toLowerCase().replace(/\//g, '_').replace(/[^a-z0-9_]/g, '').replace(/^assets_/, '');
}
/**
 * @description Builds the URI Discord's Android image views load a bundled drawable from.
 * @param asset The asset from the asset registry.
 * @param packageName The app package that ships the drawable.
 * @returns An `android.resource://` URI for the drawable.
 */ function androidResourceUri(asset) {
    var packageName = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : DISCORD_ANDROID_PACKAGE;
    return "android.resource://".concat(packageName, "/drawable/").concat(androidResourceName(asset));
}var MessageRowData = window.unbound.metro.findByProps('generateMessageRowData', {
    lazy: true
});
var AssetUris = window.unbound.metro.findByProps('getAssetUriForEmbed', {
    lazy: true
});
var GuildStore = window.unbound.metro.stores.Guilds;
var Patcher = window.unbound.patcher.createPatcher('unbound.force-owner-crown');function getCrownSource() {
    var _AssetUris_getAssetUriForEmbed, _Image_resolveAssetSource;
    var id = window.unbound.assets.getIDByName('ic_crown_16px');
    if (id === undefined) return;
    var asset = window.unbound.assets.getByID(id);
    if (window.ReactNative.Platform.OS === 'android' && (asset === null || asset === void 0 ? void 0 : asset.httpServerLocation)) return androidResourceUri(asset);
    // Discord's embed URI stays valid where the native asset's may not.
    return ((_AssetUris_getAssetUriForEmbed = AssetUris.getAssetUriForEmbed) === null || _AssetUris_getAssetUriForEmbed === void 0 ? void 0 : _AssetUris_getAssetUriForEmbed.call(AssetUris, id)) || ((_Image_resolveAssetSource = window.ReactNative.Image.resolveAssetSource(id)) === null || _Image_resolveAssetSource === void 0 ? void 0 : _Image_resolveAssetSource.uri) || id;
}
/**
 * @description Shows the owner crown as the role icon on the server owner's messages that have none.
 * @returns A function that removes the patch.
 */ function patchOwnerCrown() {
    // Resolved on the first owner row rather than at start, since the asset may register later.
    var source;
    return Patcher.after(MessageRowData, 'generateMessageRowData', function(param) {
        var result = param.result;
        var _GuildStore_getGuild;
        var row = result === null || result === void 0 ? void 0 : result.message;
        if (!(row === null || row === void 0 ? void 0 : row.guildId) || !row.authorId || row.roleIcon) return;
        if (((_GuildStore_getGuild = GuildStore.getGuild(row.guildId)) === null || _GuildStore_getGuild === void 0 ? void 0 : _GuildStore_getGuild.ownerId) !== row.authorId) return;
        source !== null && source !== void 0 ? source : source = getCrownSource();
        if (source === undefined) return;
        row.roleIcon = {
            source: source,
            name: 'Server Owner',
            size: 18,
            alt: 'Server Owner'
        };
    });
}var dispose = function dispose() {};
function start() {
    if (!ensureModules('Force Owner Crown', {
        MessageRowData: MessageRowData,
        GuildStore: GuildStore
    })) return;
    dispose = applyFeatures('Force Owner Crown', [
        patchOwnerCrown
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