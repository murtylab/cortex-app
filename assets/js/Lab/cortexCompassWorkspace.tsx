import React, { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  COMPASS_OPEN_EVENT,
  buildEmbeddedCompassUrl,
  isCortexCompassPath,
  readCompassSessionToken,
} from '../services/cortexCompassNavigation.js';

type WorkspaceState = {
  open: boolean;
  sessionId: string | null;
  invalidLink: boolean;
  preparing: boolean;
  hasLab: boolean;
  hasCompass: boolean;
};

function initialWorkspace(): WorkspaceState {
  const open = isCortexCompassPath();
  const hash = window.location.hash;
  const suppliedToken = new URLSearchParams(hash.replace(/^#/, '')).has('session');
  const token = readCompassSessionToken(hash);
  const saved = window.history.state?.cortexCompassSession;
  const savedToken = typeof saved === 'string'
    ? readCompassSessionToken(`#session=${encodeURIComponent(saved)}`)
    : null;
  return {
    open,
    sessionId: open ? token ?? savedToken : null,
    invalidLink: open && suppliedToken && !token,
    preparing: open && !suppliedToken && !token && !savedToken
      && new URLSearchParams(window.location.search).get('preparing') === '1',
    hasLab: !open,
    hasCompass: open,
  };
}

/** Keep the Lab mounted while Compass occupies the same site's page shell. */
export default function CortexCompassWorkspace({ children }: { children: ReactNode }) {
  const [workspace, setWorkspace] = useState(initialWorkspace);
  const [frameStatus, setFrameStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const frame = useRef<HTMLIFrameElement>(null);
  const currentSession = useRef(workspace.sessionId);
  const openedFromLab = useRef(false);
  const labScroll = useRef(0);
  const returnFocus = useRef<HTMLElement | null>(null);

  const showLab = useCallback(() => {
    setWorkspace((previous) => ({ ...previous, open: false, hasLab: true }));
    window.requestAnimationFrame(() => {
      window.scrollTo(0, labScroll.current);
      returnFocus.current?.focus({ preventScroll: true });
    });
  }, []);

  const returnToLab = useCallback(() => {
    if (openedFromLab.current && isCortexCompassPath()) {
      window.history.back();
    } else {
      window.history.replaceState(null, '', '/lab/');
      showLab();
    }
  }, [showLab]);

  useEffect(() => {
    function openCompass(sessionId: string | null = currentSession.current) {
      if (!isCortexCompassPath()) {
        openedFromLab.current = true;
        labScroll.current = window.scrollY;
        returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        window.history.pushState({ cortexCompassSession: sessionId }, '', '/cortex-compass/');
      } else {
        window.history.replaceState({ cortexCompassSession: sessionId }, '', '/cortex-compass/');
      }
      if (sessionId !== currentSession.current) setFrameStatus('loading');
      currentSession.current = sessionId;
      setWorkspace((previous) => ({ ...previous, open: true, sessionId, invalidLink: false, preparing: false, hasCompass: true }));
      window.scrollTo(0, 0);
    }

    function handleOpen(event: Event) {
      const sessionId = (event as CustomEvent<{ sessionId: string }>).detail?.sessionId;
      if (!readCompassSessionToken(`#session=${encodeURIComponent(sessionId ?? '')}`)) return;
      event.preventDefault();
      openCompass(sessionId);
    }

    function handlePopState() {
      if (!isCortexCompassPath()) {
        showLab();
        return;
      }
      const hash = window.location.hash;
      const suppliedToken = new URLSearchParams(hash.replace(/^#/, '')).has('session');
      const token = readCompassSessionToken(hash);
      const saved = window.history.state?.cortexCompassSession;
      const sessionId = token ?? (typeof saved === 'string'
        ? readCompassSessionToken(`#session=${encodeURIComponent(saved)}`)
        : null);
      if (sessionId !== currentSession.current) setFrameStatus('loading');
      currentSession.current = sessionId;
      setWorkspace((previous) => ({
        ...previous, open: true, sessionId, invalidLink: suppliedToken && !token,
        preparing: !suppliedToken && !sessionId && new URLSearchParams(window.location.search).get('preparing') === '1',
        hasCompass: true,
      }));
      if (hash) window.history.replaceState({ cortexCompassSession: sessionId }, '', '/cortex-compass/');
      window.scrollTo(0, 0);
    }

    function handleNavigation(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('#navmenu a') : null;
      if (!link || link.origin !== window.location.origin) return;
      if (isCortexCompassPath(link.pathname)) {
        event.preventDefault();
        openCompass();
      } else if (link.pathname === '/lab/' && isCortexCompassPath()) {
        event.preventDefault();
        returnToLab();
      }
    }

    function handleFrameMessage(event: MessageEvent) {
      if (!frame.current?.contentWindow || event.source !== frame.current.contentWindow
        || event.origin !== window.location.origin || !event.data || typeof event.data !== 'object') return;
      if (event.data.type === 'cortex-compass:return-to-lab') {
        returnToLab();
      } else if (event.data.type === 'cortex-compass:status'
        && ['loading', 'ready', 'error'].includes(event.data.status)) {
        setFrameStatus(event.data.status);
      }
    }

    // Keep the opaque token in this history entry, never in a query or a shared URL.
    if (isCortexCompassPath() && window.location.hash) {
      window.history.replaceState({ cortexCompassSession: currentSession.current }, '', '/cortex-compass/');
    }
    window.addEventListener(COMPASS_OPEN_EVENT, handleOpen);
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('message', handleFrameMessage);
    document.addEventListener('click', handleNavigation);
    return () => {
      window.removeEventListener(COMPASS_OPEN_EVENT, handleOpen);
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('message', handleFrameMessage);
      document.removeEventListener('click', handleNavigation);
    };
  }, [returnToLab, showLab]);

  useEffect(() => {
    document.body.classList.toggle('cortex-compass-open', workspace.open);
    document.title = workspace.open ? 'Cortex-Compass - Virtual Visual Cortex' : 'The Lab - Virtual Visual Cortex';
    document.querySelector('[data-cortex-compass-link]')?.classList.toggle('active', workspace.open);
    document.querySelector('#navmenu a[href="/labLanding/"]')?.classList.toggle('active', !workspace.open);
    return () => { document.body.classList.remove('cortex-compass-open'); };
  }, [workspace.open]);

  useEffect(() => {
    const header = document.getElementById('header');
    if (!header) return;
    const updateHeight = () => document.body.style.setProperty('--cortex-shell-header-height', `${header.getBoundingClientRect().height}px`);
    updateHeight();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateHeight);
    observer?.observe(header);
    window.addEventListener('resize', updateHeight);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updateHeight);
      document.body.style.removeProperty('--cortex-shell-header-height');
    };
  }, []);

  return (
    <>
      <div className="cortex-lab-workspace" hidden={workspace.open}>
        {workspace.hasLab ? children : null}
      </div>
      {workspace.hasCompass ? (
        <section className="cortex-compass-workspace" hidden={!workspace.open} aria-label="Cortex-Compass inside Virtual Cortex">
          <div className="cortex-compass-workspace-bar">
            <span className="cortex-compass-breadcrumb">The Lab <span aria-hidden="true">/</span> <strong>Cortex-Compass</strong></span>
            <span className="cortex-compass-loading-label" role="status">{frameStatus === 'loading' && !workspace.invalidLink ? 'Loading workspace…' : ''}</span>
            <button type="button" className="cortex-compass-return" onClick={returnToLab}>
              <span aria-hidden="true">←</span> Back to the Lab
            </button>
          </div>
          {workspace.invalidLink ? (
            <div className="cortex-compass-link-error" role="alert">
              <h2>This comparison link is invalid</h2>
              <p>Return to the Lab and open Cortex-Compass again.</p>
              <button type="button" onClick={returnToLab}>Return to the Lab</button>
            </div>
          ) : workspace.preparing ? (
            <div className="cortex-compass-preparing" role="status" aria-live="polite">
              <div className="cortex-compass-loading-panel">
                <p className="cortex-compass-loading-eyebrow">Loading</p>
                <h1>Opening Cortex-Compass</h1>
                <p>Preparing uploaded stimuli and Murty reference images.</p>
              </div>
            </div>
          ) : (
            <iframe
              key={workspace.sessionId ?? 'reference-workspace'}
              ref={frame}
              className="cortex-compass-frame"
              title="Cortex-Compass visualization workspace"
              src={buildEmbeddedCompassUrl(workspace.sessionId)}
              referrerPolicy="no-referrer"
              allow="fullscreen"
            />
          )}
        </section>
      ) : null}
    </>
  );
}
