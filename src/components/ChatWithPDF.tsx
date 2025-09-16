import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { PDFDocument } from './PDFManager';
import { RAGService, RAGResponse } from '../services/ragService';
import { databaseService, ChatMessage, Conversation } from '../services/databaseService';

interface ChatWithPDFProps {
  selectedPDF: PDFDocument | null;
  onClose: () => void;
  chatWidth: number;
  onChatWidthChange: (width: number) => void;
  availablePDFs: PDFDocument[];
  selectedConversation: Conversation | null;
  onConversationUpdate: (conversation: Conversation) => void;
}

// ChatMessage interface is now imported from databaseService

const ChatWithPDF: React.FC<ChatWithPDFProps> = ({ 
  selectedPDF, 
  onClose, 
  chatWidth, 
  onChatWidthChange, 
  availablePDFs, 
  selectedConversation, 
  onConversationUpdate 
}) => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [selectedPDFs, setSelectedPDFs] = useState<string[]>([]);
  const [showPDFSelector, setShowPDFSelector] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [ragService, setRagService] = useState<RAGService | null>(null);
  const [error, setError] = useState<string | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const isResizing = useRef(false);

  console.log('ChatWithPDF rendered with:', { selectedPDF, availablePDFs, chatWidth });

  // Initialize RAG service
  useEffect(() => {
    try {
      // Use environment variable for OpenAI API key
      const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
      
      if (apiKey) {
        const rag = new RAGService({
          openaiApiKey: apiKey,
          maxChunks: 5,
          temperature: 0.7,
        });
        setRagService(rag);
        console.log('RAG service initialized successfully with OpenAI');
        setError(null);
      } else {
        console.warn('OpenAI API key not found. Please create a .env file with VITE_OPENAI_API_KEY=your_api_key_here');
        setRagService(null);
        setError('OpenAI API key not found');
      }
    } catch (err) {
      console.error('Error initializing RAG service:', err);
      setError('Failed to initialize RAG service');
    }
  }, []);

  // Initialize with selected conversation
  useEffect(() => {
    if (selectedConversation) {
      setMessages(selectedConversation.messages);
      // If it's a new chat with no PDFs, default to the currently selected PDF
      if (selectedConversation.pdfIds.length === 0 && selectedPDF) {
        setSelectedPDFs([selectedPDF.id]);
      } else {
        setSelectedPDFs(selectedConversation.pdfIds);
      }
    } else {
      setMessages([]);
      setSelectedPDFs([]);
    }
  }, [selectedConversation, selectedPDF]);

  // Initialize with current PDF if no conversation is selected
  useEffect(() => {
    if (!selectedConversation && selectedPDF && selectedPDFs.length === 0) {
      setSelectedPDFs([selectedPDF.id]);
    }
  }, [selectedPDF, selectedPDFs.length, selectedConversation]);

  // Removed immediate saving - conversations will be saved after first message

  // Removed loadChatMessages - now handled by conversation system

  const saveConversation = async (conversation: Conversation) => {
    try {
      console.log('Saving conversation:', conversation);
      await databaseService.saveConversation(conversation);
      console.log('Conversation saved successfully');
      onConversationUpdate(conversation);
    } catch (error) {
      console.error('Error saving conversation:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || selectedPDFs.length === 0) return;
    
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: inputText,
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, userMessage]);
    const query = inputText;
    setInputText('');
    setIsProcessing(true);
    
    try {
      if (!ragService) {
        // Fallback when RAG service is not available
        const fallbackMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          type: 'assistant',
          content: "RAG service is not available. Please create a .env file with VITE_OPENAI_API_KEY=your_api_key_here",
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, fallbackMessage]);
        return;
      }

      // Process PDFs if not already processed
      const pdfsToProcess = availablePDFs.filter(pdf => 
        selectedPDFs.includes(pdf.id) && !ragService.isPDFProcessed(pdf.id)
      );
      
      if (pdfsToProcess.length > 0) {
        await ragService.processMultiplePDFs(pdfsToProcess);
      }
      
      // Query the RAG system
      const response = await ragService.query(query, selectedPDFs);
      
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: response.answer,
        timestamp: new Date(),
        sources: response.sources,
      };
      
      setMessages(prev => {
        const newMessages = [...prev, assistantMessage];
        // Save conversation to database
        if (selectedConversation) {
          const updatedConversation = {
            ...selectedConversation,
            messages: newMessages,
            pdfIds: selectedPDFs,
            updatedAt: new Date()
          };
          saveConversation(updatedConversation);
        }
        return newMessages;
      });
    } catch (error) {
      console.error('Error processing query:', error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: "Sorry, I encountered an error while processing your question. Please try again.",
        timestamp: new Date(),
      };
      setMessages(prev => {
        const newMessages = [...prev, errorMessage];
        // Save conversation to database
        if (selectedConversation) {
          const updatedConversation = {
            ...selectedConversation,
            messages: newMessages,
            pdfIds: selectedPDFs,
            updatedAt: new Date()
          };
          saveConversation(updatedConversation);
        }
        return newMessages;
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handlePDFToggle = (pdfId: string) => {
    setSelectedPDFs(prev => {
      const newSelectedPDFs = prev.includes(pdfId) 
        ? prev.filter(id => id !== pdfId)
        : [...prev, pdfId];
      
      // Update conversation with new PDF selection
      if (selectedConversation) {
        const updatedConversation = {
          ...selectedConversation,
          pdfIds: newSelectedPDFs,
          updatedAt: new Date()
        };
        saveConversation(updatedConversation);
      }
      
      return newSelectedPDFs;
    });
  };

  // Resize functionality
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      
      const newWidth = window.innerWidth - e.clientX;
      const minWidth = 300;
      const maxWidth = 600;
      
      if (newWidth >= minWidth && newWidth <= maxWidth) {
        onChatWidthChange(newWidth);
      }
    };

    const handleMouseUp = () => {
      isResizing.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    // Always add listeners, but only act if isResizing is true
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [onChatWidthChange]);

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  return (
    <div 
      ref={chatContainerRef}
      className={`chat-container ${isDarkMode ? 'dark-mode' : 'light-mode'}`}
      style={{ width: `${chatWidth}px` }}
    >
      {/* Resize Handle */}
      <div 
        className="chat-resize-handle"
        onMouseDown={handleResizeStart}
      />
      
      {/* Chat Header */}
      <div className="chat-header">
        <div className="chat-title">
          <h3>Chat with PDF</h3>
          <div className="pdf-selection">
            <button 
              className="pdf-selector-btn"
              onClick={() => setShowPDFSelector(!showPDFSelector)}
            >
              📄 {selectedPDFs.length === 0 ? 'Select PDFs' : `${selectedPDFs.length} PDF${selectedPDFs.length > 1 ? 's' : ''} selected`}
            </button>
            {showPDFSelector && (
              <div className="pdf-selector-dropdown">
                {availablePDFs.map(pdf => (
                  <label key={pdf.id} className="pdf-option">
                    <input
                      type="checkbox"
                      checked={selectedPDFs.includes(pdf.id)}
                      onChange={() => handlePDFToggle(pdf.id)}
                    />
                    <span className="pdf-option-name">{pdf.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="chat-controls">
          <button 
            className="theme-toggle"
            onClick={() => setIsDarkMode(!isDarkMode)}
            title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDarkMode ? '☀️' : '🌙'}
          </button>
          <button 
            className="close-chat"
            onClick={onClose}
            title="Close chat"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="error-message" style={{ 
          padding: '10px', 
          margin: '10px', 
          backgroundColor: '#ffebee', 
          color: '#c62828', 
          borderRadius: '4px',
          border: '1px solid #ffcdd2'
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* Chat Messages */}
      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="welcome-message">
            <p>👋 Hi! I'm here to help you understand your PDF.</p>
            <p>Ask me questions about the content, request summaries, or get explanations of specific sections.</p>
          </div>
        ) : (
          messages.map(message => (
            <div key={message.id} className={`message ${message.type}`}>
              <div className="message-content">
                {message.type === 'assistant' ? (
                  <ReactMarkdown
                    remarkPlugins={[remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                  >
                    {message.content}
                  </ReactMarkdown>
                ) : (
                  message.content
                )}
                {message.sources && message.sources.length > 0 && (
                  <div className="message-sources">
                    <div className="sources-header">📚 Sources:</div>
                    {message.sources.map((source, index) => (
                      <div key={index} className="source-item">
                        <span className="source-pdf">{source.pdfName}</span>
                        <span className="source-page">Page {source.pageNumber}</span>
                        <div className="source-text">{source.text.substring(0, 100)}...</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="message-time">
                {message.timestamp instanceof Date 
                  ? message.timestamp.toLocaleTimeString() 
                  : new Date(message.timestamp).toLocaleTimeString()}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Chat Input */}
      <div className="chat-input-container">
        <div className="chat-input">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={selectedPDFs.length === 0 ? "Select PDFs first to ask questions..." : "Ask a question about the selected PDFs..."}
            rows={1}
            className="message-input"
          />
          <button 
            className="send-button"
            onClick={handleSendMessage}
            disabled={!inputText.trim() || selectedPDFs.length === 0 || isProcessing}
          >
            {isProcessing ? 'Processing...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatWithPDF;
