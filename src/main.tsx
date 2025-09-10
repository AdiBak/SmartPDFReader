import './style.css'
import { createRoot } from 'react-dom/client'
import { ReactApp } from './components/ReactApp'

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
