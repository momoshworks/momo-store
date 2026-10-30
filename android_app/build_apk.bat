@echo off
echo Building MOMO store APK...

set ANDROID_JAR=%LOCALAPPDATA%\Android\Sdk\platforms\android-36\android.jar
set BUILD_TOOLS=%LOCALAPPDATA%\Android\Sdk\build-tools\36.0.0

if not exist "%ANDROID_JAR%" (
    echo Error: Android SDK not found at %ANDROID_JAR%
    exit /b 1
)

mkdir gen 2>nul
mkdir bin 2>nul
mkdir out 2>nul
del /q out\*.apk 2>nul
del /q bin\*.apk 2>nul

echo 1. Generating R.java...
"%BUILD_TOOLS%\aapt.exe" package -f -m -J gen -M AndroidManifest.xml -S res -I "%ANDROID_JAR%"

echo 2. Compiling Java sources...
javac -cp "%ANDROID_JAR%" -d bin gen\com\momo\store\R.java src\com\momo\store\*.java

echo 3. Converting to DEX with D8...
call "%BUILD_TOOLS%\d8.bat" --release --min-api 21 --lib "%ANDROID_JAR%" --output bin bin\com\momo\store\*.class

echo 4. Packaging APK...
"%BUILD_TOOLS%\aapt.exe" package -f -M AndroidManifest.xml -S res -A assets -I "%ANDROID_JAR%" -F out\momo-unaligned.apk bin

echo 5. Zipaligning APK...
"%BUILD_TOOLS%\zipalign.exe" -f -p 4 out\momo-unaligned.apk out\momo-aligned.apk

echo 6. Signing APK...
call "%BUILD_TOOLS%\apksigner.bat" sign --ks momo.keystore --ks-pass pass:momostore123 --out momo-store.apk out\momo-aligned.apk

echo APK Build complete: momo-store.apk
