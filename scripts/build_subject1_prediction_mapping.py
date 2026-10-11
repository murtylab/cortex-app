#!/usr/bin/env python3
"""Build a sparse NSD Subject 1 prediction-to-surface lookup for the Lab.

The committed cortical GLB is reused unchanged. This build reads the training
selection masks, t-values, and an existing pycortex linenn volume-to-surface
mapper. It does not export MRI, cortical geometry, or source volumes.

Requires NumPy and SciPy. External paths are explicit; the source GIFTI surfaces
are used only to verify that the GLB retains the mapper's vertex identities.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import struct
import xml.etree.ElementTree as ET
import zlib
from pathlib import Path

import numpy as np
from scipy import sparse


VOLUME_SHAPE_XYZ = (83, 104, 81)
VOLUME_SHAPE_ZYX = (81, 104, 83)
SURFACE_SHA256 = "7d434402499dd479f3e40eb98e79415a1ebe96800a9cfc45dd1af23015b46f2a"
SURFACE_COUNTS = {"lh": (227021, 454038), "rh": (226601, 453198)}
ROI_SPECS = {
    "eba": ("bodies", (1,), 518, "440e3d36e725f44df7a4bfc6aeab9cc3fc180853adde80843439393698c36fbe"),
    "fba": ("bodies", (2, 3), 35, "2c3e850b334890e44ce8ee8d6a7d982948018c4bd00295e220a09e3e56d600a0"),
    "ffa": ("faces", (2, 3), 156, "ce13c8bcd14cc54865b90cc4d9546559afd92269ad2bdc9a66df9aa327ef8a88"),
    "ofa": ("faces", (1,), 13, "e54c2365cdc92758d6c20dfed70c58c8a674ac29795f645cd4ac738e745e216f"),
    "opa": ("places", (1,), 64, "870d08c099404bb1f23d23cd58df13f54ac12b18ed1bf03ea12401c956c9e7e9"),
    "ppa": ("places", (2,), 170, "e0b164fe5a54d564b09e4dc25b4d456bb966933870e3dbb9aebd93d73657282e"),
    "rsc": ("places", (3,), 38, "1a9aab9b4d4e8943cef479b1127958fac0b11d9f28b3ee306e7cfc244111574d"),
    "vwfa": ("words", (2, 3), 232, "ed60b1be23c3057819327db1d11208edca202ba74d2aa0d650cacf4179561c9e"),
}


def digest(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def select_coordinates(mask, labels, t_values, label_values):
    """Reconstruct ROI-local response order using training boolean indexing."""
    mask = np.asarray(mask)
    if mask.dtype != np.bool_ or mask.shape != VOLUME_SHAPE_ZYX:
        raise ValueError("The cortical mask must be boolean with z/y/x shape (81,104,83).")
    labels, t_values = np.asarray(labels).squeeze(), np.asarray(t_values).squeeze()
    count = int(mask.sum())
    for values in (labels, t_values):
        if values.shape != (count,) or not np.all(np.isfinite(values)):
            raise ValueError("Labels and t-values must match the finite cortical-mask order.")
    selected = np.zeros(mask.shape, dtype=np.bool_)
    selected[mask] = np.isin(labels, label_values) & (t_values > 7)
    return np.ascontiguousarray(np.argwhere(selected), dtype="<i2")


def read_gifti(path):
    """Read the two known GIFTI array kinds without a geometry-export dependency."""
    arrays = {}
    for item in ET.parse(path).getroot().findall("DataArray"):
        kind = item.attrib["Intent"]
        if kind not in ("NIFTI_INTENT_POINTSET", "NIFTI_INTENT_TRIANGLE"):
            continue
        if (item.attrib.get("Encoding") != "GZipBase64Binary"
                or item.attrib.get("Endian") != "LittleEndian"
                or item.attrib.get("ArrayIndexingOrder") != "RowMajorOrder"):
            raise ValueError("Surface audit requires little-endian row-major GIFTI arrays.")
        expected_dtype = "NIFTI_TYPE_FLOAT32" if kind == "NIFTI_INTENT_POINTSET" else "NIFTI_TYPE_INT32"
        if item.attrib.get("DataType") != expected_dtype:
            raise ValueError("Unexpected GIFTI surface array type.")
        raw = zlib.decompress(base64.b64decode(item.findtext("Data")))
        dtype = "<f4" if kind == "NIFTI_INTENT_POINTSET" else "<i4"
        arrays[kind] = np.frombuffer(raw, dtype=dtype).reshape(int(item.attrib["Dim0"]), 3)
    if set(arrays) != {"NIFTI_INTENT_POINTSET", "NIFTI_INTENT_TRIANGLE"}:
        raise ValueError("Source GIFTI must contain points and triangles.")
    return arrays["NIFTI_INTENT_POINTSET"], arrays["NIFTI_INTENT_TRIANGLE"]


def read_glb(path):
    payload = path.read_bytes()
    magic, version, length = struct.unpack_from("<4sII", payload)
    if magic != b"glTF" or version != 2 or length != len(payload):
        raise ValueError("Invalid cortical GLB header.")
    chunks, offset = {}, 12
    while offset < len(payload):
        length, kind = struct.unpack_from("<I4s", payload, offset)
        offset += 8
        chunks[kind] = payload[offset:offset + length]
        offset += length
    document = json.loads(chunks[b"JSON"])
    binary = chunks[b"BIN\x00"]

    def accessor(index):
        entry = document["accessors"][index]
        view = document["bufferViews"][entry["bufferView"]]
        if "byteStride" in view or view.get("buffer", 0) != 0:
            raise ValueError("Surface audit requires packed local GLB buffers.")
        dtype = {5126: "<f4", 5125: "<u4"}[entry["componentType"]]
        width = {"SCALAR": 1, "VEC3": 3}[entry["type"]]
        return np.frombuffer(binary, dtype=dtype, count=entry["count"] * width,
                             offset=view.get("byteOffset", 0) + entry.get("byteOffset", 0)).reshape(-1, width)

    return payload, document, accessor


def audit_surface(surface_path, source_surface_dir):
    """Prove vertex correspondence, not merely matching mesh dimensions."""
    payload, document, accessor = read_glb(surface_path)
    if digest(payload) != SURFACE_SHA256:
        raise ValueError("The cortical GLB does not match the reviewed VSS asset.")
    hemispheres, provenance = {}, {}
    for hemisphere, (vertex_count, face_count) in SURFACE_COUNTS.items():
        source_path = source_surface_dir / ("inflated_" + hemisphere + ".gii")
        points, triangles = read_gifti(source_path)
        mesh = next(mesh for mesh in document["meshes"] if mesh["name"] == "base_" + hemisphere)
        primitive = mesh["primitives"][0]
        positions = accessor(primitive["attributes"]["POSITION"])
        indices = accessor(primitive["indices"]).reshape(-1, 3)
        if positions.shape != (vertex_count, 3) or indices.shape != (face_count, 3):
            raise ValueError("Unexpected cortical GLB topology.")
        if not np.array_equal(indices, triangles):
            raise ValueError("GLB triangles do not preserve the mapper surface vertex identities.")
        points = points.astype(np.float64)
        rotated = np.column_stack((points[:, 0], points[:, 2], -points[:, 1]))
        translation = (positions - rotated).mean(axis=0)
        deviation = float(np.abs(positions - rotated - translation).max())
        if not np.all(np.isfinite(positions)) or deviation > 0.0001:
            raise ValueError("GLB vertices are not the source surface under rotation and translation.")
        hemispheres[hemisphere] = {
            "node": "base_" + hemisphere,
            "vertexCount": vertex_count,
            "faceCount": face_count,
            "indicesSha256": digest(np.ascontiguousarray(indices, dtype="<u4").tobytes()),
            "sourceVertexOrderPreserved": True,
            "sourceToGlbTranslationMm": translation.tolist(),
            "correspondenceMaxErrorMm": deviation,
        }
        provenance["mapper_surface_" + hemisphere] = digest(source_path.read_bytes())
    return {"url": "/assets/brainModel/subj01_froi_t7.glb", "sha256": digest(payload),
            "coordinateTransform": "FreeSurfer RAS (x,y,z) to glTF (x,z,-y), hemisphere centering",
            "hemispheres": hemispheres}, provenance


def load_mappers(path):
    with np.load(path, allow_pickle=False) as archive:
        if tuple(archive["shape"].astype(int)) != VOLUME_SHAPE_XYZ:
            raise ValueError("The mapper volume shape must be (83,104,81) in x/y/z order.")
        result = {}
        for hemisphere, prefix in (("lh", "left"), ("rh", "right")):
            matrix = sparse.csr_matrix((archive[prefix + "_data"].astype(np.float64),
                                        archive[prefix + "_indices"], archive[prefix + "_indptr"]),
                                       shape=tuple(archive[prefix + "_shape"].astype(int)))
            matrix.check_format(full_check=True)
            if matrix.shape != (SURFACE_COUNTS[hemisphere][0], int(np.prod(VOLUME_SHAPE_XYZ))):
                raise ValueError("The mapper does not use the reviewed cortical surface dimensions.")
            if not np.all(np.isfinite(matrix.data)) or np.any(matrix.data < 0) or not matrix.nnz:
                raise ValueError("The mapper contains invalid or negative weights.")
            matrix.sum_duplicates()
            matrix.eliminate_zeros()
            result[hemisphere] = matrix
    return result


def map_coordinates(coordinates, mappers):
    z, y, x = coordinates.T
    linear = np.ravel_multi_index((x, y, z), VOLUME_SHAPE_XYZ, order="C")
    count = len(coordinates)
    hits, mappings = {}, {}
    for hemisphere in ("lh", "rh"):
        matrix = mappers[hemisphere][:, linear].tocoo()
        positive = matrix.data > 0
        vertices = matrix.row[positive]
        responses = matrix.col[positive]
        weights = matrix.data[positive]
        totals = np.bincount(vertices, weights=weights, minlength=mappers[hemisphere].shape[0])
        weights = (weights / totals[vertices]).astype(np.float32)
        normalized = np.bincount(vertices, weights=weights, minlength=len(totals))
        if not np.allclose(normalized[totals > 0], 1, rtol=0, atol=2e-6):
            raise ValueError("Selected ROI surface weights do not sum to one per mapped vertex.")
        hits[hemisphere] = np.bincount(responses, minlength=count) > 0
        mappings[hemisphere] = {"responseIndices": responses.astype(int).tolist(),
                               "vertexIndices": vertices.astype(int).tolist(),
                               "weights": weights.astype(float).tolist()}
    mapped = hits["lh"] | hits["rh"]
    labels = ["bilateral" if left and right else "lh" if left else "rh" if right else "unmapped"
              for left, right in zip(hits["lh"], hits["rh"])]
    return {"responseCount": count, "mappedResponseCount": int(mapped.sum()),
            "orderedCoordinateSha256": digest(coordinates.tobytes(order="C")),
            "volumeCoordinatesZyx": coordinates.astype(int).tolist(),
            "volumeLinearIndicesXyz": linear.astype(int).tolist(),
            "unmappedResponseIndices": np.flatnonzero(~mapped).astype(int).tolist(),
            "hemispheres": labels, "mappings": mappings}


def build(args):
    surface, provenance = audit_surface(args.surface, args.mapper_surface_dir)
    mappers = load_mappers(args.mapper)
    provenance["linenn_mapper"] = digest(args.mapper.read_bytes())
    mask_path = args.nsd_data_root / "voxels_masks/subj1/cortical_mask_subj01.npy"
    mask = np.load(mask_path, allow_pickle=False)
    provenance["cortical_mask"] = digest(mask_path.read_bytes())
    rois = {}
    for roi, (domain, labels, expected_count, expected_hash) in ROI_SPECS.items():
        labels_path = (args.body_labels if domain == "bodies" else args.nsd_data_root /
                       ("voxels_masks/subj1/roi_1d_mask_subj01_floc-" + domain + ".npy"))
        stem = "word" if domain == "words" else domain
        t_path = args.nsd_data_root / ("tvals/subj1_" + stem + ".npy")
        coordinates = select_coordinates(mask, np.load(labels_path, allow_pickle=False),
                                         np.load(t_path, allow_pickle=False), labels)
        if len(coordinates) != expected_count or digest(coordinates.tobytes()) != expected_hash:
            raise ValueError(roi.upper() + " voxel identity/order does not match the training contract.")
        rois[roi] = {"label": roi.upper(), **map_coordinates(coordinates, mappers)}
        provenance["floc_" + domain + "_labels"] = digest(labels_path.read_bytes())
        provenance["floc_" + domain + "_t_values"] = digest(t_path.read_bytes())
    return {"schemaVersion": 1, "subjectId": "s1",
            "responseSpace": "nsd_1000_subject1_floc_t7_v1",
            "fLocThreshold": 7, "fLocThresholdOperator": ">",
            "responseOrdering": "zyx-c-order", "mapper": "linenn",
            "normalizationPolicy": "per-surface-vertex",
            "volumeShapeXyz": list(VOLUME_SHAPE_XYZ),
            "trainingSelection": {"dataset": "nsd_1000", "subject": "s1",
                                  "source": "Training cortical-mask and fLoc label/t-value arrays",
                                  "readout": "Raw ROI-local Subject 1 prediction vector",
                                  "threshold": "strict fLoc t > 7",
                                  "coordinateOrdering": "NumPy boolean indexing, z/y/x C-order"},
            "surface": surface, "rois": rois, "sourceSha256": provenance}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--nsd-data-root", type=Path, required=True)
    parser.add_argument("--body-labels", type=Path, required=True)
    parser.add_argument("--mapper", type=Path, required=True)
    parser.add_argument("--mapper-surface-dir", type=Path, required=True)
    parser.add_argument("--surface", type=Path, default=Path("assets/brainModel/subj01_froi_t7.glb"))
    parser.add_argument("--out", type=Path, default=Path("assets/brainModel/subject1-prediction-mapping.json"))
    args = parser.parse_args()
    document = build(args)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(document, separators=(",", ":"), sort_keys=True) + "\n", encoding="utf-8")
    for roi, entry in document["rois"].items():
        print(f"{roi.upper()}: {entry['mappedResponseCount']}/{entry['responseCount']} responses mapped")
    print(f"wrote {args.out}: {args.out.stat().st_size} bytes")


if __name__ == "__main__":
    main()
