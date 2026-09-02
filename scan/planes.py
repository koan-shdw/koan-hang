import trimesh, numpy as np
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components
s = trimesh.load("scan/raw/9_2_2026.glb", force='scene')
m = s.to_geometry()
# estimate rotation: dominant wall direction
nrm = m.face_normals; area = m.area_faces
v = np.abs(nrm[:,1]) < 0.1
ang = np.degrees(np.arctan2(nrm[v,2], nrm[v,0])) % 90
h,e = np.histogram(ang, bins=180, range=(0,90), weights=area[v])
peak = e[np.argmax(h)] + 0.25
# robust: mean of angles within +-3 of peak
sel = np.abs(((ang-peak)+45)%90-45) < 3
rot = np.average(((ang[sel]-peak+45)%90-45), weights=area[v][sel]) + peak
print("dominant wall direction (deg mod 90):", round(rot,2))
theta = np.radians(-rot)  # rotate so walls align with x/z
R = np.array([[np.cos(theta),0,np.sin(theta)],[0,1,0],[-np.sin(theta),0,np.cos(theta)]])
V = m.vertices @ R.T
m2 = trimesh.Trimesh(V, m.faces, process=False)
nrm = m2.face_normals; area = m2.area_faces; ctr = m2.triangles_center
print("rotated bounds:", np.round(m2.bounds,2).tolist())
def report_planes(mask, axis, label, binw=0.05, minarea=1.5):
    c = ctr[mask][:,axis]; a = area[mask]
    lo, hi = c.min(), c.max()
    bins = np.arange(lo, hi+binw, binw)
    h,_ = np.histogram(c, bins=bins, weights=a)
    print(f"--- {label}: planes with area > {minarea} m2 (position along axis, area, extent of the other axes)")
    i=0
    while i < len(h):
        if h[i] > 0:
            j=i
            while j+1 < len(h) and h[j+1] > 0.3: j+=1
            tot = h[i:j+1].sum()
            if tot > minarea:
                sel = mask.copy(); idx = np.where(mask)[0]
                pick = idx[(c >= bins[i]) & (c < bins[j+1])]
                pts = ctr[pick]; w = area[pick]
                pos = np.average(pts[:,axis], weights=w)
                others = [k for k in (0,1,2) if k!=axis]
                lo1, hi1 = np.percentile(pts[:,others[0]], [2,98]); lo2, hi2 = np.percentile(pts[:,others[1]], [2,98])
                print(f"  pos={pos:6.2f}  area={tot:6.2f}  {'xyz'[others[0]]}:[{lo1:6.2f},{hi1:6.2f}]  {'xyz'[others[1]]}:[{lo2:6.2f},{hi2:6.2f}]")
            i=j+1
        else: i+=1
horiz = np.abs(nrm[:,1]) > 0.95
report_planes(horiz, 1, "HORIZONTAL (floors/ceilings), y")
wx = (np.abs(nrm[:,0]) > 0.97)
wz = (np.abs(nrm[:,2]) > 0.97)
report_planes(wx, 0, "WALLS facing +-X (position x)", minarea=1.0)
report_planes(wz, 2, "WALLS facing +-Z (position z)", minarea=1.0)
print("area of walls not axis-aligned (vertical, |nx|,|nz| both < .97):", round(float(area[(np.abs(nrm[:,1])<0.1) & ~wx & ~wz].sum()),2))
np.save("scan/rot_deg.npy", rot)
