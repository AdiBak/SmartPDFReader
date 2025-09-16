import React, { useState, useEffect } from 'react';
import { databaseService, Conversation } from '../services/databaseService';
import { PDFDocument } from './PDFManager';
import { v4 as uuidv4 } from 'uuid';

interface ChatListProps {
  onChatSelect: (conversation: Conversation | null) => void;
  selectedChat: Conversation | null;
  availablePDFs: PDFDocument[];
  refreshTrigger?: number; // Add refresh trigger prop
}

export const ChatList: React.FC<ChatListProps> = ({
  onChatSelect,
  selectedChat,
  availablePDFs,
  refreshTrigger
}) => {
  const [chats, setChats] = useState<Conversation[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    loadChats();
  }, []);

  // Refresh chats when refreshTrigger changes
  useEffect(() => {
    if (refreshTrigger) {
      loadChats();
    }
  }, [refreshTrigger]);

  const loadChats = async () => {
    try {
      const loadedChats = await databaseService.getConversations();
      setChats(loadedChats);
    } catch (error) {
      console.error('Error loading chats:', error);
    }
  };

  const handleNewChat = () => {
    const newChat: Conversation = {
      id: uuidv4(), // Generate proper UUID
      name: 'New Chat',
      pdfIds: [],
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };
    onChatSelect(newChat);
    setIsDropdownOpen(false);
  };

  const getChatDisplayName = (chat: Conversation): string => {
    if (chat.name !== 'New Chat') {
      return chat.name;
    }

    // Auto-generate name based on PDFs
    const pdfNames = chat.pdfIds
      .map(pdfId => availablePDFs.find(pdf => pdf.id === pdfId)?.name)
      .filter(Boolean)
      .slice(0, 2);

    if (pdfNames.length === 0) {
      return 'New Chat';
    } else if (pdfNames.length === 1) {
      return pdfNames[0]!;
    } else {
      return `${pdfNames[0]} + ${pdfNames[1]}${chat.pdfIds.length > 2 ? ` +${chat.pdfIds.length - 2}` : ''}`;
    }
  };

  const getLastMessage = (chat: Conversation): string => {
    if (chat.messages.length === 0) {
      return 'No messages yet';
    }
    const lastMessage = chat.messages[chat.messages.length - 1];
    return lastMessage.content.substring(0, 30) + (lastMessage.content.length > 30 ? '...' : '');
  };

  const formatTime = (date: Date): string => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="sidebar-section">
      <div className="sidebar-header">
        <h3>💬 Recent Chats</h3>
        <button 
          className="upload-btn"
          onClick={handleNewChat}
          title="Start new chat"
        >
          +
        </button>
      </div>
      
      {chats.length === 0 ? (
        <div className="empty-state">
          <p>No chats yet</p>
          <p>Start a conversation to create your first chat!</p>
        </div>
      ) : (
        <div className="chat-list">
          {chats.map(chat => (
            <div
              key={chat.id}
              className={`chat-item ${selectedChat?.id === chat.id ? 'selected' : ''}`}
              onClick={() => {
                onChatSelect(chat);
                setIsDropdownOpen(false);
              }}
            >
              <div className="chat-name">
                {getChatDisplayName(chat)}
              </div>
              <div className="chat-preview">
                {getLastMessage(chat)}
              </div>
              <div className="chat-meta">
                <span className="chat-time">{formatTime(chat.updatedAt)}</span>
                {chat.pdfIds.length > 0 && (
                  <span className="chat-pdf-count">
                    📄 {chat.pdfIds.length}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
