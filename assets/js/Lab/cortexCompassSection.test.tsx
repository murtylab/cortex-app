import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import CortexCompassSection from './cortexCompassSection';

function renderSection(props: Partial<React.ComponentProps<typeof CortexCompassSection>> = {}) {
  return renderToStaticMarkup(
    <CortexCompassSection modelCount={4} loading={false} error={null} onOpen={() => {}} {...props} />,
  );
}

describe('Cortex-Compass results section', () => {
  it('uses the same section heading structure as the four result graphics', () => {
    const markup = renderSection();
    expect(markup).toContain('<section class="lab-compass-section" aria-labelledby="lab-compass-heading">');
    expect(markup).toContain('class="lab-section-header"');
    expect(markup).toContain('class="lab-eyebrow">Reference comparison');
    expect(markup).toContain('<h3 class="lab-heading" id="lab-compass-heading">Cortex-Compass</h3>');
    expect(markup).toContain('Open Cortex-Compass');
    expect(markup).toContain('aria-label="Open Cortex-Compass in a new tab"');
    expect(markup).toContain('title="Opens in a new tab"');
    expect(markup).toContain('Murty-185');
    expect(markup).toContain('NSD-1000 predictions across FFA, PPA, and EBA.');
    expect(markup).not.toContain('Your selected model plus');
    expect(markup).not.toContain('Your Lab results stay unchanged.');
    expect(markup).not.toContain('role="status"');
  });

  it.each([3, 4])('keeps the button disabled and reports %i unique models during preparation', (modelCount) => {
    const markup = renderSection({ modelCount, loading: true });
    expect(markup).toContain('Opening Cortex-Compass…');
    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain('disabled=""');
    expect(markup).toContain('role="status"');
    expect(markup).toContain(`Preparing ${modelCount} models across FFA, PPA, and EBA…`);
  });

  it('preserves errors and retry in the section while hiding stale errors during preparation', () => {
    const markup = renderSection({ error: 'Reference data unavailable.', onRetry: () => {} });
    expect(markup).toContain('role="alert"');
    expect(markup).toContain('Reference data unavailable.');
    expect(markup).toContain('Retry');
    expect(renderSection({ error: 'Reference data unavailable.' })).not.toContain('Retry');
    const loadingMarkup = renderSection({ loading: true, error: 'Reference data unavailable.', onRetry: () => {} });
    expect(loadingMarkup).not.toContain('Reference data unavailable.');
    expect(loadingMarkup).not.toContain('Retry');
  });
});
