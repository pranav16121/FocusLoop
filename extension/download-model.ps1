param([string]$ExpectedSha256 = '64184E229B263107BC2B804C6625DB1341FF2BB731874B0BCC2FE6544E0BC9FF')
$ErrorActionPreference = 'Stop'
$url = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'
$out = Join-Path $PSScriptRoot 'models\face_landmarker.task'
New-Item -ItemType Directory -Force (Split-Path $out) | Out-Null
Invoke-WebRequest -Uri $url -OutFile $out
$actual = (Get-FileHash -Algorithm SHA256 $out).Hash.ToLowerInvariant()
if ($actual -ne $ExpectedSha256.ToLowerInvariant()) { Remove-Item -LiteralPath $out -Force; throw "Model checksum mismatch: $actual" }
Write-Host "Verified model written to $out"
