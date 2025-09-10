import React from 'react';
import { ReactPDFViewer } from './ReactPDFViewer';

export const ReactApp: React.FC = () => {
  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-left">
          <div className="logo">
            <div className="logo-icon">🕵️</div>
            <span className="logo-text">LawBandit</span>
          </div>
        </div>
        <div className="header-right">
          <div className="subscription-info">
            <span className="pay-amount">470 Pay</span>
            <span className="subscription">Subscription</span>
          </div>
          <div className="timer">
            <span className="timer-icon">⏱️</span>
            <span className="timer-text">00:00:03</span>
          </div>
          <div className="status">
            <span className="status-icon">✓</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content">
        {/* PDF Viewer Section */}
        <section className="pdf-section">
          <ReactPDFViewer />
        </section>
      </main>
    </div>
  );
};
