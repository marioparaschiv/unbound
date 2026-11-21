#include <cassert>
#include <ctime>
#include <filesystem>
#include <string>
#include <unistd.h>

#include "LoaderAddonFolders.h"
#include "LoaderFiles.h"

namespace fs = std::filesystem;

static fs::path makeRoot()
{
    std::string templ = (fs::temp_directory_path() / "loader-addon-folders-XXXXXX").string();
    assert(mkdtemp(templ.data()));
    return templ;
}

static void write(const fs::path &path, const std::string &text)
{
    assert(loader::writeTextFileAtomically(path.string(), text));
}

static void replacesTheOldCopyWithTheStagedOne()
{
    const fs::path root = makeRoot();
    write(root / "Plugins" / "a" / "manifest.json", "old");
    write(root / "Plugins" / "a" / "stale.png", "x");
    write(root / "Staging" / "Plugins" / "a" / "manifest.json", "new");

    assert(loader::replaceAddonFolder(root.string(), "Staging/Plugins/a", "Plugins/a"));
    assert(*loader::readTextFile((root / "Plugins" / "a" / "manifest.json").string()) == "new");
    assert(!fs::exists(root / "Plugins" / "a" / "stale.png"));
    assert(!fs::exists(root / "Staging" / "Plugins" / "a"));
    assert(!fs::exists(root / "Plugins" / "a.replaced"));

    write(root / "Staging" / "Plugins" / "b" / "manifest.json", "first");
    assert(loader::replaceAddonFolder(root.string(), "Staging/Plugins/b", "Plugins/b"));
    assert(fs::exists(root / "Plugins" / "b" / "manifest.json"));

    assert(!loader::replaceAddonFolder(root.string(), "Staging/Plugins/missing", "Plugins/a"));
    assert(!loader::replaceAddonFolder(root.string(), "../outside", "Plugins/a"));
    assert(fs::exists(root / "Plugins" / "a" / "manifest.json"));
    fs::remove_all(root);
}

static void removesOnlyStaleLeftovers()
{
    const fs::path root = makeRoot();
    write(root / "Plugins" / "kept" / "manifest.json", "{}");
    write(root / "Plugins" / "broken" / "index.js", "x");
    write(root / "Plugins" / "old.replaced" / "manifest.json", "{}");
    write(root / "Staging" / "Plugins" / "half" / "index.js", "x");
    write(root / "Themes" / "empty" / "readme", "x");
    const int64_t now = static_cast<int64_t>(std::time(nullptr));

    assert(loader::removeOrphanedAddonFolders(root.string(), now, 3600) == 0);
    assert(loader::removeOrphanedAddonFolders(root.string(), now + 7200, 3600) == 4);
    assert(fs::exists(root / "Plugins" / "kept"));
    assert(!fs::exists(root / "Plugins" / "broken"));
    assert(!fs::exists(root / "Plugins" / "old.replaced"));
    assert(!fs::exists(root / "Staging" / "Plugins" / "half"));
    assert(!fs::exists(root / "Themes" / "empty"));
    fs::remove_all(root);
}

int main()
{
    replacesTheOldCopyWithTheStagedOne();
    removesOnlyStaleLeftovers();
    return 0;
}
