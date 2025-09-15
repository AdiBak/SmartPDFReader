import React, { useState, useRef, useEffect } from 'react';
import { PDFDocument } from './PDFManager';

interface ChatWithPDFProps {
  selectedPDF: PDFDocument | null;
  onClose: () => void;
  chatWidth: number;
  onChatWidthChange: (width: number) => void;
}

const ChatWithPDF: React.FC<ChatWithPDFProps> = ({ selectedPDF, onClose, chatWidth, onChatWidthChange }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [messages, setMessages] = useState<Array<{ id: string; type: 'user' | 'assistant'; content: string; timestamp: Date }>>([]);
  const [inputText, setInputText] = useState('');
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const isResizing = useRef(false);

  const handleSendMessage = () => {
    if (!inputText.trim()) return;
    
    const newMessage = {
      id: Date.now().toString(),
      type: 'user' as const,
      content: inputText,
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, newMessage]);
    setInputText('');
    
    // TODO: Send to AI service and get response
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
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
          {selectedPDF && (
            <span className="pdf-name">{selectedPDF.name}</span>
          )}
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
                {message.content}
              </div>
              <div className="message-time">
                {message.timestamp.toLocaleTimeString()}
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
            placeholder="Ask a question about the PDF..."
            rows={1}
            className="message-input"
          />
          <button 
            className="send-button"
            onClick={handleSendMessage}
            disabled={!inputText.trim()}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatWithPDF;
