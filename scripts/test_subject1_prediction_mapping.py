"""Fast unit and shipped-artifact checks; external neuroimaging data is not needed."""

import json
import unittest
from pathlib import Path

import numpy as np
from scipy import sparse

import build_subject1_prediction_mapping as mapping


REPO_ROOT = Path(__file__).resolve().parents[1]


class SelectionTests(unittest.TestCase):
    def make_selection(self):
        mask = np.zeros(mapping.VOLUME_SHAPE_ZYX, dtype=np.bool_)
        mask[0, 1, 3] = True
        mask[2, 0, 1] = True
        mask[4, 5, 6] = True
        return mask

    def test_threshold_is_strict_and_response_order_is_zyx_c_order(self):
        coordinates = mapping.select_coordinates(self.make_selection(), [2, 3, 2], [8, 7, 9], (2, 3))
        self.assertEqual(coordinates.tolist(), [[0, 1, 3], [4, 5, 6]])
        self.assertEqual(coordinates.dtype, np.dtype("<i2"))

    def test_label_values_do_not_mix_adjacent_rois(self):
        coordinates = mapping.select_coordinates(self.make_selection(), [1, 2, 3], [9, 9, 9], (1,))
        self.assertEqual(coordinates.tolist(), [[0, 1, 3]])

    def test_mask_orientation_and_type_are_checked(self):
        with self.assertRaises(ValueError):
            mapping.select_coordinates(np.zeros(mapping.VOLUME_SHAPE_XYZ, dtype=np.bool_), [], [], (1,))
        with self.assertRaises(ValueError):
            mapping.select_coordinates(self.make_selection().astype(int), [1, 1, 1], [8, 8, 8], (1,))

    def test_label_width_and_nonfinite_values_are_rejected(self):
        with self.assertRaises(ValueError):
            mapping.select_coordinates(self.make_selection(), [1, 1], [8, 8], (1,))
        with self.assertRaises(ValueError):
            mapping.select_coordinates(self.make_selection(), [1, 1, 1], [8, float("nan"), 8], (1,))


class SparseMappingTests(unittest.TestCase):
    def test_weights_are_normalized_by_surface_vertex_not_response(self):
        coordinates = np.array([[0, 0, 0], [0, 0, 1], [0, 0, 2]], dtype="<i2")
        linear = np.ravel_multi_index(tuple(coordinates[:, ::-1].T), mapping.VOLUME_SHAPE_XYZ)
        width = int(np.prod(mapping.VOLUME_SHAPE_XYZ))
        left = sparse.csr_matrix(([2, 1, 3], ([0, 0, 1], [linear[0], linear[1], linear[1]])), shape=(2, width))
        right = sparse.csr_matrix(([4], ([0], [linear[1]])), shape=(2, width))
        result = mapping.map_coordinates(coordinates, {"lh": left, "rh": right})
        self.assertEqual(result["mappedResponseCount"], 2)
        self.assertEqual(result["unmappedResponseIndices"], [2])
        self.assertEqual(result["hemispheres"], ["lh", "bilateral", "unmapped"])
        self.assertEqual(result["volumeLinearIndicesXyz"], linear.tolist())
        np.testing.assert_allclose(result["mappings"]["lh"]["weights"], [2 / 3, 1 / 3, 1], atol=1e-7)
        self.assertEqual(result["mappings"]["rh"]["weights"], [1])


class ShippedArtifactTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.document = json.loads((REPO_ROOT / "assets/brainModel/subject1-prediction-mapping.json").read_text())

    def test_mapping_binds_the_existing_cortical_asset(self):
        surface = self.document["surface"]
        payload, geometry, _ = mapping.read_glb(REPO_ROOT / "assets/brainModel/subj01_froi_t7.glb")
        self.assertEqual(surface["sha256"], mapping.digest(payload))
        self.assertEqual(surface["sha256"], mapping.SURFACE_SHA256)
        self.assertEqual(surface["url"], "/assets/brainModel/subj01_froi_t7.glb")
        nodes = {node["name"] for node in geometry["nodes"]}
        for hemisphere, (vertices, faces) in mapping.SURFACE_COUNTS.items():
            entry = surface["hemispheres"][hemisphere]
            self.assertIn(entry["node"], nodes)
            self.assertEqual((entry["vertexCount"], entry["faceCount"]), (vertices, faces))
            self.assertTrue(entry["sourceVertexOrderPreserved"])
            self.assertLess(entry["correspondenceMaxErrorMm"], 0.0001)

    def test_subject_threshold_volume_and_ordering_contract(self):
        self.assertEqual(self.document["schemaVersion"], 1)
        self.assertEqual(self.document["subjectId"], "s1")
        self.assertEqual(self.document["responseSpace"], "nsd_1000_subject1_floc_t7_v1")
        self.assertEqual(self.document["fLocThreshold"], 7)
        self.assertEqual(self.document["fLocThresholdOperator"], ">")
        self.assertEqual(self.document["responseOrdering"], "zyx-c-order")
        self.assertEqual(self.document["volumeShapeXyz"], list(mapping.VOLUME_SHAPE_XYZ))
        self.assertEqual(self.document["mapper"], "linenn")
        self.assertEqual(self.document["normalizationPolicy"], "per-surface-vertex")

    def test_all_eight_roi_coordinate_identities_match_training_contract(self):
        self.assertEqual(set(self.document["rois"]), set(mapping.ROI_SPECS))
        for roi, (_, _, expected_count, expected_hash) in mapping.ROI_SPECS.items():
            entry = self.document["rois"][roi]
            coordinates = np.asarray(entry["volumeCoordinatesZyx"], dtype="<i2")
            self.assertEqual(entry["responseCount"], expected_count)
            self.assertEqual(coordinates.shape, (expected_count, 3))
            self.assertEqual(mapping.digest(coordinates.tobytes()), expected_hash)
            self.assertEqual(entry["orderedCoordinateSha256"], expected_hash)
            z, y, x = coordinates.T
            linear = np.ravel_multi_index((x, y, z), mapping.VOLUME_SHAPE_XYZ)
            self.assertEqual(entry["volumeLinearIndicesXyz"], linear.tolist())
            self.assertEqual(len(np.unique(linear)), expected_count)

    def test_shipped_sparse_weights_are_positive_finite_bounded_and_normalized(self):
        for entry in self.document["rois"].values():
            count = entry["responseCount"]
            seen = np.zeros(count, dtype=np.bool_)
            for hemisphere in ("lh", "rh"):
                sparse_mapping = entry["mappings"][hemisphere]
                responses = np.asarray(sparse_mapping["responseIndices"])
                vertices = np.asarray(sparse_mapping["vertexIndices"])
                weights = np.asarray(sparse_mapping["weights"])
                self.assertEqual(len(responses), len(vertices))
                self.assertEqual(len(weights), len(vertices))
                self.assertTrue(np.all((responses >= 0) & (responses < count)))
                self.assertTrue(np.all((vertices >= 0) & (vertices < mapping.SURFACE_COUNTS[hemisphere][0])))
                self.assertTrue(np.all(np.isfinite(weights) & (weights > 0)))
                totals = np.bincount(vertices, weights=weights)
                np.testing.assert_allclose(totals[totals > 0], 1, rtol=0, atol=2e-6)
                seen[responses] = True
            self.assertEqual(entry["mappedResponseCount"], int(seen.sum()))
            self.assertEqual(entry["unmappedResponseIndices"], np.flatnonzero(~seen).tolist())

    def test_omissions_remain_explicit_not_fabricated(self):
        expected_unmapped = {"eba": 3, "fba": 0, "ffa": 0, "ofa": 1,
                             "opa": 0, "ppa": 0, "rsc": 0, "vwfa": 6}
        for roi, count in expected_unmapped.items():
            entry = self.document["rois"][roi]
            self.assertEqual(len(entry["unmappedResponseIndices"]), count)
            self.assertEqual(entry["hemispheres"].count("unmapped"), count)
        self.assertTrue(all(len(value) == 64 for value in self.document["sourceSha256"].values()))


if __name__ == "__main__":
    unittest.main()
