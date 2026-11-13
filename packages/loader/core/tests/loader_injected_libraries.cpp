#include <cassert>
#include <string>
#include <vector>

#include "LoaderInjectedLibraries.h"

void iosListsTweaksAndInjectedDylibs()
{
    const std::vector<std::string> images = {
        "/System/Library/Frameworks/UIKit.framework/UIKit",
        "/usr/lib/libobjc.A.dylib",
        "/private/preboot/Cryptexes/OS/usr/lib/libswiftCore.dylib",
        "/var/containers/Bundle/Application/X/Discord.app/Discord",
        "/var/containers/Bundle/Application/X/Discord.app/Frameworks/hermes.framework/hermes",
        "/var/containers/Bundle/Application/X/Discord.app/Frameworks/Unbound.dylib",
        "/var/containers/Bundle/Application/X/Discord.app/Frameworks/CydiaSubstrate.framework/"
        "CydiaSubstrate",
        "/var/containers/Bundle/Application/X/Discord.app/Frameworks/Enmity.dylib",
        "/var/containers/Bundle/Application/X/Discord.app/Frameworks/libswiftUIKit.dylib",
        "/private/preboot/ABC/jb-XYZ/procursus/usr/lib/TweakInject/Unbound.dylib",
        "/private/preboot/ABC/jb-XYZ/procursus/usr/lib/TweakInject/Cephei.dylib",
        "/private/preboot/ABC/jb-XYZ/procursus/usr/lib/TweakInject/FLEXing.dylib",
        "/private/preboot/ABC/jb-XYZ/procursus/usr/lib/libellekit.dylib",
        "/private/preboot/ABC/jb-XYZ/procursus/usr/lib/libcolorpicker.dylib",
        "/Library/MobileSubstrate/DynamicLibraries/Shadow.dylib",
        "/Library/MobileSubstrate/DynamicLibraries/FLEXing.dylib",
    };
    assert((loader::injectedIOSLibraries(images) ==
            std::vector<std::string>{"Cephei", "Enmity", "FLEXing", "Shadow"}));
}

void androidListsOtherModulesOnce()
{
    const std::string maps =
        "7000-7100 r--p 00000000 fd:05 1 /system/lib64/libc.so\n"
        "7100-7200 r--p 00000000 fd:05 2 "
        "/data/app/~~aa==/com.discord-bb==/base.apk\n"
        "7200-7300 r--p 00000000 fd:05 3 "
        "/data/app/~~cc==/com.discord-bb==/lib/arm64/libunbound.so\n"
        "7300-7400 r--p 00000000 fd:05 4 /data/app/~~dd==/app.unbound.android-ee==/base.apk\n"
        "7400-7500 r--p 00000000 fd:05 5 /data/app/~~ff==/com.example.hide-gg==/base.apk\n"
        "7500-7600 r--p 00000000 fd:05 6 /data/app/~~ff==/com.example.hide-gg==/base.apk\n"
        "7600-7700 r--p 00000000 fd:05 7 "
        "/data/app/~~hh==/com.google.android.trichromelibrary_6.0-ii==/base.apk\n"
        "7700-7800 r--p 00000000 fd:05 8 /data/adb/modules/zygisk_shamiko/zygisk/arm64-v8a.so\n"
        "7800-7900 r--p 00000000 fd:05 9 /data/app/com.legacy.module-1/base.apk\n"
        "7900-7a00 rw-p 00000000 00:00 0 [anon:dalvik-main space]\n";
    assert((loader::injectedAndroidModules(maps, "com.discord") ==
            std::vector<std::string>{"com.example.hide", "com.legacy.module", "zygisk_shamiko"}));
}

int main()
{
    iosListsTweaksAndInjectedDylibs();
    androidListsOtherModulesOnce();
    return 0;
}
