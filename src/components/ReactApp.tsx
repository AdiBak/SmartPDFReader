import React, { useState, useEffect } from 'react';
import { ReactPDFViewer } from './ReactPDFViewer';
import { PDFManager, PDFDocument } from './PDFManager';
import { HistoricalHighlights } from './HistoricalHighlights';
import ChatWithPDF from './ChatWithPDF';
import { ChatList } from './ChatList';
import { Auth } from './Auth';
import { Annotation } from '../types';
import { databaseService, Conversation } from '../services/databaseService';
import { RAGService } from '../services/ragService';
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
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [ragService, setRagService] = useState<RAGService | null>(null);

  const showSaveFeedback = async (saveOperation: () => Promise<void>) => {
    setSaveStatus('saving');
    try {
      await saveOperation();
      setSaveStatus('saved');
      // Hide the checkmark after 2 seconds
      setTimeout(() => {
        setSaveStatus('idle');
      }, 2000);
    } catch (error) {
      console.error('Save operation failed:', error);
      setSaveStatus('idle');
    }
  };

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
      await showSaveFeedback(async () => {
        console.log('Saving highlight to database for PDF:', selectedPDF.id);
        const savedId = await databaseService.saveHighlight(newHighlight, selectedPDF.id);
        console.log('Highlight saved with ID:', savedId);
        // Update the highlight with the real UUID from database
        setHighlights(prev => 
          prev.map(h => h.id === tempId ? { ...h, id: savedId } : h)
        );
      });
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
    await showSaveFeedback(async () => {
      await databaseService.updateHighlight(id, updates);
    });
  };

  const handleDeleteHighlight = async (id: string) => {
    setHighlights(prev => prev.filter(highlight => highlight.id !== id));
    
    // Delete from database
    await showSaveFeedback(async () => {
      await databaseService.deleteHighlight(id);
    });
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
    
    // Initialize RAG service
    try {
      const openaiApiKey = import.meta.env.VITE_OPENAI_API_KEY;
      if (openaiApiKey) {
        const ragService = new RAGService({
          openaiApiKey,
          maxChunks: 10,
          temperature: 0.7
        });
        setRagService(ragService);
        console.log('RAG service initialized successfully');
      } else {
        console.warn('OpenAI API key not found, RAG functionality will be limited');
      }
    } catch (error) {
      console.error('Error initializing RAG service:', error);
    }
    
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
    setShowUserDropdown(false);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.user-dropdown')) {
        setShowUserDropdown(false);
      }
    };

    if (showUserDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showUserDropdown]);

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
            <img 
              src="https://www.lawbandit.com/lawbandit-logo-yellow.svg" 
              alt="LawBandit" 
              className="logo-icon"
            />
          </div>
        </div>
        <div className="header-right">
          <div className="status">
            {saveStatus === 'saving' && (
              <div className="spinner"></div>
            )}
            {saveStatus === 'saved' && (
              <span className="status-icon">✓</span>
            )}
          </div>
          <div className="user-dropdown">
            <button 
              className="user-dropdown-toggle"
              onClick={() => setShowUserDropdown(!showUserDropdown)}
              title="User menu"
            >
              <i className="fas fa-user"></i>
              <span className="user-name">{currentUser}</span>
              <i className={`fas fa-chevron-down ${showUserDropdown ? 'rotated' : ''}`}></i>
            </button>
            {showUserDropdown && (
              <div className="user-dropdown-menu">
                <div className="user-info">
                  <i className="fas fa-user"></i>
                  <span>{currentUser}</span>
                </div>
                <hr />
                <button 
                  className="logout-option"
                  onClick={handleLogout}
                >
                  <i className="fas fa-sign-out-alt"></i>
                  <span>Logout</span>
                </button>
              </div>
            )}
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
                    onPDFsUpdate={handlePDFsUpdate}
                    pdfs={pdfs}
                    ragService={ragService}
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
                ragService={ragService}
              />
            )}
      </main>
    </div>
  );
};
