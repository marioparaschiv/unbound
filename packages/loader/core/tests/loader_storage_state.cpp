#include <cassert>
#include <filesystem>
#include <string>

#include "LoaderFiles.h"
#include "NativePlatformBridge.h"

int main()
{
    std::filesystem::path root =
        std::filesystem::temp_directory_path() / "unbound-storage-state-test";
    std::filesystem::remove_all(root);
    std::filesystem::create_directories(root / "Unbound" / "Fonts");
    assert(loader::writeTextFileAtomically((root / "Unbound" / "Fonts" / "a.ttf").string(),
                                           std::string(3 * 1024 * 1024, 'x')));

    nlohmann::json state = loader::storageState(root.string());
    assert(state["unboundMB"] == 3);
    assert(state["freeMB"].is_number_unsigned() && state["freeMB"].get<uint64_t>() > 0);
    assert(loader::storageState("").empty());

    std::filesystem::remove_all(root);
    return 0;
}
