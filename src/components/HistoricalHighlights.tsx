import React, { useState } from 'react';
import { Annotation } from '../types';

interface HistoricalHighlightsProps {
  highlights: Annotation[];
  onUpdateHighlight: (id: string, updates: Partial<Annotation>) => void;
  onDeleteHighlight: (id: string) => void;
  onLocateHighlight: (highlight: Annotation) => void;
  selectedPDF: { id: string } | null;
}

export const HistoricalHighlights: React.FC<HistoricalHighlightsProps> = ({
  highlights,
  onUpdateHighlight,
  onDeleteHighlight,
  onLocateHighlight,
  selectedPDF,
}) => {
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [editComment, setEditComment] = useState('');

  // Filter highlights for the selected PDF
  const pdfHighlights = selectedPDF 
    ? highlights.filter(h => h.pdfId === selectedPDF.id)
    : [];

  const handleEditComment = (highlight: Annotation) => {
    setEditingComment(highlight.id);
    setEditComment(highlight.comment || '');
  };

  const handleSaveComment = (highlightId: string) => {
    onUpdateHighlight(highlightId, { comment: editComment.trim() || undefined });
    setEditingComment(null);
    setEditComment('');
  };

  const handleCancelEdit = () => {
    setEditingComment(null);
    setEditComment('');
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const getColorName = (color: string) => {
    const colorMap: { [key: string]: string } = {
      '#ffeb3b': 'Yellow',
      '#4caf50': 'Green',
      '#2196f3': 'Blue',
      '#e91e63': 'Pink',
      '#ff9800': 'Orange',
      '#9c27b0': 'Purple',
    };
    return colorMap[color] || 'Custom';
  };

  if (!selectedPDF) {
    return (
      <div className="sidebar-section historical-highlights-section">
        <div className="sidebar-header">
          <h3>Historical Highlights</h3>
        </div>
        <div className="empty-state">
          <p>Select a PDF to view highlights</p>
        </div>
      </div>
    );
  }

  return (
    <div className="sidebar-section historical-highlights-section">
      <div className="sidebar-header">
        <h3>Historical Highlights</h3>
        <span className="highlight-count">{pdfHighlights.length}</span>
      </div>

      {pdfHighlights.length === 0 ? (
        <div className="empty-state">
          <p>No highlights yet</p>
          <small>Select text in the PDF to create highlights</small>
        </div>
      ) : (
        <div className="highlights-list">
          {pdfHighlights.map((highlight) => (
            <div 
              key={highlight.id} 
              className="highlight-item"
              onClick={() => onLocateHighlight(highlight)}
              style={{ cursor: 'pointer' }}
            >
              <div className="highlight-header">
                <div className="highlight-meta">
                  <span 
                    className="highlight-color-indicator"
                    style={{ backgroundColor: highlight.color }}
                  />
                  <span className="highlight-date">
                    {formatDate(highlight.createdAt)}
                  </span>
                  <span className="highlight-page">
                    Page {highlight.pageNumber}
                  </span>
                </div>
                <div className="highlight-actions">
                  <button
                    className="edit-comment-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditComment(highlight);
                    }}
                    title="Edit Comment"
                  >
                    ✏️
                  </button>
                  <button
                    className="delete-highlight-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteHighlight(highlight.id);
                    }}
                    title="Delete Highlight"
                  >
                    🗑️
                  </button>
                </div>
              </div>

              <div className="highlight-text" style={{ userSelect: 'none' }}>
                "{highlight.content}"
              </div>

              {highlight.comment && (
                <div className="highlight-comment">
                  {editingComment === highlight.id ? (
                    <div className="comment-edit">
                      <textarea
                        value={editComment}
                        onChange={(e) => setEditComment(e.target.value)}
                        className="comment-edit-input"
                        rows={2}
                        placeholder="Add a comment..."
                      />
                      <div className="comment-edit-actions">
                        <button
                          className="save-comment-btn"
                          onClick={() => handleSaveComment(highlight.id)}
                        >
                          Save
                        </button>
                        <button
                          className="cancel-comment-btn"
                          onClick={handleCancelEdit}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="comment-display">
                      <span className="comment-label">Comment:</span>
                      <span className="comment-text">{highlight.comment}</span>
                    </div>
                  )}
                </div>
              )}

              {!highlight.comment && editingComment !== highlight.id && (
                <button
                  className="add-comment-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEditComment(highlight);
                  }}
                >
                  + Add Comment
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
