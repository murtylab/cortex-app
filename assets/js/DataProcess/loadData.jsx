// hooks/useLoadDataNew.js
import { useEffect, useState } from 'react';
import * as d3 from 'd3';

function addOverall(content) {
  if (!content) return content;

  const rois = ["ppa", "ffa", "eba"];
  const overall = {};

  rois.forEach(roi => {
    if (!content[roi]) return;

    Object.keys(content[roi]).forEach(model => {
      if (!overall[model]) overall[model] = {};

      Object.keys(content[roi][model]).forEach(dataset => {
        const score = content[roi][model][dataset]?.[0];
        const pval  = content[roi][model][dataset]?.[1];
        if (score != null) {
          if (!overall[model][dataset]) {
            overall[model][dataset] = [0, 0, 0]; // sumScore, sumPval, count
          }
          overall[model][dataset][0] += score;
          overall[model][dataset][1] += pval ?? 0;
          overall[model][dataset][2] += 1;
        }
      });
    });
  });

  // average
  Object.keys(overall).forEach(model => {
    Object.keys(overall[model]).forEach(dataset => {
      const [sumScore, sumPval, count] = overall[model][dataset];
      overall[model][dataset] = [
        sumScore / count,
        sumPval / count
      ];
    });
  });

  return { ...content, Overall: overall };
}

export default function useLoadData() {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const files = {

      // group by regions
      murty_multi: '/assets/data/new/standardized_results_murty185_models_multivariate.json',
      murty_uni:   '/assets/data/new/standardized_results_murty185_models_univariate.json',
      nsd_multi:   '/assets/data/new/standardized_results_nsd_1000_models_multivariate.json',
      nsd_uni:     '/assets/data/new/standardized_results_nsd_1000_models_univariate.json',


      // for barchart
      ceiling_uni: '/assets/data/new/uni_ceiling.json',
      ceiling_multi: '/assets/data/new/multi_ceiling.json',

      // for linechart
      roi_dataset_Murty185_uni:'/assets/data/new/Roi_Dataset_murty.json',
      roi_dataset_Murty185_multi:'/assets/data/new/Roi_Dataset_murty_multi.json',
      roi_dataset_NSD_uni:'/assets/data/new/Roi_Dataset_nsd.json',
      roi_dataset_NSD_multi:'/assets/data/new/Roi_Dataset_nsd_multi.json'




      
    };

    Promise.all(
      Object.entries(files).map(([key, path]) =>
        d3.json(path).then(content => {
          // ceiling doesnot need addOverall
          if (key === "ceiling_uni" || key === "ceiling_multi") {
            console.log("📂 Loaded ceiling file:", key, content);
            return { key, content }; 
          }
 
          return { key, content: addOverall(content) };
        })
      )
    )
      .then(results => {
        const loadedData = {};
        results.forEach(({ key, content }) => {
          loadedData[key] = content;
        });
        setData(loadedData);
        setLoading(false);
        console.log("✅ All data files loaded successfully:", Object.keys(loadedData));
      })
      .catch(err => {
        console.error('❌ Failed to load some files', err);
        setLoading(false);
      });
  }, []);

  return { data, loading };
}
