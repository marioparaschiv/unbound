#include <cassert>
#include <filesystem>
#include <string>

#include "LoaderFiles.h"
#include "NativePlatformBridge.h"

static void writeMegabytes(const std::filesystem::path &file, size_t megabytes)
{
    std::filesystem::create_directories(file.parent_path());
    assert(
        loader::writeTextFileAtomically(file.string(), std::string(megabytes * 1024 * 1024, 'x')));
}

int main()
{
    std::filesystem::path appData =
        std::filesystem::temp_directory_path() / "unbound-storage-state-test";
    std::filesystem::path documents = appData / "Documents" / "Unbound";
    std::filesystem::remove_all(appData);
    writeMegabytes(documents / "Fonts" / "a.ttf", 3);
    writeMegabytes(appData / "Library" / "Caches" / "images.db", 2);
    writeMegabytes(appData / "tmp" / "upload.bin", 1);

    nlohmann::json state = loader::storageState(documents.string());
    assert(state["unboundMB"] == 3);
    assert(state["discordMB"] == 6);
    assert(state["cacheMB"] == 3);
    assert(state["freeMB"].is_number_unsigned() && state["freeMB"].get<uint64_t>() > 0);
    assert(loader::storageState("").empty());

    std::filesystem::remove_all(appData);
    return 0;
}
