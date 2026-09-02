# KOAN.hang pipeline step 9: level/scan.clean.glb -> level/scan.glb
# textures 2048, simplify to ~40% triangles, Draco. Run from the repo root after scan/pipeline.py.
$ErrorActionPreference = "Stop"
Set-Location "$PSScriptRoot\..\level"
npx --yes @gltf-transform/cli resize --width 2048 --height 2048 scan.clean.glb scan.r.glb
npx --yes @gltf-transform/cli simplify --ratio 0.4 --error 0.001 scan.r.glb scan.s.glb
npx --yes @gltf-transform/cli draco scan.s.glb scan.glb
Remove-Item scan.r.glb, scan.s.glb
Get-Item scan.clean.glb, scan.glb | Select-Object Name, @{n="MB";e={[math]::Round($_.Length/1MB,2)}}
