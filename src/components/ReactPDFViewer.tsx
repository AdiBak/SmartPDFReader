import React, { useState, useEffect, useRef } from 'react';
import { Viewer, Worker } from '@react-pdf-viewer/core';
import { defaultLayoutPlugin } from '@react-pdf-viewer/default-layout';
import { searchPlugin } from '@react-pdf-viewer/search';
import { PDFDocument } from './PDFManager';
import { HighlightingToolbar } from './HighlightingToolbar';
import { Annotation } from '../types';

// Import styles
import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/default-layout/lib/styles/index.css';
import '@react-pdf-viewer/search/lib/styles/index.css';

interface ReactPDFViewerProps {
  selectedPDF: PDFDocument | null;
  highlights: Annotation[];
  onAddHighlight: (highlight: Omit<Annotation, 'id' | 'createdAt'>) => void;
}

export const ReactPDFViewer: React.FC<ReactPDFViewerProps> = ({ 
  selectedPDF, 
  onAddHighlight 
}) => {
  const [pdfFile, setPdfFile] = useState<string | null>(null);
  const [selectedText, setSelectedText] = useState('');
  const [showHighlightingToolbar, setShowHighlightingToolbar] = useState(false);
  const [toolbarPosition, setToolbarPosition] = useState({ x: 0, y: 0 });
  const [currentHighlightColor, setCurrentHighlightColor] = useState('#ffeb3b');
  const viewerRef = useRef<HTMLDivElement>(null);
  
  // Create search plugin (we'll use it for search functionality, not user highlighting)
  const searchPluginInstance = searchPlugin();
  
  // Create default layout plugin
  const defaultLayoutPluginInstance = defaultLayoutPlugin({
    sidebarTabs: (defaultTabs) => [
      defaultTabs[0], // Thumbnail tab
      defaultTabs[1], // Bookmark tab
    ],
  });

  // Update PDF file when selectedPDF changes
  useEffect(() => {
    if (selectedPDF) {
      setPdfFile(selectedPDF.dataUrl);
    } else {
      setPdfFile(null);
    }
  }, [selectedPDF]);

  // Handle text selection
  useEffect(() => {
    const handleTextSelection = () => {
      const selection = window.getSelection();
      if (selection && selection.toString().trim()) {
        const text = selection.toString().trim();
        if (text.length > 0) {
          // Check if selection is within a historical highlight
          const range = selection.getRangeAt(0);
          const container = range.commonAncestorContainer;
          const highlightItem = container.nodeType === Node.TEXT_NODE 
            ? container.parentElement?.closest('.highlight-item')
            : (container as Element).closest('.highlight-item');
          
          if (highlightItem) {
            // Don't show toolbar if selecting within historical highlights
            return;
          }
          
          setSelectedText(text);
          
          // Get selection position
          const rect = range.getBoundingClientRect();
          
          setToolbarPosition({
            x: rect.left + rect.width / 2,
            y: rect.top,
          });
          
          setShowHighlightingToolbar(true);
        }
      } else {
        setShowHighlightingToolbar(false);
        setSelectedText('');
      }
    };

    document.addEventListener('mouseup', handleTextSelection);
    document.addEventListener('keyup', handleTextSelection);

    return () => {
      document.removeEventListener('mouseup', handleTextSelection);
      document.removeEventListener('keyup', handleTextSelection);
    };
  }, []);

  const handleHighlight = (highlight: Omit<Annotation, 'id' | 'createdAt'>) => {
    if (selectedPDF && selectedText.trim()) {
      console.log('Handling highlight:', { selectedText, color: highlight.color });
      
      // Set the current highlight color for the search plugin
      setCurrentHighlightColor(highlight.color || '#ffeb3b');
      
      // Try to use search plugin to highlight the selected text
      const { highlight: searchHighlight } = searchPluginInstance;
      console.log('Search plugin methods:', searchPluginInstance);
      
      if (searchHighlight) {
        console.log('Attempting to highlight with search plugin:', selectedText);
        try {
          searchHighlight([selectedText]);
          console.log('Search highlight applied');
        } catch (error) {
          console.log('Search highlight failed:', error);
        }
      } else {
        console.log('No search highlight method available');
      }
      
      // Fallback: Apply our custom highlighting
      applyCustomHighlighting(highlight.color || '#ffeb3b');
      
      const newHighlight = {
        ...highlight,
        pdfId: selectedPDF.id,
        pageNumber: 1, // This would be determined by the PDF viewer
      };
      onAddHighlight(newHighlight);
    }
    
    // Clear selection
    window.getSelection()?.removeAllRanges();
    setShowHighlightingToolbar(false);
    setSelectedText('');
  };

  const applyCustomHighlighting = (color: string) => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const selectedText = range.toString();

    console.log('Applying custom highlighting:', { color, selectedText });

    if (selectedText.trim()) {
      try {
        // For multi-line selections, we need to be more careful
        // First, try to wrap the entire range in a single span
        const highlightSpan = document.createElement('span');
        highlightSpan.setAttribute('style', `background-color: ${color} !important; opacity: 0.7 !important; border-radius: 2px !important; padding: 1px 2px !important; display: inline !important; position: relative !important; z-index: 10 !important; box-shadow: 0 0 0 1px rgba(0,0,0,0.1) !important; line-height: inherit !important; white-space: pre-wrap !important; color: inherit !important;`);
        highlightSpan.className = 'pdf-highlight';
        highlightSpan.setAttribute('data-highlight-color', color);
        highlightSpan.setAttribute('data-highlight-text', selectedText);

        // Try to surround the entire range
        range.surroundContents(highlightSpan);
        console.log('Custom highlighting applied successfully with surroundContents');
        
      } catch (e) {
        console.log('surroundContents failed, trying alternative approach:', e);
        
        // Fallback: handle multi-line selections by wrapping each text node individually
        const walker = document.createTreeWalker(
          range.commonAncestorContainer,
          NodeFilter.SHOW_TEXT,
          {
            acceptNode: (node) => {
              return range.intersectsNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
            }
          }
        );

        const textNodes = [];
        let node;
        while (node = walker.nextNode()) {
          textNodes.push(node);
        }

        console.log('Found text nodes in range:', textNodes);

        if (textNodes.length > 0) {
          // For multi-line selections, we need to be more careful about positioning
          textNodes.forEach((textNode, index) => {
            const parent = textNode.parentElement;
            if (parent) {
              // Check if this is a PDF text element
              if (parent.classList.contains('rpv-core__text') || 
                  parent.tagName === 'SPAN' || 
                  parent.tagName === 'DIV' ||
                  parent.closest('.rpv-core__text-layer')) {
                
                // Create a wrapper span for this specific text node
                const wrapperSpan = document.createElement('span');
                wrapperSpan.setAttribute('style', `background-color: ${color} !important; opacity: 0.7 !important; border-radius: 2px !important; padding: 1px 2px !important; display: inline !important; position: relative !important; z-index: 10 !important; box-shadow: 0 0 0 1px rgba(0,0,0,0.1) !important; line-height: inherit !important; white-space: pre-wrap !important; color: inherit !important;`);
                wrapperSpan.className = 'pdf-highlight';
                wrapperSpan.setAttribute('data-highlight-color', color);
                wrapperSpan.setAttribute('data-highlight-text', selectedText);
                wrapperSpan.setAttribute('data-highlight-index', index.toString());

                // Wrap the text node
                try {
                  const range = document.createRange();
                  range.selectNode(textNode);
                  range.surroundContents(wrapperSpan);
                  console.log('Applied highlighting to text node:', textNode, 'with wrapper:', wrapperSpan);
                } catch (wrapError) {
                  console.log('Failed to wrap text node:', wrapError);
                  // Fallback: apply styling directly to parent
                  parent.setAttribute('style', `background-color: ${color} !important; opacity: 0.7 !important; border-radius: 2px !important; padding: 1px 2px !important; display: inline !important; position: relative !important; z-index: 10 !important; box-shadow: 0 0 0 1px rgba(0,0,0,0.1) !important; line-height: inherit !important; white-space: pre-wrap !important; color: inherit !important;`);
                  parent.classList.add('pdf-highlight');
                  parent.setAttribute('data-highlight-color', color);
                  parent.setAttribute('data-highlight-text', selectedText);
                }
              }
            }
          });
        }
      }
    }
  };

  // Note: Search plugin methods are available through searchPluginInstance

  const handleCloseToolbar = () => {
    setShowHighlightingToolbar(false);
    setSelectedText('');
    window.getSelection()?.removeAllRanges();
  };

  if (!pdfFile) {
    return (
      <div className="upload-area">
        <div className="upload-icon">📄</div>
        <h3>No PDF Selected</h3>
        <p>Use the sidebar to upload and select a PDF document</p>
        <div className="upload-hint">
          <small>Click the "+" button in the Recent PDFs section</small>
        </div>
      </div>
    );
  }

  return (
    <div className="react-pdf-viewer-container" style={{ height: '100%', width: '100%' }} ref={viewerRef}>
      <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js">
        <Viewer
          fileUrl={pdfFile}
          plugins={[defaultLayoutPluginInstance, searchPluginInstance]}
        />
      </Worker>
      
      {showHighlightingToolbar && (
        <HighlightingToolbar
          selectedText={selectedText}
          onHighlight={handleHighlight}
          onClose={handleCloseToolbar}
          position={toolbarPosition}
        />
      )}
    </div>
  );
};
