

import React from 'react';
import { createRoot } from 'react-dom/client';
import Stepper from './stepper';

function App() {
  return (
    <div>
      <Stepper />
    </div>
  );
}

const container = document.getElementById('container');
if (container) {
  // Check if a root already exists
  let root = (container as any)._reactRoot;
  if (!root) {
    // Create a new root only if it doesn't exist
    root = createRoot(container);
    (container as any)._reactRoot = root;
  }
  // Render or update using the existing root
  root.render(<App />);
} else {
  console.error("Failed to find the 'container' element.");
}

