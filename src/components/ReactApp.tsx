import React, { useState } from 'react';
import { ReactPDFViewer } from './ReactPDFViewer';
import { PDFManager, PDFDocument } from './PDFManager';
import { HistoricalHighlights } from './HistoricalHighlights';
import ChatWithPDF from './ChatWithPDF';
import { Annotation } from '../types';

export const ReactApp: React.FC = () => {
  const [selectedPDF, setSelectedPDF] = useState<PDFDocument | null>(null);
  const [highlights, setHighlights] = useState<Annotation[]>([]);
  const [highlightPlugin, setHighlightPlugin] = useState<any>(null);
  const [showChat, setShowChat] = useState(false);
  const [chatWidth, setChatWidth] = useState(400);
  const [availablePDFs, setAvailablePDFs] = useState<PDFDocument[]>([]);

  const handlePDFSelect = (pdf: PDFDocument | null) => {
    setSelectedPDF(pdf);
  };

  const handleAddHighlight = (highlight: Omit<Annotation, 'id' | 'createdAt'>) => {
    const newHighlight: Annotation = {
      ...highlight,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      createdAt: new Date(),
    };
    setHighlights(prev => [...prev, newHighlight]);
  };

  const handleUpdateHighlight = (id: string, updates: Partial<Annotation>) => {
    setHighlights(prev => 
      prev.map(highlight => 
        highlight.id === id ? { ...highlight, ...updates } : highlight
      )
    );
  };

  const handleDeleteHighlight = (id: string) => {
    setHighlights(prev => prev.filter(highlight => highlight.id !== id));
  };

  const handleLocateHighlight = (highlight: Annotation) => {
    if (highlightPlugin && highlightPlugin.jumpToHighlightArea) {
      // Convert our annotation position to HighlightArea format
      const highlightArea = {
        pageIndex: highlight.pageNumber - 1, // Convert to 0-based index
        left: highlight.position.x,
        top: highlight.position.y,
        width: highlight.position.width,
        height: highlight.position.height,
      };
      
      try {
        highlightPlugin.jumpToHighlightArea(highlightArea);
        console.log('Jumped to highlight area:', highlightArea);
      } catch (error) {
        console.error('Failed to jump to highlight area:', error);
        // Fallback to alert if jump fails
        alert(`Locating highlight: "${highlight.content}" on page ${highlight.pageNumber}`);
      }
    } else {
      // Fallback if plugin not ready
      alert(`Locating highlight: "${highlight.content}" on page ${highlight.pageNumber}`);
    }
  };

  const handleToggleChat = () => {
    setShowChat(!showChat);
  };

  const handleCloseChat = () => {
    setShowChat(false);
  };

  const handlePDFsUpdate = (pdfs: PDFDocument[]) => {
    setAvailablePDFs(pdfs);
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
      <main className={`main-content ${showChat ? 'chat-open' : ''}`}>
            {/* PDF Viewer Section */}
            <section 
              className="pdf-section"
              style={showChat ? { width: `calc(100% - ${chatWidth}px)` } : {}}
            >
              <ReactPDFViewer 
                selectedPDF={selectedPDF}
                onAddHighlight={handleAddHighlight}
                onHighlightPluginReady={setHighlightPlugin}
                allHighlights={highlights}
              />
            </section>

            {/* Sidebar */}
            {!showChat && (
              <aside className="sidebar">
                <div className="sidebar-content">
                  <PDFManager
                    onPDFSelect={handlePDFSelect}
                    selectedPDF={selectedPDF}
                    onToggleChat={handleToggleChat}
                    onPDFsUpdate={handlePDFsUpdate}
                  />
                  
                  <HistoricalHighlights
                    highlights={highlights}
                    onUpdateHighlight={handleUpdateHighlight}
                    onDeleteHighlight={handleDeleteHighlight}
                    onLocateHighlight={handleLocateHighlight}
                    selectedPDF={selectedPDF}
                  />
                </div>
              </aside>
            )}

            {/* Chat Component */}
            {showChat && (
              <ChatWithPDF
                selectedPDF={selectedPDF}
                onClose={handleCloseChat}
                chatWidth={chatWidth}
                onChatWidthChange={setChatWidth}
                availablePDFs={availablePDFs}
              />
            )}
      </main>
    </div>
  );
};
