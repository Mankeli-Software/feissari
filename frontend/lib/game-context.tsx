"use client"

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import Cookies from 'js-cookie';
import { GameState, ChatMessage, CreateGameResponse, UpdateGameResponse } from '@/lib/types';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
const GAME_DURATION_MS = 3 * 60 * 1000; // 3 minutes
const INITIAL_BALANCE = 100;

// Audio mute state management
const MUTE_STORAGE_KEY = 'feissari_audio_muted';

export function useAudioMute() {
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    // Load mute state from localStorage on mount
    const stored = localStorage.getItem(MUTE_STORAGE_KEY);
    if (stored !== null) {
      setIsMuted(stored === 'true');
    }
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      const newValue = !prev;
      localStorage.setItem(MUTE_STORAGE_KEY, String(newValue));
      return newValue;
    });
  }, []);

  const setMuted = useCallback((value: boolean) => {
    setIsMuted(value);
    localStorage.setItem(MUTE_STORAGE_KEY, String(value));
  }, []);

  return { isMuted, toggleMute, setMuted };
}

interface GameContextType {
  gameState: GameState;
  startGame: () => Promise<void>;
  sendMessage: (message: string) => Promise<void>;
  resetGame: () => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [gameState, setGameState] = useState<GameState>({
    gameId: null,
    balance: INITIAL_BALANCE,
    timeRemaining: GAME_DURATION_MS / 1000, // in seconds
    isActive: false,
    messages: [],
    currentFeissariName: '',
    isLoading: false,
    isTransitioning: false,
    threatLevel: 0,
  });

  const [startTime, setStartTime] = useState<number | null>(null);
  const [prevBalance, setPrevBalance] = useState<number>(INITIAL_BALANCE);

  // Play kaching sound effect when balance changes
  useEffect(() => {
    if (gameState.balance !== prevBalance && gameState.gameId) {
      // Only play if game has started (gameId exists)
      const audio = new Audio('/audio/kaching.wav');
      audio.volume = 0.5; // Set volume to 50%
      // Check mute state from localStorage
      const isMuted = localStorage.getItem(MUTE_STORAGE_KEY) === 'true';
      if (!isMuted) {
        audio.play().catch(err => console.error('Error playing kaching sound:', err));
      }
      setPrevBalance(gameState.balance);
    }
  }, [gameState.balance, gameState.gameId, prevBalance]);

  // Timer effect - counts down and marks game inactive when time expires
  // The backend automatically saves to leaderboard when it receives any API call
  // after the time has expired, so no need to make a separate API call here
  useEffect(() => {
    if (!gameState.isActive || !startTime) return;

    let timeExpiredHandled = false;

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, Math.floor((GAME_DURATION_MS - elapsed) / 1000));
      
      setGameState(prev => ({
        ...prev,
        timeRemaining: remaining,
      }));

      if (remaining <= 0 && !timeExpiredHandled) {
        timeExpiredHandled = true;
        clearInterval(interval); // Stop the timer immediately
        // Mark game as inactive and calculate final score
        // The leaderboard save is handled by the backend automatically
        setGameState(prev => {
          const finalScore = (prev.defeatedFeissari || 0) * prev.balance;
          return {
            ...prev,
            isActive: false,
            score: finalScore,
          };
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [gameState.isActive, startTime]);

  const startGame = useCallback(async () => {
    const sessionId = Cookies.get('feissari_session');
    
    if (!sessionId) {
      console.error('No session ID found');
      return;
    }

    setGameState(prev => ({ ...prev, isLoading: true }));

    try {
      const response = await fetch(`${BACKEND_URL}/api/game`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: sessionId }),
      });

      if (!response.ok) {
        throw new Error('Failed to create game');
      }

  const data: CreateGameResponse = await response.json();
      
      setGameState(prev => ({
        ...prev,
        gameId: data.gameId,
        balance: data.initialBalance,
        timeRemaining: GAME_DURATION_MS / 1000,
        isActive: true,
        messages: [],
        isLoading: true,
        isTransitioning: false,
        threatLevel: 0,
      }));

      setStartTime(Date.now());

      // Get initial AI message
      await sendInitialMessage(data.gameId);
    } catch (error) {
      console.error('Error starting game:', error);
      setGameState(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  const sendInitialMessage = async (gameId: string) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/game/${gameId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: null }),
      });

      if (!response.ok) {
        throw new Error('Failed to get initial message');
      }

  const data: UpdateGameResponse = await response.json();
      
      const aiMessage: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        message: data.message,
        feissariName: data.feissariName,
        emoteAssets: data.emoteAssets,
        balance: data.balance,
        goToNext: data.goToNext,
        quickActions: data.quickActions,
        threatLevel: data.threatLevel,
      };

      setGameState(prev => ({
        ...prev,
        messages: [aiMessage],
        balance: data.balance,
        currentFeissariName: data.feissariName,
        isActive: !data.gameOver,
        score: data.score,
        defeatedFeissari: data.defeatedFeissari,
        isLoading: false,
        isTransitioning: false,
        threatLevel: data.threatLevel ?? prev.threatLevel ?? 0,
      }));
    } catch (error) {
      console.error('Error getting initial message:', error);
    }
  };

  const sendMessage = useCallback(async (message: string) => {
    if (!gameState.gameId || !message.trim()) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      message: message.trim(),
    };

      setGameState(prev => ({
      ...prev,
      messages: [...prev.messages, userMessage],
      isLoading: true,
    }));

    try {
      const response = await fetch(`${BACKEND_URL}/api/game/${gameState.gameId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: message.trim() }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

  const data: UpdateGameResponse = await response.json();
      
      const aiMessage: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        message: data.message,
        feissariName: data.feissariName,
        emoteAssets: data.emoteAssets,
        balance: data.balance,
        goToNext: data.goToNext,
        quickActions: data.quickActions,
        threatLevel: data.threatLevel,
      };

      setGameState(prev => ({
        ...prev,
        messages: [...prev.messages, aiMessage],
        balance: data.balance,
        currentFeissariName: data.feissariName,
        isActive: !data.gameOver,
        // We'll manage transition with a custom flag and timed sequence
        isLoading: false,
        score: data.score,
        defeatedFeissari: data.defeatedFeissari,
        threatLevel: data.threatLevel ?? prev.threatLevel ?? 0,
      }));

      // If moving to next feissari, wait 3s, then start transition animation and fetch next greeting
      if (data.goToNext && !data.gameOver) {
        // Show old feissari and message for 3 seconds (no loading spinner)
        await new Promise(resolve => setTimeout(resolve, 3000));
        // Start background animation and hide old feissari
        setGameState(prev => ({
          ...prev,
          isTransitioning: true,
          currentFeissariName: '',
        }));
        // Fetch the next feissari greeting
        await fetchNextFeissariGreeting();
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setGameState(prev => ({ ...prev, isLoading: false }));
    }
  }, [gameState.gameId]);

  const fetchNextFeissariGreeting = useCallback(async () => {
    if (!gameState.gameId) return;

    try {
      const response = await fetch(`${BACKEND_URL}/api/game/${gameState.gameId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: null }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch next feissari greeting');
      }

  const data: UpdateGameResponse = await response.json();
      
      const nextFeissariMessage: ChatMessage = {
        id: `ai-${Date.now()}-next`,
        sender: 'ai',
        message: data.message,
        feissariName: data.feissariName,
        emoteAssets: data.emoteAssets,
        balance: data.balance,
        goToNext: false, // Next feissari is just starting
        quickActions: data.quickActions,
        threatLevel: data.threatLevel,
      };

      setGameState(prev => ({
        ...prev,
        messages: [...prev.messages, nextFeissariMessage],
        balance: data.balance,
        currentFeissariName: data.feissariName,
        isActive: !data.gameOver,
        isLoading: false,
        isTransitioning: false, // stop background animation when new feissari has loaded
        score: data.score,
        defeatedFeissari: data.defeatedFeissari,
        threatLevel: data.threatLevel ?? prev.threatLevel ?? 0,
      }));
    } catch (error) {
      console.error('Error fetching next feissari greeting:', error);
      setGameState(prev => ({ ...prev, isLoading: false }));
    }
  }, [gameState.gameId]);

  const resetGame = useCallback(() => {
    setGameState({
      gameId: null,
      balance: INITIAL_BALANCE,
      timeRemaining: GAME_DURATION_MS / 1000,
      isActive: false,
      messages: [],
      currentFeissariName: '',
      isLoading: false,
      threatLevel: 0,
    });
    setStartTime(null);
  }, []);

  return (
    <GameContext.Provider value={{ gameState, startGame, sendMessage, resetGame }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
}

// EmoteImage: renders a single SVG URL or cycles through multiple SVG URLs every 500ms.
// Accepts either a string (single URL) or string[] (multiple URLs). If no assets provided, renders null.
export function EmoteImage({ emoteAssets, className }: { emoteAssets?: string[] | string, className?: string }) {
  const assets = React.useMemo(() => {
    if (!emoteAssets) return [] as string[];
    return Array.isArray(emoteAssets) ? emoteAssets : [emoteAssets];
  }, [emoteAssets]);

  const [index, setIndex] = React.useState(0);

  React.useEffect(() => {
    if (assets.length <= 1) {
      setIndex(0);
      return;
    }

    setIndex(0);
    const id = setInterval(() => {
      setIndex(i => (i + 1) % assets.length);
    }, 200);

    return () => clearInterval(id);
  }, [assets]);

  if (assets.length === 0) return null;

  // Keep images small like a pixel-art emote
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={assets[index]}
      alt="emote"
      className={`w-60 h-60 object-contain ${className ?? ''}`}
      draggable={false}
    />
  );
}
