import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CortexCompassWorkspace from './cortexCompassWorkspace';

const TOKEN = '0123456789abcdef0123456789';

function renderWorkspace(pathname = '/lab/', hash = '', historyState: unknown = null, search = '') {
  vi.stubGlobal('window', { location: { pathname, hash, search }, history: { state: historyState } });
  return renderToStaticMarkup(
    <CortexCompassWorkspace><div data-testid="lab-results">Existing Lab results</div></CortexCompassWorkspace>,
  );
}

afterEach(() => { vi.unstubAllGlobals(); });

describe('Cortex-Compass site workspace', () => {
  it('leaves the existing Lab untouched before Compass is opened', () => {
    const markup = renderWorkspace();
    expect(markup).toContain('Existing Lab results');
    expect(markup).not.toContain('<iframe');
    expect(markup).not.toContain('cortex-lab-workspace" hidden');
  });

  it('opens reference mode as a borderless full-page workspace with an accessible frame title', () => {
    const markup = renderWorkspace('/cortex-compass/');
    expect(markup).toContain('aria-label="Cortex-Compass inside Virtual Cortex"');
    expect(markup).toContain('title="Cortex-Compass visualization workspace"');
    expect(markup).toContain('src="/infoviz/?embedded=1"');
    expect(markup).toContain('Back to the Lab');
    expect(markup).not.toContain('Existing Lab results');
  });

  it('uses the integrated loading view during preparation without loading reference-only mode', () => {
    const markup = renderWorkspace('/cortex-compass/', '', null, '?preparing=1');
    expect(markup).toContain('Cortex-Compass inside Virtual Cortex');
    expect(markup).toContain('Loading workspace…');
    expect(markup).toContain('Opening Cortex-Compass');
    expect(markup).toContain('Preparing uploaded stimuli and Murty reference images.');
    expect(markup).toContain('Back to the Lab');
    expect(markup).not.toContain('<iframe');
    expect(markup).not.toContain('Existing Lab results');
    expect(markup).not.toContain('Your Lab results remain open in the original tab.');
    expect(markup).not.toContain('Preparing Cortex-Compass');
  });

  it('loads a supplied or saved comparison even if the preparation flag is present', () => {
    expect(renderWorkspace('/cortex-compass/', `#session=${TOKEN}`, null, '?preparing=1'))
      .toContain(`src="/infoviz/?embedded=1#session=${TOKEN}"`);
    expect(renderWorkspace('/cortex-compass/', '', { cortexCompassSession: TOKEN }, '?preparing=1'))
      .toContain(`src="/infoviz/?embedded=1#session=${TOKEN}"`);
  });

  it('does not let the preparation flag hide an invalid comparison link', () => {
    const markup = renderWorkspace('/cortex-compass/', '#session=invalid', null, '?preparing=1');
    expect(markup).toContain('This comparison link is invalid');
    expect(markup).not.toContain('Opening Cortex-Compass');
    expect(markup).not.toContain('<iframe');
  });

  it.each(['?preparing=0', '?other=1', ''])('leaves normal reference mode intact for %s', (search) => {
    expect(renderWorkspace('/cortex-compass/', '', null, search)).toContain('src="/infoviz/?embedded=1"');
  });

  it('passes only the opaque token to the child fragment, not model settings or paths', () => {
    const markup = renderWorkspace('/cortex-compass/', `#session=${TOKEN}`);
    expect(markup).toContain(`src="/infoviz/?embedded=1#session=${TOKEN}"`);
    expect(markup).not.toContain('path=');
    expect(markup).not.toContain('model=');
    expect(markup).toContain('referrerPolicy="no-referrer"');
  });

  it('restores the current comparison from this tab history entry on refresh', () => {
    const markup = renderWorkspace('/cortex-compass/', '', { cortexCompassSession: TOKEN });
    expect(markup).toContain(`src="/infoviz/?embedded=1#session=${TOKEN}"`);
  });

  it('does not quietly treat an invalid comparison link as reference mode', () => {
    const markup = renderWorkspace('/cortex-compass/', '#session=invalid');
    expect(markup).toContain('This comparison link is invalid');
    expect(markup).toContain('role="alert"');
    expect(markup).not.toContain('<iframe');
  });

  it('ignores invalid saved tokens and does not send them to the visualization', () => {
    const markup = renderWorkspace('/cortex-compass/', '', { cortexCompassSession: '../not-a-token' });
    expect(markup).toContain('src="/infoviz/?embedded=1"');
    expect(markup).not.toContain('../not-a-token');
  });
});
