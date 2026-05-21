@echo off
set JAVA_HOME=D:\Android\openjdk\jdk-17.0.8.101-hotspot
set ANDROID_HOME=D:\Android\android-sdk

echo [1/3] 重新生成原生项目（含图标）...
cd /d E:\SJTU\sjtu_helper\frontend
call npx expo prebuild -p android
if %errorlevel% neq 0 goto :error

echo [2/3] 构建 Release APK...
cd android
call gradlew.bat assembleRelease
if %errorlevel% neq 0 goto :error

echo.
echo ✅ 构建成功！
echo APK 位置: android\app\build\outputs\apk\release\app-arm64-v8a-release.apk
pause
exit /b 0

:error
echo.
echo ❌ 构建失败，请检查上面的错误信息。
pause
exit /b 1
