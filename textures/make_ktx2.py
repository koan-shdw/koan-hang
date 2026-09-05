"""KTX2 tiles for the remake (REMAKE.md s3): every jpg in textures/ -> textures/ktx2/<name>.ktx2.
UASTC for the surfaces we look at up close (wall-white, concrete-floor), ETC1S for the rest. Mips baked in, sRGB.
Needs toktx (KTX-Software 4.4, installed 2026-09-05 at C:/Program Files/KTX-Software). Run from textures/: python make_ktx2.py
"""
import glob, os, subprocess, sys
TOKTX = r"C:\Program Files\KTX-Software\bin\toktx.exe"
UASTC = {"wall-white", "concrete-floor"}
os.makedirs("ktx2", exist_ok=True)
for f in sorted(glob.glob("*.jpg")):
    name = f[:-4]; out = f"ktx2/{name}.ktx2"
    if os.path.exists(out) and os.path.getmtime(out) > os.path.getmtime(f): print("keep", out); continue
    enc = ["--encode", "uastc", "--uastc_quality", "2", "--zcmp", "19"] if name in UASTC else ["--encode", "etc1s", "--clevel", "2", "--qlevel", "200"]
    cmd = [TOKTX, "--t2", "--genmipmap", "--assign_oetf", "srgb", "--assign_primaries", "bt709", *enc, out, f]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode: print("FAIL", f, r.stderr.strip()[:300]); sys.exit(1)
    print("made", out, os.path.getsize(out) // 1024, "kB from", os.path.getsize(f) // 1024, "kB")
