THEOS_PACKAGE_SCHEME=rootless
FINALPACKAGE=1

ARCHS := arm64
TARGET := iphone:clang:latest:15.0

include $(THEOS)/makefiles/common.mk

# The Objective-C object explorer behind `native.objc.inspect`. Unbound.dylib dlopens it only when developer
# mode or the debugger is on. Installed without the `.dylib` extension and without a filter plist so neither
# ElleKit nor cyan's `*.dylib` injection ever loads it into Discord at launch.
LIBRARY_NAME = UnboundInspector
UnboundInspector_INSTALL_PATH = /Library/Application Support/Unbound
UnboundInspector_LIBRARY_EXTENSION = -
# FLEX's reflection subset, vendored as upstream wrote it apart from `// Unbound:` edits.
FLEX_FILES := $(shell find vendor/FLEX/Classes -name "*.m" -o -name "*.mm")
$(foreach file,$(FLEX_FILES),$(eval $(file)_CFLAGS = -Wno-deprecated-declarations))

UnboundInspector_FILES = $(wildcard sources/*.m) $(FLEX_FILES)
UnboundInspector_CFLAGS = -fobjc-arc -fvisibility=hidden -include sources/UBFLEXNamespace.h -Iinclude $(addprefix -I,$(shell find vendor/FLEX/Classes -type d))
UnboundInspector_FRAMEWORKS = Foundation

include $(THEOS_MAKE_PATH)/library.mk
