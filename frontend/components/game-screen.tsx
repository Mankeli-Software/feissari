"use client"

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation'
import { useGame, EmoteImage } from '@/lib/game-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Cookies from 'js-cookie';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

// VideoBackground: renders a full-bleed, muted background video and manages
// play/pause according to game events:
// 1. When a new game starts (`isActive` becomes true) the video plays by default.
// 2. When the first AI response arrives, wait 1s then pause the video.
// 3. When an AI message with `goToNext === true` appears, start playing again.
// 4. When the next AI response after a `goToNext` arrives, wait 1s then pause.
// `isLoading` (AI thinking) will always force the video to play while true.
function VideoBackground({
  isLoading,
  messages,
  isActive,
}: {
  isLoading: boolean;
  messages: any[];
  isActive: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const prevIsActive = useRef<boolean>(false);

  // Track the last AI message we've seen (id) and whether it had goToNext.
  const prevLastAiName = useRef<string | number | null>(null);
  const prevLastAiHadGoToNext = useRef<boolean>(false);
  const pauseTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    // If a new game just started, play by default
    if (!prevIsActive.current && isActive) {
      v.play().catch(() => {});
    }

    // Find the last AI message
    const lastAi = [...messages].reverse().find((m) => m && m.sender === 'ai');
    const lastAiName = lastAi?.feissariName ?? null;
    const lastAiGoToNext = !!lastAi?.goToNext;

    // If the last AI message changed, react according to rules
    if (lastAiName !== prevLastAiName.current) {
      // Clear any pending pause timers
      if (pauseTimerRef.current) {
        clearTimeout(pauseTimerRef.current);
        pauseTimerRef.current = null;
      }

      if (lastAiGoToNext) {
        // Feissari gave up -> play the video
        v.play().catch(() => {});
      } else {
        // Regular AI response
        // If this is the first AI response (no prev AI) OR it follows a goToNext,
        // wait 1s then pause.
        if (prevLastAiName.current === null || prevLastAiHadGoToNext.current) {
          pauseTimerRef.current = window.setTimeout(() => {
            try {
              v.pause();
            } catch (_) {}
            pauseTimerRef.current = null;
          }, 1000);
        }
      }

      prevLastAiHadGoToNext.current = lastAiGoToNext;
      prevLastAiName.current = lastAiName;
    }

    prevIsActive.current = isActive;
  }, [messages, isActive, isLoading]);

  // Clean up pause timer on unmount
  useEffect(() => {
    return () => {
      if (pauseTimerRef.current) {
        clearTimeout(pauseTimerRef.current);
        pauseTimerRef.current = null;
      }
    };
  }, []);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <video
      ref={videoRef}
      src="/background.webm"
      // paused by default — play while loading is true or per game events
      muted
      playsInline
      loop
      preload="metadata"
      className="pointer-events-none fixed inset-0 w-full h-full object-cover z-0"
      aria-hidden
    />
  );
}

export default function GameScreen() {
  const { gameState, startGame, sendMessage, resetGame } = useGame();

  // Video background ref is kept in a component below; expose it here if needed later
  const router = useRouter()
  const [inputMessage, setInputMessage] = useState('');
  const [prevScore, setPrevScore] = useState<number>(0);
  const [animatingScore, setAnimatingScore] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // If no session cookie present, redirect to start screen so user can create/join a session
  useEffect(() => {
    const sessionId = Cookies.get('feissari_session');
    if (!sessionId) {
      router.replace('/');
    }
  }, [router]);

  useEffect(() => {
    scrollToBottom();
  }, [gameState.messages]);

  // Calculate current score during gameplay
  const currentScore = (gameState.defeatedFeissari || 0) * gameState.balance;

  // Animate score changes
  useEffect(() => {
    if (currentScore !== prevScore && gameState.isActive) {
      setAnimatingScore(true);
      setPrevScore(currentScore);
      const timer = setTimeout(() => setAnimatingScore(false), 500);
      return () => clearTimeout(timer);
    }
  }, [currentScore, prevScore, gameState.isActive]);

  // Save game to leaderboard and redirect after a short delay when game ends
  useEffect(() => {
    if (!gameState.isActive && gameState.messages.length > 0 && gameState.gameId) {
      // Immediately start saving in background and redirect right away.
      (async () => {
        try {
          await fetch(`${BACKEND_URL}/api/leaderboard`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ gameId: gameState.gameId }),
          });
        } catch (error) {
          // Log but do not block redirect
          console.error('Error saving game to leaderboard:', error);
        }
      })();

      // Redirect immediately to leaderboard. We don't await the save above.
      router.push('/leaderboard');
    }
  }, [gameState.isActive, gameState.messages.length, gameState.gameId, gameState.score, gameState.defeatedFeissari, gameState.balance, router]);

  const handleSendMessage = () => {
    if (inputMessage.trim() && !gameState.isLoading) {
      sendMessage(inputMessage);
      setInputMessage('');
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Show start screen if game hasn't started
  if (!gameState.isActive && gameState.messages.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center relative">
  <VideoBackground isLoading={gameState.isLoading} messages={gameState.messages} isActive={gameState.isActive} />
        <div className="w-full max-w-md space-y-8 rounded-lg bg-white p-10 shadow-2xl dark:bg-gray-800 relative z-10">
          <div className="text-center">
            <h1 className="text-5xl font-bold text-emerald-800 dark:text-emerald-400 mb-4">
              Survive the Feissari
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-300 mb-6">
              Can you survive 3 minutes without losing all your money?
            </p>
            <div className="space-y-4 text-left bg-emerald-50 dark:bg-emerald-950 p-6 rounded-lg">
              <h2 className="font-bold text-xl text-emerald-800 dark:text-emerald-400">Game Rules:</h2>
              <ul className="space-y-2 text-gray-700 dark:text-gray-300">
                <li>💰 Starting balance: €{gameState.balance}</li>
                <li>⏱️ Time limit: 3 minutes</li>
                <li>🎯 Goal: Don't let them sell you anything!</li>
                <li>💬 Talk your way out of their sales pitches</li>
              </ul>
            </div>
          </div>
          
          <Button
            onClick={startGame}
            disabled={gameState.isLoading}
            className="w-full h-14 text-lg font-semibold bg-emerald-600 hover:bg-emerald-700"
            size="lg"
          >
            {gameState.isLoading ? "Starting Game..." : "Start Game"}
          </Button>
        </div>
      </div>
    );
  }

  // Game over: we redirect immediately to leaderboard. Show a minimal redirecting indicator
  if (!gameState.isActive && gameState.messages.length > 0) {
    return (
      <div className="flex min-h-screen items-center justify-center relative">
  <VideoBackground isLoading={gameState.isLoading} messages={gameState.messages} isActive={gameState.isActive} />
        <div className="w-full max-w-sm space-y-4 rounded-lg bg-white p-8 shadow-2xl dark:bg-gray-800 text-center relative z-10">
          <p className="text-lg text-gray-700 dark:text-gray-300">Saving your result and redirecting to leaderboard...</p>
          <div className="flex justify-center mt-4">
            <div className="w-6 h-6 border-4 border-emerald-600 border-dashed rounded-full animate-spin"></div>
          </div>
        </div>
      </div>
    );
  }

  // Active game screen
  return (
    <div className="relative">
  <VideoBackground isLoading={gameState.isLoading} messages={gameState.messages} isActive={gameState.isActive} />
      <div className="flex flex-col h-screen relative z-10">
        {/* Header with stats */}
        <div className="bg-white dark:bg-gray-800 shadow-lg p-4">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-6">
            <div className="text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400">Score</p>
              <p className={`text-2xl font-bold text-emerald-600 dark:text-emerald-400 transition-all duration-300 ${
                animatingScore ? 'scale-125' : 'scale-100'
              }`}>
                {currentScore}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400">Balance</p>
              <p className={`text-2xl font-bold ${
                gameState.balance < 30 
                  ? 'text-red-600 dark:text-red-400' 
                  : 'text-emerald-600 dark:text-emerald-400'
              }`}>
                €{gameState.balance}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400">Defeated</p>
              <p className="text-2xl font-bold text-gray-800 dark:text-gray-200">
                {gameState.defeatedFeissari || 0}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400">Time</p>
              <p className={`text-2xl font-bold ${
                gameState.timeRemaining < 30 
                  ? 'text-red-600 dark:text-red-400' 
                  : 'text-gray-800 dark:text-gray-200'
              }`}>
                {formatTime(gameState.timeRemaining)}
              </p>
            </div>
          </div>
          {gameState.currentFeissariName && (
            <div className="text-right">
              <p className="text-sm text-gray-600 dark:text-gray-400">Talking to</p>
              <p className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                {gameState.currentFeissariName}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-4xl mx-auto space-y-4">
          {gameState.messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex items-start ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {/* Show emote image for AI messages on the left */}
              {msg.sender !== 'user' && msg.emoteAssets && (
                <div className="flex-shrink-0 flex items-start">
                  <EmoteImage emoteAssets={msg.emoteAssets} />
                </div>
              )}

              <div
                className={`max-w-[70%] rounded-lg p-4 ${
                  msg.sender === 'user'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 shadow-md'
                }`}
              >
                {msg.sender === 'ai' && msg.feissariName && (
                  <p className="text-xs font-semibold mb-2 text-emerald-600 dark:text-emerald-400">
                    {msg.feissariName}
                  </p>
                )}
                <p className="whitespace-pre-wrap">{msg.message}</p>
                {msg.sender === 'ai' && msg.goToNext && (
                  <p className="text-xs mt-2 font-semibold text-emerald-600 dark:text-emerald-400">
                    ✨ Feissari defeated! Moving to next challenger...
                  </p>
                )}
                {msg.sender === 'ai' && msg.balance !== undefined && (
                  <p className="text-xs mt-2 opacity-75">
                    Balance: €{msg.balance}
                  </p>
                )}
              </div>
            </div>
          ))}
          {gameState.isLoading && (
            <div className="flex justify-start">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-md">
                <div className="flex space-x-2">
                  <div className="w-2 h-2 bg-emerald-600 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-emerald-600 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-emerald-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input area */}
        {/* Input area */}
        <div className="bg-white dark:bg-gray-800 shadow-lg p-4">
        <div className="max-w-4xl mx-auto flex gap-2">
          <Input
            type="text"
            placeholder="Type your response..."
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            disabled={gameState.isLoading}
            className="flex-1"
          />
          <Button
            onClick={handleSendMessage}
            disabled={!inputMessage.trim() || gameState.isLoading}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            Send
          </Button>
        </div>
      </div>
    </div>
    </div>
  );
}
