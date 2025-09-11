import React, { useState } from 'react';
import { ReactPDFViewer } from './ReactPDFViewer';
import { PDFManager, PDFDocument } from './PDFManager';

export const ReactApp: React.FC = () => {
  const [selectedPDF, setSelectedPDF] = useState<PDFDocument | null>(null);

  const handlePDFSelect = (pdf: PDFDocument | null) => {
    setSelectedPDF(pdf);
  };

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-left">
          <div className="logo">
            <div className="logo-icon">🕵️</div>
            <span className="logo-text">LawBandit</span>
          </div>
        </div>
        <div className="header-right">
          <div className="subscription-info">
            <span className="pay-amount">470 Pay</span>
            <span className="subscription">Subscription</span>
          </div>
          <div className="timer">
            <span className="timer-icon">⏱️</span>
            <span className="timer-text">00:00:03</span>
          </div>
          <div className="status">
            <span className="status-icon">✓</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content">
        {/* PDF Viewer Section */}
        <section className="pdf-section">
          <ReactPDFViewer selectedPDF={selectedPDF} />
        </section>
        
        {/* Sidebar */}
        <aside className="sidebar">
          <div className="sidebar-content">
            <PDFManager 
              onPDFSelect={handlePDFSelect}
              selectedPDF={selectedPDF}
            />
          </div>
        </aside>
      </main>
    </div>
  );
};
