import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './tailwind.css';
import './styles.css';
import './styles/tokens.css';
import './styles/animations.css';
import './index.css';   // ← toujours en dernier pour que tes overrides gagnent

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
