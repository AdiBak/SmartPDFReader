import './style.css'
import { createRoot } from 'react-dom/client'
import { ReactApp } from './components/ReactApp'

// Disable all console logs except PDF processing debug
const originalWarn = console.warn;
const originalLog = console.log;
const originalError = console.error;

console.warn = () => {};
console.log = (...args) => {
  // Only show PDF processing related logs
  if (args[0] && typeof args[0] === 'string') {
    if (args[0].includes('Processing PDF') || 
        args[0].includes('PDF processing') ||
        args[0].includes('Text extraction') ||
        args[0].includes('Generated embeddings') ||
        args[0].includes('Background processing') ||
        args[0].includes('PDFs to process') ||
        args[0].includes('Successfully processed PDF') ||
        args[0].includes('RAG service') ||
        args[0].includes('Vector store')) {
      originalLog.apply(console, args);
    }
  }
};

console.error = (...args) => {
  // Only show PDF processing errors and actual errors, not React warnings
  if (args[0] && typeof args[0] === 'string') {
    if (args[0].includes('Warning:') || 
        args[0].includes('Do not call Hooks') ||
        args[0].includes('Maximum update depth') ||
        args[0].includes('React has detected')) {
      return;
    }
    // Show PDF processing errors
    if (args[0].includes('Error processing PDF') ||
        args[0].includes('PDF processing failed') ||
        args[0].includes('Failed to process PDF') ||
        args[0].includes('Error downloading PDF') ||
        args[0].includes('Error getting PDFs')) {
      originalError.apply(console, args);
    }
  } else {
    // Show other actual errors
    originalError.apply(console, args);
  }
};

// Main entry point for the application
console.log('Lawbandit Assessment - Smarter RAG & PDF Reader')

// Initialize the React application
const appContainer = document.getElementById('app')
if (appContainer) {
  const root = createRoot(appContainer)
  root.render(<ReactApp />)
} else {
  console.error('App container not found')
}
