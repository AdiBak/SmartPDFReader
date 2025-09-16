import React, { useState } from 'react';
import { ReactPDFViewer } from './ReactPDFViewer';
import { PDFManager, PDFDocument } from './PDFManager';
import { HistoricalHighlights } from './HistoricalHighlights';
import ChatWithPDF from './ChatWithPDF';
import { ChatList } from './ChatList';
import { Auth } from './Auth';
import { Annotation } from '../types';
import { databaseService, Conversation } from '../services/databaseService';
import { v4 as uuidv4 } from 'uuid';

export const ReactApp: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [selectedPDF, setSelectedPDF] = useState<PDFDocument | null>(null);
  const [highlights, setHighlights] = useState<Annotation[]>([]);
  const [highlightPlugin, setHighlightPlugin] = useState<any>(null);
  const [showChat, setShowChat] = useState(false);
  const [chatWidth, setChatWidth] = useState(400);
  const [availablePDFs, setAvailablePDFs] = useState<PDFDocument[]>([]);
  const [pdfs, setPdfs] = useState<PDFDocument[]>([]);
  const [selectedChat, setSelectedChat] = useState<Conversation | null>(null);
  const [chatRefreshTrigger, setChatRefreshTrigger] = useState(0);

  const handlePDFSelect = async (pdf: PDFDocument | null) => {
    console.log('handlePDFSelect called with:', pdf);
    setSelectedPDF(pdf);
    
    // Load highlights for the selected PDF
    if (pdf) {
      try {
        console.log('Loading highlights for PDF:', pdf.id);
        const dbHighlights = await databaseService.getHighlights(pdf.id);
        console.log('Loaded highlights from database:', dbHighlights);
        setHighlights(dbHighlights);
      } catch (error) {
        console.error('Error loading highlights:', error);
        setHighlights([]);
      }
    } else {
      console.log('No PDF selected, clearing highlights');
      setHighlights([]);
    }
  };

  const handleAddHighlight = async (highlight: Omit<Annotation, 'id' | 'createdAt'>) => {
    console.log('handleAddHighlight called with:', highlight);
    const tempId = uuidv4(); // Temporary ID for immediate UI update
    const newHighlight: Annotation = {
      ...highlight,
      id: tempId,
      createdAt: new Date(),
    };
    
    console.log('Adding highlight to UI:', newHighlight);
    setHighlights(prev => [...prev, newHighlight]);
    
    // Save to database and update with real UUID
    if (selectedPDF) {
      try {
        console.log('Saving highlight to database for PDF:', selectedPDF.id);
        const savedId = await databaseService.saveHighlight(newHighlight, selectedPDF.id);
        console.log('Highlight saved with ID:', savedId);
        // Update the highlight with the real UUID from database
        setHighlights(prev => 
          prev.map(h => h.id === tempId ? { ...h, id: savedId } : h)
        );
      } catch (error) {
        console.error('Error saving highlight to database:', error);
        // Remove the highlight if saving failed
        setHighlights(prev => prev.filter(h => h.id !== tempId));
      }
    } else {
      console.warn('No selected PDF, cannot save highlight');
    }
  };

  const handleUpdateHighlight = async (id: string, updates: Partial<Annotation>) => {
    setHighlights(prev => 
      prev.map(highlight => 
        highlight.id === id ? { ...highlight, ...updates } : highlight
      )
    );
    
    // Update in database
    try {
      await databaseService.updateHighlight(id, updates);
    } catch (error) {
      console.error('Error updating highlight in database:', error);
    }
  };

  const handleDeleteHighlight = async (id: string) => {
    setHighlights(prev => prev.filter(highlight => highlight.id !== id));
    
    // Delete from database
    try {
      await databaseService.deleteHighlight(id);
    } catch (error) {
      console.error('Error deleting highlight from database:', error);
    }
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
    setSelectedChat(null);
  };

  const handleChatSelect = (chat: Conversation | null) => {
    setSelectedChat(chat);
    if (chat) {
      setShowChat(true);
    }
  };

  const handleChatUpdate = (chat: Conversation) => {
    setSelectedChat(chat);
    // Trigger refresh of chat list
    setChatRefreshTrigger(prev => prev + 1);
  };

  const handleChatDelete = (chatId: string) => {
    // If the deleted chat was selected, close the chat
    if (selectedChat?.id === chatId) {
      setShowChat(false);
      setSelectedChat(null);
    }
    // Trigger refresh of chat list
    setChatRefreshTrigger(prev => prev + 1);
  };

  const handlePDFsUpdate = (updatedPdfs: PDFDocument[]) => {
    setPdfs(updatedPdfs);
    setAvailablePDFs(updatedPdfs);
  };

  const handleLogin = async (username: string) => {
    setCurrentUser(username);
    setIsAuthenticated(true);
    
    // Load user data from database
    try {
      // PDFs will be loaded by PDFManager component
      // Highlights will be loaded when a PDF is selected
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const handleLogout = () => {
    // Logout from database service
    databaseService.logout();
    
    setCurrentUser(null);
    setIsAuthenticated(false);
    // Clear all user data
    setSelectedPDF(null);
    setHighlights([]);
    setPdfs([]);
    setAvailablePDFs([]);
    setShowChat(false);
  };

  // Show auth screen if not authenticated
  if (!isAuthenticated) {
    return <Auth onLogin={handleLogin} />;
  }

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
          <div className="user-info">
            <span className="user-name">👤 {currentUser}</span>
          </div>
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
          <button 
            className="logout-button"
            onClick={handleLogout}
            title="Logout"
          >
            🚪
          </button>
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
                    pdfs={pdfs}
                  />
                  
                  <ChatList
                    onChatSelect={handleChatSelect}
                    selectedChat={selectedChat}
                    availablePDFs={availablePDFs}
                    refreshTrigger={chatRefreshTrigger}
                    onChatDelete={handleChatDelete}
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
                selectedConversation={selectedChat}
                onConversationUpdate={handleChatUpdate}
              />
            )}
      </main>
    </div>
  );
};
