import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { PDFDocument } from './PDFManager';
import { RAGService } from '../services/ragService';
import { databaseService, ChatMessage, Conversation } from '../services/databaseService';

// Simple debounce utility
function debounce<T extends (...args: any[]) => any>(func: T, wait: number): T {
  let timeout: NodeJS.Timeout;
  return ((...args: any[]) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  }) as T;
}

interface ChatWithPDFProps {
  selectedPDF: PDFDocument | null;
  onClose: () => void;
  chatWidth: number;
  onChatWidthChange: (width: number) => void;
  availablePDFs: PDFDocument[];
  selectedConversation: Conversation | null;
  onConversationUpdate: (conversation: Conversation) => void;
  ragService?: RAGService;
}

// ChatMessage interface is now imported from databaseService

const ChatWithPDF: React.FC<ChatWithPDFProps> = ({ 
  selectedPDF, 
  onClose, 
  chatWidth, 
  onChatWidthChange, 
  availablePDFs, 
  selectedConversation, 
  onConversationUpdate,
  ragService: externalRagService
}) => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [selectedPDFs, setSelectedPDFs] = useState<string[]>([]);
  const [showPDFSelector, setShowPDFSelector] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isProcessingPDFs, setIsProcessingPDFs] = useState(false);
  const [ragService, setRagService] = useState<RAGService | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set());
  
  // TTS state
  const [ttsState, setTtsState] = useState<{
    speakingMessageId: string | null;
    isPaused: boolean;
    utterance: SpeechSynthesisUtterance | null;
  }>({
    speakingMessageId: null,
    isPaused: false,
    utterance: null
  });
  
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const isResizing = useRef(false);

  console.log('ChatWithPDF rendered with:', { selectedPDF, availablePDFs, chatWidth });

  // Initialize RAG service
  useEffect(() => {
    if (externalRagService) {
      // Use external RAG service if provided
      setRagService(externalRagService);
      console.log('Using external RAG service');
      setError(null);
    } else {
      // Create own RAG service if none provided
      try {
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
    }
  }, [externalRagService]);

  // Initialize with selected conversation
  useEffect(() => {
    if (selectedConversation) {
      setMessages(selectedConversation.messages);
      // If it's a new chat with no PDFs, default to the currently selected PDF
      if (selectedConversation.pdfIds.length === 0 && selectedPDF) {
        setSelectedPDFs([selectedPDF.id]);
        // Update the conversation with the default PDF and save to database
        const updatedConversation = {
          ...selectedConversation,
          pdfIds: [selectedPDF.id],
          updatedAt: new Date()
        };
        onConversationUpdate(updatedConversation);
        saveConversation(updatedConversation);
      } else {
        setSelectedPDFs(selectedConversation.pdfIds);
        // Save the conversation even if it has no messages yet
        saveConversation(selectedConversation);
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

  // Debounced save to prevent too many rapid saves
  const saveConversation = useCallback(
    debounce(async (conversation: Conversation) => {
      try {
        console.log('Saving conversation:', conversation);
        await databaseService.saveConversation(conversation);
        console.log('Conversation saved successfully');
        onConversationUpdate(conversation);
      } catch (error) {
        console.error('Error saving conversation:', error);
      }
    }, 500), // 500ms debounce
    [onConversationUpdate]
  );

  // Filter out deleted PDFs from selectedPDFs when availablePDFs changes
  useEffect(() => {
    if (selectedPDFs.length > 0) {
      const validPDFIds = selectedPDFs.filter(pdfId => 
        availablePDFs.some(pdf => pdf.id === pdfId)
      );
      
      if (validPDFIds.length !== selectedPDFs.length) {
        setSelectedPDFs(validPDFIds);
        
        // Update conversation with filtered PDF IDs if we have a selected conversation
        if (selectedConversation && validPDFIds.length !== selectedConversation.pdfIds.length) {
          const updatedConversation = {
            ...selectedConversation,
            pdfIds: validPDFIds,
            updatedAt: new Date()
          };
          onConversationUpdate(updatedConversation);
          saveConversation(updatedConversation);
        }
      }
    }
  }, [availablePDFs, selectedConversation, onConversationUpdate, saveConversation]);

  // Background PDF processing when PDFs are selected
  useEffect(() => {
    const processSelectedPDFs = async () => {
      console.log(`🔍 Background processing check:`, {
        selectedPDFs: selectedPDFs.length,
        availablePDFs: availablePDFs.length,
        ragService: !!ragService
      });
      
      if (selectedPDFs.length === 0 || !ragService) {
        console.log(`⏭️ Skipping background processing - no PDFs selected or no RAG service`);
        return;
      }
      
      const pdfsToProcess = availablePDFs.filter(pdf => 
        selectedPDFs.includes(pdf.id) && !ragService.isPDFProcessed(pdf.id)
      );
      
      console.log(`📋 PDFs to process:`, pdfsToProcess.map(p => p.name));
      console.log(`📋 Already processed PDFs:`, availablePDFs
        .filter(pdf => selectedPDFs.includes(pdf.id) && ragService.isPDFProcessed(pdf.id))
        .map(p => p.name));
      
      if (pdfsToProcess.length > 0) {
        console.log(`🚀 Background processing ${pdfsToProcess.length} PDFs...`);
        setIsProcessingPDFs(true);
        try {
          await ragService.processMultiplePDFs(pdfsToProcess);
          console.log(`✅ Background PDF processing completed for ${pdfsToProcess.length} PDFs`);
        } catch (error) {
          console.error(`❌ Background PDF processing failed:`, error);
        } finally {
          setIsProcessingPDFs(false);
        }
      } else {
        console.log(`✅ All selected PDFs are already processed`);
      }
    };

    // Process PDFs after a short delay to avoid processing on every selection change
    console.log(`⏰ Setting 1000ms timeout for background PDF processing...`);
    const timeoutId = setTimeout(processSelectedPDFs, 1000);
    return () => {
      console.log(`🧹 Clearing background processing timeout`);
      clearTimeout(timeoutId);
    };
  }, [selectedPDFs, availablePDFs, ragService]);

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

      // Process PDFs if not already processed (optimized check)
      const pdfsToProcess = availablePDFs.filter(pdf => 
        selectedPDFs.includes(pdf.id) && !ragService.isPDFProcessed(pdf.id)
      );
      
      if (pdfsToProcess.length > 0) {
        console.log(`Processing ${pdfsToProcess.length} PDFs for query`);
        setIsProcessingPDFs(true);
        try {
          await ragService.processMultiplePDFs(pdfsToProcess);
        } finally {
          setIsProcessingPDFs(false);
        }
      } else {
        console.log('All selected PDFs already processed, skipping processing');
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

  const handleCopyResponse = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      // You could add a toast notification here
      console.log('Response copied to clipboard');
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = content;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
  };

  const handleEditMessage = (messageId: string, currentContent: string) => {
    setEditingMessageId(messageId);
    setEditText(currentContent);
  };

  const handleSaveEdit = async () => {
    if (!editingMessageId || !editText.trim()) return;

    // Update the user message
    const updatedMessages = messages.map(msg => 
      msg.id === editingMessageId 
        ? { ...msg, content: editText.trim() }
        : msg
    );

    // Remove any assistant messages that came after the edited user message
    const editedMessageIndex = updatedMessages.findIndex(msg => msg.id === editingMessageId);
    const messagesUpToEdit = updatedMessages.slice(0, editedMessageIndex + 1);
    
    setMessages(messagesUpToEdit);
    setEditingMessageId(null);
    setEditText('');

    // Automatically send the edited message to get a new AI response
    if (ragService && selectedPDFs.length > 0) {
      setIsProcessing(true);
      setError(null);

      try {
        const response = await ragService.query(editText.trim(), selectedPDFs);
        
        const assistantMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          type: 'assistant',
          content: response.answer,
          timestamp: new Date(),
          sources: response.sources,
        };

        const finalMessages = [...messagesUpToEdit, assistantMessage];
        setMessages(finalMessages);

        // Save the updated conversation with the new response
        if (selectedConversation) {
          const updatedConversation = {
            ...selectedConversation,
            messages: finalMessages,
            updatedAt: new Date()
          };
          saveConversation(updatedConversation);
        }
      } catch (error) {
        console.error('Error getting AI response for edited message:', error);
        setError(`Failed to get response: ${error}`);
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditText('');
  };

  const toggleSources = (messageId: string) => {
    setExpandedSources(prev => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      return newSet;
    });
  };

  const handlePDFToggle = useCallback((pdfId: string) => {
    setSelectedPDFs(prev => {
      const newSelectedPDFs = prev.includes(pdfId) 
        ? prev.filter(id => id !== pdfId)
        : [...prev, pdfId];
      
      // Update conversation with new PDF selection and save to database
      if (selectedConversation) {
        const updatedConversation = {
          ...selectedConversation,
          pdfIds: newSelectedPDFs,
          updatedAt: new Date()
        };
        // Update parent component and save to database
        onConversationUpdate(updatedConversation);
        saveConversation(updatedConversation);
      }
      
      return newSelectedPDFs;
    });
  }, [selectedConversation, onConversationUpdate, saveConversation]);

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

  // Close PDF selector when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showPDFSelector && chatContainerRef.current) {
        const target = event.target as HTMLElement;
        if (!chatContainerRef.current.contains(target)) {
          setShowPDFSelector(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showPDFSelector]);

  // TTS Functions
  const handleTTSPlay = (messageId: string, content: string) => {
    // Stop any current speech
    if (ttsState.utterance) {
      speechSynthesis.cancel();
    }

    // Create new utterance
    const utterance = new SpeechSynthesisUtterance(content);
    utterance.rate = 0.9; // Slightly slower for better comprehension
    utterance.pitch = 1;
    utterance.volume = 0.8;

    // Set up event handlers
    utterance.onstart = () => {
      setTtsState({
        speakingMessageId: messageId,
        isPaused: false,
        utterance
      });
    };

    utterance.onend = () => {
      setTtsState({
        speakingMessageId: null,
        isPaused: false,
        utterance: null
      });
    };

    utterance.onerror = () => {
      setTtsState({
        speakingMessageId: null,
        isPaused: false,
        utterance: null
      });
    };

    // Start speaking
    speechSynthesis.speak(utterance);
  };

  const handleTTSPause = () => {
    if (ttsState.isPaused) {
      speechSynthesis.resume();
      setTtsState(prev => ({ ...prev, isPaused: false }));
    } else {
      speechSynthesis.pause();
      setTtsState(prev => ({ ...prev, isPaused: true }));
    }
  };

  const handleTTSStop = () => {
    speechSynthesis.cancel();
    setTtsState({
      speakingMessageId: null,
      isPaused: false,
      utterance: null
    });
  };

  // Cleanup TTS on component unmount
  useEffect(() => {
    return () => {
      speechSynthesis.cancel();
    };
  }, []);

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
              {isProcessingPDFs && <span className="processing-indicator">⏳</span>}
            </button>
            {showPDFSelector && (
              <div className="pdf-selector-dropdown">
                {availablePDFs.map(pdf => (
                  <PDFOption 
                    key={pdf.id} 
                    pdf={pdf} 
                    isSelected={selectedPDFs.includes(pdf.id)}
                    onToggle={handlePDFToggle}
                  />
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
            <i className={`fas ${isDarkMode ? 'fa-sun' : 'fa-moon'}`}></i>
          </button>
          <button 
            className="close-chat"
            onClick={onClose}
            title="Close chat"
          >
            <i className="fas fa-times" style={{color: '#dc3545'}}></i>
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
          <i className="fas fa-exclamation-triangle"></i> {error}
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
          messages.map((message, index) => (
            <div key={message.id} className={`message ${message.type}`}>
              <div className="message-content">
                {editingMessageId === message.id ? (
                  <div className="edit-message-container">
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className="edit-message-input"
                      rows={3}
                    />
                    <div className="edit-message-actions">
                      <button 
                        className="save-edit-btn"
                        onClick={handleSaveEdit}
                      >
                        Save
                      </button>
                      <button 
                        className="cancel-edit-btn"
                        onClick={handleCancelEdit}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
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
                        <button 
                          className="sources-toggle"
                          onClick={() => toggleSources(message.id)}
                        >
                          <span className="sources-header">📚 Sources ({message.sources.length})</span>
                          <span className="sources-arrow">
                            {expandedSources.has(message.id) ? '▲' : '▼'}
                          </span>
                        </button>
                        {expandedSources.has(message.id) && (
                          <div className="sources-content">
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
                    )}
                  </>
                )}
              </div>
              <div className="message-footer">
                <div className="message-time">
                  {message.timestamp instanceof Date 
                    ? message.timestamp.toLocaleTimeString() 
                    : new Date(message.timestamp).toLocaleTimeString()}
                </div>
                <div className="message-actions">
                  {message.type === 'assistant' && (
                    <>
                      <button
                        className="copy-response-btn"
                        onClick={() => handleCopyResponse(message.content)}
                        title="Copy response"
                      >
                        <i className="fas fa-copy"></i>
                      </button>
                      {ttsState.speakingMessageId === message.id ? (
                        <>
                          <button
                            className="tts-pause-btn"
                            onClick={handleTTSPause}
                            title={ttsState.isPaused ? "Resume" : "Pause"}
                          >
                            <i className={`fas ${ttsState.isPaused ? 'fa-play' : 'fa-pause'}`}></i>
                          </button>
                          <button
                            className="tts-stop-btn"
                            onClick={handleTTSStop}
                            title="Stop"
                          >
                            <i className="fas fa-circle-stop"></i>
                          </button>
                        </>
                      ) : (
                        <button
                          className="tts-play-btn"
                          onClick={() => handleTTSPlay(message.id, message.content)}
                          title="Read aloud"
                        >
                          <i className="fas fa-volume-high"></i>
                        </button>
                      )}
                    </>
                  )}
                  {message.type === 'user' && index === messages.map((m, i) => m.type === 'user' ? i : -1).filter(i => i !== -1).pop() && (
                    <button
                      className="edit-message-btn"
                      onClick={() => handleEditMessage(message.id, message.content)}
                      title="Edit message"
                    >
                      <i className="fas fa-pen-to-square"></i>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
        
        {/* Typing Indicator */}
        {isProcessing && (
          <div className="typing-indicator">
            <div className="typing-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <span className="typing-text">AI is thinking...</span>
          </div>
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

// Memoized PDF option component to prevent unnecessary re-renders
const PDFOption = React.memo(({ pdf, isSelected, onToggle }: {
  pdf: PDFDocument;
  isSelected: boolean;
  onToggle: (pdfId: string) => void;
}) => (
  <label className="pdf-option">
    <input
      type="checkbox"
      checked={isSelected}
      onChange={() => onToggle(pdf.id)}
    />
    <span className="pdf-option-name">{pdf.name}</span>
  </label>
));

export default ChatWithPDF;
