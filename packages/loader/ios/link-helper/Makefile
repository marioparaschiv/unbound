THEOS_PACKAGE_SCHEME=rootless
FINALPACKAGE=1

ARCHS := arm64 arm64e
TARGET := iphone:clang:latest:15.0

include $(THEOS)/makefiles/common.mk

# A hidden app that claims unbound:// on jailbroken devices, where Discord keeps its App Store
# signature and Info.plist, and reopens each link under Discord's own scheme.
APPLICATION_NAME = UnboundLink
UnboundLink_FILES = $(wildcard sources/*.m)
UnboundLink_CFLAGS = -fobjc-arc
UnboundLink_FRAMEWORKS = UIKit Foundation

include $(THEOS_MAKE_PATH)/application.mk
