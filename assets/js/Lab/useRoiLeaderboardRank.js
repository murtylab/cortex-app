import { useEffect, useState } from 'react';

const LEADERBOARD_PATHS = {
  nsd_1000: '/assets/data/new/standardized_results_nsd_1000_models_univariate.json',
  murty185: '/assets/data/new/standardized_results_murty185_models_univariate.json',
};

const SKIP_EVAL_KEYS = new Set(['murty185', 'nsd_1000']);
const cache = new Map();

function normalizeDatasetKey(dataset) {
  return String(dataset || '').toLowerCase() === 'murty185' ? 'murty185' : 'nsd_1000';
}

function meanRawScore(modelScores) {
  const values = Object.entries(modelScores || {})
    .filter(([key, value]) => !SKIP_EVAL_KEYS.has(key) && Array.isArray(value) && Number.isFinite(value[0]))
    .map(([, value]) => value[0]);

  if (!values.length) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function resolveModelKey(roiData, model) {
  if (roiData[model]) {
    return model;
  }

  const lower = String(model || '').toLowerCase();
  return Object.keys(roiData).find((key) => key.toLowerCase() === lower) || null;
}

export function computeRoiSpecificRank(data, region, model) {
  const roiKey = String(region || '').toLowerCase();
  const roiData = data?.[roiKey];

  if (!roiData) {
    return { status: 'unavailable' };
  }

  const modelKey = resolveModelKey(roiData, model);
  const ranked = Object.keys(roiData)
    .filter((key) => key !== 'ceiling')
    .map((key) => ({ model: key, score: meanRawScore(roiData[key]) }))
    .filter((row) => row.score != null)
    .sort((left, right) => right.score - left.score);

  if (!ranked.length) {
    return { status: 'unavailable' };
  }

  const index = ranked.findIndex((row) => row.model === modelKey);
  if (index === -1) {
    return { status: 'missing', total: ranked.length };
  }

  return {
    status: 'ok',
    rank: index + 1,
    total: ranked.length,
    score: ranked[index].score,
  };
}

async function loadLeaderboard(datasetKey) {
  if (cache.has(datasetKey)) {
    return cache.get(datasetKey);
  }

  const request = fetch(LEADERBOARD_PATHS[datasetKey])
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Failed to load leaderboard (${response.status})`);
      }
      return response.json();
    })
    .catch((error) => {
      cache.delete(datasetKey);
      throw error;
    });

  cache.set(datasetKey, request);
  return request;
}

export default function useRoiLeaderboardRank(dataset, region, model) {
  const [result, setResult] = useState({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    const datasetKey = normalizeDatasetKey(dataset);

    setResult({ status: 'loading' });
    loadLeaderboard(datasetKey)
      .then((data) => {
        if (!cancelled) {
          setResult(computeRoiSpecificRank(data, region, model));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResult({ status: 'error' });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [dataset, region, model]);

  return result;
}
