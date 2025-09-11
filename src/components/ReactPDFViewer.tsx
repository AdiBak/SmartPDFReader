import React, { useState, useEffect } from 'react';
import { Viewer, Worker } from '@react-pdf-viewer/core';
import { defaultLayoutPlugin } from '@react-pdf-viewer/default-layout';
import { PDFDocument } from './PDFManager';

// Import styles
import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/default-layout/lib/styles/index.css';

interface ReactPDFViewerProps {
  selectedPDF: PDFDocument | null;
}

export const ReactPDFViewer: React.FC<ReactPDFViewerProps> = ({ selectedPDF }) => {
  const [pdfFile, setPdfFile] = useState<string | null>(null);
  
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
    <div className="react-pdf-viewer-container" style={{ height: '100%', width: '100%' }}>
      <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js">
        <Viewer
          fileUrl={pdfFile}
          plugins={[defaultLayoutPluginInstance]}
        />
      </Worker>
    </div>
  );
};
