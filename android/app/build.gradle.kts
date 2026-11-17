plugins {
  id("com.android.application")
  id("org.jetbrains.kotlin.android")
}

android {
  namespace = "app.fixup.mobile"
  compileSdk = 35

  defaultConfig {
    applicationId = "app.fixup.mobile"
    minSdk = 24
    targetSdk = 35
    versionCode = 30000
    versionName = "3.0.0"
    resourceConfigurations += listOf("pt", "pt-rBR")
  }

  signingConfigs {
    create("release") {
      storeFile = file("fixup-release.jks")
      storePassword = "fixup123"
      keyAlias = "fixup"
      keyPassword = "fixup123"
      enableV1Signing = true
      enableV2Signing = true
    }
  }

  buildTypes {
    debug {
      signingConfig = signingConfigs.getByName("release")
    }
    release {
      isMinifyEnabled = true
      isShrinkResources = true
      signingConfig = signingConfigs.getByName("release")
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

  buildFeatures {
    aidl = false
    buildConfig = false
    shaders = false
  }

  packaging {
    resources {
      excludes += "/META-INF/{AL2.0,LGPL2.1}"
    }
  }
}

val syncWebAssets = tasks.register<Sync>("syncWebAssets") {
  val webRoot = rootProject.projectDir.parentFile
  from(webRoot) {
    include("index.html")
    include("css/**")
    include("js/**")
    include("img/**")
  }
  from("src/main/vendor-assets") {
    into("vendor")
  }
  into(layout.projectDirectory.dir("src/main/assets"))
}

tasks.named("preBuild").configure {
  dependsOn(syncWebAssets)
}

dependencies {
  implementation("androidx.webkit:webkit:1.12.1")
  implementation("androidx.appcompat:appcompat:1.7.0")
  implementation("androidx.activity:activity-ktx:1.9.3")
  implementation("androidx.core:core-ktx:1.13.1")
}
