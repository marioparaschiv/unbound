THEOS_PACKAGE_SCHEME=rootless
FINALPACKAGE=1

ARCHS := arm64 arm64e
TARGET := iphone:clang:latest:15.0

include $(THEOS)/makefiles/common.mk

# A hidden app that claims astral:// on jailbroken devices, where Discord keeps its App Store
# signature and Info.plist, and reopens each link under Discord's own scheme.
APPLICATION_NAME = AstralLink
AstralLink_FILES = $(wildcard sources/*.m)
AstralLink_CFLAGS = -fobjc-arc
AstralLink_FRAMEWORKS = UIKit Foundation

include $(THEOS_MAKE_PATH)/application.mk
