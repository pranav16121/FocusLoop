$ErrorActionPreference = 'Stop'
Remove-Item -LiteralPath 'HKCU:\Software\Google\Chrome\NativeMessagingHosts\com.focusloop.companion' -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath 'HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\com.focusloop.companion' -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath (Join-Path $PSScriptRoot 'com.focusloop.companion.chrome.json') -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath (Join-Path $PSScriptRoot 'com.focusloop.companion.edge.json') -Force -ErrorAction SilentlyContinue
Write-Host 'FocusLoop Native Messaging host registration removed.'
