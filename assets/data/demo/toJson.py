import csv
import json
import os
import numpy as np

def csv_to_json(csv_file, json_file, region="ffa", subject="all-participants"):
    with open(csv_file, "r") as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    mean = {}
    sem = {}
    voxels = {}

    for row in rows:
        image = row["image"]
        values = [float(v) for k, v in row.items() if k != "image" and v.strip() != ""]
        mean[image] = float(np.mean(values))
        sem[image] = float(np.std(values) / np.sqrt(len(values)))
        voxels[image] = {subject: {region: values}}

    # 计算 RDM
    images = list(mean.keys())
    rdm = []
    for i, img1 in enumerate(images):
        v1 = voxels[img1][subject][region]
        row_rdm = []
        for j, img2 in enumerate(images):
            v2 = voxels[img2][subject][region]
            dist = float(np.linalg.norm(np.array(v1) - np.array(v2)))
            row_rdm.append(dist)
        rdm.append(row_rdm)

    result = [{
        "mean": mean,
        "sem": sem,
        "rdm": rdm,
        "voxels": voxels
    }]

    with open(json_file, "w") as f:
        json.dump(result, f, indent=2)

    print(f"✅ Converted {csv_file} → {json_file}")


if __name__ == "__main__":
    folder = "."
    for file in os.listdir(folder):
        if file.endswith(".csv"):
            csv_path = os.path.join(folder, file)
            json_path = os.path.splitext(csv_path)[0] + ".json"

            # ⚠️ 从文件名里解析 region，例如 murtylab_clip_rn50_nsd_1000_ppa.csv
            region = "ffa"
            parts = file.split("_")
            if len(parts) >= 4:
                region = parts[-1].replace(".csv", "")

            csv_to_json(csv_path, json_path, region=region, subject="all-participants")
