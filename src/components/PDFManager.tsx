import React, { useState, useRef } from 'react';

export interface PDFDocument {
  id: string;
  name: string;
  file: File;
  dataUrl: string;
  uploadDate: Date;
}

interface PDFManagerProps {
  onPDFSelect: (pdf: PDFDocument | null) => void;
  selectedPDF: PDFDocument | null;
  onToggleChat?: () => void;
}

export const PDFManager: React.FC<PDFManagerProps> = ({ onPDFSelect, selectedPDF, onToggleChat }) => {
  const [pdfs, setPdfs] = useState<PDFDocument[]>([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);


  const handleFileUpload = async (files: FileList | null) => {
    if (!files) return;

    const validFiles = Array.from(files).filter(file => 
      file.type === 'application/pdf' && file.size <= 50 * 1024 * 1024
    );

    if (validFiles.length === 0) {
      alert('Please select valid PDF files (max 50MB each)');
      return;
    }

    // Check for duplicates
    const existingNames = pdfs.map(pdf => pdf.name.toLowerCase());
    const duplicates: string[] = [];
    const newFiles: File[] = [];

    validFiles.forEach(file => {
      const fileName = file.name.replace('.pdf', '').toLowerCase();
      if (existingNames.includes(fileName)) {
        duplicates.push(file.name);
      } else {
        newFiles.push(file);
      }
    });

    // Show message about duplicates
    if (duplicates.length > 0) {
      const duplicateMessage = duplicates.length === 1 
        ? `"${duplicates[0]}" is already uploaded. Skipping duplicate.`
        : `These files are already uploaded: ${duplicates.join(', ')}. Skipping duplicates.`;
      
      if (newFiles.length === 0) {
        alert(duplicateMessage);
        return;
      } else {
        alert(`${duplicateMessage}\n\nUploading ${newFiles.length} new file(s).`);
      }
    }

    if (newFiles.length === 0) return;

    const newPDFs: PDFDocument[] = [];
    
    // Process new files one by one to avoid race conditions
    for (const file of newFiles) {
      try {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (event) => {
            if (event.target?.result) {
              resolve(event.target.result as string);
            } else {
              reject(new Error('Failed to read file'));
            }
          };
          reader.onerror = () => reject(new Error('Error reading file'));
          reader.readAsDataURL(file);
        });

        const newPDF: PDFDocument = {
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          name: file.name.replace('.pdf', ''),
          file,
          dataUrl,
          uploadDate: new Date(),
        };
        
        newPDFs.push(newPDF);
        
      } catch (error) {
        console.error('Error processing file:', file.name, error);
      }
    }

    if (newPDFs.length > 0) {
      setPdfs(prev => [...prev, ...newPDFs]);
      
      // Auto-select the first uploaded PDF if none is selected
      if (!selectedPDF) {
        onPDFSelect(newPDFs[0]);
      }
      
      // Auto-open dropdown to show uploaded files
      setIsDropdownOpen(true);
    }
  };

  const handleUploadClick = () => {
    setShowUploadModal(true);
  };

  const handleModalUpload = () => {
    if (fileInputRef.current?.files && fileInputRef.current.files.length > 0) {
      handleFileUpload(fileInputRef.current.files);
      setShowUploadModal(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } else {
      alert('Please select at least one PDF file');
    }
  };

  const handlePDFSelect = (pdf: PDFDocument) => {
    onPDFSelect(pdf);
    setIsDropdownOpen(false);
  };

  const handleRemovePDF = (pdfId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPdfs(prev => prev.filter(pdf => pdf.id !== pdfId));
    
    // If the removed PDF was selected, select another one or clear selection
    if (selectedPDF?.id === pdfId) {
      const remainingPDFs = pdfs.filter(pdf => pdf.id !== pdfId);
      onPDFSelect(remainingPDFs.length > 0 ? remainingPDFs[0] : null);
    }
  };

  return (
    <>
      <div className="sidebar-section">
        <div className="sidebar-header">
          <h3>Recent PDFs</h3>
          <div className="header-actions">
            <button 
              className="upload-btn"
              onClick={handleUploadClick}
              title="Upload PDFs"
            >
              +
            </button>
            <span 
              className="chevron"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              style={{ transform: isDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
            >
              ▼
            </span>
          </div>
        </div>
        
        {isDropdownOpen && (
          <div className="pdf-dropdown">
            {pdfs.length === 0 ? (
              <div className="empty-state">
                <p>No PDFs uploaded yet</p>
                <button className="upload-link" onClick={handleUploadClick}>
                  Upload your first PDF
                </button>
              </div>
            ) : (
              <div className="pdf-list">
                {pdfs.map((pdf) => (
                  <div 
                    key={pdf.id}
                    className={`pdf-item ${selectedPDF?.id === pdf.id ? 'selected' : ''}`}
                    onClick={() => handlePDFSelect(pdf)}
                  >
                    <div className="pdf-info">
                      <span className="pdf-name">{pdf.name}</span>
                      <span className="pdf-date">
                        {pdf.uploadDate.toLocaleDateString()}
                      </span>
                    </div>
                    <button 
                      className="remove-btn"
                      onClick={(e) => handleRemovePDF(pdf.id, e)}
                      title="Remove PDF"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="modal-overlay" onClick={() => setShowUploadModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Upload PDFs</h3>
              <button 
                className="close-btn"
                onClick={() => setShowUploadModal(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <p>Select one or more PDF files to upload (max 50MB each)</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                multiple
                className="file-input"
              />
              <div className="modal-actions">
                <button 
                  className="cancel-btn"
                  onClick={() => setShowUploadModal(false)}
                >
                  Cancel
                </button>
                <button 
                  className="upload-btn-modal"
                  onClick={handleModalUpload}
                >
                  Upload
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tools Section */}
      <div className="sidebar-section tools-section">
        <div className="sidebar-header">
          <h3>Tools</h3>
        </div>
        <div className="tools-buttons">
          <button 
            className="tool-btn chat-btn"
            onClick={() => {
              if (!selectedPDF) {
                alert('Please select a PDF first to use Chat with PDF');
                return;
              }
              if (onToggleChat) {
                onToggleChat();
              }
            }}
            disabled={!selectedPDF}
          >
            <span className="tool-icon">💬</span>
            <span className="tool-text">Chat with PDF</span>
          </button>
          
          <button 
            className="tool-btn notes-btn"
            onClick={() => {
              if (!selectedPDF) {
                alert('Please select a PDF first to open notes');
                return;
              }
              alert('Open Notes feature coming soon!');
            }}
            disabled={!selectedPDF}
          >
            <span className="tool-icon">📝</span>
            <span className="tool-text">Open Notes</span>
          </button>
        </div>
      </div>
    </>
  );
};
