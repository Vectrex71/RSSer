import { useState } from 'react';

// Define a subscriber system
const subscribers = new Set<(user: any) => void>();

let currentUser: any = null;

// Populate from localStorage initially
try {
  const stored = localStorage.getItem('mock_user');
  if (stored) {
    currentUser = JSON.parse(stored);
  }
} catch (e) {}

function notifySubscribers() {
  subscribers.forEach(cb => cb(currentUser));
}

export const getAuth = () => {
  return {
    get currentUser() {
      return currentUser;
    }
  };
};

export const onAuthStateChanged = (auth: any, callback: (user: any) => void) => {
  subscribers.add(callback);
  // Trigger initially
  setTimeout(() => callback(currentUser), 0);
  return () => {
    subscribers.delete(callback);
  };
};

export const signInWithEmailAndPassword = async (auth: any, email: string, password: any) => {
  currentUser = {
    uid: 'mock_uid_' + btoa(email).substring(0, 10),
    email,
    displayName: email.split('@')[0],
    emailVerified: true,
    providerData: [{ providerId: 'password', email }]
  };
  try {
    localStorage.setItem('mock_user', JSON.stringify(currentUser));
  } catch (e) {
    console.warn('Could not save user session to localStorage:', e);
  }
  notifySubscribers();
  return { user: currentUser };
};

export const createUserWithEmailAndPassword = async (auth: any, email: string, password: any) => {
  currentUser = {
    uid: 'mock_uid_' + btoa(email).substring(0, 10),
    email,
    displayName: email.split('@')[0],
    emailVerified: true,
    providerData: [{ providerId: 'password', email }]
  };
  try {
    localStorage.setItem('mock_user', JSON.stringify(currentUser));
  } catch (e) {
    console.warn('Could not save user session to localStorage:', e);
  }
  notifySubscribers();
  return { user: currentUser };
};

export const signOut = async (auth: any) => {
  currentUser = null;
  try {
    localStorage.removeItem('mock_user');
  } catch (e) {
    console.warn('Could not remove user session from localStorage:', e);
  }
  notifySubscribers();
};

export const updateProfile = async (user: any, profile: { displayName?: string, photoURL?: string }) => {
  if (currentUser) {
    currentUser = { ...currentUser, ...profile };
    try {
      localStorage.setItem('mock_user', JSON.stringify(currentUser));
    } catch (e) {
      console.warn('Could not save custom profile update to localStorage:', e);
    }
    notifySubscribers();
  }
};

export const sendPasswordResetEmail = async (auth: any, email: string) => {
  console.log(`Password reset email simulated for ${email}`);
};

export const verifyPasswordResetCode = async (auth: any, code: string) => {
  return 'mock_email@example.com';
};

export const confirmPasswordReset = async (auth: any, code: string, password: any) => {
  console.log('Password reset confirmed');
};
