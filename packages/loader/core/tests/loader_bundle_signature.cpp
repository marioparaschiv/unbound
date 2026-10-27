#include <cassert>
#include <filesystem>
#include <string>
#include <unistd.h>

#include "LoaderBundleSignature.h"
#include "LoaderFiles.h"
#include "LoaderUpdater.h"

static const std::string kPublicKey = "PUAXw+hDiVqStwqnTRt+vJyYLM8uxJaMwM1V8Sr0Zgw=";
static const std::string kSignature =
    "kqAJqfDUyrhyDoILX2QlQKKye1QWUD+Ps3YiI+vbadoIWsHkPhWZbkWPNhPQ8R2MOHsurrQwKu6wDSkWErsMAA==";
static const std::string kMessage = "r";

static std::filesystem::path makeTemporaryDirectory()
{
    std::string templatePath =
        (std::filesystem::temp_directory_path() / "loader-bundle-signature-XXXXXX").string();
    char *directory = mkdtemp(templatePath.data());
    assert(directory);
    return std::filesystem::path(directory);
}

static void decodesBase64()
{
    assert(loader::decodeBase64("cg==") == std::string("r"));
    assert(loader::decodeBase64("Zm9vYmFy\n") == std::string("foobar"));
    assert(loader::decodeBase64(kPublicKey)->size() == 32);
    assert(loader::decodeBase64(kSignature)->size() == 64);
    assert(!loader::decodeBase64(""));
    assert(!loader::decodeBase64("cg="));
    assert(!loader::decodeBase64("c=g="));
    assert(!loader::decodeBase64("ch=="));
    assert(!loader::decodeBase64("Zm9v!mFy"));
}

static void verifiesSignatures()
{
    assert(loader::verifyBundleSignature(kMessage, kSignature, kPublicKey));
    assert(loader::verifyBundleSignature(kMessage, kSignature + "\n", kPublicKey));
    assert(!loader::verifyBundleSignature("s", kSignature, kPublicKey));
    assert(!loader::verifyBundleSignature(kMessage, kSignature,
                                          "PUAXw+hDiVqStwqnTRt+vJyYLM8uxJaMwM1V8Sr0Zgs="));
    std::string flipped = kSignature;
    flipped[10]         = flipped[10] == 'A' ? 'B' : 'A';
    assert(!loader::verifyBundleSignature(kMessage, flipped, kPublicKey));
    assert(!loader::verifyBundleSignature(kMessage, "cg==", kPublicKey));
    assert(!loader::verifyBundleSignature(kMessage, kSignature, ""));
}

static void recognisesDevelopmentServers()
{
    assert(loader::isDevelopmentBundleURL("http://10.0.2.2:3000/unbound.98.bundle"));
    assert(loader::isDevelopmentBundleURL("http://127.0.0.1:3000/unbound.js"));
    assert(loader::isDevelopmentBundleURL("http://localhost:3000/"));
    assert(loader::isDevelopmentBundleURL("HTTP://192.168.1.20:3000/unbound.bundle"));
    assert(loader::isDevelopmentBundleURL("http://172.20.0.4/unbound.bundle"));
    assert(loader::isDevelopmentBundleURL("http://mac.local:3000/unbound.bundle"));
    assert(loader::isDevelopmentBundleURL("http://[::1]:3000/unbound.bundle"));
    assert(loader::isDevelopmentBundleURL("http://user@10.0.2.2:3000/unbound.bundle"));
    assert(!loader::isDevelopmentBundleURL("https://127.0.0.1:3000/unbound.bundle"));
    assert(!loader::isDevelopmentBundleURL("https://builds.unbound.rip/unbound.98.bundle"));
    assert(!loader::isDevelopmentBundleURL("http://builds.unbound.rip/unbound.98.bundle"));
    assert(!loader::isDevelopmentBundleURL("http://172.32.0.1/unbound.bundle"));
    assert(!loader::isDevelopmentBundleURL("http://10.0.2.2.example.com/unbound.bundle"));
    assert(!loader::isDevelopmentBundleURL("http://localhost.example.com/unbound.bundle"));
    assert(!loader::isDevelopmentBundleURL("http://evil.com@/unbound.bundle"));
    assert(!loader::isDevelopmentBundleURL("file:///tmp/unbound.bundle"));
}

struct UpdaterHarness {
    std::filesystem::path root = makeTemporaryDirectory();
    loader::SettingsStore settings{(root / "settings.json").string()};
    std::string           served    = kMessage;
    std::string           signature = kSignature;
    bool                  signed_   = true;
    std::string           requestedSignature;

    loader::BundleUpdater updater(const std::string &key)
    {
        settings.load();
        return loader::BundleUpdater(
            root.string(), loader::updaterSettings(settings),
            [this](const std::string &url, double) -> std::optional<std::string> {
                if (url.size() > 4 && url.compare(url.size() - 4, 4, ".sig") == 0)
                {
                    requestedSignature = url;
                    return signed_ ? std::optional<std::string>(signature + "\n") : std::nullopt;
                }
                if (url.find("manifest.json") != std::string::npos)
                {
                    return std::string(R"({"bytecodeVersions":[98]})");
                }
                return std::nullopt;
            },
            [this](const std::string &, const std::string &destination,
                   const std::map<std::string, std::string> &,
                   const loader::DownloadPolicy &) -> std::optional<loader::DownloadResult> {
                assert(loader::writeTextFileAtomically(destination, served));
                return loader::DownloadResult{200, "\"etag\""};
            },
            key);
    }

    std::string candidatePath() const
    {
        return (root / "unbound.bundle.candidate").string();
    }

    bool downloadFrom(loader::BundleUpdater &updater, const std::optional<std::string> &base)
    {
        try
        {
            return updater.downloadBundle(updater.resolveBundlePath(), base, 98) == candidatePath();
        }
        catch (const std::runtime_error &)
        {
            return false;
        }
    }

    ~UpdaterHarness()
    {
        std::filesystem::remove_all(root);
    }
};

static void acceptsSignedBundles()
{
    UpdaterHarness        harness;
    loader::BundleUpdater updater = harness.updater(kPublicKey);
    assert(harness.downloadFrom(updater, std::nullopt));
    assert(harness.requestedSignature == "https://builds.unbound.rip/unbound.98.bundle.sig");
    assert(loader::fileExists(harness.candidatePath() + ".etag"));
}

static void verifiesAnyHttpsBase()
{
    UpdaterHarness        harness;
    loader::BundleUpdater updater = harness.updater(kPublicKey);
    assert(harness.downloadFrom(updater, std::string("https://cdn.example.com/unbound/pr/42/")));
    assert(harness.requestedSignature ==
           "https://cdn.example.com/unbound/pr/42/unbound.98.bundle.sig");

    harness.signature[3] = harness.signature[3] == 'A' ? 'B' : 'A';
    std::filesystem::remove(harness.candidatePath());
    std::filesystem::remove(harness.candidatePath() + ".etag");
    assert(!harness.downloadFrom(updater, std::string("https://cdn.example.com/unbound/pr/42/")));
}

static void rejectsTamperedBundlesAndKeepsTheCurrentOne()
{
    UpdaterHarness harness;
    std::string    current = (harness.root / "unbound.bundle").string();
    assert(loader::writeTextFileAtomically(current, "current"));

    loader::BundleUpdater updater = harness.updater(kPublicKey);
    harness.served                = "tampered";
    assert(!harness.downloadFrom(updater, std::nullopt));
    assert(!loader::fileExists(harness.candidatePath()));
    assert(!loader::fileExists(harness.candidatePath() + ".etag"));
    assert(updater.resolveBundlePath() == current);
    assert(loader::readTextFile(current) == std::string("current"));
}

static void rejectsUnsignedBundles()
{
    UpdaterHarness        harness;
    loader::BundleUpdater updater = harness.updater(kPublicKey);
    harness.signed_               = false;
    assert(!harness.downloadFrom(updater, std::nullopt));
    assert(!loader::fileExists(harness.candidatePath()));
    assert(!harness.downloadFrom(updater, std::string("http://cdn.example.com/")));
}

static void skipsDevelopmentServers()
{
    UpdaterHarness        harness;
    loader::BundleUpdater updater = harness.updater(kPublicKey);
    harness.signed_               = false;
    harness.served                = "dev bundle";
    assert(harness.downloadFrom(updater, std::string("http://10.0.2.2:3000/")));
    assert(harness.requestedSignature.empty());
}

static void skipsWhenExplicitlyAllowed()
{
    UpdaterHarness        harness;
    loader::BundleUpdater updater = harness.updater(kPublicKey);
    harness.settings.set("unbound", "loader.update.unsigned", true);
    harness.signed_ = false;
    harness.served  = "unsigned";
    assert(harness.downloadFrom(updater, std::nullopt));
    assert(harness.requestedSignature.empty());
}

static void skipsWithoutAKey()
{
    UpdaterHarness        harness;
    loader::BundleUpdater updater = harness.updater("");
    harness.signed_               = false;
    harness.served                = "unsigned";
    assert(harness.downloadFrom(updater, std::nullopt));
    assert(harness.requestedSignature.empty());
}

int main()
{
    decodesBase64();
    verifiesSignatures();
    recognisesDevelopmentServers();
    acceptsSignedBundles();
    verifiesAnyHttpsBase();
    rejectsTamperedBundlesAndKeepsTheCurrentOne();
    rejectsUnsignedBundles();
    skipsDevelopmentServers();
    skipsWhenExplicitlyAllowed();
    skipsWithoutAKey();
    return 0;
}
