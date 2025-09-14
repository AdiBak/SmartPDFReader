import React, { useState, useRef, useEffect } from 'react';
import { Annotation } from '../types';

interface HighlightingToolbarProps {
  selectedText: string;
  onHighlight: (highlight: Omit<Annotation, 'id' | 'createdAt'>) => void;
  onClose: () => void;
  position: { x: number; y: number };
}

const HIGHLIGHT_COLORS = [
  { name: 'Yellow', value: '#ffeb3b', class: 'highlight-yellow' },
  { name: 'Green', value: '#4caf50', class: 'highlight-green' },
  { name: 'Blue', value: '#2196f3', class: 'highlight-blue' },
  { name: 'Pink', value: '#e91e63', class: 'highlight-pink' },
  { name: 'Orange', value: '#ff9800', class: 'highlight-orange' },
  { name: 'Purple', value: '#9c27b0', class: 'highlight-purple' },
];

export const HighlightingToolbar: React.FC<HighlightingToolbarProps> = ({
  selectedText,
  onHighlight,
  onClose,
  position,
}) => {
  const [selectedColor, setSelectedColor] = useState(HIGHLIGHT_COLORS[0].value);
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [comment, setComment] = useState('');
  const [customColor, setCustomColor] = useState('#ffeb3b');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Close toolbar when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const handleHighlight = (color: string) => {
    const highlight: Omit<Annotation, 'id' | 'createdAt'> = {
      type: 'highlight',
      content: selectedText,
      position: {
        x: position.x,
        y: position.y,
        width: 0, // Will be calculated based on text
        height: 0, // Will be calculated based on text
      },
      pageNumber: 1, // Will be determined by PDF viewer
      color: color,
      comment: comment.trim() || undefined,
      pdfId: '', // Will be set by parent component
    };

    onHighlight(highlight);
    onClose();
  };

  const handleColorSelect = (color: string) => {
    setSelectedColor(color);
    setShowColorPicker(false);
    // Highlight immediately when color is selected
    handleHighlight(color);
  };

  return (
    <div
      ref={toolbarRef}
      className="highlighting-toolbar"
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y - 60,
        zIndex: 1000,
      }}
    >
      <div className="toolbar-content">
        <div className="selected-text-preview">
          <span className="text-label">Selected:</span>
          <span className="selected-text">"{selectedText.substring(0, 30)}{selectedText.length > 30 ? '...' : ''}"</span>
        </div>

        <div className="color-selection">
          <div className="color-options">
            {HIGHLIGHT_COLORS.map((color) => (
              <button
                key={color.value}
                className={`color-btn ${selectedColor === color.value ? 'selected' : ''}`}
                style={{ backgroundColor: color.value }}
                onClick={() => handleColorSelect(color.value)}
                title={color.name}
              />
            ))}
            <button
              className="color-btn custom-color-btn"
              onClick={() => setShowColorPicker(!showColorPicker)}
              title="Custom Color"
            >
              🎨
            </button>
          </div>

          {showColorPicker && (
            <div className="color-picker-container">
              <input
                type="color"
                value={customColor}
                onChange={(e) => {
                  setCustomColor(e.target.value);
                  setSelectedColor(e.target.value);
                }}
                className="color-picker"
              />
            </div>
          )}
        </div>

        <div className="toolbar-actions">
          <button
            className="comment-btn"
            onClick={() => setShowCommentInput(!showCommentInput)}
            title="Add Comment"
          >
            💬
          </button>
          
          <button className="cancel-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        {showCommentInput && (
          <div className="comment-input-container">
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add a comment to this highlight..."
              className="comment-input"
              rows={3}
            />
            <div className="comment-actions">
              <button
                className="save-comment-btn"
                onClick={() => setShowCommentInput(false)}
              >
                Save
              </button>
              <button
                className="cancel-comment-btn"
                onClick={() => {
                  setShowCommentInput(false);
                  setComment('');
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
