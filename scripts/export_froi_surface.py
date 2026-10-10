"""Bake NSD subj01's inflated cortical surface and its eight fROIs into a single GLB.

Run once and commit the result; the FreeSurfer inputs live outside the repo.

    python scripts/export_froi_surface.py --source ~/downloads/draw_nsd_s1

The output holds one grey base mesh per hemisphere plus one mesh per ROI per hemisphere,
named `base_lh` / `roi_lh_FFA` and so on, so the viewer can toggle ROIs by visibility alone
rather than rewriting colours. Hemispheres are centred individually because the viewer draws
each in its own viewport.
"""
import argparse
from pathlib import Path

import numpy as np
import nibabel as nib
import nibabel.freesurfer as fs
import trimesh
from matplotlib import colormaps

# Kept in step with render_interactive.py, which is where these were tuned.
ROIS = [
    ("FFA",  "faces",  [2, 3], "flocfacestval",      "#C0392B"),
    ("OFA",  "faces",  [1],    "flocfacestval",      "#E8836F"),
    ("EBA",  "bodies", [1],    "flocbodiestval",     "#1F8A70"),
    ("FBA",  "bodies", [2, 3], "flocbodiestval",     "#7FC8A9"),
    ("PPA",  "places", [2],    "flocplacestval",     "#2E5EAA"),
    ("OPA",  "places", [1],    "flocplacestval",     "#6FA8DC"),
    ("RSC",  "places", [3],    "flocplacestval",     "#8E6FBF"),
    ("VWFA", "words",  [2, 3], "floccharacterstval", "#E09F3E"),
]

# Grey levels for the deepest sulcus and the most gyral crown, matching the "sulc" style in
# render_interactive.py. Handing nilearn raw sulc instead stretches to the full range and
# bottoms out at black, which is what this avoids.
SULCUS_LEVEL, GYRUS_LEVEL = 0.35, 0.97

# ROI patches reuse the decimated base geometry, so they only need to clear it by enough to
# beat depth-buffer quantisation, not by enough to cover a geometric mismatch.
PATCH_OFFSET_MM = 0.05


def mgz(path):
    return np.asarray(nib.load(str(path)).dataobj).squeeze()


def vertex_normals(coords, faces):
    """Area-weighted vertex normals; used only to lift ROI patches off the base."""
    tri = coords[faces]
    face_n = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0])
    normals = np.zeros_like(coords, dtype=np.float64)
    np.add.at(normals, faces[:, 0], face_n)
    np.add.at(normals, faces[:, 1], face_n)
    np.add.at(normals, faces[:, 2], face_n)
    length = np.linalg.norm(normals, axis=1, keepdims=True)
    return np.divide(normals, length, out=np.zeros_like(normals), where=length > 1e-8)


def display_rgba(srgb):
    """Write display-referred bytes.

    glTF says COLOR_0 is linear, but three.js MeshBasic/Lambert vertex colours are shown
    as these bytes directly. Baking the sRGB→linear conversion here made the sulcal floor
    land near RGB 55 and the base read as charcoal.
    """
    rgba = np.ones((len(srgb), 4))
    rgba[:, :3] = np.asarray(srgb, dtype=np.float64)
    return (rgba * 255).round().astype(np.uint8)


def sulc_depths(source):
    """Sulcal depth per hemisphere on a [0, 1] scale shared by both.

    Normalising each hemisphere against its own extremes would leave the two visibly
    mismatched when shown side by side.
    """
    raw = {h: fs.read_morph_data(source / "web" / f"{h}.sulc") for h in ("lh", "rh")}
    low = min(values.min() for values in raw.values())
    high = max(values.max() for values in raw.values())
    return {h: (values - low) / (high - low) for h, values in raw.items()}


def exclusive_rois(source, hemi, n_vertices, threshold):
    """Assign each vertex to at most one ROI.

    Cross-domain floc labels can claim the same vertex; the higher t-value wins.
    Independent t-value contours on the same edge would otherwise overlap.
    """
    codes = np.zeros(n_vertices, dtype=np.int16)
    best_t = np.full(n_vertices, -np.inf)
    claimed = np.zeros(n_vertices, dtype=np.int16)
    for code, (_, domain, indices, tval_stem, _) in enumerate(ROIS, start=1):
        labels = mgz(source / "label" / f"{hemi}.floc-{domain}.mgz")
        tval = mgz(source / "label" / f"{hemi}.{tval_stem}.mgz").astype(np.float64)
        hit = np.isin(labels, indices) & (tval > threshold)
        claimed[hit] += 1
        take = hit & (tval > best_t)
        codes[take] = code
        best_t[take] = tval[take]
    n_tie = int((claimed > 1).sum())
    if n_tie:
        print(f"  {hemi}: {n_tie} vertices claimed by >1 domain, kept the higher t")
    best_t[codes == 0] = 0
    return codes, best_t


def contour_patch(coords, faces, codes, tval, code, threshold, normals):
    """Keep vertices assigned to `code`, splitting mixed triangles.

    Against bare cortex the cut follows t = threshold. Against another ROI it
    meets at the edge midpoint so the two patches share a border and do not overlap.
    """
    inside = codes == code
    field = np.where(inside, tval, 0.0)
    out_coords = []
    out_normals = []
    out_faces = []
    orig = -np.ones(len(coords), dtype=np.int64)
    cuts = {}

    def emit_orig(index):
        if orig[index] < 0:
            orig[index] = len(out_coords)
            out_coords.append(coords[index])
            out_normals.append(normals[index])
        return int(orig[index])

    def emit_cut(i, j):
        a, b = (i, j) if i < j else (j, i)
        key = (a, b)
        if key not in cuts:
            neighbour = codes[j] if codes[i] == code else codes[i]
            if neighbour != 0:
                t = 0.5
            else:
                span = field[j] - field[i]
                t = 0.5 if abs(span) < 1e-8 else float(np.clip((threshold - field[i]) / span, 0, 1))
            n = (1 - t) * normals[i] + t * normals[j]
            n_len = np.linalg.norm(n)
            cuts[key] = len(out_coords)
            out_coords.append((1 - t) * coords[i] + t * coords[j])
            out_normals.append(n / n_len if n_len > 1e-8 else normals[i])
        return cuts[key]

    for i, j, k in faces:
        verts = (i, j, k)
        n_in = int(inside[i]) + int(inside[j]) + int(inside[k])
        if n_in == 0:
            continue
        if n_in == 3:
            out_faces.append([emit_orig(i), emit_orig(j), emit_orig(k)])
            continue
        for rot in range(3):
            a, b, c = verts[rot], verts[(rot + 1) % 3], verts[(rot + 2) % 3]
            if n_in == 1 and inside[a]:
                out_faces.append([emit_orig(a), emit_cut(a, b), emit_cut(a, c)])
                break
            if n_in == 2 and not inside[a]:
                out_faces.append([emit_cut(a, b), emit_orig(b), emit_orig(c)])
                out_faces.append([emit_cut(a, b), emit_orig(c), emit_cut(a, c)])
                break

    if not out_faces:
        return None, None, None
    return np.asarray(out_coords), np.asarray(out_faces, dtype=np.int64), np.asarray(out_normals)


def to_gl(coords):
    """FreeSurfer RAS to glTF's Y-up frame: a -90 degree turn about X.

    Written out rather than done with a matrix so it is obvious this stays right-handed;
    mirroring instead would invert every face winding.
    """
    return np.column_stack([coords[:, 0], coords[:, 2], -coords[:, 1]])


def hemisphere_meshes(source, hemi, depth, threshold, target_faces):
    coords, faces = fs.read_geometry(source / "web" / f"{hemi}.inflated")
    codes, tval = exclusive_rois(source, hemi, len(coords), threshold)

    if target_faces and target_faces < len(faces):
        import pyvista as pv
        from scipy.spatial import cKDTree

        mesh = pv.PolyData(coords, np.hstack([np.full((len(faces), 1), 3), faces]).ravel())
        reduced = mesh.decimate_pro(1 - target_faces / len(faces), preserve_topology=True)
        reduced = reduced.triangulate().clean()
        new_coords = np.asarray(reduced.points, dtype=np.float32)
        nearest = cKDTree(coords).query(new_coords)[1]
        coords, codes, tval = new_coords, codes[nearest], tval[nearest]
        depth = depth[nearest]
        faces = reduced.faces.reshape(-1, 4)[:, 1:]

    # Centre on the base mesh so the ROI patches, which reuse these coordinates, stay aligned.
    coords = coords - coords.mean(axis=0)
    grey = colormaps["Greys"]((1 - GYRUS_LEVEL) + depth * (GYRUS_LEVEL - SULCUS_LEVEL))[:, :3]

    meshes = {f"base_{hemi}": trimesh.Trimesh(
        vertices=to_gl(coords), faces=faces, vertex_colors=display_rgba(grey), process=False)}

    normals = vertex_normals(coords, faces)
    for code, (name, _, _, _, color) in enumerate(ROIS, start=1):
        patch = contour_patch(coords, faces, codes, tval, code, threshold, normals)
        if patch[0] is None:
            continue
        patch_coords, patch_faces, patch_normals = patch
        rgb = np.array([int(color[i:i + 2], 16) for i in (1, 3, 5)]) / 255
        meshes[f"roi_{hemi}_{name}"] = trimesh.Trimesh(
            vertices=to_gl(patch_coords + patch_normals * PATCH_OFFSET_MM),
            faces=patch_faces,
            vertex_colors=display_rgba(np.tile(rgb, (len(patch_coords), 1))),
            process=False)
    return meshes


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True,
                        help="folder holding the web/ and label/ FreeSurfer directories")
    parser.add_argument("--out", type=Path,
                        default=Path("assets/brainModel/subj01_froi.glb"))
    parser.add_argument("--threshold", type=float, default=3.3)
    parser.add_argument("--faces", type=int, default=0,
                        help="target face count per hemisphere; 0 keeps the full FreeSurfer mesh")
    args = parser.parse_args()

    source = args.source.expanduser()
    depths = sulc_depths(source)
    scene = trimesh.Scene()
    for hemi in ("lh", "rh"):
        for name, mesh in hemisphere_meshes(source, hemi, depths[hemi], args.threshold,
                                            args.faces).items():
            scene.add_geometry(mesh, geom_name=name, node_name=name)
            print(f"  {name:16} {len(mesh.faces):7} faces")

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_bytes(trimesh.exchange.gltf.export_glb(scene))
    print(f"wrote {args.out} ({args.out.stat().st_size / 1e6:.1f} MB uncompressed)")


if __name__ == "__main__":
    main()
