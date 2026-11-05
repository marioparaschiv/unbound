#include "UnboundNativeBridge.h"

#include <filesystem>
#include <memory>
#include <optional>
#include <stdexcept>
#include <utility>

#include "LoaderCrypto.h"
#include "LoaderFiles.h"
#include "LoaderRequiredLoader.h"
#include "LoaderVersion.h"
#include "NativePlatformBridge.h"
#include "NativePluginRuntime.h"
#include "UnboundNativeFonts.h"

namespace loader {
namespace jsi = facebook::jsi;

// Fonts and compiled bundles run to a few MB, so the total limit allows a slow connection.
constexpr DownloadPolicy kAddonDownloadPolicy{15.0, 30.0, 120.0};

static void downloadInside(const std::string &documents, const FileDownloader &download,
                           const std::string &url, const std::string &path)
{
    if (path.find('\0') != std::string::npos || !isContainedRelativePath(path))
    {
        throw std::runtime_error("Refused to download to " + path + ": it leaves Unbound's folder");
    }
    std::string target = joinPath(documents, path);
    createDirectories(std::filesystem::path(target).parent_path().string());
    std::optional<DownloadResult> response = download(url, target, {}, kAddonDownloadPolicy);
    if (!response)
    {
        throw std::runtime_error("Failed to download " + url);
    }
    if (response->status != 200)
    {
        throw std::runtime_error("Failed to download " + url + ": HTTP " +
                                 std::to_string(response->status));
    }
}

UnboundNativeProvider makeUnboundNativeProvider(const AddonState                   &addons,
                                                std::shared_ptr<fonts::FontService> fonts,
                                                std::string origin, uint32_t bytecodeVersion,
                                                std::string documents, FileDownloader download)
{
    UnboundNativeProvider provider;
    provider.getLoader = [origin = std::move(origin), bytecodeVersion,
                          documents]() -> nlohmann::json {
        nlohmann::json loader{
            {"origin", origin}, {"version", loaderVersion()}, {"bytecodeVersion", bytecodeVersion}};
        if (std::optional<std::string> required = requiredLoaderVersion(documents))
        {
            loader["requiredVersion"] = *required;
        }
        return loader;
    };
    provider.getPlugins = [&addons] {
        return addons.plugins();
    };
    provider.getThemes = [&addons] {
        return addons.themes();
    };
    provider.fonts = std::move(fonts);
    if (!documents.empty() && download)
    {
        provider.downloadFile = [documents = std::move(documents), download = std::move(download)](
                                    const std::string &url, const std::string &path) {
            downloadInside(documents, download, url, path);
        };
    }
    return provider;
}

static jsi::Function getter(jsi::Runtime &runtime, const char *name,
                            std::function<nlohmann::json()> read, nlohmann::json fallback)
{
    return native::makeFunction(
        runtime, name, 0,
        [read = std::move(read), fallback = std::move(fallback)](
            jsi::Runtime &rt, const jsi::Value &, const jsi::Value *, size_t) -> jsi::Value {
            return toJSIValue(rt, read ? read() : fallback);
        });
}

static jsi::Function rescanFunction(jsi::Runtime &runtime, std::function<void()> rescan)
{
    return native::makeFunction(runtime, "rescanThemes", 0,
                                [rescan = std::move(rescan)](jsi::Runtime &, const jsi::Value &,
                                                             const jsi::Value *,
                                                             size_t) -> jsi::Value {
                                    rescan();
                                    return jsi::Value::undefined();
                                });
}

static jsi::Function sha256Function(jsi::Runtime &runtime)
{
    return native::makeFunction(
        runtime, "getSha256", 1,
        [](jsi::Runtime &rt, const jsi::Value &, const jsi::Value *args,
           size_t count) -> jsi::Value {
            if (count < 1 || !args[0].isString())
            {
                throw jsi::JSError(rt, "getSha256 expects a string");
            }
            return jsi::String::createFromAscii(
                rt, crypto::hex(crypto::sha256(args[0].getString(rt).utf8(rt))));
        });
}

static jsi::Function
downloadFunction(jsi::Runtime                                                 &runtime,
                 std::function<void(const std::string &, const std::string &)> downloadFile)
{
    return native::makeFunction(
        runtime, "downloadFile", 2,
        [downloadFile = std::move(downloadFile)](jsi::Runtime     &rt, const jsi::Value &,
                                                 const jsi::Value *args,
                                                 size_t            count) -> jsi::Value {
            if (count < 2 || !args[0].isString() || !args[1].isString())
            {
                throw jsi::JSError(rt, "downloadFile expects a URL and a path");
            }
            if (!downloadFile)
            {
                throw jsi::JSError(rt, "downloadFile is unavailable on this loader");
            }
            std::string url  = args[0].getString(rt).utf8(rt);
            std::string path = args[1].getString(rt).utf8(rt);
            return native::executeBackgroundAsynchronously(
                rt,
                [downloadFile, url = std::move(url), path = std::move(path)] {
                    downloadFile(url, path);
                },
                [](jsi::Runtime &) {
                    return jsi::Value::undefined();
                });
        });
}

void installUnboundNative(jsi::Runtime &runtime, UnboundNativeProvider provider)
{
    const nlohmann::json none = nlohmann::json::array();
    jsi::Object          bridge(runtime);
    bridge.setProperty(
        runtime, "getLoader",
        getter(runtime, "getLoader", std::move(provider.getLoader), nlohmann::json::object()));
    bridge.setProperty(runtime, "getPlugins",
                       getter(runtime, "getPlugins", std::move(provider.getPlugins), none));
    bridge.setProperty(runtime, "getThemes",
                       getter(runtime, "getThemes", std::move(provider.getThemes), none));
    bridge.setProperty(runtime, "getAppIcons",
                       getter(runtime, "getAppIcons", std::move(provider.getAppIcons), none));
    if (provider.rescanThemes)
    {
        bridge.setProperty(runtime, "rescanThemes",
                           rescanFunction(runtime, std::move(provider.rescanThemes)));
    }
    if (provider.fonts)
    {
        bridge.setProperty(runtime, "fonts", makeFontsBridge(runtime, std::move(provider.fonts)));
    }
    bridge.setProperty(runtime, "getSha256", sha256Function(runtime));
    bridge.setProperty(runtime, "downloadFile",
                       downloadFunction(runtime, std::move(provider.downloadFile)));
    runtime.global().setProperty(runtime, "UnboundNative", std::move(bridge));
}
}
