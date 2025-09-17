import React, { useState, useRef, useEffect } from 'react';
import { databaseService } from '../services/databaseService';

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
  onPDFsUpdate?: (pdfs: PDFDocument[]) => void;
  pdfs?: PDFDocument[];
}

export const PDFManager: React.FC<PDFManagerProps> = ({ onPDFSelect, selectedPDF, onPDFsUpdate, pdfs: externalPdfs }) => {
  const [pdfs, setPdfs] = useState<PDFDocument[]>(externalPdfs || []);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load PDFs from database on mount
  useEffect(() => {
    loadPDFsFromDatabase();
  }, []);

  // Sync internal state with external prop
  useEffect(() => {
    if (externalPdfs) {
      setPdfs(externalPdfs);
    }
  }, [externalPdfs]);

  const loadPDFsFromDatabase = async () => {
    try {
      setIsLoading(true);
      const dbPDFs = await databaseService.getPDFs();
      setPdfs(dbPDFs);
      if (onPDFsUpdate) {
        onPDFsUpdate(dbPDFs);
      }
    } catch (error) {
      console.error('Error loading PDFs from database:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Notify parent component when PDFs change
  useEffect(() => {
    if (onPDFsUpdate) {
      onPDFsUpdate(pdfs);
    }
  }, [pdfs]); // Remove onPDFsUpdate from dependencies to prevent infinite loop

  const handleFileUpload = async (files: FileList | null) => {
    if (!files) return;

    const validFiles = Array.from(files).filter(file => 
      file.type === 'application/pdf' && file.size <= 50 * 1024 * 1024
    );

    if (validFiles.length === 0) {
      alert('Please select valid PDF files (max 50MB each)');
      return;
    }

    setIsUploading(true);

    try {
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
        
        // Save PDF to database
        try {
          const savedPdfId = await databaseService.savePDF(newPDF);
          // Update the PDF with the UUID from database
          const savedPDF = { ...newPDF, id: savedPdfId };
          newPDFs.push(savedPDF);
        } catch (error) {
          console.error('Error saving PDF to database:', error);
          // Still add to local state even if database save fails
          newPDFs.push(newPDF);
        }
        
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
    }
  } finally {
    setIsUploading(false);
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
              disabled={isUploading}
            >
              {isUploading ? '⏳' : '+'}
            </button>
          </div>
        </div>
        
        <div className="pdf-list">
          {isLoading ? (
            <div className="loading-skeleton">
              {[1, 2, 3].map((i) => (
                <div key={i} className="pdf-skeleton">
                  <div className="skeleton-line skeleton-title"></div>
                  <div className="skeleton-line skeleton-date"></div>
                </div>
              ))}
            </div>
          ) : pdfs.length === 0 ? (
            <div className="empty-state">
              <p>No PDFs uploaded yet</p>
              <button className="upload-link" onClick={handleUploadClick}>
                Upload your first PDF
              </button>
            </div>
          ) : (
            pdfs.map((pdf) => (
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
            ))
          )}
        </div>
        
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
                  disabled={isUploading}
                >
                  {isUploading ? '⏳ Uploading...' : 'Upload'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </>
  );
};
