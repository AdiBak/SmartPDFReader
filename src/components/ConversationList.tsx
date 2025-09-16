import React, { useState, useEffect } from 'react';
import { databaseService, Conversation } from '../services/databaseService';
import { PDFDocument } from './PDFManager';

interface ConversationListProps {
  onConversationSelect: (conversation: Conversation | null) => void;
  selectedConversation: Conversation | null;
  availablePDFs: PDFDocument[];
}

export const ConversationList: React.FC<ConversationListProps> = ({
  onConversationSelect,
  selectedConversation,
  availablePDFs
}) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    try {
      setIsLoading(true);
      const loadedConversations = await databaseService.getConversations();
      setConversations(loadedConversations);
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewConversation = () => {
    const newConversation: Conversation = {
      id: `temp-${Date.now()}`,
      name: 'New Conversation',
      pdfIds: [],
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };
    onConversationSelect(newConversation);
  };

  const getConversationDisplayName = (conversation: Conversation): string => {
    if (conversation.name !== 'New Conversation') {
      return conversation.name;
    }

    // Auto-generate name based on PDFs
    const pdfNames = conversation.pdfIds
      .map(pdfId => availablePDFs.find(pdf => pdf.id === pdfId)?.name)
      .filter(Boolean)
      .slice(0, 2); // Limit to 2 PDFs for display

    if (pdfNames.length === 0) {
      return 'New Conversation';
    } else if (pdfNames.length === 1) {
      return pdfNames[0]!;
    } else {
      return `${pdfNames[0]} + ${pdfNames[1]}${conversation.pdfIds.length > 2 ? ` +${conversation.pdfIds.length - 2}` : ''}`;
    }
  };

  const getLastMessage = (conversation: Conversation): string => {
    if (conversation.messages.length === 0) {
      return 'No messages yet';
    }
    const lastMessage = conversation.messages[conversation.messages.length - 1];
    return lastMessage.content.substring(0, 50) + (lastMessage.content.length > 50 ? '...' : '');
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

  if (isLoading) {
    return (
      <div className="conversation-list">
        <div className="conversation-list-header">
          <h3>💬 Conversations</h3>
        </div>
        <div className="conversation-list-content">
          <div className="loading">Loading conversations...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="conversation-list">
      <div className="conversation-list-header">
        <h3>💬 Conversations</h3>
        <button 
          className="new-conversation-btn"
          onClick={handleNewConversation}
          title="Start new conversation"
        >
          +
        </button>
      </div>
      
      <div className="conversation-list-content">
        {conversations.length === 0 ? (
          <div className="no-conversations">
            <p>No conversations yet</p>
            <p>Start chatting to create your first conversation!</p>
          </div>
        ) : (
          conversations.map(conversation => (
            <div
              key={conversation.id}
              className={`conversation-item ${selectedConversation?.id === conversation.id ? 'selected' : ''}`}
              onClick={() => onConversationSelect(conversation)}
            >
              <div className="conversation-header">
                <div className="conversation-name">
                  {getConversationDisplayName(conversation)}
                </div>
                <div className="conversation-time">
                  {formatTime(conversation.updatedAt)}
                </div>
              </div>
              <div className="conversation-preview">
                {getLastMessage(conversation)}
              </div>
              <div className="conversation-pdfs">
                {conversation.pdfIds.length > 0 && (
                  <span className="pdf-count">
                    📄 {conversation.pdfIds.length} PDF{conversation.pdfIds.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
