import fs from 'node:fs';

const catalogPath = 'assets/data/model-pages.json';
const file1 = 'assets/data/new/standardized_results_nsd_1000_models_univariate.json';
const file2 = 'assets/data/new/standardized_results_murty185_models_univariate.json';

function getModelKeys(filePath) {
    if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        return new Set();
    }
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const keys = new Set();
    ['ppa', 'ffa', 'eba'].forEach(section => {
        if (data[section]) {
            Object.keys(data[section]).forEach(key => keys.add(key));
        }
    });
    return keys;
}

const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
const pageDirs = Object.keys(catalog);
const keys1 = getModelKeys(file1);
const keys2 = getModelKeys(file2);
const allKeys = new Set([...keys1, ...keys2]);

const exactMatches = pageDirs.filter(dir => allKeys.has(dir));
const lowerKeys = new Map();
allKeys.forEach(k => lowerKeys.set(k.toLowerCase(), k));

const caseInsensitiveMatches = pageDirs.filter(dir => {
    if (allKeys.has(dir)) return true;
    return lowerKeys.has(dir.toLowerCase());
});

const unmatchedDirs = pageDirs.filter(dir => !allKeys.has(dir) && !lowerKeys.has(dir.toLowerCase()));
const unmatchedKeys = Array.from(allKeys).filter(key => {
    const lowerDirMap = new Set(pageDirs.map(d => d.toLowerCase()));
    return !lowerDirMap.has(key.toLowerCase());
});

console.log(`Total catalog models: ${pageDirs.length}`);
console.log(`Exact slug matches: ${exactMatches.length}`);
console.log(`Case-insensitive matches: ${caseInsensitiveMatches.length}`);
console.log(`Unmatched catalog models (up to 25): ${unmatchedDirs.slice(0, 25).join(', ')}`);
console.log(`Data keys with no catalog entry (up to 25): ${unmatchedKeys.slice(0, 25).join(', ')}`);
