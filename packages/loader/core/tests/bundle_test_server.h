#pragma once

#include <array>
#include <cassert>
#include <cstdint>
#include <filesystem>
#include <map>
#include <monocypher/monocypher-ed25519.h>
#include <optional>
#include <stdexcept>
#include <string>
#include <unistd.h>

#include "LoaderBundleSignature.h"
#include "LoaderFiles.h"
#include "LoaderUpdater.h"

namespace bundle_test {
inline std::string encodeBase64(const std::string &data)
{
    static constexpr char kAlphabet[] =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    std::string encoded;
    size_t      index = 0;
    while (index + 2 < data.size())
    {
        uint32_t chunk = (static_cast<uint8_t>(data[index]) << 16) |
                         (static_cast<uint8_t>(data[index + 1]) << 8) |
                         static_cast<uint8_t>(data[index + 2]);
        encoded += {kAlphabet[chunk >> 18], kAlphabet[(chunk >> 12) & 63],
                    kAlphabet[(chunk >> 6) & 63], kAlphabet[chunk & 63]};
        index += 3;
    }
    if (index + 1 == data.size())
    {
        uint32_t chunk = static_cast<uint8_t>(data[index]) << 16;
        encoded += {kAlphabet[chunk >> 18], kAlphabet[(chunk >> 12) & 63], '=', '='};
    }
    else if (index + 2 == data.size())
    {
        uint32_t chunk = (static_cast<uint8_t>(data[index]) << 16) |
                         (static_cast<uint8_t>(data[index + 1]) << 8);
        encoded += {kAlphabet[chunk >> 18], kAlphabet[(chunk >> 12) & 63],
                    kAlphabet[(chunk >> 6) & 63], '='};
    }
    return encoded;
}

struct SigningKey {
    std::array<uint8_t, 64> secret{};
    std::string             publicKey;

    explicit SigningKey(uint8_t fill)
    {
        std::array<uint8_t, 32> seed{};
        seed.fill(fill);
        std::array<uint8_t, 32> raw{};
        crypto_ed25519_key_pair(secret.data(), raw.data(), seed.data());
        publicKey = encodeBase64(std::string(raw.begin(), raw.end()));
    }

    std::string sign(const std::string &message, uint32_t pullRequest = 0) const
    {
        std::string signed_ =
            pullRequest ? loader::pullRequestSigningContext(pullRequest) + message : message;
        std::array<uint8_t, 64> signature{};
        crypto_ed25519_sign(signature.data(), secret.data(),
                            reinterpret_cast<const uint8_t *>(signed_.data()), signed_.size());
        return encodeBase64(std::string(signature.begin(), signature.end()));
    }
};

inline const SigningKey &productionKey()
{
    static const SigningKey key(1);
    return key;
}

inline const SigningKey &pullRequestKey()
{
    static const SigningKey key(2);
    return key;
}

inline const SigningKey &foreignKey()
{
    static const SigningKey key(3);
    return key;
}

inline loader::BundleTrust productionTrust()
{
    return loader::BundleTrust{productionKey().publicKey, "", 0};
}

inline loader::BundleTrust pullRequestTrust(uint32_t number)
{
    return loader::BundleTrust{productionKey().publicKey, pullRequestKey().publicKey, number};
}

struct Signer {
    const SigningKey *key         = &productionKey();
    uint32_t          pullRequest = 0;
};

inline std::string manifestText(const std::string                        &buildTime,
                                const std::map<std::string, std::string> &bundles,
                                const std::string                        &channel  = "beta",
                                const std::string                        &revision = "abc1234")
{
    std::string hashes;
    for (const auto &[file, contents] : bundles)
    {
        hashes += (hashes.empty() ? "" : ",") + std::string("\"") + file + "\":\"" +
                  loader::sha512Hex(contents) + "\"";
    }
    return "{\n  \"revision\": \"" + revision + "\",\n  \"channel\": \"" + channel +
           "\",\n  \"buildTime\": \"" + buildTime +
           "\",\n  \"bytecodeVersions\": [98],\n  \"sha512\": {" + hashes + "}\n}";
}

inline std::filesystem::path makeTemporaryDirectory()
{
    std::string templatePath =
        (std::filesystem::temp_directory_path() / "loader-bundle-trust-XXXXXX").string();
    char *directory = mkdtemp(templatePath.data());
    assert(directory);
    return std::filesystem::path(directory);
}

struct Server {
    std::filesystem::path              root = makeTemporaryDirectory();
    loader::SettingsStore              settings{(root / "settings.json").string()};
    std::map<std::string, std::string> files;
    std::map<std::string, std::string> lastHeaders;
    std::string                        lastDownload;
    int                                downloads = 0;

    Server()
    {
        settings.load();
    }

    ~Server()
    {
        std::filesystem::remove_all(root);
    }

    void publish(const std::string &base, const std::string &buildTime,
                 const std::map<std::string, std::string> &bundles, Signer signer = {},
                 const std::string &channel = "beta", const std::string &revision = "abc1234")
    {
        std::string manifest              = manifestText(buildTime, bundles, channel, revision);
        files[base + "manifest.json"]     = manifest;
        files[base + "manifest.json.sig"] = signer.key->sign(manifest, signer.pullRequest) + "\n";
        for (const auto &[file, contents] : bundles)
        {
            files[base + file]          = contents;
            files[base + file + ".sig"] = signer.key->sign(contents, signer.pullRequest) + "\n";
        }
    }

    loader::BundleUpdater updater(const loader::BundleTrust &trust)
    {
        return loader::BundleUpdater(
            root.string(), loader::updaterSettings(settings),
            [this](const std::string &url, double) -> std::optional<std::string> {
                auto file = files.find(url);
                return file == files.end() ? std::nullopt
                                           : std::optional<std::string>(file->second);
            },
            [this](const std::string &url, const std::string &destination,
                   const std::map<std::string, std::string> &headers,
                   const loader::DownloadPolicy &) -> std::optional<loader::DownloadResult> {
                lastHeaders  = headers;
                lastDownload = url;
                downloads++;
                auto file = files.find(url);
                if (file == files.end())
                {
                    return loader::DownloadResult{404, ""};
                }
                std::string etag  = "\"" + loader::sha512Hex(file->second).substr(0, 16) + "\"";
                auto        match = headers.find("If-None-Match");
                if (match != headers.end() && match->second == etag)
                {
                    return loader::DownloadResult{304, etag};
                }
                assert(loader::writeTextFileAtomically(destination, file->second));
                return loader::DownloadResult{200, etag};
            },
            trust);
    }

    std::string path(const std::string &name) const
    {
        return (root / name).string();
    }

    std::string candidate() const
    {
        return path("astral.bundle.candidate");
    }

    std::string active() const
    {
        return path("astral.bundle");
    }

    bool download(loader::BundleUpdater &updater, const std::optional<std::string> &base)
    {
        try
        {
            return updater.downloadBundle(updater.resolveBundlePath(), base, 98) == candidate();
        }
        catch (const std::runtime_error &)
        {
            return false;
        }
    }

    bool install(loader::BundleUpdater &updater, const std::optional<std::string> &base)
    {
        if (!download(updater, base))
        {
            return false;
        }
        std::string resolved = updater.resolveBundlePath();
        return resolved == candidate() && updater.markBundleAttempted(resolved) &&
               updater.acceptBundle(resolved);
    }

    std::string activeContents() const
    {
        return loader::readTextFile(active()).value_or("");
    }
};
}
