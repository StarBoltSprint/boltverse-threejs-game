# Simple static server for Bolt Engine (no Python/Node required)
# Usage: right-click → Run with PowerShell, or: powershell -File serve.ps1

$port = 8080
$root = $PSScriptRoot
$prefix = "http://localhost:$port/"

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)

try {
  $listener.Start()
} catch {
  Write-Host "Could not bind $prefix — try another port or run as admin." -ForegroundColor Red
  Write-Host $_.Exception.Message
  exit 1
}

Write-Host ""
Write-Host "  BOLT ENGINE server" -ForegroundColor Cyan
Write-Host "  Open: $prefix" -ForegroundColor Green
Write-Host "  Root: $root"
Write-Host "  Press Ctrl+C to stop."
Write-Host ""

# Try to open browser
Start-Process $prefix

$mime = @{
  ".html" = "text/html; charset=utf-8"
  ".js"   = "application/javascript; charset=utf-8"
  ".css"  = "text/css; charset=utf-8"
  ".json" = "application/json"
  ".png"  = "image/png"
  ".jpg"  = "image/jpeg"
  ".svg"  = "image/svg+xml"
  ".ico"  = "image/x-icon"
  ".md"   = "text/markdown; charset=utf-8"
}

while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $req = $ctx.Request
  $res = $ctx.Response

  $path = [Uri]::UnescapeDataString($req.Url.LocalPath.TrimStart("/"))
  if ([string]::IsNullOrWhiteSpace($path)) { $path = "index.html" }

  $full = Join-Path $root $path
  $full = [System.IO.Path]::GetFullPath($full)

  if (-not $full.StartsWith($root, [StringComparison]::OrdinalIgnoreCase)) {
    $res.StatusCode = 403
    $bytes = [Text.Encoding]::UTF8.GetBytes("Forbidden")
    $res.OutputStream.Write($bytes, 0, $bytes.Length)
    $res.Close()
    continue
  }

  if (-not (Test-Path -LiteralPath $full -PathType Leaf)) {
    $res.StatusCode = 404
    $bytes = [Text.Encoding]::UTF8.GetBytes("Not found: $path")
    $res.OutputStream.Write($bytes, 0, $bytes.Length)
    $res.Close()
    continue
  }

  $ext = [System.IO.Path]::GetExtension($full).ToLowerInvariant()
  $res.ContentType = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { "application/octet-stream" }
  $bytes = [System.IO.File]::ReadAllBytes($full)
  $res.ContentLength64 = $bytes.Length
  $res.OutputStream.Write($bytes, 0, $bytes.Length)
  $res.Close()
}
