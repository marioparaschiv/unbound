#pragma once

#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

bool promoteNativeBundle(const char *candidatePath, const char *targetPath, const char *backupPath);
bool restoreNativeBundle(const char *backupPath, const char *targetPath);

#ifdef __cplusplus
}
#endif
