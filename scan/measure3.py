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
T = np.vstack(tris); Cc = np.vstack(cols); C = T.mean(axis=1)
e1 = T[:, 1] - T[:, 0]; e2 = T[:, 2] - T[:, 0]; N = np.cross(e1, e2); A = np.linalg.norm(N, axis=1) / 2; N = N / (2 * A[:, None] + 1e-12)
r, g, b = Cc[:, 0], Cc[:, 1], Cc[:, 2]
G0 = -5.54
side = (C[:, 0] > 0.25) & (C[:, 0] < 6.0) & (C[:, 2] < -1.8) & (C[:, 1] < -2.0)
def show(mask, label):
    p = C[mask]; w = A[mask]
    if w.sum() < 0.02: print(label, "nothing"); return
    print(f"{label}: area {w.sum():.2f}  x [{np.percentile(p[:,0],3):.2f},{np.percentile(p[:,0],97):.2f}]  y [{np.percentile(p[:,1],3):.2f},{np.percentile(p[:,1],97):.2f}] (above floor {np.percentile(p[:,1],3)-G0:.2f}..{np.percentile(p[:,1],97)-G0:.2f})  z [{np.percentile(p[:,2],3):.2f},{np.percentile(p[:,2],97):.2f}]")
    return p, w
rust = side & (r > 45) & (r > g * 1.25) & (r > b * 1.35) & (np.abs(N[:, 1]) < 0.4)
res = show(rust, "RUST vertical faces, door-side of the yard")
if res:
    p, w = res
    for axis, nm in ((2, 'z'), (0, 'x')):
        m = np.abs(N[rust][:, axis]) > 0.8
        if w[m].sum() > 0.05:
            h, e = np.histogram(p[m, axis], bins=np.arange(-4.6, 6.0, 0.05), weights=w[m])
            print(f"   faces normal along {nm}: area by 5 cm of {nm}:", " ".join(f"{e[i]:.2f}:{h[i]:.2f}" for i in range(len(h)) if h[i] > 0.03))
            other = 0 if axis == 2 else 2
            ho, eo = np.histogram(p[m, other], bins=np.arange(-4.6, 6.0, 0.1), weights=w[m])
            print(f"   ...extent along {'xz'[other//2]}:", " ".join(f"{eo[i]:.1f}:{ho[i]:.2f}" for i in range(len(ho)) if ho[i] > 0.02))
            hy, ey = np.histogram(p[m, 1] - G0, bins=np.arange(0, 3.5, 0.1), weights=w[m])
            print(f"   ...height above floor:", " ".join(f"{ey[i]:.1f}:{hy[i]:.2f}" for i in range(len(hy)) if hy[i] > 0.02))
green = side & (g > r * 1.1) & (g > b * 1.1) & (g > 50)
res = show(green, "GREEN, door-side")
if res:
    p, w = res
    hy, ey = np.histogram(p[:, 1] - G0, bins=np.arange(0, 3.5, 0.2), weights=w); print("   plants height above floor:", " ".join(f"{ey[i]:.1f}:{hy[i]:.2f}" for i in range(len(hy)) if hy[i] > 0.02))
    hz, ez = np.histogram(p[:, 2], bins=np.arange(-4.6, -1.5, 0.2), weights=w); print("   plants by z:", " ".join(f"{ez[i]:.1f}:{hz[i]:.2f}" for i in range(len(hz)) if hz[i] > 0.02))
    hx, ex = np.histogram(p[:, 0], bins=np.arange(0, 6, 0.2), weights=w); print("   plants by x:", " ".join(f"{ex[i]:.1f}:{hx[i]:.2f}" for i in range(len(hx)) if hx[i] > 0.02))
# statue: faces between the glass line and x 1.2, z -3.2..-2.2, 0.1..1.3 m up, not rust, not green
stat = (C[:, 0] > 0.25) & (C[:, 0] < 1.3) & (C[:, 2] > -3.3) & (C[:, 2] < -2.2) & (C[:, 1] > G0 + 0.1) & (C[:, 1] < G0 + 1.4) & ~rust & ~green
res = show(stat, "FIGURE candidates by the glass corner")
if res:
    p, w = res
    hx, ex = np.histogram(p[:, 0], bins=np.arange(0.2, 1.4, 0.1), weights=w); print("   by x:", " ".join(f"{ex[i]:.1f}:{hx[i]:.2f}" for i in range(len(hx)) if hx[i] > 0.01))
    hz, ez = np.histogram(p[:, 2], bins=np.arange(-3.3, -2.1, 0.1), weights=w); print("   by z:", " ".join(f"{ez[i]:.1f}:{hz[i]:.2f}" for i in range(len(hz)) if hz[i] > 0.01))
# all vertical faces on that side by z: where are the walls?
vert = side & (np.abs(N[:, 2]) > 0.85)
p = C[vert]; w = A[vert]
h, e = np.histogram(p[:, 2], bins=np.arange(-4.6, -1.8, 0.05), weights=w)
print("ALL z-facing faces door-side, area by 5 cm of z:", " ".join(f"{e[i]:.2f}:{h[i]:.2f}" for i in range(len(h)) if h[i] > 0.05))
