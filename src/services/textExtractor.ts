import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

export interface ExtractedText {
  text: string;
  pageNumber: number;
  metadata: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface ExtractedPDF {
  id: string;
  name: string;
  totalPages: number;
  extractedText: ExtractedText[];
  extractedAt: Date;
}

export class TextExtractor {
  /**
   * Extract text from a PDF file
   */
  static async extractTextFromPDF(file: File, pdfId?: string, pdfName?: string): Promise<ExtractedPDF> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      const extractedText: ExtractedText[] = [];
      
      // Extract text from each page
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        // Combine all text items from the page
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        
        if (pageText.trim()) {
          extractedText.push({
            text: pageText,
            pageNumber: pageNum,
            metadata: {
              x: 0,
              y: 0,
              width: page.view[2],
              height: page.view[3],
            },
          });
        }
      }
      
      return {
        id: pdfId || `${file.name}-${Date.now()}`,
        name: pdfName || file.name,
        totalPages: pdf.numPages,
        extractedText,
        extractedAt: new Date(),
      };
    } catch (error) {
      console.error('Error extracting text from PDF:', error);
      throw new Error(`Failed to extract text from PDF: ${error}`);
    }
  }
  
  /**
   * Extract text from multiple PDFs
   */
  static async extractTextFromMultiplePDFs(files: File[]): Promise<ExtractedPDF[]> {
    const results = await Promise.all(
      files.map(file => this.extractTextFromPDF(file))
    );
    return results;
  }
  
  /**
   * Get text content from a specific page range
   */
  static getTextFromPageRange(extractedPDF: ExtractedPDF, startPage: number, endPage: number): string {
    return extractedPDF.extractedText
      .filter(item => item.pageNumber >= startPage && item.pageNumber <= endPage)
      .map(item => item.text)
      .join('\n\n');
  }
  
  /**
   * Get all text content from a PDF
   */
  static getAllText(extractedPDF: ExtractedPDF): string {
    return extractedPDF.extractedText
      .map(item => item.text)
      .join('\n\n');
  }
}
