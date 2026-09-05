"""Bake the G1 URDF + loose STLs into ONE self-contained GLB.

Node names match URDF joint names, so the articulation survives and three.js
can pose it with plain GLTFLoader — no urdf-loader, no runtime STL fetching.
"""
import os, sys, xml.etree.ElementTree as ET
import numpy as np, trimesh

URDF = sys.argv[1] if len(sys.argv) > 1 else 'web/public/g1/g1_23dof.urdf'
OUT  = sys.argv[2] if len(sys.argv) > 2 else 'web/public/g1/g1.glb'
BASE = os.path.dirname(URDF)

root = ET.parse(URDF).getroot()

def rpy_xyz(el):
    T = np.eye(4)
    if el is None: return T
    r, p, y = [float(v) for v in el.get('rpy', '0 0 0').split()]
    T[:3, :3] = trimesh.transformations.euler_matrix(r, p, y, 'sxyz')[:3, :3]
    T[:3, 3]  = [float(v) for v in el.get('xyz', '0 0 0').split()]
    return T

# link name -> list of (mesh, transform)
links = {}
for link in root.findall('link'):
    parts = []
    for vis in link.findall('visual'):
        geo = vis.find('geometry/mesh')
        if geo is None: continue
        path = os.path.join(BASE, geo.get('filename'))
        if not os.path.exists(path): continue
        m = trimesh.load(path, force='mesh')
        s = geo.get('scale')
        if s: m.apply_scale([float(v) for v in s.split()])
        parts.append((m, rpy_xyz(vis.find('origin'))))
    links[link.get('name')] = parts

joints = [(j.get('name'), j.find('parent').get('link'), j.find('child').get('link'),
           rpy_xyz(j.find('origin')), j.get('type'))
          for j in root.findall('joint')]

children = set(c for _, _, c, _, _ in joints)
base = next(n for n in links if n not in children)

scene = trimesh.Scene()
def walk(link, parent_node):
    for mesh, T in links.get(link, []):
        scene.add_geometry(mesh, node_name=f'{link}_visual',
                           parent_node_name=parent_node, transform=T)
    for jname, p, c, T, jtype in joints:
        if p != link: continue
        node = scene.graph.nodes and jname
        scene.graph.update(frame_from=parent_node, frame_to=jname, matrix=T)
        walk(c, jname)

scene.graph.update(frame_from=scene.graph.base_frame, frame_to=base, matrix=np.eye(4))
walk(base, base)

# URDF is Z-up with +X forward. three.js is Y-up and rigs conventionally face +Z.
# Apply BOTH corrections here so no downstream app has to know or guess.
Zup     = trimesh.transformations.rotation_matrix(-np.pi / 2, [1, 0, 0])   # Z-up -> Y-up
Forward = trimesh.transformations.rotation_matrix(-np.pi / 2, [0, 1, 0])   # +X fwd -> +Z fwd
scene.apply_transform(Forward @ Zup)

os.makedirs(os.path.dirname(OUT), exist_ok=True)
scene.export(OUT)
n_mesh = len(scene.geometry)
print(f'baked {OUT}  meshes={n_mesh}  nodes={len(scene.graph.nodes)}  '
      f'{os.path.getsize(OUT)/1e6:.1f} MB')
print('joint nodes:', ', '.join(sorted(n for n, *_ in joints)[:6]), '...')

# joint axes + limits sidecar, so the browser can pose without re-reading the URDF
import json
meta = {}
for j in root.findall('joint'):
    if j.get('type') not in ('revolute', 'continuous'): continue
    ax = j.find('axis')
    lim = j.find('limit')
    meta[j.get('name')] = {
        'axis': [float(v) for v in (ax.get('xyz') if ax is not None else '0 0 1').split()],
        'lower': float(lim.get('lower')) if lim is not None and lim.get('lower') else -3.14,
        'upper': float(lim.get('upper')) if lim is not None and lim.get('upper') else 3.14,
    }
side = OUT.replace('.glb', '.joints.json')
json.dump(meta, open(side, 'w'), indent=0)
print(f'wrote {side}  revolute joints={len(meta)}')
