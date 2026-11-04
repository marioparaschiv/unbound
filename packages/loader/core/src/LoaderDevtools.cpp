#include "LoaderBundleRecord.h"
#include "LoaderFiles.h"
#include "LoaderLog.h"
#include "LoaderUpdater.h"

namespace loader {
std::optional<std::string> BundleUpdater::devtoolsScript(const std::string &bundlePath,
                                                         uint32_t           bytecodeVersion)
{
    nlohmann::json record = parseBundleRecord(readTextFile(bundlePath + kBundleTrustSuffix));
    std::string    kind   = bundleRecordField(record, "kind");
    std::string    source = bundleRecordField(record, "source");

    std::optional<std::string> manifestText;
    if (kind == "manifest")
    {
        manifestText = bundleRecordField(record, "manifest");
        if (trust_.isEnabled() &&
            verifyTrustedSignature(*manifestText, bundleRecordField(record, "signature"), trust_) ==
                TrustedSigner::None)
        {
            log(LogLevel::Error, LOG_CATEGORY_UPDATER,
                "Refused the DevTools backend: the bundle's stored manifest signature does not "
                "match.");
            return std::nullopt;
        }
    }
    else if (kind == "exempt" && !source.empty())
    {
        // The bundle itself was downloaded unverified (dev server, unkeyed or unsigned), so its
        // manifest is read the same way.
        manifestText = fetch(source + kBundleManifestName);
    }

    std::optional<BundleManifest> manifest =
        manifestText ? parseBundleManifest(*manifestText) : std::nullopt;
    std::optional<std::string> file =
        manifest ? manifest->devtoolsFile(bytecodeVersion) : std::nullopt;
    if (!file || source.empty())
    {
        log(LogLevel::Warning, LOG_CATEGORY_UPDATER,
            "React DevTools is on, but the active bundle's build lists no DevTools backend.");
        return std::nullopt;
    }

    std::string expected = manifest->sha512.at(*file);
    std::string cached   = joinPath(documents_, *file);
    if (std::optional<std::string> script = readTextFile(cached);
        script && sha512Hex(*script) == expected)
    {
        return script;
    }

    // Blocks the launch on the first run after the backend changes; it runs before Discord's
    // bundle.
    std::string                   url     = source + *file;
    std::string                   partial = cached + ".download";
    std::optional<DownloadResult> response =
        download_ ? download_(url, partial, {}, kBundleDownloadPolicy) : std::nullopt;
    std::optional<std::string> script =
        response && response->status == 200 ? readTextFile(partial) : std::nullopt;
    removeFile(partial);

    if (!script || sha512Hex(*script) != expected)
    {
        log(LogLevel::Error, LOG_CATEGORY_UPDATER,
            "Failed to download the DevTools backend " + url +
                (script ? ": its SHA-512 does not match the manifest." : "."));
        return std::nullopt;
    }

    if (!writeTextFileAtomically(cached, *script))
    {
        log(LogLevel::Warning, LOG_CATEGORY_UPDATER,
            "Failed to cache the DevTools backend " + cached + "; it downloads again next launch.");
    }
    log(LogLevel::Info, LOG_CATEGORY_UPDATER, "Downloaded the DevTools backend " + *file + ".");
    return script;
}
}
