THEOS_PACKAGE_SCHEME=rootless
FINALPACKAGE=1

ARCHS := arm64
TARGET := iphone:clang:latest:15.0

include $(THEOS)/makefiles/common.mk

TOOL_NAME = unbound-icons
unbound-icons_FILES = $(wildcard sources/*.m)
unbound-icons_CFLAGS = -fobjc-arc
unbound-icons_FRAMEWORKS = Foundation MobileCoreServices
unbound-icons_CODESIGN_FLAGS = -Sentitlements.plist
unbound-icons_INSTALL_PATH = /usr/libexec

include $(THEOS_MAKE_PATH)/tool.mk
