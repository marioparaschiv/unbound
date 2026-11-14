#import <CoreFoundation/CoreFoundation.h>

// A sideloaded IPA's Info.plist names the loader in its short version (353.0_1.5.0) so AltStore,
// SideStore and Feather show loader updates, and keeps Discord's own under UnboundDiscordVersion.
// Discord keys its OTA bundle and the client_version it reports on the short version, so this puts
// Discord's back in the bundle's cached Info.plist, which NSBundle and CFBundle both read, before
// Discord's code runs. Tweak installs lack the key.
__attribute__((constructor(101))) static void restoreDiscordVersion(void)
{
    CFBundleRef bundle = CFBundleGetMainBundle();
    if (!bundle)
    {
        return;
    }

    CFMutableDictionaryRef info = (CFMutableDictionaryRef) CFBundleGetInfoDictionary(bundle);
    if (!info)
    {
        return;
    }

    CFTypeRef discord = CFDictionaryGetValue(info, CFSTR("UnboundDiscordVersion"));
    if (!discord || CFGetTypeID(discord) != CFStringGetTypeID())
    {
        return;
    }

    CFDictionarySetValue(info, CFSTR("CFBundleShortVersionString"), discord);
}
