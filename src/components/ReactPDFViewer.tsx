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
  onHighlightPluginReady?: (plugin: any) => void;
  allHighlights?: Annotation[];
}

export const ReactPDFViewer: React.FC<ReactPDFViewerProps> = ({ 
  selectedPDF, 
  onAddHighlight,
  onHighlightPluginReady,
  allHighlights = []
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
          background: 'white',
          border: '2px solid #007bff',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          padding: '12px',
          position: 'absolute',
          left: `${props.selectionRegion.left}%`,
          top: `${Math.max(10, props.selectionRegion.top - 10)}%`, // Position above selection, with minimum top margin
          transform: 'translate(0, -8px)',
          zIndex: 1000,
          minWidth: '180px',
          maxWidth: '300px',
        }}
      >
        <div style={{ marginBottom: '10px' }}>
          <strong style={{ fontSize: '14px', color: '#333' }}>Choose Highlight Color:</strong>
        </div>
        
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
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
                    // Store all highlight areas for multi-line highlights
                    const firstArea = props.highlightAreas[0];
                    const annotation: Omit<Annotation, 'id' | 'createdAt'> = {
                      type: 'highlight',
                      content: props.selectedText,
                      position: {
                        x: firstArea?.left || props.selectionRegion.left,
                        y: firstArea?.top || props.selectionRegion.top,
                        width: firstArea?.width || props.selectionRegion.width,
                        height: firstArea?.height || props.selectionRegion.height,
                      },
                      pageNumber: firstArea?.pageIndex + 1 || 1,
                      color: color,
                      pdfId: selectedPDF.id,
                      // Store the full highlight areas for proper multi-line rendering
                      highlightAreas: props.highlightAreas.map(area => ({
                        pageIndex: area.pageIndex,
                        left: area.left,
                        top: area.top,
                        width: area.width,
                        height: area.height,
                      })),
                    };
                    onAddHighlight(annotation);
                  }
                
                props.cancel();
              }}
              style={{
                width: '28px',
                height: '28px',
                backgroundColor: color,
                border: '2px solid #ddd',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'transform 0.1s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.1)';
                e.currentTarget.style.borderColor = '#007bff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.borderColor = '#ddd';
              }}
              title={`Highlight in ${color}`}
            />
          ))}
        </div>
        
        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
          <button
            onClick={props.cancel}
            style={{
              background: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              padding: '6px 12px',
              cursor: 'pointer',
              fontSize: '12px',
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

  // Sync highlights from parent component and filter by current PDF
  useEffect(() => {
    if (selectedPDF) {
      // Filter highlights for the current PDF and convert to plugin format
      const pdfHighlights = allHighlights
        .filter(h => h.pdfId === selectedPDF.id)
        .map(h => {
          // Use stored highlight areas if available, otherwise fall back to position
          const areas = h.highlightAreas && h.highlightAreas.length > 0 
            ? h.highlightAreas.map(area => ({
                pageIndex: area.pageIndex,
                left: area.left,
                top: area.top,
                width: area.width,
                height: area.height,
              }))
            : [{
                pageIndex: h.pageNumber - 1, // Convert to 0-based index
                left: h.position.x,
                top: h.position.y,
                width: h.position.width,
                height: h.position.height,
              }];
          
          return {
            id: h.id,
            areas: areas,
            text: h.content,
            color: h.color || '#ffeb3b',
          };
        });
      
      setHighlights(pdfHighlights);
    } else {
      setHighlights([]);
    }
  }, [selectedPDF, allHighlights]);

  // Pass highlight plugin to parent component
  useEffect(() => {
    if (onHighlightPluginReady && highlightPluginInstance) {
      onHighlightPluginReady(highlightPluginInstance);
    }
  }, [highlightPluginInstance]); // Removed onHighlightPluginReady from dependencies


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
