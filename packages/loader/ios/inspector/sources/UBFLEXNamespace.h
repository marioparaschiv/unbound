// Prefixed into every file (`-include`). Renames the vendored FLEX classes so they never collide
// with a FLEX tweak loaded into the same Discord process: the ObjC runtime registers classes by
// name, whatever the symbol visibility.
#pragma once

#define FLEXIvar                      UBFLEXIvar
#define FLEXMethod                    UBFLEXMethod
#define FLEXMethodBase                UBFLEXMethodBase
#define FLEXMethodDescription         UBFLEXMethodDescription
#define FLEXMirror                    UBFLEXMirror
#define FLEXMutablePropertyAttributes UBFLEXMutablePropertyAttributes
#define FLEXObjectRef                 UBFLEXObjectRef
#define FLEXProperty                  UBFLEXProperty
#define FLEXPropertyAttributes        UBFLEXPropertyAttributes
#define FLEXProtocol                  UBFLEXProtocol
#define FLEXRuntimeUtility            UBFLEXRuntimeUtility
#define FLEXTypeEncodingParser        UBFLEXTypeEncodingParser
