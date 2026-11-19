package app.unbound.android

enum class StatusLevel { GOOD, WARNING, BAD }

data class StatusRow(val label: String, val value: String, val level: StatusLevel)

data class FrameworkFacts(val name: String, val version: String, val apiVersion: Int, val scope: List<String>)

data class ModuleStatusInput(
    val moduleVersion: String,
    val framework: FrameworkFacts?,
    val frameworkTimedOut: Boolean,
    val discordVersion: String?,
    val legacyFramework: String? = null,
)

object ModuleStatus {
    const val DISCORD_PACKAGE = "com.discord"

    val LEGACY_FRAMEWORKS = mapOf(
        "de.robv.android.xposed.installer" to "Xposed",
        "org.meowcat.edxposed.manager" to "EdXposed",
        "com.solohsu.android.edxp.manager" to "EdXposed",
        "top.canyie.dreamland.manager" to "Dreamland",
    )

    fun rows(input: ModuleStatusInput): List<StatusRow> = listOf(
        StatusRow("Module", input.moduleVersion, StatusLevel.GOOD),
        frameworkRow(input),
        scopeRow(input.framework),
        discordRow(input.discordVersion),
    )

    fun summary(input: ModuleStatusInput): String {
        val framework = input.framework
        return when {
            framework == null && input.frameworkTimedOut && input.legacyFramework != null ->
                "${input.legacyFramework} can't load Unbound. Install LSPosed or Vector instead, then reboot."
            framework == null && input.frameworkTimedOut -> "Unbound isn't active. Enable it in LSPosed or Vector, then reboot."
            framework == null -> "Checking the framework…"
            input.discordVersion == null -> "Install Discord to use Unbound."
            DISCORD_PACKAGE !in framework.scope -> "Add Discord to Unbound's scope in your framework."
            else -> "Unbound is active. Force-stop and reopen Discord after a module update."
        }
    }

    private fun frameworkRow(input: ModuleStatusInput): StatusRow {
        val framework = input.framework ?: return StatusRow(
            "Framework",
            when {
                input.frameworkTimedOut && input.legacyFramework != null -> "${input.legacyFramework} (unsupported)"
                input.frameworkTimedOut -> "Not active"
                else -> "Checking…"
            },
            if (input.frameworkTimedOut) StatusLevel.BAD else StatusLevel.WARNING,
        )
        return StatusRow(
            "Framework",
            "${framework.name} ${shortVersion(framework.version)} · API ${framework.apiVersion}",
            StatusLevel.GOOD,
        )
    }

    fun shortVersion(version: String): String =
        Regex("""^\S+(?: \(\d+\))?""").find(version.trim())?.value ?: version

    private fun scopeRow(framework: FrameworkFacts?): StatusRow = when {
        framework == null -> StatusRow("Scope", "Unknown", StatusLevel.WARNING)
        DISCORD_PACKAGE in framework.scope -> StatusRow("Scope", "Discord", StatusLevel.GOOD)
        else -> StatusRow("Scope", "Discord missing", StatusLevel.BAD)
    }

    private fun discordRow(version: String?): StatusRow =
        if (version == null) StatusRow("Discord", "Not installed", StatusLevel.BAD) else StatusRow("Discord", version, StatusLevel.GOOD)
}
