const fs = require('fs');

const nsdFile = 'assets/data/new/standardized_results_nsd_1000_models_multivariate.json';
const murtyFile = 'assets/data/new/standardized_results_murty185_models_multivariate.json';

function loadData(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    console.error(\`Error reading \${file}: \${e.message}\`);
    return null;
  }
}

const nsdData = loadData(nsdFile);
const murtyData = loadData(murtyFile);

if (!nsdData || !murtyData) {
  process.exit(1);
}

const ppa_subsets = ['bold_5000', 'bonner_2021', 'bmd_2024', 'kingbaker_2019', 'wardle_2020', 'nsd_syn'];
const ffa_subsets = ['bmd_2024', 'kingbaker_2019', 'wardle_2020', 'nsd_syn'];
const eba_subsets = ['bmd_2024', 'nsd_syn'];

function getValues(modelName, subsets, data) {
  const values = [];
  const missing = [];
  const modelEntries = data.filter(entry => entry.model === modelName);
  
  subsets.forEach(subset => {
    const entry = modelEntries.find(e => e.benchmark === subset);
    if (entry && entry.score !== undefined && entry.score !== null) {
      values.push(parseFloat(entry.score));
    } else {
      missing.push(subset);
    }
  });
  return { values, missing };
}

function average(arr) {
  if (arr.length === 0) return null;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

const modelName = 'dinov2';

// Check NSD Data for subsets
const ppa_res = getValues(modelName, ppa_subsets, nsdData);
const ffa_res = getValues(modelName, ffa_subsets, nsdData);
const eba_res = getValues(modelName, eba_subsets, nsdData);

// Global is usually the mean of all benchmarks for the model in that dataset or similar
const globalEntry = nsdData.find(e => e.model === modelName && e.benchmark === 'average');
const globalVal = globalEntry ? globalEntry.score : null;

console.log('--- DINOv2 Analysis ---');
console.log(\`Global (nsd_1000 average): \${globalVal !== null ? globalVal.toFixed(3) : 'Missing'}\`);
console.log(\`PPA Average: \${ppa_res.values.length > 0 ? average(ppa_res.values).toFixed(3) : 'N/A'} (Missing: \${ppa_res.missing.join(', ') || 'none'})\`);
console.log(\`FFA Average: \${ffa_res.values.length > 0 ? average(ffa_res.values).toFixed(3) : 'N/A'} (Missing: \${ffa_res.missing.join(', ') || 'none'})\`);
console.log(\`EBA Average: \${eba_res.values.length > 0 ? average(eba_res.values).toFixed(3) : 'N/A'} (Missing: \${eba_res.missing.join(', ') || 'none'})\`);

const allPresent = ppa_res.missing.length === 0 && ffa_res.missing.length === 0 && eba_res.missing.length === 0 && globalVal !== null;
console.log(\`All required entries present: \${allPresent}\`);

