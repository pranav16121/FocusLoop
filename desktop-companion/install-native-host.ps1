param(
  [Parameter(Mandatory=$true)][string]$ChromeExtensionId,
  [Parameter(Mandatory=$true)][string]$EdgeExtensionId,
  [string]$BinaryPath = (Join-Path $PSScriptRoot 'target\release\focusloop-companion.exe')
)
$ErrorActionPreference = 'Stop'
if (!(Test-Path -LiteralPath $BinaryPath)) { throw "Build first: cargo build --release. Missing: $BinaryPath" }
function Install-Host([string]$browser, [string]$extensionId, [string]$registryPath) {
  $template = Get-Content -Raw (Join-Path $PSScriptRoot "host-manifest.$browser.json")
  $manifest = $template.Replace('__HOST_PATH__', ($BinaryPath -replace '\\','\\')).Replace("__$($browser.ToUpper())_EXTENSION_ID__", $extensionId)
  $destination = Join-Path $PSScriptRoot "com.focusloop.companion.$browser.json"
  [IO.File]::WriteAllText($destination, $manifest, [Text.UTF8Encoding]::new($false))
  $hostKey = Join-Path $registryPath 'com.focusloop.companion'
  New-Item -Path $hostKey -Force | Out-Null
  Set-Item -Path $hostKey -Value $destination
}
Install-Host 'chrome' $ChromeExtensionId 'HKCU:\Software\Google\Chrome\NativeMessagingHosts'
Install-Host 'edge' $EdgeExtensionId 'HKCU:\Software\Microsoft\Edge\NativeMessagingHosts'
Write-Host 'FocusLoop Native Messaging host installed for Chrome and Edge.'
