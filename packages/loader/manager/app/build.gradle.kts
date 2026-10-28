import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.plugin.compose")
    id("org.jetbrains.kotlin.plugin.serialization")
}

val versionProperties = Properties().apply {
    rootDir.resolve("version.properties").inputStream().use(::load)
}
val trustedSigners: List<String> = (
    providers.gradleProperty("unboundTrustedSigners").orNull
        ?: "3923c381141ea804a1a311c69b616ac9c360d4fb0dccb5fbcd09a6b8b78842c5"
    ).split(",").map(String::trim).filter(String::isNotEmpty)
val releasesUrl: String = providers.gradleProperty("unboundReleasesUrl").orNull?.trim()
    ?: "https://api.github.com/repos/marioparaschiv/unbound/releases"

if (trustedSigners.isEmpty() || trustedSigners.any { !it.matches(Regex("[0-9a-f]{64}")) }) {
    throw GradleException("unboundTrustedSigners must be a comma list of lowercase SHA-256 hex digests")
}
if (!releasesUrl.matches(Regex("https?://[^\\s\"]+"))) {
    throw GradleException("unboundReleasesUrl must be an http or https URL, got $releasesUrl")
}

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
    namespace = "app.unbound.manager"
    compileSdk = 36

    defaultConfig {
        applicationId = "app.unbound.manager"
        minSdk = 28
        targetSdk = 36
        versionCode = versionProperties.getProperty("versionCode").toInt()
        versionName = versionProperties.getProperty("versionName")

        buildConfigField("String", "TRUSTED_SIGNER_SHA256", "\"${trustedSigners.joinToString(",")}\"")
        buildConfigField("String", "RELEASES_URL", "\"$releasesUrl\"")
        manifestPlaceholders["usesCleartextTraffic"] = releasesUrl.startsWith("http://").toString()
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
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"))
            signingConfig = signingConfigs.getByName(if (hasReleaseSigning) "release" else "debug")
        }
    }

    buildFeatures {
        buildConfig = true
        compose = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
    }
}

dependencies {
    implementation(platform("androidx.compose:compose-bom:2026.06.01"))
    implementation("androidx.compose.material3:material3")
    implementation("androidx.activity:activity-compose:1.13.0")
    implementation("androidx.work:work-runtime-ktx:2.12.0")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.12.0")
    testImplementation("junit:junit:4.13.2")
}

val ktlint: Configuration = configurations.create("ktlint")

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
