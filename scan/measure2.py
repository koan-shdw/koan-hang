"""Measure from the raw scan (de-rotated): the red intro wall by its colour, the plants above it, the stone figure, the
front glass frame uprights on the courtyard side, the ceiling lights (bright spots), the aircon boxes, the rib direction."""
import trimesh, numpy as np
ROT = 1.79
scene = trimesh.load("scan/raw/9_2_2026.glb", force="scene")
th = np.radians(-ROT); R = np.array([[np.cos(th), 0, np.sin(th)], [0, 1, 0], [-np.sin(th), 0, np.cos(th)]])
tris, cols = [], []
for name, g in scene.geometry.items():
    V = g.vertices @ R.T; F = g.faces
    img = np.asarray(g.visual.material.baseColorTexture.convert("RGB"))
    fc = g.visual.uv[F].mean(axis=1)
    px = (fc[:, 0] * (img.shape[1] - 1)).astype(int).clip(0, img.shape[1] - 1)
    py = ((1 - fc[:, 1]) * (img.shape[0] - 1)).astype(int).clip(0, img.shape[0] - 1)
    cols.append(img[py, px].astype(float)); tris.append(V[F])
T = np.vstack(tris); Cc = np.vstack(cols)
C = T.mean(axis=1)
e1 = T[:, 1] - T[:, 0]; e2 = T[:, 2] - T[:, 0]; N = np.cross(e1, e2); A = np.linalg.norm(N, axis=1) / 2; N = N / (2 * A[:, None] + 1e-12)
r, g, b = Cc[:, 0], Cc[:, 1], Cc[:, 2]
G0, G1, F0, F1 = -5.54, -2.30, -2.14, 0.84

def stats(mask, label):
    p = C[mask]; w = A[mask]
    if w.sum() < 0.01: print(f"{label}: nothing"); return None
    print(f"{label}: area {w.sum():.2f} m2  x [{np.percentile(p[:,0],3):.2f}, {np.percentile(p[:,0],97):.2f}]  y [{np.percentile(p[:,1],3):.2f}, {np.percentile(p[:,1],97):.2f}]  z [{np.percentile(p[:,2],3):.2f}, {np.percentile(p[:,2],97):.2f}]")
    return p, w

# ---- red intro wall: rust red, vertical, in the courtyard (x > 0.3) ----
red = (r > 80) & (r > g * 1.5) & (r > b * 1.7) & (np.abs(N[:, 1]) < 0.3) & (C[:, 0] > 0.3) & (C[:, 1] < -2.0)
res = stats(red, "RED faces (vertical, courtyard)")
if res:
    p, w = res
    nx, nz = np.average(np.abs(N[red][:, 0]), weights=w), np.average(np.abs(N[red][:, 2]), weights=w)
    axis = 0 if nx > nz else 2
    print(f"   faces mostly point along {'x' if axis == 0 else 'z'} -> the wall runs along {'z' if axis == 0 else 'x'}")
    # position along its normal (weighted mean), split by normal sign (two faces of the wall = thickness)
    sgn = np.sign(N[red][:, axis])
    for s_ in (-1, 1):
        m = sgn == s_
        if w[m].sum() > 0.05: print(f"   face normal {'+' if s_ > 0 else '-'}{'xz'[axis // 2]}: plane at {np.average(p[m, axis], weights=w[m]):.3f}, area {w[m].sum():.2f}")
    along = 2 if axis == 0 else 0
    print(f"   extent along the wall: {np.percentile(p[:, along], 2):.2f} .. {np.percentile(p[:, along], 98):.2f}   top y {np.percentile(p[:, 1], 98):.2f} = {np.percentile(p[:, 1], 98) - G0:.2f} m above the yard floor")
    # 5 cm histogram along the wall, to see its true ends
    h, e = np.histogram(p[:, along], bins=np.arange(-1, 8, 0.1), weights=w)
    print("   area by 10 cm along:", " ".join(f"{e[i]:.1f}:{h[i]:.2f}" for i in range(len(h)) if h[i] > 0.02))
    hy, ey = np.histogram(p[:, 1], bins=np.arange(G0, -2.0, 0.1), weights=w)
    print("   area by 10 cm height:", " ".join(f"{ey[i] - G0:.1f}:{hy[i]:.2f}" for i in range(len(hy)) if hy[i] > 0.02))

# ---- plants: green, near the red wall, above it ----
green = (g > r * 1.15) & (g > b * 1.15) & (g > 60) & (C[:, 0] > 0.3) & (C[:, 1] < -1.0)
stats(green, "GREEN faces (plants, courtyard)")

# ---- stone figure: grey, vertical-ish, low, near the red wall's end ----
grey = (np.abs(r - g) < 25) & (np.abs(g - b) < 25) & (r > 70) & (r < 170) & (C[:, 0] > 0.3) & (C[:, 0] < 1.5) & (C[:, 1] < G0 + 1.3) & (C[:, 1] > G0 + 0.1)
stats(grey, "GREY low faces near the glass corner (figure candidates)")

# ---- ceiling lights: very bright texels just under each ceiling, inside the room ----
for lvl, cy in (("ground", G1), ("second", F1)):
    bright = (r > 235) & (g > 225) & (b > 200) & (C[:, 1] > cy - 0.45) & (C[:, 1] < cy + 0.02) & (C[:, 0] > -5.8) & (C[:, 0] < 0.2) & (C[:, 2] > -2.4) & (C[:, 2] < 2.7)
    p = C[bright]; w = A[bright]
    print(f"\nLIGHTS {lvl}: bright faces area {w.sum():.3f}")
    # cluster on a 0.3 m grid
    from collections import defaultdict
    cl = defaultdict(float)
    for (x, y, z), a in zip(p, w): cl[(round(x / 0.3), round(z / 0.3))] += a
    top = sorted(cl.items(), key=lambda kv: -kv[1])[:16]
    print("   spots (x, z, area):", " ".join(f"({k[0]*0.3:.1f},{k[1]*0.3:.1f},{v:.3f})" for k, v in top))
    # aircon: down-facing faces hanging 5..40 cm under the ceiling, any colour, big cluster
    hang = (N[:, 1] < -0.8) & (C[:, 1] > cy - 0.40) & (C[:, 1] < cy - 0.05) & (C[:, 0] > -5.8) & (C[:, 0] < 0.2) & (C[:, 2] > -2.4) & (C[:, 2] < 2.7)
    p2 = C[hang]; w2 = A[hang]
    cl2 = defaultdict(float)
    for (x, y, z), a in zip(p2, w2): cl2[(round(x / 0.5), round(z / 0.5))] += a
    big = sorted(cl2.items(), key=lambda kv: -kv[1])[:4]
    print("   hanging boxes (x, z, area):", " ".join(f"({k[0]*0.5:.1f},{k[1]*0.5:.1f},{v:.2f})" for k, v in big))
    # rib direction: near-horizontal faces at the ceiling; ridges vary along the axis with the larger normal component
    rib = (N[:, 1] > 0.5) & (N[:, 1] < 0.97) & (C[:, 1] > cy - 0.12) & (C[:, 1] < cy + 0.05) & (C[:, 0] > -5.8) & (C[:, 0] < 0.2)
    if rib.sum():
        print(f"   ribs: mean |nx| {np.average(np.abs(N[rib][:,0]), weights=A[rib]):.2f} vs |nz| {np.average(np.abs(N[rib][:,2]), weights=A[rib]):.2f} -> ridges run along {'z' if np.average(np.abs(N[rib][:,0]), weights=A[rib]) > np.average(np.abs(N[rib][:,2]), weights=A[rib]) else 'x'}")

# ---- front glass uprights seen from the courtyard: vertical faces just outside the glass line, by z ----
fr = (np.abs(N[:, 0]) > 0.8) & (C[:, 0] > 0.18) & (C[:, 0] < 0.40) & (C[:, 1] > G0 + 0.3) & (C[:, 1] < G1 - 0.3)
p = C[fr]; w = A[fr]
h, e = np.histogram(p[:, 2], bins=np.arange(-2.5, 3.0, 0.05), weights=w)
print("\nFRONT uprights (x-facing faces at x 0.18..0.40), area per 5 cm of z:")
print("   " + " ".join(f"{e[i]:.2f}:{h[i]:.2f}" for i in range(len(h)) if h[i] > 0.03))
# horizontal bars: y-facing faces near the glass line
bar = (np.abs(N[:, 1]) > 0.8) & (C[:, 0] > 0.15) & (C[:, 0] < 0.40) & (C[:, 1] > G0 + 0.3) & (C[:, 1] < G1 - 0.2)
p = C[bar]; w = A[bar]
h, e = np.histogram(p[:, 1], bins=np.arange(G0, G1, 0.05), weights=w)
print("FRONT bars (y-facing faces at the glass line), area per 5 cm of height above the floor:")
print("   " + " ".join(f"{e[i] - G0:.2f}:{h[i]:.2f}" for i in range(len(h)) if h[i] > 0.02))
