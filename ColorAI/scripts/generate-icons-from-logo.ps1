# 从品牌图生成浏览器全套图标（favicon / apple-touch-icon / PWA）
# 源图：public/icons/logo.jpg（白底居中设计，maskable 安全区外均为白色留白，全幅缩放即可通过裁切）
# 用法：powershell -ExecutionPolicy Bypass -File scripts/generate-icons-from-logo.ps1
# 产物：public/favicon.png、public/apple-touch-icon.png、
#       public/icons/icon-192.png、public/icons/icon-512.png、public/icons/maskable-icon-512.png
# 说明：依赖 .NET System.Drawing（Windows 自带）。替换品牌图后重跑本脚本即可刷新全部图标。

Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$src = Join-Path $root 'public\icons\logo.jpg'

if (-not (Test-Path $src)) { throw "源图不存在: $src" }

$img = [System.Drawing.Image]::FromFile($src)
try {
    $outputs = @(
        @{ Path = 'public\favicon.png';                 Size = 64  },
        @{ Path = 'public\apple-touch-icon.png';        Size = 180 },
        @{ Path = 'public\icons\icon-192.png';          Size = 192 },
        @{ Path = 'public\icons\icon-512.png';          Size = 512 },
        @{ Path = 'public\icons\maskable-icon-512.png'; Size = 512 }
    )

    foreach ($o in $outputs) {
        $dest = Join-Path $root $o.Path
        $size = $o.Size
        $bmp = New-Object System.Drawing.Bitmap($size, $size)
        $g = [System.Drawing.Graphics]::FromImage($bmp)
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $g.DrawImage($img, 0, 0, $size, $size)
        $g.Dispose()
        $bmp.Save($dest, [System.Drawing.Imaging.ImageFormat]::Png)
        $bmp.Dispose()
        Write-Host "[OK] $($o.Path) ($size x $size)"
    }
}
finally {
    $img.Dispose()
}
