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
  const [isRegistering, setIsRegistering] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    // Simulate a brief loading state
    await new Promise(resolve => setTimeout(resolve, 500));

    try {
      if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password && !isRegistering) {
        // Admin login (only if not in register mode)
        await databaseService.initializeUser(username);
        onLogin(username);
      } else {
        // Check if user exists
        console.log('🔍 About to check if user exists:', username);
        const userExists = await databaseService.checkUserExists(username);
        console.log('🔍 User exists result:', userExists, 'for username:', username);
        console.log('🔍 Current mode - isRegistering:', isRegistering);
        
        if (userExists) {
          // User exists - check if they want to login or register
          if (isRegistering) {
            // User is trying to register with existing username
            console.log('❌ User trying to register with existing username:', username);
            setError('Username already exists. Please choose a different username or click "Already have an account? Sign in" to login.');
          } else {
            // User wants to login with existing account
            const isValidPassword = await databaseService.validatePassword(username, password);
            if (isValidPassword) {
              await databaseService.initializeUser(username);
              onLogin(username);
            } else {
              setError('Invalid password');
            }
          }
        } else {
          // User doesn't exist - check if they want to register or login
          if (isRegistering) {
            // User wants to register new account
            console.log('Attempting to register new user:', username);
            await databaseService.registerUser(username, password);
            await databaseService.initializeUser(username);
            onLogin(username);
          } else {
            // User tried to login with non-existent account
            setError('Account not found. Click "Don\'t have an account? Sign up" to create one.');
          }
        }
      }
    } catch (error) {
      console.error('Authentication error:', error);
      if (error instanceof Error && error.message.includes('duplicate key')) {
        setError('Username already exists. Please choose a different username.');
      } else {
        setError(error instanceof Error ? error.message : 'Authentication failed');
      }
    }
    
    setIsLoading(false);
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="logo">
            <img 
              src="https://www.lawbandit.com/lawbandit-logo-yellow.svg" 
              alt="LawBandit" 
              className="logo-icon logo-inverted"
            />
          </div>
          <h2>{isRegistering ? 'Create Account' : 'Welcome Back'}</h2>
          <p>{isRegistering ? 'Sign up to start using LawBandit' : 'Sign in to access your PDFs and chat history'}</p>
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
            {isLoading ? (isRegistering ? 'Creating account...' : 'Signing in...') : (isRegistering ? 'Create Account' : 'Sign In')}
          </button>
        </form>

        <div className="auth-footer">
          <button 
            type="button"
            className="toggle-auth-mode"
            onClick={() => {
              setIsRegistering(!isRegistering);
              setError('');
            }}
            disabled={isLoading}
          >
            {isRegistering ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
          </button>
          
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
