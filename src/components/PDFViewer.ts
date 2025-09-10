import { PDFDocumentProxy, getDocument, GlobalWorkerOptions } from 'pdfjs-dist';

// Configure PDF.js worker - use a working CDN URL
GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

export class PDFViewer {
  private container: HTMLElement;
  private pdfDoc: PDFDocumentProxy | null = null;
  private currentPage = 1;
  private totalPages = 0;
  private scale = 1.0;

  constructor(container: HTMLElement) {
    this.container = container;
    this.setupEventListeners();
    
    // Log worker configuration for debugging
    console.log('PDF.js worker configured:', GlobalWorkerOptions.workerSrc);
  }

  private setupEventListeners(): void {
    // Drag and drop functionality
    this.container.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.container.classList.add('drag-over');
    });

    this.container.addEventListener('dragleave', (e) => {
      e.preventDefault();
      this.container.classList.remove('drag-over');
    });

    this.container.addEventListener('drop', (e) => {
      e.preventDefault();
      this.container.classList.remove('drag-over');
      
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        this.loadPDF(files[0]);
      }
    });

    // Click to upload
    this.container.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.pdf';
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          this.loadPDF(file);
        }
      };
      input.click();
    });
  }

  private async loadPDF(file: File): Promise<void> {
    try {
      console.log('Loading PDF:', file.name, 'Size:', file.size);
      
      // Show loading state
      this.showLoading();
      
      // Validate file type
      if (file.type !== 'application/pdf') {
        throw new Error('Please select a valid PDF file');
      }
      
      // Validate file size (50MB limit)
      if (file.size > 50 * 1024 * 1024) {
        throw new Error('File size too large. Maximum size is 50MB');
      }
      
      const arrayBuffer = await file.arrayBuffer();
      console.log('PDF loaded, processing...');
      
      this.pdfDoc = await getDocument({
        data: arrayBuffer,
        useSystemFonts: true,
        disableFontFace: false
      }).promise;
      
      this.totalPages = this.pdfDoc.numPages;
      this.currentPage = 1;
      
      console.log('PDF processed successfully. Pages:', this.totalPages);
      
      this.render();
      this.updatePageInfo();
    } catch (error) {
      console.error('Error loading PDF:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load PDF. Please try again.';
      this.showError(errorMessage);
    }
  }

  private async render(): Promise<void> {
    if (!this.pdfDoc) return;

    // Clear container
    this.container.innerHTML = '';

    // Render all pages directly in the container
    for (let pageNum = 1; pageNum <= this.totalPages; pageNum++) {
      const page = await this.pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: this.scale });

      const pageContainer = document.createElement('div');
      pageContainer.className = 'pdf-page-container';
      pageContainer.setAttribute('data-page', pageNum.toString());

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) continue;

      canvas.height = viewport.height;
      canvas.width = viewport.width;
      canvas.className = 'pdf-page-canvas';

      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };

      await page.render(renderContext).promise;
      
      pageContainer.appendChild(canvas);
      this.container.appendChild(pageContainer);
    }

    // Add scroll listener to update current page
    this.setupScrollListener(this.container);
  }

  private setupScrollListener(scrollContainer: HTMLElement): void {
    scrollContainer.addEventListener('scroll', () => {
      this.updateCurrentPageFromScroll(scrollContainer);
    });
  }

  private updateCurrentPageFromScroll(scrollContainer: HTMLElement): void {
    const containerRect = scrollContainer.getBoundingClientRect();
    const containerCenter = containerRect.top + containerRect.height / 2;

    let closestPage = 1;
    let minDistance = Infinity;

    for (let pageNum = 1; pageNum <= this.totalPages; pageNum++) {
      const pageElement = scrollContainer.querySelector(`[data-page="${pageNum}"]`);
      if (pageElement) {
        const pageRect = pageElement.getBoundingClientRect();
        const pageCenter = pageRect.top + pageRect.height / 2;
        const distance = Math.abs(pageCenter - containerCenter);

        if (distance < minDistance) {
          minDistance = distance;
          closestPage = pageNum;
        }
      }
    }

    if (closestPage !== this.currentPage) {
      this.currentPage = closestPage;
      this.updatePageInfo();
    }
  }

  private updatePageInfo(): void {
    const pageInfo = document.getElementById('page-info');
    if (pageInfo) {
      pageInfo.textContent = `${this.currentPage} / ${this.totalPages}`;
    }
  }

  private showLoading(): void {
    this.container.innerHTML = `
      <div class="loading-message">
        <div class="loading-spinner"></div>
        <p>Loading PDF...</p>
      </div>
    `;
  }

  private showError(message: string): void {
    this.container.innerHTML = `
      <div class="error-message">
        <p>${message}</p>
        <button class="retry-btn" onclick="location.reload()">Try Again</button>
      </div>
    `;
  }

  public nextPage(): void {
    if (this.pdfDoc && this.currentPage < this.totalPages) {
      this.currentPage++;
      this.scrollToPage(this.currentPage);
      this.updatePageInfo();
    }
  }

  public prevPage(): void {
    if (this.pdfDoc && this.currentPage > 1) {
      this.currentPage--;
      this.scrollToPage(this.currentPage);
      this.updatePageInfo();
    }
  }

  private scrollToPage(pageNumber: number): void {
    const pageElement = this.container.querySelector(`[data-page="${pageNumber}"]`);
    
    if (pageElement) {
      pageElement.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
      });
    }
  }

  public zoomIn(): void {
    this.scale += 0.25;
    this.render();
  }

  public zoomOut(): void {
    if (this.scale > 0.5) {
      this.scale -= 0.25;
      this.render();
    }
  }

  public resetZoom(): void {
    this.scale = 1.0;
    this.render();
  }
}
