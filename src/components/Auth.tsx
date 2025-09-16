import React, { useState } from 'react';
import { databaseService } from '../services/databaseService';

interface AuthProps {
  onLogin: (username: string) => void;
}

// Hardcoded credentials for assessment
const ADMIN_CREDENTIALS = {
  username: "admin123",
  password: "password123"
};

export const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    // Simulate a brief loading state
    await new Promise(resolve => setTimeout(resolve, 500));

    if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
      try {
        // Initialize user in database
        await databaseService.initializeUser(username);
        onLogin(username);
      } catch (error) {
        console.error('Error initializing user:', error);
        setError('Failed to initialize user session');
      }
    } else {
      setError('Invalid username or password');
    }
    
    setIsLoading(false);
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="logo">
            <div className="logo-icon">🕵️</div>
            <span className="logo-text">LawBandit</span>
          </div>
          <h2>Welcome Back</h2>
          <p>Sign in to access your PDFs and chat history</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              required
              disabled={isLoading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              disabled={isLoading}
            />
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <button 
            type="submit" 
            className="auth-button"
            disabled={isLoading}
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="auth-footer">
          <p className="demo-credentials">
            <strong>Demo Credentials:</strong><br />
            Username: <code>admin123</code><br />
            Password: <code>password123</code>
          </p>
        </div>
      </div>
    </div>
  );
};
