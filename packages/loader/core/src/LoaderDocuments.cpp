#include "LoaderDocuments.h"

#include <filesystem>

#include "LoaderPreferences.h"

namespace loader {
std::string documentsDirectory(const std::string &parent)
{
    return (std::filesystem::path(parent) / preferences::kDocumentsName).string();
}
}
