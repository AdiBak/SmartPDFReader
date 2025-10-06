import { PDFViewer } from './PDFViewer';

export class App {
  private container: HTMLElement;
  private pdfViewer: PDFViewer | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.render();
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="app">
        <!-- Header -->
        <header class="header">
          <div class="header-left">
            <div class="logo">
              <div class="logo-icon">🕵️</div>
              <span class="logo-text">Smart PDF Reader</span>
            </div>
          </div>
          <div class="header-right">
            <div class="subscription-info">
              <span class="pay-amount">470 Pay</span>
              <span class="subscription">Subscription</span>
            </div>
            <div class="timer">
              <span class="timer-icon">⏱️</span>
              <span class="timer-text">00:00:03</span>
            </div>
            <div class="status">
              <span class="status-icon">✓</span>
            </div>
          </div>
        </header>

        <!-- Main Content -->
        <main class="main-content">
          <!-- PDF Viewer Section -->
          <section class="pdf-section">
            <!-- PDF Controls -->
            <div class="pdf-controls">
              <div class="navigation">
                <button class="nav-btn" id="prev-page" title="Previous Page">
                  <span>←</span>
                </button>
                <span class="page-info" id="page-info">1 / 1</span>
                <button class="nav-btn" id="next-page" title="Next Page">
                  <span>→</span>
                </button>
              </div>
              
              <div class="zoom-controls">
                <button class="zoom-btn" id="zoom-out" title="Zoom Out">-</button>
                <span class="zoom-level" id="zoom-level">100%</span>
                <button class="zoom-btn" id="zoom-in" title="Zoom In">+</button>
                <button class="zoom-btn" id="zoom-reset" title="Reset Zoom">⌂</button>
              </div>

              <div class="file-controls">
                <button class="file-btn" id="upload-btn" title="Upload PDF">
                  <span>📁</span>
                </button>
                <button class="file-btn" id="download-btn" title="Download PDF">
                  <span>⬇️</span>
                </button>
              </div>
            </div>

            <!-- PDF Viewer Container -->
            <div class="pdf-viewer-container" id="pdf-viewer">
              <div class="upload-area">
                <div class="upload-icon">📄</div>
                <h3>Upload a PDF Document</h3>
                <p>Drag and drop your PDF here, or click to browse</p>
                <div class="upload-hint">
                  <small>Maximum file size: 50MB</small>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    `;

    this.initializeComponents();
    this.setupEventListeners();
  }

  private initializeComponents(): void {
    const pdfContainer = document.getElementById('pdf-viewer');
    if (pdfContainer) {
      this.pdfViewer = new PDFViewer(pdfContainer);
    }
  }

  private setupEventListeners(): void {
    // Navigation controls
    const prevBtn = document.getElementById('prev-page');
    const nextBtn = document.getElementById('next-page');
    const zoomInBtn = document.getElementById('zoom-in');
    const zoomOutBtn = document.getElementById('zoom-out');
    const zoomResetBtn = document.getElementById('zoom-reset');

    prevBtn?.addEventListener('click', () => {
      this.pdfViewer?.prevPage();
    });

    nextBtn?.addEventListener('click', () => {
      this.pdfViewer?.nextPage();
    });

    zoomInBtn?.addEventListener('click', () => {
      this.pdfViewer?.zoomIn();
    });

    zoomOutBtn?.addEventListener('click', () => {
      this.pdfViewer?.zoomOut();
    });

    zoomResetBtn?.addEventListener('click', () => {
      this.pdfViewer?.resetZoom();
    });
  }
}
