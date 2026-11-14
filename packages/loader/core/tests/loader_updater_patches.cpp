#include <cassert>
#include <fstream>
#include <iterator>
#include <string>

#include "LoaderBundlePatch.h"
#include "LoaderFiles.h"
#include "bundle_test_server.h"

namespace {
const std::string kBase   = "https://builds.unbound.rip/";
const std::string kBundle = "unbound.98.bundle";

std::string readVector(const char *name)
{
    std::ifstream file(std::string(UNBOUND_CORE_TEST_VECTORS_DIR "/bundle-patch/") + name,
                       std::ios::binary);
    return {std::istreambuf_iterator<char>(file), std::istreambuf_iterator<char>()};
}

std::string baseBundle()
{
    std::string text;
    for (int index = 0; index < 3000; index++)
    {
        text += "const value" + std::to_string(index) + " = " + std::to_string(index * 7) + ";\n";
    }
    return text;
}

std::string targetBundle()
{
    std::string       text = baseBundle();
    const std::string from = "value1500 = 10500";
    text.replace(text.find(from), from.size(), "value1500 = 42");
    return text + "globalThis.patched = true;\n";
}

void publishWithPatch(bundle_test::Server &server, const std::string &patch)
{
    std::string base     = loader::sha512Hex(baseBundle());
    std::string manifest = "{\n  \"revision\": \"def5678\",\n  \"channel\": \"beta\",\n"
                           "  \"buildTime\": \"2026-11-14T00:00:00.000Z\",\n"
                           "  \"bytecodeVersions\": [98],\n  \"sha512\": {\"" +
                           kBundle + "\":\"" + loader::sha512Hex(targetBundle()) +
                           "\"},\n  \"patches\": {\"" + kBundle + "\":[\"" + base + "\"]}\n}";
    server.files[kBase + "manifest.json"]     = manifest;
    server.files[kBase + "manifest.json.sig"] = bundle_test::productionKey().sign(manifest) + "\n";
    server.files[kBase + kBundle]             = targetBundle();
    server.files[kBase + loader::bundlePatchPath(kBundle, base)] = patch;
}

void patchesTheActiveBundleInsteadOfDownloadingIt()
{
    bundle_test::Server   server;
    loader::BundleUpdater updater = server.updater(bundle_test::productionTrust());
    server.publish(kBase, "2026-11-13T00:00:00.000Z", {{kBundle, baseBundle()}});
    assert(server.install(updater, std::nullopt));

    publishWithPatch(server, readVector("target.js.br"));
    int before = server.downloads;
    assert(server.install(updater, std::nullopt));

    assert(server.activeContents() == targetBundle());
    assert(server.downloads == before + 1);
    assert(server.lastDownload.find("/patches/") != std::string::npos);
    assert(!updater.integrityProblem(server.active()));
}

void downloadsTheWholeBundleWhenThePatchFails()
{
    bundle_test::Server   server;
    loader::BundleUpdater updater = server.updater(bundle_test::productionTrust());
    server.publish(kBase, "2026-11-13T00:00:00.000Z", {{kBundle, baseBundle()}});
    assert(server.install(updater, std::nullopt));

    publishWithPatch(server, "damaged");
    assert(server.install(updater, std::nullopt));

    assert(server.activeContents() == targetBundle());
    assert(server.lastDownload == kBase + kBundle);
    assert(!loader::fileExists(server.candidate() + ".patch"));
}
}

int main()
{
    patchesTheActiveBundleInsteadOfDownloadingIt();
    downloadsTheWholeBundleWhenThePatchFails();
    return 0;
}
