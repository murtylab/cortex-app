import * as React from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import { Typography, Link } from '@mui/material';
import { MODEL_OPTIONS } from '../constants';
import useRoiLeaderboardRank from './useRoiLeaderboardRank';

const ModelCard = ({ region, dataset, model, variant = 'default', collapsed = false, onCollapsedChange }) => {
  const modelMeta = MODEL_OPTIONS.find(option => option.value === model);
  const modelName = modelMeta?.label || model;
  const modelType = modelMeta?.type || 'Unknown Model Type';
  const cardUrl = `/model-pages/${model}/`;
  const ranking = useRoiLeaderboardRank(dataset, region, model);
  const regionLabel = (region || '').toUpperCase();
  const datasetLabel = dataset || '—';
  const isLab = variant === 'lab';

  let rankCopy = 'Loading scoreboard rank…';
  if (ranking.status === 'unavailable') {
    rankCopy = `Not yet ranked for ${regionLabel}`;
  } else if (ranking.status === 'missing') {
    rankCopy = `Not listed for ${regionLabel}`;
  } else if (ranking.status === 'error') {
    rankCopy = 'Scoreboard rank unavailable';
  }

  if (isLab) {
    return (
      <Box
        className={`lab-model-card-wrap${collapsed ? ' is-collapsed' : ''}`}
        data-tutorial="lab-results-model-card"
      >
        <Card
          variant="outlined"
          sx={{
            borderRadius: '8px',
            boxShadow: 'none',
            border: '0.5px solid var(--lab-hairline, #D6D2C6)',
            background: 'var(--lab-panel, #FBFAF6)',
            aspectRatio: collapsed ? 'auto' : '1 / 1',
            height: 'auto',
          }}
        >
          <CardContent className={`lab-model-card${collapsed ? ' is-collapsed' : ''}`} sx={{ position: 'relative' }}>
            {onCollapsedChange && (
              <button
                type="button"
                aria-expanded={!collapsed}
                aria-label={collapsed ? 'Expand model card' : 'Collapse model card'}
                onClick={() => onCollapsedChange(!collapsed)}
                style={{ position: 'absolute', top: 12, right: 12, border: 0, background: 'none', color: 'var(--lab-muted)', cursor: 'pointer', padding: 4 }}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                  <path d={collapsed ? 'M2 4 6 8 10 4' : 'M2 8 6 4 10 8'} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            )}
            <p className="lab-section-label">Model Card</p>
            <a
              className="lab-model-card-name"
              data-tutorial="lab-results-model-card-link"
              href={cardUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {modelName}
            </a>
            {!collapsed && <p className="lab-model-card-type">{modelType}</p>}

            <div className="lab-model-card-rank">
              {collapsed ? (
                <>
                  <p className="lab-model-card-rank-fallback" style={{ margin: 0 }}>
                    {ranking.status === 'ok' ? <>Rank <strong>{ranking.rank}</strong> of {ranking.total} models</> : rankCopy}
                  </p>
                  <a className="lab-model-card-link" href="/scoreboardQuantitative/?view=rank" target="_blank" rel="noopener noreferrer">
                    View scoreboard
                  </a>
                </>
              ) : ranking.status === 'ok' ? (
                <>
                  <span className="lab-stat-kicker">Rank</span>
                  <span className="lab-stat-number">{ranking.rank}</span>
                  <div className="lab-model-card-rank-lines">
                    {!collapsed && <span className="lab-model-card-rank-meta">
                      of {ranking.total} models
                    </span>}
                    {!collapsed && <span className="lab-model-card-rank-scope">
                      {regionLabel} · {datasetLabel}
                    </span>}
                    <a
                      className="lab-model-card-link"
                      href="/scoreboardQuantitative/?view=rank"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View scoreboard
                    </a>
                  </div>
                </>
              ) : (
                <>
                  <p className="lab-model-card-rank-fallback">{rankCopy}</p>
                  <div className="lab-model-card-rank-lines">
                    <a
                      className="lab-model-card-link"
                      href="/scoreboardQuantitative/?view=rank"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View scoreboard
                    </a>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </Box>
    );
  }

  return (
    <Box
      sx={{ minWidth: 250, borderRadius: '8px', marginTop: 2, marginBottom: 2 }}
    >
      <Card
        variant="outlined"
        sx={{
          borderRadius: '8px',
          boxShadow: 'none',
          border: '1px solid var(--hairline-color, rgba(60,55,48,0.14))',
          background: 'var(--background-color)',
        }}
      >
        <CardContent>
          <Typography sx={{ fontSize: 14 }} color="text.secondary" gutterBottom>
            Model Card
          </Typography>
          <Typography variant="h5" component="div">
            <Link
              href={cardUrl}
              target="_blank"
              rel="noopener noreferrer"
              underline="hover"
              sx={{
                fontFamily: "var(--mono-font, 'IBM Plex Mono', monospace)",
                fontWeight: 500,
                color: 'var(--accent-color, #5b3a6e)',
              }}
            >
              {modelName}
            </Link>
          </Typography>
          <Typography sx={{ mb: 1.5 }} color="text.secondary">
            {modelType}
          </Typography>
          {ranking.status === 'ok' ? (
            <Typography variant="body2">
              {ranking.rank}/{ranking.total} {regionLabel}·{datasetLabel} models
            </Typography>
          ) : (
            <Typography variant="body2">{rankCopy}</Typography>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default ModelCard;
