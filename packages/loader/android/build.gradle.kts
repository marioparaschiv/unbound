plugins {
    id("com.android.application") version "9.5.1" apply false
    id("org.jetbrains.kotlin.android") version "2.4.21" apply false
}

// ktlint lives in the root project so `--configure-on-demand :ktlintCheck` never configures :module, which needs the Android SDK.
val ktlint: Configuration by configurations.creating

dependencies {
    ktlint("com.pinterest.ktlint:ktlint-cli:1.8.0") {
        attributes {
            attribute(Bundling.BUNDLING_ATTRIBUTE, objects.named(Bundling::class.java, Bundling.EXTERNAL))
        }
    }
}

val ktlintSources = providers.gradleProperty("ktlintFiles").orNull?.split(",")?.filter(String::isNotBlank)
    ?: listOf("module/src/**/*.kt", "*.kts", "module/*.kts")

tasks.register<JavaExec>("ktlintCheck") {
    group = "verification"
    classpath = ktlint
    mainClass.set("com.pinterest.ktlint.Main")
    args(ktlintSources)
}

tasks.register<JavaExec>("ktlintFormat") {
    group = "formatting"
    classpath = ktlint
    mainClass.set("com.pinterest.ktlint.Main")
    jvmArgs("--add-opens=java.base/java.lang=ALL-UNNAMED")
    args(listOf("--format") + ktlintSources)
}
