$ErrorActionPreference = "Stop"

Write-Host "========================================="
Write-Host " RN ARM64 Release Builder"
Write-Host "========================================="

$gradleFile = "android/app/build.gradle"

if (!(Test-Path $gradleFile)) {
    Write-Host "build.gradle not found!"
    exit 1
}

$content = Get-Content $gradleFile -Raw

# 检查是否已有 splits abi 配置
if ($content -notmatch 'splits\s*\{[\s\S]*?abi') {

    Write-Host ""
    Write-Host "Injecting ABI split config..."

    $splitConfig = @"

    splits {
        abi {
            enable true
            reset()
            include "arm64-v8a"
            universalApk false
        }
    }

"@

    # 插入 android { 内
    $content = $content -replace 'android\s*\{', "android {$splitConfig"

    Set-Content $gradleFile $content

    Write-Host "ABI split injected."
}
else {
    Write-Host ""
    Write-Host "ABI split already exists."
}

Write-Host ""
Write-Host "Building ARM64 release..."

Set-Location android

cmd /c "gradlew assembleRelease -DreactNativeArchitectures=arm64-v8a"

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "BUILD FAILED"
    exit $LASTEXITCODE
}

Set-Location ..

Write-Host ""
Write-Host "========================================="
Write-Host " BUILD SUCCESS"
Write-Host "========================================="

Write-Host ""
Write-Host "APK path:"
Write-Host "android/app/build/outputs/apk/"