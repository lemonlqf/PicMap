# PicMap 一键构建脚本
# 作用：生成 Windows 图标 -> wails 构建 -> 组装自包含产物到 dist/
# 说明：build/ 目录仅存放 Wails 构建配置与中间产物，不对外交付；最终产物在 dist/
# 用法：在项目根目录执行  powershell -ExecutionPolicy Bypass -File .\build.ps1

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
Set-Location $root

$binDir = Join-Path $root "build\bin"     # wails 中间产物
$distDir = Join-Path $root "dist"          # 最终交付产物
$toolsSrc = Join-Path $root "tools"
$magick = Join-Path $toolsSrc "imagemagick\magick.exe"

Write-Host "==> [1/4] 生成应用图标 icon.ico" -ForegroundColor Cyan
# 图标源文件为 build/appicon.png（wails 官方约定，替换它即可换图标）；
# 由它生成多尺寸 build/windows/icon.ico 供 wails 嵌入 exe
$appicon = Join-Path $root "build\appicon.png"
$icon = Join-Path $root "build\windows\icon.ico"
if (Test-Path $appicon) {
    & $magick $appicon -define icon:auto-resize=256,128,64,48,32,24,16 $icon
    if ($LASTEXITCODE -ne 0) { throw "生成 icon.ico 失败" }
} else {
    Write-Warning "未找到 build/appicon.png，跳过图标生成（exe 将使用默认图标）"
}

Write-Host "==> [2/4] wails 构建" -ForegroundColor Cyan
wails build -platform windows/amd64
if ($LASTEXITCODE -ne 0) { throw "wails build 失败" }

Write-Host "==> [3/4] 组装自包含产物到 dist/" -ForegroundColor Cyan
# dist/ 每次全量重建，保证只含最终产物
if (Test-Path $distDir) { Remove-Item -Recurse -Force $distDir }
New-Item -ItemType Directory -Force -Path $distDir | Out-Null

# 主程序
Copy-Item -Force (Join-Path $binDir "picmap.exe") (Join-Path $distDir "picmap.exe")

# 外部工具：imagemagick(HEIC/RAW 转码) + libraw(RAW 解码) + ffmpeg(视频探测/取帧)
# 注意：tools/dcraw 为历史遗留，代码未使用，故不复制
$needDirs = @("imagemagick", "libraw", "ffmpeg")
$toolsDst = Join-Path $distDir "tools"
foreach ($d in $needDirs) {
    $src = Join-Path $toolsSrc $d
    $dst = Join-Path $toolsDst $d
    if (-not (Test-Path $src)) { throw "缺少工具目录: tools\$d" }
    Copy-Item -Recurse -Force $src $dst
    Write-Host "    已复制 tools\$d"
}

Write-Host "==> [4/4] 校验产物完整性" -ForegroundColor Cyan
$required = @(
    "picmap.exe",
    "tools\imagemagick\magick.exe",
    "tools\libraw\dcraw_emu.exe",
    "tools\libraw\libraw.dll",
    "tools\ffmpeg\ffmpeg.exe",
    "tools\ffmpeg\ffprobe.exe"
)
$missing = @()
foreach ($f in $required) {
    if (-not (Test-Path (Join-Path $distDir $f))) { $missing += $f }
}
if ($missing.Count -gt 0) {
    Write-Host "产物缺少以下文件：" -ForegroundColor Red
    $missing | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
    throw "产物不完整"
}

Write-Host ""
Write-Host "构建完成，交付目录: $distDir" -ForegroundColor Green
Write-Host "交付内容（自包含，可直接运行 picmap.exe）：" -ForegroundColor Green
Get-ChildItem $distDir | Select-Object Name | ForEach-Object { Write-Host "  - $($_.Name)" }
