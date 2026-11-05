THEOS_PACKAGE_SCHEME=rootless
FINALPACKAGE=1

ARCHS := arm64
TARGET := iphone:clang:latest:15.0

include $(THEOS)/makefiles/common.mk

TOOL_NAME = unbound-bundle
unbound-bundle_FILES = $(wildcard sources/*.m)
unbound-bundle_CFLAGS = -fobjc-arc
unbound-bundle_FRAMEWORKS = Foundation MobileCoreServices
unbound-bundle_CODESIGN_FLAGS = -Sentitlements.plist
unbound-bundle_INSTALL_PATH = /usr/libexec

include $(THEOS_MAKE_PATH)/tool.mk
