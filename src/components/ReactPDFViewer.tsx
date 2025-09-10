import React, { useState } from 'react';
import { Viewer, Worker } from '@react-pdf-viewer/core';
import { defaultLayoutPlugin } from '@react-pdf-viewer/default-layout';

// Import styles
import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/default-layout/lib/styles/index.css';

interface ReactPDFViewerProps {
  fileUrl?: string;
}

export const ReactPDFViewer: React.FC<ReactPDFViewerProps> = ({ fileUrl }) => {
  const [pdfFile, setPdfFile] = useState<string | null>(fileUrl || null);
  
  // Create default layout plugin
  const defaultLayoutPluginInstance = defaultLayoutPlugin({
    sidebarTabs: (defaultTabs) => [
      defaultTabs[0], // Thumbnail tab
      defaultTabs[1], // Bookmark tab
    ],
  });

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      const url = URL.createObjectURL(file);
      setPdfFile(url);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') {
      const url = URL.createObjectURL(file);
      setPdfFile(url);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  if (!pdfFile) {
    return (
      <div 
        className="upload-area"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={() => document.getElementById('pdf-upload')?.click()}
      >
        <div className="upload-icon">📄</div>
        <h3>Upload a PDF Document</h3>
        <p>Drag and drop your PDF here, or click to browse</p>
        <div className="upload-hint">
          <small>Maximum file size: 50MB</small>
        </div>
        <input
          id="pdf-upload"
          type="file"
          accept=".pdf"
          onChange={handleFileUpload}
          style={{ display: 'none' }}
        />
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
