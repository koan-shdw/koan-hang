"""Straight-down colour ortho of the courtyard floor from the RAW scan (de-rotated), 1 cm cells, up-facing faces only,
higher faces drawn last. Writes scan/yard_ortho.png (true colour), scan/yard_class.png (colour classes) and prints the
axis-aligned boxes of every red tile, slate cell, dirt bed and the floor outline to scan/yard_boxes.json."""
import trimesh, numpy as np, json
from PIL import Image, ImageDraw
from scipy import ndimage
ROT = 1.79
G0 = -5.54
X0, X1, Z0, Z1 = -0.5, 8.0, -4.6, 5.2      # world window (x across, z along)
CELL = 0.01
scene = trimesh.load("scan/raw/9_2_2026.glb", force="scene")
th = np.radians(-ROT); R = np.array([[np.cos(th), 0, np.sin(th)], [0, 1, 0], [-np.sin(th), 0, np.cos(th)]])
tris, cols = [], []
for name, g in scene.geometry.items():
    V = g.vertices @ R.T; F = g.faces
    img = np.asarray(g.visual.material.baseColorTexture.convert("RGB"))
    fc = g.visual.uv[F].mean(axis=1)
    px = (fc[:, 0] * (img.shape[1] - 1)).astype(int).clip(0, img.shape[1] - 1)
    py = ((1 - fc[:, 1]) * (img.shape[0] - 1)).astype(int).clip(0, img.shape[0] - 1)
    cols.append(img[py, px]); tris.append(V[F])
T = np.vstack(tris); Cc = np.vstack(cols)
C = T.mean(axis=1)
e1 = T[:, 1] - T[:, 0]; e2 = T[:, 2] - T[:, 0]; N = np.cross(e1, e2); N = N / (np.linalg.norm(N, axis=1)[:, None] + 1e-12)
up = (N[:, 1] > 0.6) & (C[:, 1] > G0 - 0.25) & (C[:, 1] < G0 + 0.30) & (C[:, 0] > X0) & (C[:, 0] < X1) & (C[:, 2] > Z0) & (C[:, 2] < Z1)
idx = np.where(up)[0]
idx = idx[np.argsort(C[idx, 1])]           # low first, high last
W = int(round((X1 - X0) / CELL)); H = int(round((Z1 - Z0) / CELL))
im = Image.new("RGB", (W, H), (0, 0, 0)); d = ImageDraw.Draw(im)
hm = Image.new("F", (W, H), -99.0); dh = ImageDraw.Draw(hm)
for i in idx:
    t = T[i]
    poly = [((v[0] - X0) / CELL, (v[2] - Z0) / CELL) for v in t]
    d.polygon(poly, fill=tuple(int(c) for c in Cc[i]))
    dh.polygon(poly, fill=float(C[i, 1] - G0))
im.save("scan/yard_ortho.png")
A = np.asarray(im).astype(float); Hgt = np.asarray(hm); np.save("scan/yard_height.npy", Hgt)
r, g, b = A[..., 0], A[..., 1], A[..., 2]
seen = (r + g + b) > 0
red = seen & (r - b >= 35) & (r - g >= 22) & (g - b < 25)
green = seen & (g > r + 10) & (g > b + 10)
dirt = seen & ~red & ~green & (g - b >= 30) & (r - b >= 40)
lum = (r + g + b) / 3
slate = seen & ~red & ~green & ~dirt & (b >= r - 3) & (lum < 225)
concrete = seen & ~red & ~green & ~dirt & ~slate
def solid(m, it):
    return ndimage.binary_opening(ndimage.binary_closing(m, iterations=it), iterations=it)
red = solid(red, 4); slate = solid(slate, 5); dirt = solid(dirt, 5)
cls = np.zeros((H, W, 3), np.uint8)
cls[concrete] = (200, 200, 200); cls[slate] = (110, 95, 130); cls[red] = (200, 70, 50); cls[dirt] = (140, 100, 60); cls[green] = (60, 160, 60)
Image.fromarray(cls).save("scan/yard_class.png")

def boxes(mask, min_area_cells, label, open_px=3):
    m = ndimage.binary_opening(mask, iterations=open_px)
    m = ndimage.binary_closing(m, iterations=2)
    lab, n = ndimage.label(m)
    out = []
    for k in range(1, n + 1):
        ys, xs = np.where(lab == k)
        if len(xs) < min_area_cells: continue
        bx = dict(kind=label, x0=round(X0 + xs.min() * CELL, 2), x1=round(X0 + (xs.max() + 1) * CELL, 2),
                  z0=round(Z0 + ys.min() * CELL, 2), z1=round(Z0 + (ys.max() + 1) * CELL, 2), cells=int(len(xs)),
                  lift=round(float(np.median(Hgt[ys, xs])), 3))
        bx["fill"] = round(len(xs) / ((xs.max() - xs.min() + 1) * (ys.max() - ys.min() + 1)), 2)
        out.append(bx)
    out.sort(key=lambda b: (b["z0"], b["x0"]))
    return out
res = dict(window=dict(x0=X0, x1=X1, z0=Z0, z1=Z1, cell=CELL))
res["red"] = boxes(red, 1500, "red", open_px=1)
res["slate"] = boxes(slate, 1200, "slate", open_px=1)
res["dirt"] = boxes(dirt, 4000, "dirt", open_px=1)
res["green"] = boxes(green, 800, "green")
res["floor"] = boxes(seen, 5000, "floor", open_px=2)
json.dump(res, open("scan/yard_boxes.json", "w"), indent=1)
for k in ("red", "slate", "dirt", "green", "floor"):
    print(f"\n{k}: {len(res[k])}")
    for b_ in res[k]: print(f"   x {b_['x0']:6.2f}..{b_['x1']:6.2f}  z {b_['z0']:6.2f}..{b_['z1']:6.2f}  {b_['x1']-b_['x0']:.2f} x {b_['z1']-b_['z0']:.2f}  lift {b_['lift']:+.3f} fill {b_['fill']}")

# floor outline, 10 cm ascii (x across, z down)
S = 10
m = seen.reshape(H // S, S, W // S, S).mean(axis=(1, 3)) > 0.5
print("\nfloor outline, 10 cm cells, x from %.1f (|=1 m), z rows" % X0)
print("       " + "".join("|" if k % 10 == 0 else " " for k in range(W // S)))
for j in range(H // S):
    print(f"{Z0 + j * S * CELL:6.1f} " + "".join("#" if m[j, k] else "." for k in range(W // S)))
