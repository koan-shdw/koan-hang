"""Sculpture prep (docs/ART.md s5, REMAKE.md R4): a heavy OBJ -> a web GLB.

  python art/sculpt/prep.py "path/to/YOZO vol 2.obj" --id yozo-vol-2 --title "YOZO vol 2" [--budget 200000]

Steps: load (groups kept), triangulate, decimate per group to a shared triangle budget (pyfqmr), recompute normals,
box-projected UVs in METRES (so a tile field in cm and the picker work in the app), origin to the base centre
(feet on y=0, centred in x/z), write art/sculpt/<id>.glb, Draco-compress it with gltf-transform when npx is there,
and add / update the entry in art/index.json with the bounds in cm. Thumbnail: the app renders it on first load.
"""
import argparse, json, os, subprocess, sys, shutil
import numpy as np
import trimesh

HERE = os.path.dirname(os.path.abspath(__file__))
ART = os.path.dirname(HERE)
INDEX = os.path.join(ART, 'index.json')


def load_groups(path):
    scene = trimesh.load(path, force='scene', split_object=True, group_material=False, process=False)
    out = []
    for name, geom in scene.geometry.items():
        if not isinstance(geom, trimesh.Trimesh) or len(geom.faces) == 0:
            continue
        out.append((name, geom))
    if not out:
        m = trimesh.load(path, force='mesh', process=False)
        out = [('mesh', m)]
    return out


def decimate(mesh, target):
    if len(mesh.faces) <= target:
        return mesh
    import pyfqmr
    s = pyfqmr.Simplify()
    s.setMesh(np.asarray(mesh.vertices, dtype=np.float64), np.asarray(mesh.faces, dtype=np.int32))
    s.simplify_mesh(target_count=int(target), aggressiveness=7, preserve_border=True, verbose=0)
    v, f, _ = s.getMesh()
    return trimesh.Trimesh(vertices=v, faces=f, process=False)


def box_uv(mesh):
    """box projection in metres, per VERTEX by its smooth normal's axis, so the mesh stays welded and smooth-shaded
    (a seam triangle stretches a little where the axis flips; the tiles hide it)"""
    n = np.abs(mesh.vertex_normals)
    axis = np.argmax(n, axis=1)
    v = mesh.vertices
    uv = np.zeros((len(v), 2))
    uv[axis == 0] = v[axis == 0][:, [2, 1]]
    uv[axis == 1] = v[axis == 1][:, [0, 2]]
    uv[axis == 2] = v[axis == 2][:, [0, 1]]
    m = trimesh.Trimesh(vertices=v, faces=mesh.faces, process=False)
    m.visual = trimesh.visual.TextureVisuals(uv=uv)
    _ = m.vertex_normals   # cached -> exported as NORMAL
    return m


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('obj'); ap.add_argument('--id', required=True); ap.add_argument('--title', required=True)
    ap.add_argument('--budget', type=int, default=200_000); ap.add_argument('--scale', type=float, default=1.0, help='source units -> metres')
    a = ap.parse_args()
    groups = load_groups(a.obj)
    total = sum(len(g.faces) for _, g in groups)
    print(f'{len(groups)} groups, {total:,} faces')
    scene = trimesh.Scene()
    allv = []
    for name, g in groups:
        share = max(500, int(a.budget * len(g.faces) / max(total, 1)))
        g = decimate(g, share)
        g.apply_scale(a.scale)
        allv.append(g.vertices)
        scene.add_geometry(g, node_name=name, geom_name=name)
    v = np.vstack(allv)
    lo, hi = v.min(axis=0), v.max(axis=0)
    shift = np.array([(lo[0] + hi[0]) / 2, lo[1], (lo[2] + hi[2]) / 2])
    out = trimesh.Scene()
    for name, g in scene.geometry.items():
        g = g.copy(); g.apply_translation(-shift)
        g.fix_normals()
        g = box_uv(g)
        out.add_geometry(g, node_name=name, geom_name=name)
    size = hi - lo
    os.makedirs(HERE, exist_ok=True)
    glb = os.path.join(HERE, f'{a.id}.glb')
    out.export(glb)
    print(f'wrote {glb} {os.path.getsize(glb) // 1024} kB, size {size[0]:.2f} x {size[1]:.2f} x {size[2]:.2f} m')
    npx = shutil.which('npx') or shutil.which('npx.cmd')
    if npx:
        tmp = glb + '.draco.glb'
        r = subprocess.run([npx, '--yes', '@gltf-transform/cli', 'draco', glb, tmp], capture_output=True, text=True)
        if r.returncode == 0 and os.path.exists(tmp):
            os.replace(tmp, glb); print(f'draco: {os.path.getsize(glb) // 1024} kB')
        else:
            print('draco skipped:', (r.stderr or r.stdout).strip()[:200])
    idx = {'format': 'koan-hang-art/2', 'items': []}
    if os.path.exists(INDEX):
        try: idx = json.load(open(INDEX, encoding='utf-8'))
        except Exception: pass
    idx['format'] = 'koan-hang-art/2'
    idx['items'] = [i for i in idx.get('items', []) if i.get('id') != a.id]
    idx['items'].append({'id': a.id, 'kind': 'sculpture', 'title': a.title, 'model': f'sculpt/{a.id}.glb',
                         'w': round(float(size[0]) * 100), 'h': round(float(size[1]) * 100), 'd': round(float(size[2]) * 100),
                         'edge': 'wrap', 'colour': '#f2f2ee', 'texture': None, 'plinth': {'w': 40, 'd': 40, 'h': 100, 'colour': '#f4f4f0'}})
    json.dump(idx, open(INDEX, 'w', encoding='utf-8'), indent=1)
    print('index updated')


if __name__ == '__main__':
    main()
