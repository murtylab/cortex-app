import React from 'react';
import { Button } from 'antd';
import './cortexCompassSection.css';

type CortexCompassSectionProps = {
  modelCount: number;
  loading: boolean;
  error: string | null;
  onOpen: () => void;
  onRetry?: () => void;
};

export default function CortexCompassSection({ modelCount, loading, error, onOpen, onRetry }: CortexCompassSectionProps) {
  return (
    <section className="lab-compass-section" aria-labelledby="lab-compass-heading">
      <div className="lab-section-header">
        <span className="lab-eyebrow">Reference comparison</span>
        <h3 className="lab-heading" id="lab-compass-heading">Cortex-Compass</h3>
      </div>
      <p className="lab-compass-description">
        Compare your images with Murty-185 across models and brain regions.
      </p>
      <p className="lab-compass-context">
        NSD-1000 predictions across FFA, PPA, and EBA.
      </p>
      <Button
        type="primary"
        htmlType="button"
        onClick={onOpen}
        disabled={loading}
        loading={loading}
        aria-busy={loading}
        aria-label="Open Cortex-Compass in a new tab"
        title="Opens in a new tab"
      >
        {loading ? 'Opening Cortex-Compass…' : 'Open Cortex-Compass'}
      </Button>
      {loading && (
        <p className="lab-compass-status" role="status">
          Preparing {modelCount} models across FFA, PPA, and EBA…
        </p>
      )}
      {error && !loading && (
        <div className="lab-compass-error" role="alert">
          <span>{error}</span>
          {onRetry && <Button size="small" htmlType="button" onClick={onRetry}>Retry</Button>}
        </div>
      )}
    </section>
  );
}
