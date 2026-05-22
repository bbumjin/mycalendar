plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("org.jetbrains.kotlin.plugin.serialization")
}

android {
    namespace = "com.aicalendar.widget"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.aicalendar.widget"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"

        // Production base URL — override via local.properties WEB_BASE_URL if needed
        val baseUrl = (project.findProperty("WEB_BASE_URL") as String?) ?: "https://mycalendar-nine.vercel.app"
        buildConfigField("String", "WEB_BASE_URL", "\"$baseUrl\"")
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    // Stable signing so every CI build shares one signature → installs over previous
    // builds without "App not installed". The keystore is provided by CI (cached) at
    // android/fixed-debug.keystore. Falls back to default debug signing if absent.
    val fixedKeystore = rootProject.file("fixed-debug.keystore")
    signingConfigs {
        create("fixed") {
            if (fixedKeystore.exists()) {
                storeFile = fixedKeystore
                storePassword = "android"
                keyAlias = "aicalendar"
                keyPassword = "android"
            }
        }
    }

    buildTypes {
        debug {
            if (fixedKeystore.exists()) signingConfig = signingConfigs.getByName("fixed")
        }
        release {
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

dependencies {
    // Compose
    val composeBom = platform("androidx.compose:compose-bom:2024.10.01")
    implementation(composeBom)
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    debugImplementation("androidx.compose.ui:ui-tooling")
    implementation("androidx.activity:activity-compose:1.9.3")

    // Core / Lifecycle / Coroutines
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.browser:browser:1.8.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")

    // Glance widgets
    implementation("androidx.glance:glance-appwidget:1.1.1")
    implementation("androidx.glance:glance-material3:1.1.1")

    // DataStore for token persistence
    implementation("androidx.datastore:datastore-preferences:1.1.1")

    // WorkManager for periodic refresh
    implementation("androidx.work:work-runtime-ktx:2.10.0")

    // Network + JSON
    implementation("io.ktor:ktor-client-core:3.0.0")
    implementation("io.ktor:ktor-client-android:3.0.0")
    implementation("io.ktor:ktor-client-content-negotiation:3.0.0")
    implementation("io.ktor:ktor-serialization-kotlinx-json:3.0.0")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.3")
}
