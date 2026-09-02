import trimesh, numpy as np, matplotlib
matplotlib.use('Agg'); import matplotlib.pyplot as plt
from matplotlib.collections import PolyCollection
s = trimesh.load("scan/raw/9_2_2026.glb", force='scene')
m = s.to_geometry()
# per-face colour from texture
cols = np.zeros((0,3))
for name,gm in s.geometry.items():
    img = np.asarray(gm.visual.material.baseColorTexture.convert('RGB'))
    uv = gm.visual.uv; fc = uv[gm.faces].mean(axis=1)
    px = (fc[:,0]*(img.shape[1]-1)).astype(int).clip(0,img.shape[1]-1)
    py = ((1-fc[:,1])*(img.shape[0]-1)).astype(int).clip(0,img.shape[0]-1)
    cols = np.vstack([cols, img[py,px]/255.0])
tri = m.triangles; ctr = m.triangles_center; nrm = m.face_normals
def plot(mask, fname, title, sortkey=None):
    fig, ax = plt.subplots(figsize=(14,9), dpi=110)
    idx = np.where(mask)[0]
    if sortkey is not None: idx = idx[np.argsort(sortkey[idx])]
    polys = tri[idx][:,:,[0,2]]
    pc = PolyCollection(polys, facecolors=cols[idx], edgecolors='none')
    ax.add_collection(pc); ax.set_xlim(-9.5,8); ax.set_ylim(-5.5,5.5); ax.set_aspect('equal')
    ax.set_title(title); ax.grid(True, alpha=.3); ax.set_xticks(range(-9,9)); ax.set_yticks(range(-5,6))
    fig.savefig(f"scan/{fname}", bbox_inches='tight'); plt.close(fig)
y = ctr[:,1]
# ground floor: everything below first-floor slab, seen from above (highest painted last)
plot(y < -2.6, "plan_ground.png", "Ground floor, top-down, all geometry y < -2.6", sortkey=y)
plot((y >= -2.6) & (y < 0.6), "plan_first.png", "First floor, top-down, geometry -2.6 <= y < 0.6", sortkey=y)
# wall footprints: vertical faces only, by floor
v = np.abs(nrm[:,1]) < 0.15
plot(v & (y < -2.6), "walls_ground.png", "Ground floor vertical faces (walls) footprint")
plot(v & (y >= -2.6) & (y < 0.6), "walls_first.png", "First floor vertical faces (walls) footprint")
# elevation side views
def elev(mask, fname, title, axes):
    fig, ax = plt.subplots(figsize=(16,8), dpi=110)
    idx = np.where(mask)[0]; idx = idx[np.argsort(-ctr[idx][:, 3-sum(axes)] if False else ctr[idx][:, [a for a in (0,1,2) if a not in axes][0]])]
    pc = PolyCollection(tri[idx][:,:,list(axes)], facecolors=cols[idx], edgecolors='none')
    ax.add_collection(pc); ax.autoscale(); ax.set_aspect('equal'); ax.grid(True, alpha=.3); ax.set_title(title)
    fig.savefig(f"scan/{fname}", bbox_inches='tight'); plt.close(fig)
elev(np.ones(len(y),bool), "elev_xy.png", "Elevation looking along Z (x horizontal, y up)", (0,1))
elev(np.ones(len(y),bool), "elev_zy.png", "Elevation looking along X (z horizontal, y up)", (2,1))
print("done")
