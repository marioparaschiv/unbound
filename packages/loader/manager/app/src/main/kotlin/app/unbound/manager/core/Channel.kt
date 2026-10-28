package app.unbound.manager.core

import kotlinx.serialization.Serializable

enum class Channel(val titlePattern: Regex, val prerelease: Boolean, val discordAsset: String) {
    STABLE(Regex("""^loader-v\d+\.\d+$"""), prerelease = false, discordAsset = "Unbound.apks"),
    BETA(Regex("""^loader-v\d+\.\d+-android-beta$"""), prerelease = true, discordAsset = "Unbound-beta.apks"),
    ALPHA(Regex("""^loader-v\d+\.\d+-android-alpha$"""), prerelease = true, discordAsset = "Unbound-alpha.apks"),
}

enum class Mode(val targets: List<Target>) {
    PATCHED(listOf(Target.DISCORD, Target.MANAGER)),
    LSPOSED(listOf(Target.MODULE, Target.MANAGER)),
}

enum class Target(val packageName: String, val split: Boolean, val versionNameIsReleaseVersion: Boolean) {
    DISCORD("com.discord", split = true, versionNameIsReleaseVersion = true),
    MODULE("app.unbound.android", split = false, versionNameIsReleaseVersion = false),
    MANAGER("app.unbound.manager", split = false, versionNameIsReleaseVersion = true),
    ;

    fun assetName(channel: Channel): String = when (this) {
        DISCORD -> channel.discordAsset
        MODULE -> "app.unbound.android.lsposed.apk"
        MANAGER -> "unbound-manager.apk"
    }

    fun accepts(title: String, prerelease: Boolean, channel: Channel): Boolean = when (this) {
        MANAGER -> MANAGER_TITLE.matches(title)
        DISCORD, MODULE -> channel.titlePattern.matches(title) && prerelease == channel.prerelease
    }
}

private val MANAGER_TITLE = Regex("""^manager-v\d+\.\d+\.\d+$""")

@Serializable
data class Settings(val channel: Channel = Channel.STABLE, val mode: Mode = Mode.PATCHED, val autoUpdate: Boolean = true)
