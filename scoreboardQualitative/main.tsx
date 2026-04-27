import React from 'react';
import { createRoot } from 'react-dom/client';
import ScoreboardPageQualitative from '../assets/js/scoreboard-page-qualitative';

function App() {
  return (
    <div>
      <ScoreboardPageQualitative />
    </div>
  );
}

const container = document.getElementById('container');
if (container) {
  let root = (container as any)._reactRoot;
  if (!root) {
    root = createRoot(container);
    (container as any)._reactRoot = root;
  }
  root.render(<App />);
} else {
  console.error("Failed to find the 'container' element.");
}
