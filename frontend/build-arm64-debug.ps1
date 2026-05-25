$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "========================================="
Write-Host " React Native ARM64 Debug Builder"
Write-Host "========================================="
Write-Host ""

# 项目根目录
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

# gradle.properties
$gradleProps = "android/gradle.properties"

if (!(Test-Path $gradleProps)) {
    Write-Host "gradle.properties not found!"
    exit 1
}

$content = Get-Content $gradleProps -Raw

Write-Host "Checking gradle.properties..."

# reactNativeArchitectures
if ($content -notmatch "reactNativeArchitectures=") {
    Write-Host "Adding reactNativeArchitectures=arm64-v8a"
    Add-Content $gradleProps "`nreactNativeArchitectures=arm64-v8a"
}
else {
    $content = $content -replace "reactNativeArchitectures=.*", "reactNativeArchitectures=arm64-v8a"
    Set-Content $gradleProps $content
}

Write-Host ""
Write-Host "Checking vector icon fonts..."

$fontsDir = "android/app/src/main/assets/fonts"

if (!(Test-Path $fontsDir)) {
    Write-Host "Fonts directory missing."
    Write-Host "Running react-native-asset..."
    cmd /c "npx react-native-asset"
}

Write-Host ""
Write-Host "Building debug APK..."
Write-Host ""

Push-Location android

cmd /c "gradlew assembleDebug -DreactNativeArchitectures=arm64-v8a"

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "========================================="
    Write-Host " BUILD FAILED"
    Write-Host "========================================="
    Pop-Location
    exit $LASTEXITCODE
}

Pop-Location

Write-Host ""
Write-Host "========================================="
Write-Host " BUILD SUCCESS"
Write-Host "========================================="
Write-Host ""

Write-Host "APK path:"
Write-Host "android/app/build/outputs/apk/debug/app-debug.apk"

Write-Host ""
pause