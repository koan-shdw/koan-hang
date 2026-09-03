"""Contact sheets of the bake: per material, the baked image next to its hole mask, coverage in the corner, plus one
overview sheet of every material. docs/sheet/tex-<material>.jpg and docs/sheet/tex-overview.jpg (docs/TEXTURES.md D)."""
import json, os
from PIL import Image, ImageDraw
idx = json.load(open("scan/bake/index.json"))
os.makedirs("docs/sheet", exist_ok=True)
tiles = []
for m, e in idx.items():
    img = Image.open(f"scan/bake/{m}.png").convert("RGB"); msk = Image.open(f"scan/bake/{m}.mask.png").convert("RGB")
    W, H = img.size; sc = min(1.0, 1200 / W, 1200 / H); w, h = int(W * sc), int(H * sc)
    sheet = Image.new("RGB", (w * 2 + 12, h + 40), (30, 30, 30))
    sheet.paste(img.resize((w, h)), (4, 36)); sheet.paste(msk.resize((w, h)), (w + 8, 36))
    d = ImageDraw.Draw(sheet); d.text((6, 8), f"{m}   {W}x{H} px at {e['ppc']} px/cm   {len(e['faces'])} faces   coverage {e['coverage']}%   left bake, right hits", fill=(0, 255, 160))
    sheet.save(f"docs/sheet/tex-{m}.jpg", quality=85)
    t = img.resize((300, max(1, int(300 * H / W)))) if W >= H else img.resize((max(1, int(300 * W / H)), 300))
    tiles.append((m, e["coverage"], t))
cols = 4; rows = (len(tiles) + cols - 1) // cols
ov = Image.new("RGB", (cols * 310, rows * 330), (30, 30, 30)); d = ImageDraw.Draw(ov)
for i, (m, c, t) in enumerate(tiles):
    x, y = (i % cols) * 310 + 5, (i // cols) * 330 + 22
    ov.paste(t, (x, y)); d.text((x, y - 16), f"{m}  {c}%", fill=(0, 255, 160))
ov.save("docs/sheet/tex-overview.jpg", quality=85)
print("sheets:", len(tiles))
