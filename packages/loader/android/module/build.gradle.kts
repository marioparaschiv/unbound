import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import javax.inject.Inject

plugins {
    id("com.android.application")
}

val repositoryRoot: File = rootDir.parentFile
val packageVersion: String = repositoryRoot.resolve("ios/control").readLines()
    .first { it.startsWith("Version:") }
    .substringAfter(":")
    .trim()
val buildNumber = providers.gradleProperty("unboundBuildNumber").orNull?.toIntOrNull()
val packageVersionCode = packageVersion.split(".").take(3).fold(0) { code, part ->
    code * 100 + (part.filter(Char::isDigit).toIntOrNull() ?: 0)
}
val resolvedVersionCode = buildNumber?.let { 1_000_000 + it } ?: packageVersionCode.coerceAtLeast(1)
val bundleURL = (providers.gradleProperty("unboundBundleURL").orNull ?: System.getenv("UNBOUND_BUNDLE_URL"))
    ?.trim()
    ?.takeIf(String::isNotEmpty)

if (bundleURL != null && !bundleURL.matches(Regex("https://[A-Za-z0-9.-]+(:[0-9]+)?/[A-Za-z0-9._~/-]*/"))) {
    throw GradleException("unboundBundleURL must be an https URL ending in /, got $bundleURL")
}
fun gitOutput(vararg arguments: String): String = providers.exec {
    commandLine("git", "-C", repositoryRoot.absolutePath, *arguments)
    isIgnoreExitValue = true
}.standardOutput.asText.get().trim()

fun buildConfigString(value: String): String = "\"" + value.filter { it.isLetterOrDigit() || it in " ._:/()-" } + "\""

val commitShortHash = gitOutput("rev-parse", "--short", "HEAD")
val commitSubject = gitOutput("log", "-1", "--pretty=format:%s")
val commitBranch = gitOutput("branch", "--show-current").ifEmpty { "detached" }
val pullRequestNumber: String = providers.gradleProperty("unboundPrNumber").orNull
    ?: System.getenv("UNBOUND_PR_NUMBER").orEmpty()
val buildTimestamp: String = ZonedDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss z"))
val signingStoreFile = System.getenv("ANDROID_SIGNING_STORE_FILE")
val signingStorePassword = System.getenv("ANDROID_SIGNING_STORE_PASSWORD")
val signingKeyAlias = System.getenv("ANDROID_SIGNING_KEY_ALIAS")
val signingKeyPassword = System.getenv("ANDROID_SIGNING_KEY_PASSWORD")
val releaseSigningValues = listOf(signingStoreFile, signingStorePassword, signingKeyAlias, signingKeyPassword)
val hasReleaseSigning = releaseSigningValues.all { !it.isNullOrBlank() }

if (releaseSigningValues.any { !it.isNullOrBlank() } && !hasReleaseSigning) {
    throw GradleException("Android release signing requires all ANDROID_SIGNING_* values")
}

android {
    namespace = "app.unbound.android"
    compileSdk = 36
    ndkVersion = "27.3.13750724"

    defaultConfig {
        applicationId = "app.unbound.android"
        minSdk = 28
        targetSdk = 36
        versionCode = resolvedVersionCode
        versionName = packageVersion

        buildConfigField("String", "COMMIT_SHORT_HASH", buildConfigString(commitShortHash))
        buildConfigField("String", "COMMIT_SUBJECT", buildConfigString(commitSubject))
        buildConfigField("String", "COMMIT_BRANCH", buildConfigString(commitBranch))
        buildConfigField("String", "BUILD_TIMESTAMP", buildConfigString(buildTimestamp))

        externalNativeBuild {
            cmake {
                arguments +=
                    listOf(
                        "-DANDROID_STL=c++_static",
                        "-DUNBOUND_VERSION=$packageVersion",
                        "-DUNBOUND_PR_NUMBER=${pullRequestNumber.trim()}",
                        "-DUNBOUND_BUNDLE_URL=${bundleURL.orEmpty()}",
                    )
                cppFlags += listOf("-std=c++20", "-fexceptions", "-frtti")
            }
        }

        ndk {
            abiFilters += listOf("arm64-v8a", "x86_64")
        }
    }

    if (hasReleaseSigning) {
        signingConfigs {
            create("release") {
                storeFile = file(signingStoreFile!!)
                storePassword = signingStorePassword
                keyAlias = signingKeyAlias
                keyPassword = signingKeyPassword
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            proguardFiles("proguard-rules.pro")
            ndk {
                debugSymbolLevel = "FULL"
            }
            signingConfig = signingConfigs.getByName(if (hasReleaseSigning) "release" else "debug")
        }
    }

    externalNativeBuild {
        cmake {
            path = file("src/main/cpp/CMakeLists.txt")
            version = "3.22.1"
        }
    }

    buildFeatures {
        buildConfig = true
    }

    testOptions {
        unitTests.isIncludeAndroidResources = true
        unitTests.all {
            val vectors = repositoryRoot.resolve("core/tests/vectors/crypto-cross-check.txt")
            it.inputs.file(vectors)
            it.systemProperty("unbound.coreCryptoVectors", vectors.absolutePath)
        }
    }

    packaging {
        jniLibs {
            useLegacyPackaging = true
        }
        resources {
            merges += "META-INF/xposed/*"
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

abstract class CopyBootstrapResources : DefaultTask() {
    @get:InputFiles
    abstract val scripts: ConfigurableFileCollection

    @get:OutputDirectory
    abstract val output: DirectoryProperty

    @get:Inject
    abstract val files: FileSystemOperations

    @TaskAction
    fun copy() {
        files.sync {
            from(scripts)
            into(output.dir("js"))
        }
    }
}

abstract class GenerateDiscordShapes : DefaultTask() {
    @get:InputFile
    @get:PathSensitive(PathSensitivity.NONE)
    abstract val shapes: RegularFileProperty

    @get:OutputDirectory
    abstract val output: DirectoryProperty

    @TaskAction
    fun generate() {
        val rules = groovy.json.JsonSlurper().parse(shapes.get().asFile) as Map<*, *>
        val entries = rules.entries.joinToString("") { (name, rule) ->
            val arguments = (rule as Map<*, *>).entries.joinToString(", ") { (key, value) -> "$key = ${literal(value)}" }
            "    ${literal(name)} to DiscordShape($arguments),\n"
        }
        val file = output.get().asFile.resolve("app/unbound/android/DiscordShapeRules.kt")
        file.parentFile.mkdirs()
        file.writeText("package app.unbound.android\n\ninternal val DISCORD_SHAPE_RULES: Map<String, DiscordShape> = mapOf(\n$entries)\n")
    }

    private fun literal(value: Any?): String = when (value) {
        is String -> "\"" + value.flatMap { character ->
            when (character) {
                '\\', '"', '$' -> listOf('\\', character)
                else -> listOf(character)
            }
        }.joinToString("") + "\""

        is Boolean, is Int -> value.toString()

        is List<*> -> value.joinToString(", ", "listOf(", ")") { literal(it) }

        else -> throw GradleException("discord-shapes.json has a value the loader cannot read: $value")
    }
}

val generateDiscordShapes = tasks.register<GenerateDiscordShapes>("generateDiscordShapes") {
    shapes.set(repositoryRoot.resolveSibling("plugins-shared/src/native/android/discord-shapes.json"))
}

val copyBootstrapResources = tasks.register<CopyBootstrapResources>("copyBootstrapResources") {
    scripts.from(fileTree(repositoryRoot.resolve("bootstrap")) { include("*.js") })
}

androidComponents {
    onVariants { variant ->
        variant.sources.assets?.addGeneratedSourceDirectory(copyBootstrapResources, CopyBootstrapResources::output)
        variant.sources.kotlin?.addGeneratedSourceDirectory(generateDiscordShapes, GenerateDiscordShapes::output)
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
    }
}

dependencies {
    compileOnly("io.github.libxposed:api:102.0.0")
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.robolectric:robolectric:4.17")
}

val ktlint: Configuration by configurations.creating

dependencies {
    ktlint("com.pinterest.ktlint:ktlint-cli:1.8.0") {
        attributes {
            attribute(Bundling.BUNDLING_ATTRIBUTE, objects.named(Bundling::class.java, Bundling.EXTERNAL))
        }
    }
}

val ktlintSources = providers.gradleProperty("ktlintFiles").orNull?.split(",")?.filter(String::isNotBlank)
    ?: listOf("src/**/*.kt", "*.kts", "../*.kts")

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
