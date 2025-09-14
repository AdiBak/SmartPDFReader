import React, { useState, useEffect, useRef } from 'react';
import { Viewer, Worker } from '@react-pdf-viewer/core';
import { defaultLayoutPlugin } from '@react-pdf-viewer/default-layout';
import { searchPlugin } from '@react-pdf-viewer/search';
import { highlightPlugin, RenderHighlightTargetProps, RenderHighlightContentProps, RenderHighlightsProps, HighlightArea, SelectionData } from '@react-pdf-viewer/highlight';
import { PDFDocument } from './PDFManager';
import { HighlightingToolbar } from './HighlightingToolbar';
import { Annotation } from '../types';

// Import styles
import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/default-layout/lib/styles/index.css';
import '@react-pdf-viewer/search/lib/styles/index.css';
import '@react-pdf-viewer/highlight/lib/styles/index.css';

interface ReactPDFViewerProps {
  selectedPDF: PDFDocument | null;
  onAddHighlight: (highlight: Omit<Annotation, 'id' | 'createdAt'>) => void;
}

export const ReactPDFViewer: React.FC<ReactPDFViewerProps> = ({ 
  selectedPDF, 
  onAddHighlight 
}) => {
  const [pdfFile, setPdfFile] = useState<string | null>(null);
  const [highlights, setHighlights] = useState<Array<{id: string, areas: HighlightArea[], text: string, color: string}>>([]);
  const viewerRef = useRef<HTMLDivElement>(null);
  
  // Create search plugin (we'll use it for search functionality, not user highlighting)
  const searchPluginInstance = searchPlugin();
  
  // Create highlight plugin
  const highlightPluginInstance = highlightPlugin({
    renderHighlightTarget: (props: RenderHighlightTargetProps) => (
      <div
        style={{
          background: '#007bff',
          borderRadius: '4px',
          display: 'flex',
          position: 'absolute',
          left: `${props.selectionRegion.left}%`,
          top: `${props.selectionRegion.top + props.selectionRegion.height}%`,
          transform: 'translate(0, 8px)',
          zIndex: 1000,
        }}
      >
        <button
          onClick={props.toggle}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'white',
            padding: '8px 12px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
          }}
        >
          🖍️ Highlight
        </button>
      </div>
    ),
    renderHighlightContent: (props: RenderHighlightContentProps) => (
      <div
        style={{
          background: 'white',
          border: '2px solid #007bff',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          padding: '16px',
          position: 'absolute',
          left: `${props.selectionRegion.left}%`,
          top: `${props.selectionRegion.top + props.selectionRegion.height}%`,
          transform: 'translate(0, 8px)',
          zIndex: 1000,
          minWidth: '200px',
        }}
      >
        <div style={{ marginBottom: '12px' }}>
          <strong>Selected Text:</strong>
          <div style={{ marginTop: '4px', fontStyle: 'italic', color: '#666' }}>
            "{props.selectedText}"
          </div>
        </div>
        
        <div style={{ marginBottom: '12px' }}>
          <strong>Choose Color:</strong>
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            {['#ffeb3b', '#4caf50', '#2196f3', '#e91e63', '#ff9800', '#9c27b0'].map((color) => (
              <button
                key={color}
                onClick={() => {
                  const newHighlight = {
                    id: Date.now().toString(),
                    areas: props.highlightAreas,
                    text: props.selectedText,
                    color: color,
                  };
                  setHighlights(prev => [...prev, newHighlight]);
                  
                  // Also add to our annotation system
                  if (selectedPDF) {
                    const annotation: Omit<Annotation, 'id' | 'createdAt'> = {
                      type: 'highlight',
                      content: props.selectedText,
                      position: {
                        x: props.selectionRegion.left,
                        y: props.selectionRegion.top,
                        width: props.selectionRegion.width,
                        height: props.selectionRegion.height,
                      },
                      pageNumber: props.highlightAreas[0]?.pageIndex + 1 || 1,
                      color: color,
                      pdfId: selectedPDF.id,
                    };
                    onAddHighlight(annotation);
                  }
                  
                  props.cancel();
                }}
                style={{
                  width: '24px',
                  height: '24px',
                  backgroundColor: color,
                  border: '2px solid #ddd',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
                title={`Highlight in ${color}`}
              />
            ))}
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={props.cancel}
            style={{
              background: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              padding: '8px 16px',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    ),
    renderHighlights: (props: RenderHighlightsProps) => (
      <div>
        {highlights.map((highlight) => (
          <React.Fragment key={highlight.id}>
            {highlight.areas
              .filter((area) => area.pageIndex === props.pageIndex)
              .map((area, idx) => (
                <div
                  key={idx}
                  style={Object.assign(
                    {},
                    {
                      background: highlight.color,
                      opacity: 0.7,
                      borderRadius: '2px',
                    },
                    props.getCssProperties(area, props.rotation)
                  )}
                />
              ))}
          </React.Fragment>
        ))}
      </div>
    ),
  });
  
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

  // Clear highlights when PDF changes
  useEffect(() => {
    if (selectedPDF) {
      setHighlights([]);
    }
  }, [selectedPDF]);


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
          plugins={[defaultLayoutPluginInstance, searchPluginInstance, highlightPluginInstance]}
        />
      </Worker>
    </div>
  );
};
