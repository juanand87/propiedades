$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$sdkPath = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { Join-Path $env:LOCALAPPDATA 'Android/Sdk' }
$androidUserPath = if ($env:ANDROID_USER_HOME) { $env:ANDROID_USER_HOME } else { Join-Path $env:USERPROFILE '.android' }
$env:ANDROID_AVD_HOME = Join-Path $androidUserPath 'avd'
if (-not (Test-Path -LiteralPath (Join-Path $sdkPath 'emulator/emulator.exe'))) { throw 'Instala Android Studio y Android Emulator desde SDK Manager antes de continuar.' }
$toolsRoot = Join-Path $projectRoot 'tmp/android-tools'
$androidCli = Join-Path $toolsRoot 'cmdline-tools/bin/android.exe'
if (-not (Test-Path -LiteralPath $androidCli)) {
  New-Item -ItemType Directory -Force (Join-Path $projectRoot 'tmp') | Out-Null
  [xml]$repository = (Invoke-WebRequest 'https://dl.google.com/android/repository/repository2-3.xml').Content
  $package = $repository.SelectSingleNode("//*[local-name()='remotePackage' and @path='cmdline-tools;latest']")
  $archive = $package.SelectSingleNode(".//*[local-name()='archive'][*[local-name()='host-os']='windows']")
  $relativeUrl = $archive.SelectSingleNode(".//*[local-name()='url']").InnerText
  if ($relativeUrl -notmatch '^commandlinetools-win-[0-9]+_latest\.zip$') { throw 'URL de herramientas Android inesperada.' }
  $zip = Join-Path $projectRoot 'tmp/android-command-tools.zip'
  Invoke-WebRequest ('https://dl.google.com/android/repository/' + $relativeUrl) -OutFile $zip
  $checksum = $archive.SelectSingleNode(".//*[local-name()='checksum']")
  if ($checksum -and $checksum.GetAttribute('type') -eq 'sha1') {
    if ((Get-FileHash -LiteralPath $zip -Algorithm SHA1).Hash -ne $checksum.InnerText) { throw 'El archivo de herramientas no supera la verificación SHA1.' }
  }
  Expand-Archive -LiteralPath $zip -DestinationPath $toolsRoot -Force
}
$avds = & (Join-Path $sdkPath 'emulator/emulator.exe') -list-avds
if ($avds -notcontains 'medium_phone') {
  & $androidCli "--sdk=$sdkPath" emulator create medium_phone
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo crear medium_phone.' }
}
Write-Host 'Emulador medium_phone preparado. Ejecuta npm run mobile:backend y luego npm run mobile:android.'
