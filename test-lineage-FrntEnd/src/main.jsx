import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ReactFlowProvider } from '@xyflow/react';
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <ReactFlowProvider>
  <StrictMode>
    <App />
  </StrictMode>
  </ReactFlowProvider>
)
