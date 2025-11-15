"use client"

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import Cookies from 'js-cookie';
import { GameState, ChatMessage, CreateGameResponse, UpdateGameResponse } from '@/lib/types';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
const GAME_DURATION_MS = 3 * 60 * 1000; // 3 minutes
const INITIAL_BALANCE = 100;

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
  });

  const [startTime, setStartTime] = useState<number | null>(null);

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
      };

      setGameState(prev => ({
        ...prev,
        messages: [...prev.messages, aiMessage],
        balance: data.balance,
        currentFeissariName: data.feissariName,
        isActive: !data.gameOver,
        isLoading: data.goToNext, // Keep loading if moving to next to fetch new feissari
        score: data.score,
        defeatedFeissari: data.defeatedFeissari,
      }));

      // If moving to next feissari, fetch the next feissari's greeting
      if (data.goToNext && !data.gameOver) {
        await fetchNextFeissariGreeting();
      } else {
        setGameState(prev => ({ ...prev, isLoading: false }));
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
      };

      setGameState(prev => ({
        ...prev,
        messages: [...prev.messages, nextFeissariMessage],
        balance: data.balance,
        currentFeissariName: data.feissariName,
        isActive: !data.gameOver,
        isLoading: false,
        score: data.score,
        defeatedFeissari: data.defeatedFeissari,
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
export function EmoteImage({ emoteAssets }: { emoteAssets?: string[] | string }) {
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
      className="w-24 h-24 mr-3 object-contain"
      draggable={false}
    />
  );
}
