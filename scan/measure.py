"""measure openings on the east wall and the stair treads from the cleaned scan (de-rotated)."""
import trimesh, numpy as np
s = trimesh.load("level/scan.clean.glb", force="scene"); m = s.to_geometry()
c = m.triangles_center; n = m.face_normals; a = m.area_faces

def wall_grid(mask, along, label, cell=0.1):
    p = c[mask]; w = a[mask]
    z0, z1 = np.floor(p[:, along].min() * 10) / 10, np.ceil(p[:, along].max() * 10) / 10
    y0, y1 = np.floor(p[:, 1].min() * 10) / 10, np.ceil(p[:, 1].max() * 10) / 10
    nz = int(round((z1 - z0) / cell)); ny = int(round((y1 - y0) / cell))
    g = np.zeros((ny, nz))
    iz = ((p[:, along] - z0) / cell).astype(int).clip(0, nz - 1); iy = ((p[:, 1] - y0) / cell).astype(int).clip(0, ny - 1)
    np.add.at(g, (iy, iz), w)
    print(f"\n## {label}  rows=y from {y1:.1f} down to {y0:.1f}, cols={'xyz'[along]} from {z0:.1f} to {z1:.1f}, cell {cell} m, # = face area > 0.002 m2")
    hdr = "      " + "".join(("|" if abs((z0 + k * cell) - round(z0 + k * cell)) < 1e-6 else " ") for k in range(nz))
    print(hdr)
    for r in range(ny - 1, -1, -1):
        y = y0 + r * cell
        print(f"{y:6.1f}" + "".join("#" if g[r, k] > 0.002 else "." for k in range(nz)))

# east wall of the room: x in 0.05..0.6, vertical faces facing -x
east = (c[:, 0] > 0.05) & (c[:, 0] < 0.6) & (np.abs(n[:, 0]) > 0.9) & (c[:, 2] > -2.6) & (c[:, 2] < 3.0)
wall_grid(east, 2, "EAST WALL x~0.22 (room side), both floors")
# south wall z~-2.42 and north z~2.72 for doors
south = (c[:, 2] > -2.7) & (c[:, 2] < -2.2) & (np.abs(n[:, 2]) > 0.9) & (c[:, 0] > -7.3) & (c[:, 0] < 0.7)
wall_grid(south, 0, "SOUTH WALL z~-2.42")
north = (c[:, 2] > 2.5) & (c[:, 2] < 3.0) & (np.abs(n[:, 2]) > 0.9) & (c[:, 0] > -7.5) & (c[:, 0] < 0.7)
wall_grid(north, 0, "NORTH WALL z~2.72")
west1 = (c[:, 0] > -7.3) & (c[:, 0] < -6.9) & (np.abs(n[:, 0]) > 0.9)
wall_grid(west1, 2, "WEST WALL x~-7.06 (hallway west)")
stairwall = (c[:, 0] > -6.0) & (c[:, 0] < -5.75) & (np.abs(n[:, 0]) > 0.9)
wall_grid(stairwall, 2, "STAIR WALL x~-5.89")

# stair treads: up-facing faces in the hallway
st = (n[:, 1] > 0.9) & (c[:, 0] > -7.1) & (c[:, 0] < -5.85) & (c[:, 1] > -5.45) & (c[:, 1] < -2.0)
p = c[st]; w = a[st]
h, e = np.histogram(p[:, 1], bins=np.arange(-5.5, -2.0, 0.02), weights=w)
print("\n## STAIR treads: y bins with area > 0.05 m2, and mean z of faces in that bin")
for k in range(len(h)):
    if h[k] > 0.05:
        sel = (p[:, 1] >= e[k]) & (p[:, 1] < e[k + 1])
        print(f"  y={e[k]:6.2f} area={h[k]:5.2f} z_mean={np.average(p[sel, 2], weights=w[sel]):6.2f} z=[{p[sel,2].min():.2f},{p[sel,2].max():.2f}]")
