#pragma once

// The JNI surface between libunbound and app.unbound.android.NativeBridge, declared once. Each
// table drives what is otherwise written by hand: the `JavaCallbacks` fields, the
// `GetStaticMethodID` lookups that must all succeed for the library to load, and the
// `RegisterNatives` entries. NativeBridgeSurfaceTest reads these tables and checks every entry
// against NativeBridge's static methods, so a renamed method or changed signature fails a unit test
// instead of the library's load.

namespace unbound::android {
constexpr const char *kBridgeClass = "app/unbound/android/NativeBridge";

#define UNBOUND_JNI_STRING "Ljava/lang/String;"

// Kotlin methods C++ calls: X(field, Kotlin name, JNI signature).
#define UNBOUND_BRIDGE_CALLBACKS(X)                                                                \
    X(scheduleRuntime, "scheduleRuntimeWork", "(Z)V")                                              \
    X(scheduleMain, "scheduleMainWork", "()V")                                                     \
    X(scheduleMainFrame, "scheduleMainFrameWork", "()V")                                           \
    X(isMainThread, "isMainThread", "()Z")                                                         \
    X(isVerifiedBuild, "isVerifiedBuild", "()Z")                                                   \
    X(installer, "installer", "(" UNBOUND_JNI_STRING UNBOUND_JNI_STRING ")" UNBOUND_JNI_STRING)    \
    X(javaGetClass, "javaGetClass", "(" UNBOUND_JNI_STRING ")" UNBOUND_JNI_STRING)                 \
    X(javaClassName, "javaClassName", "(" UNBOUND_JNI_STRING ")" UNBOUND_JNI_STRING)               \
    X(javaDescribe, "javaDescribe", "(" UNBOUND_JNI_STRING ")" UNBOUND_JNI_STRING)                 \
    X(javaConstruct, "javaConstruct",                                                              \
      "(" UNBOUND_JNI_STRING UNBOUND_JNI_STRING ")" UNBOUND_JNI_STRING)                            \
    X(javaRespondsTo, "javaRespondsTo",                                                            \
      "(" UNBOUND_JNI_STRING UNBOUND_JNI_STRING UNBOUND_JNI_STRING ")" UNBOUND_JNI_STRING)         \
    X(javaInvoke, "javaInvoke",                                                                    \
      "(" UNBOUND_JNI_STRING UNBOUND_JNI_STRING UNBOUND_JNI_STRING ")" UNBOUND_JNI_STRING)         \
    X(javaPrepare, "javaPrepare",                                                                  \
      "(" UNBOUND_JNI_STRING UNBOUND_JNI_STRING UNBOUND_JNI_STRING ")" UNBOUND_JNI_STRING)         \
    X(javaInvokePrepared, "javaInvokePrepared",                                                    \
      "(" UNBOUND_JNI_STRING UNBOUND_JNI_STRING UNBOUND_JNI_STRING ")" UNBOUND_JNI_STRING)         \
    X(javaDisposePlan, "javaDisposePlan", "(" UNBOUND_JNI_STRING ")V")                             \
    X(javaGetField, "javaGetField",                                                                \
      "(" UNBOUND_JNI_STRING UNBOUND_JNI_STRING ")" UNBOUND_JNI_STRING)                            \
    X(javaSetField, "javaSetField",                                                                \
      "(" UNBOUND_JNI_STRING UNBOUND_JNI_STRING UNBOUND_JNI_STRING ")V")                           \
    X(javaRelease, "javaRelease", "(" UNBOUND_JNI_STRING ")V")                                     \
    X(javaLiveHandles, "javaLiveHandles", "()I")                                                   \
    X(hooksInstall, "hooksInstall",                                                                \
      "(" UNBOUND_JNI_STRING UNBOUND_JNI_STRING UNBOUND_JNI_STRING UNBOUND_JNI_STRING              \
      ")" UNBOUND_JNI_STRING)                                                                      \
    X(hooksRemove, "hooksRemove", "(" UNBOUND_JNI_STRING ")V")                                     \
    X(runtimeReplaced, "runtimeReplaced", "()V")                                                   \
    X(javaBatch, "javaBatch", "(" UNBOUND_JNI_STRING ")" UNBOUND_JNI_STRING)                       \
    X(javaFindViews, "javaFindViews",                                                              \
      "(" UNBOUND_JNI_STRING UNBOUND_JNI_STRING UNBOUND_JNI_STRING ")" UNBOUND_JNI_STRING)         \
    X(javaCreateAssociationKey, "javaCreateAssociationKey", "()" UNBOUND_JNI_STRING)               \
    X(javaGetAssociatedObject, "javaGetAssociatedObject",                                          \
      "(" UNBOUND_JNI_STRING UNBOUND_JNI_STRING ")" UNBOUND_JNI_STRING)                            \
    X(javaSetAssociatedObject, "javaSetAssociatedObject",                                          \
      "(" UNBOUND_JNI_STRING UNBOUND_JNI_STRING UNBOUND_JNI_STRING "I)V")                          \
    X(fabricMount, "fabricMount",                                                                  \
      "(" UNBOUND_JNI_STRING UNBOUND_JNI_STRING UNBOUND_JNI_STRING ")" UNBOUND_JNI_STRING)         \
    X(fabricUpdate, "fabricUpdate", "(" UNBOUND_JNI_STRING UNBOUND_JNI_STRING ")V")                \
    X(fabricUnmount, "fabricUnmount", "(" UNBOUND_JNI_STRING ")Z")                                 \
    X(fabricDetach, "fabricDetach", "(" UNBOUND_JNI_STRING ")Z")                                   \
    X(fabricAttach, "fabricAttach", "(" UNBOUND_JNI_STRING UNBOUND_JNI_STRING ")V")                \
    X(fabricSetSize, "fabricSetSize",                                                              \
      "(" UNBOUND_JNI_STRING UNBOUND_JNI_STRING UNBOUND_JNI_STRING ")V")                           \
    X(fabricSetFrame, "fabricSetFrame", "(" UNBOUND_JNI_STRING UNBOUND_JNI_STRING ")V")            \
    X(fabricMeasure, "fabricMeasure", "(" UNBOUND_JNI_STRING ")" UNBOUND_JNI_STRING)               \
    X(fetchText, "fetchText", "(" UNBOUND_JNI_STRING "I)" UNBOUND_JNI_STRING)                      \
    X(download, "download",                                                                        \
      "(" UNBOUND_JNI_STRING UNBOUND_JNI_STRING "[" UNBOUND_JNI_STRING "[" UNBOUND_JNI_STRING      \
      "III)[" UNBOUND_JNI_STRING)                                                                  \
    X(devServerHost, "devServerHost", "()" UNBOUND_JNI_STRING)                                     \
    X(isServing, "isServing", "(" UNBOUND_JNI_STRING "I)Z")                                        \
    X(installHomeScreenIcon, "installHomeScreenIcon",                                              \
      "(" UNBOUND_JNI_STRING UNBOUND_JNI_STRING ")Z")                                              \
    X(availableFonts, "availableFonts", "()[" UNBOUND_JNI_STRING)                                  \
    X(appFonts, "appFonts", "()[" UNBOUND_JNI_STRING)                                              \
    X(appFontBytes, "appFontBytes", "(" UNBOUND_JNI_STRING ")[B")                                  \
    X(alert, "alert", "(" UNBOUND_JNI_STRING ")V")                                                 \
    X(crashAlert, "crashAlert", "(" UNBOUND_JNI_STRING ")V")                                       \
    X(previousExit, "previousExit", "()I")                                                         \
    X(isMeteredNetwork, "isMeteredNetwork", "()Z")                                                 \
    X(updateProgress, "updateProgress", "(Z)V")                                                    \
    X(onBundleExecuted, "onBundleExecuted", "()V")                                                 \
    X(fontsChanged, "fontsChanged", "()V")

// Kotlin `external` functions C++ implements: X(Kotlin name, JNI signature, C++ function).
#define UNBOUND_BRIDGE_NATIVES(X)                                                                  \
    X("nativeInitialize",                                                                          \
      "(" UNBOUND_JNI_STRING UNBOUND_JNI_STRING UNBOUND_JNI_STRING "I" UNBOUND_JNI_STRING ")V",    \
      nativeInitialize)                                                                            \
    X("nativeOnLoadJSBundle", "()V", nativeOnLoadJSBundle)                                         \
    X("nativeMarkHealthy", "()V", nativeMarkHealthy)                                               \
    X("nativeOnForeground", "()V", nativeOnForeground)                                             \
    X("nativeOnBackground", "()V", nativeOnBackground)                                             \
    X("nativeAdoptTombstone", "([B)Z", nativeAdoptTombstone)                                       \
    X("nativeLaunchTimings", "()" UNBOUND_JNI_STRING, nativeLaunchTimings)                         \
    X("nativeIsBlockedTelemetry", "(" UNBOUND_JNI_STRING ")Z", nativeIsBlockedTelemetry)           \
    X("nativeOnRuntimeCreated", "(J)Z", nativeOnRuntimeCreated)                                    \
    X("nativeDrainRuntimeWork", "(J)V", nativeDrainRuntimeWork)                                    \
    X("nativeInstallSchedulerDrain", "(J)Z", nativeInstallSchedulerDrain)                          \
    X("nativeDrainMainWork", "()V", nativeDrainMainWork)                                           \
    X("nativeDrainFrameWork", "()V", nativeDrainFrameWork)                                         \
    X("nativeDispatchHookEvent", "(" UNBOUND_JNI_STRING UNBOUND_JNI_STRING ")" UNBOUND_JNI_STRING, \
      nativeDispatchHookEvent)                                                                     \
    X("nativeHermesBytecodeVersion", "([B)I", nativeHermesBytecodeVersion)                         \
    X("nativeHookReturnValue",                                                                     \
      "(" UNBOUND_JNI_STRING UNBOUND_JNI_STRING UNBOUND_JNI_STRING ")" UNBOUND_JNI_STRING,         \
      nativeHookReturnValue)                                                                       \
    X("nativeToolbox", "(" UNBOUND_JNI_STRING UNBOUND_JNI_STRING ")" UNBOUND_JNI_STRING,           \
      nativeToolbox)                                                                               \
    X("nativeActiveThemeId", "()" UNBOUND_JNI_STRING, nativeActiveThemeId)                         \
    X("nativeRecoveryActionLabel", "()" UNBOUND_JNI_STRING, nativeRecoveryActionLabel)             \
    X("nativeGestureEnabled", "(" UNBOUND_JNI_STRING ")Z", nativeGestureEnabled)                   \
    X("nativeSetGestureEnabled", "(" UNBOUND_JNI_STRING "Z)V", nativeSetGestureEnabled)            \
    X("nativeDevOverlayVisible", "(ZZ)Z", nativeDevOverlayVisible)                                 \
    X("nativeToolboxHoldMilliseconds", "()J", nativeToolboxHoldMilliseconds)                       \
    X("nativeShakeSample", "(FFFJ)Z", nativeShakeSample)                                           \
    X("nativeThreeFingerEvent", "(" UNBOUND_JNI_STRING "I)" UNBOUND_JNI_STRING,                    \
      nativeThreeFingerEvent)                                                                      \
    X("nativeResolveFont", "(" UNBOUND_JNI_STRING ")" UNBOUND_JNI_STRING, nativeResolveFont)       \
    X("nativeDocumentsDirectory", "(" UNBOUND_JNI_STRING ")" UNBOUND_JNI_STRING,                   \
      nativeDocumentsDirectory)                                                                    \
    X("nativeSettingsFileName", "()" UNBOUND_JNI_STRING, nativeSettingsFileName)                   \
    X("nativeThemeColorsJSON", "(" UNBOUND_JNI_STRING ")" UNBOUND_JNI_STRING,                      \
      nativeThemeColorsJSON)                                                                       \
    X("nativePrepareAddons", "()V", nativePrepareAddons)                                           \
    X("nativeLog", "(I" UNBOUND_JNI_STRING UNBOUND_JNI_STRING ")V", nativeLog)                     \
    X("nativeAppendLogFile", "(I" UNBOUND_JNI_STRING UNBOUND_JNI_STRING ")V", nativeAppendLogFile) \
    X("nativeDevOverlayButtonSide", "()D", nativeDevOverlayButtonSide)                             \
    X("nativeAttestation", "()" UNBOUND_JNI_STRING, nativeAttestation)                             \
    X("nativeWarnOffMainViewCall", "(" UNBOUND_JNI_STRING ")V", nativeWarnOffMainViewCall)         \
    X("nativeEvictIdleSurfaces", "()V", nativeEvictIdleSurfaces)                                   \
    X("nativeIncompatibleHostMessage", "()" UNBOUND_JNI_STRING, nativeIncompatibleHostMessage)     \
    X("nativeDevelopmentBuildBanner",                                                              \
      "(" UNBOUND_JNI_STRING UNBOUND_JNI_STRING UNBOUND_JNI_STRING UNBOUND_JNI_STRING              \
      ")" UNBOUND_JNI_STRING,                                                                      \
      nativeDevelopmentBuildBanner)                                                                \
    X("nativeDevelopmentBuildBannerSeconds", "()I", nativeDevelopmentBuildBannerSeconds)           \
    X("nativeDevOverlayCenter", "([D)[D", nativeDevOverlayCenter)                                  \
    X("nativeClampDevOverlayCenter", "(DD[D)[D", nativeClampDevOverlayCenter)                      \
    X("nativeSaveDevOverlayCenter", "(DD[D)V", nativeSaveDevOverlayCenter)
}
