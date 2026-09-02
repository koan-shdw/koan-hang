import trimesh, numpy as np
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components
s = trimesh.load("scan/raw/9_2_2026.glb", force='scene')
m = s.to_geometry()
print("total faces", len(m.faces), "verts", len(m.vertices))
print("bounds (m):", np.round(m.bounds,2).tolist())
print("extents (m):", np.round(m.extents,2).tolist())
# connected components via face adjacency
adj = m.face_adjacency
n = len(m.faces)
g = coo_matrix((np.ones(len(adj)), (adj[:,0], adj[:,1])), shape=(n,n))
ncomp, labels = connected_components(g, directed=False)
area = m.area_faces
sizes = np.bincount(labels, weights=area)
counts = np.bincount(labels)
order = np.argsort(-sizes)
print("components", ncomp)
print("top 12 by area (m2, faces):", [(round(float(sizes[i]),2), int(counts[i])) for i in order[:12]])
small = counts < 200
print("components <200 faces:", int(small.sum()), "faces in them:", int(counts[small].sum()), "area:", round(float(sizes[small].sum()),2))
print("area total", round(float(m.area),2))
nrm = m.face_normals
up = np.abs(nrm[:,1])
print("area horizontal (|ny|>0.9)", round(float(area[up>0.9].sum()),2))
print("area vertical (|ny|<0.1)", round(float(area[up<0.1].sum()),2))
hy = m.triangles_center[up>0.9][:,1]
hist, edges = np.histogram(hy, bins=75, range=(m.bounds[0,1], m.bounds[1,1]), weights=area[up>0.9])
print("horizontal-surface height histogram (y, m2):")
for h,e in zip(hist,edges):
    if h>1.0: print(f"  y={e:6.2f}  {h:7.2f}")
vn = nrm[up<0.1]; va = area[up<0.1]
ang = np.degrees(np.arctan2(vn[:,2], vn[:,0])) % 180
hist, edges = np.histogram(ang, bins=36, range=(0,180), weights=va)
print("wall angle histogram (deg, m2):")
for h,e in zip(hist,edges):
    if h>1: print(f"  {e:6.1f}  {h:7.2f}")
# black patches: check vertex colors / texture darkness by sampling UVs
try:
    from PIL import Image
    dark_area=0.0
    for name,gm in s.geometry.items():
        img = gm.visual.material.baseColorTexture
        if img is None: continue
        im = np.asarray(img.convert('L'))
        uv = gm.visual.uv
        fc_uv = uv[gm.faces].mean(axis=1)
        px = (fc_uv[:,0]*(im.shape[1]-1)).astype(int).clip(0,im.shape[1]-1)
        py = ((1-fc_uv[:,1])*(im.shape[0]-1)).astype(int).clip(0,im.shape[0]-1)
        lum = im[py,px]
        dark = lum < 12
        dark_area += gm.area_faces[dark].sum()
    print("area with near-black texture (lum<12):", round(float(dark_area),2))
except Exception as e:
    print("texture check failed", e)
