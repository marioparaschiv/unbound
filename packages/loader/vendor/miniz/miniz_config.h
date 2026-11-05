/* Unbound's miniz build: in-memory zip reading only. Included before miniz.h by the wrapper source and every user. */
#pragma once

#define MINIZ_NO_STDIO
#define MINIZ_NO_TIME
#define MINIZ_NO_DEFLATE_APIS
#define MINIZ_NO_ARCHIVE_WRITING_APIS
#define MINIZ_NO_ZLIB_COMPATIBLE_NAMES

#include "miniz.h"
