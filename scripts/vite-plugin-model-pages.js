import fs from 'node:fs';
import path from 'node:path';

const SKIP_SCORE_KEYS = new Set(['ceiling']);

function collectScoreSlugs(rootDir) {
  const files = [
    'assets/data/new/standardized_results_nsd_1000_models_univariate.json',
    'assets/data/new/standardized_results_murty185_models_univariate.json',
    'assets/data/new/standardized_results_nsd_1000_models_multivariate.json',
    'assets/data/new/standardized_results_murty185_models_multivariate.json',
  ];
  const slugs = new Set();

  for (const relativePath of files) {
    const absolutePath = path.join(rootDir, relativePath);
    if (!fs.existsSync(absolutePath)) {
      continue;
    }

    const data = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
    Object.values(data).forEach((roi) => {
      Object.keys(roi || {}).forEach((key) => {
        if (!SKIP_SCORE_KEYS.has(key)) {
          slugs.add(key);
        }
      });
    });
  }

  return slugs;
}

function collectCatalogSlugs(rootDir) {
  const catalogPath = path.join(rootDir, 'assets/data/model-pages.json');
  if (!fs.existsSync(catalogPath)) {
    return new Set();
  }

  return new Set(Object.keys(JSON.parse(fs.readFileSync(catalogPath, 'utf8'))));
}

function collectModelPageSlugs(rootDir) {
  return [...new Set([...collectCatalogSlugs(rootDir), ...collectScoreSlugs(rootDir)])].sort();
}

function rewriteModelPageRequest(url) {
  const [pathname, query = ''] = url.split('?');
  const match = pathname.match(/^\/model-pages\/([^/]+)\/?(?:index\.html)?$/);
  if (!match || match[1] === 'index.html') {
    return null;
  }

  return `/model-pages/index.html${query ? `?${query}` : ''}`;
}

function applyModelPageRewrites(server) {
  server.middlewares.use((req, _res, next) => {
    if (!req.url) {
      next();
      return;
    }

    const rewritten = rewriteModelPageRequest(req.url);
    if (rewritten) {
      req.url = rewritten;
    }
    next();
  });
}

export default function modelPagesPlugin() {
  let rootDir = process.cwd();
  let outDir = path.resolve('dist');

  return {
    name: 'model-pages',
    configResolved(config) {
      rootDir = config.root;
      outDir = path.resolve(config.root, config.build.outDir);
    },
    configureServer(server) {
      applyModelPageRewrites(server);
    },
    configurePreviewServer(server) {
      applyModelPageRewrites(server);
    },
    closeBundle() {
      const templatePath = path.join(outDir, 'model-pages', 'index.html');
      const template = fs.readFileSync(path.join(rootDir, 'model-pages', 'index.html'));

      fs.mkdirSync(path.dirname(templatePath), { recursive: true });
      fs.writeFileSync(templatePath, template);

      collectModelPageSlugs(rootDir).forEach((slug) => {
        const slugDir = path.join(outDir, 'model-pages', slug);
        fs.mkdirSync(slugDir, { recursive: true });
        fs.writeFileSync(path.join(slugDir, 'index.html'), template);
      });
    },
  };
}
