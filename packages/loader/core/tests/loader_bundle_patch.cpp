#include <cassert>
#include <fstream>
#include <iterator>
#include <string>

#include "LoaderBundlePatch.h"

static std::string readVector(const char *name)
{
    std::ifstream file(std::string(UNBOUND_CORE_TEST_VECTORS_DIR "/bundle-patch/") + name,
                       std::ios::binary);
    return {std::istreambuf_iterator<char>(file), std::istreambuf_iterator<char>()};
}

static std::string baseBundle()
{
    std::string text;
    for (int index = 0; index < 3000; index++)
    {
        text += "const value" + std::to_string(index) + " = " + std::to_string(index * 7) + ";\n";
    }
    return text;
}

static std::string targetBundle()
{
    std::string       text = baseBundle();
    const std::string from = "value1500 = 10500";
    text.replace(text.find(from), from.size(), "value1500 = 42");
    return text + "globalThis.patched = true;\n";
}

static void rebuildsTheTargetFromItsBase()
{
    std::string patch = readVector("target.js.br");
    assert(!patch.empty());
    assert(loader::applyBundlePatch(baseBundle(), patch) == targetBundle());
}

static void refusesAWrongBaseOrADamagedPatch()
{
    std::string                patch     = readVector("target.js.br");
    std::optional<std::string> wrongBase = loader::applyBundlePatch("other bundle", patch);
    assert(!wrongBase || *wrongBase != targetBundle());
    assert(!loader::applyBundlePatch(baseBundle(), patch.substr(0, patch.size() / 2)));
    assert(!loader::applyBundlePatch(baseBundle(), "not brotli at all"));
}

static void namesPatchesByTheirBase()
{
    const std::string base(128, 'a');
    assert(loader::bundlePatchPath("unbound.98.bundle", base) ==
           "patches/unbound.98.bundle/" + std::string(32, 'a') + ".br");
    assert(loader::patchBaseFor({base}, base) == base);
    assert(!loader::patchBaseFor({base}, std::string(128, 'b')));
}

int main()
{
    rebuildsTheTargetFromItsBase();
    refusesAWrongBaseOrADamagedPatch();
    namesPatchesByTheirBase();
    return 0;
}
