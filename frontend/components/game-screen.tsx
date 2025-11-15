"use client"

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation'
import { useGame, EmoteImage } from '@/lib/game-context';
import type { GameState, ChatMessage } from '@/lib/types';
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
  isTransitioning,
}: {
  isLoading: boolean;
  messages: any[];
  isActive: boolean;
  isTransitioning: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const prevIsActive = useRef<boolean>(false);

  // Track the last AI message we've seen (id) and whether it had goToNext.
  const prevLastAiName = useRef<string | number | null>(null);
  const prevLastAiHadGoToNext = useRef<boolean>(false);

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

    // Control background based on transition and AI messages
    // Only play at the beginning of the game (handled above) or while transitioning between feissari
    if (isTransitioning) {
      v.play().catch(() => {});
    } else {
      // If a new AI response has arrived for a feissari (i.e., not goToNext), pause immediately
      if ((lastAiName !== prevLastAiName.current || prevLastAiHadGoToNext.current) && !lastAiGoToNext) {
        try { v.pause(); } catch (_) {}
      }
    }

    prevLastAiHadGoToNext.current = lastAiGoToNext;
    prevLastAiName.current = lastAiName;

    prevIsActive.current = isActive;
  }, [messages, isActive, isLoading, isTransitioning]);

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
  const prevFeissariRef = useRef<string | null>(null);
  const [emoteVisible, setEmoteVisible] = useState(false);
  const [showFeissariBubble, setShowFeissariBubble] = useState(false);

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

  // Animate emote when feissari changes: fade in + slide up for 1s
  useEffect(() => {
    const current = gameState.currentFeissariName || null;
    if (current && current !== prevFeissariRef.current) {
      setEmoteVisible(false);
      setShowFeissariBubble(false);
      const raf = requestAnimationFrame(() => setEmoteVisible(true));
      const timer = setTimeout(() => setShowFeissariBubble(true), 1000);
      prevFeissariRef.current = current;
      return () => {
        cancelAnimationFrame(raf);
        clearTimeout(timer);
      };
    }
    // If first time setting current feissari
    if (current && prevFeissariRef.current === null) {
      setEmoteVisible(true);
      setTimeout(() => setShowFeissariBubble(true), 1000);
      prevFeissariRef.current = current;
    }
  }, [gameState.currentFeissariName]);

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
  <VideoBackground isLoading={gameState.isLoading} messages={gameState.messages} isActive={gameState.isActive} isTransitioning={!!gameState.isTransitioning} />
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
  <VideoBackground isLoading={gameState.isLoading} messages={gameState.messages} isActive={gameState.isActive} isTransitioning={!!gameState.isTransitioning} />
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
  <VideoBackground isLoading={gameState.isLoading} messages={gameState.messages} isActive={gameState.isActive} isTransitioning={!!gameState.isTransitioning} />
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

      {/* Focused chat UI: only newest feissari message and newest own message */}
      <div className="flex-1 relative">
        {/* Feissari emote + bubble centered X, 1/3 from bottom Y */}
        {gameState.currentFeissariName && (
          <div className="pointer-events-none fixed left-1/2 bottom-[24%] -translate-x-2/3 flex flex-col items-center gap-3 z-10">
            {/* Speech bubble appears after emote entrance animation */}
            {showFeissariBubble && (
              <FeissariBubble gameState={gameState} />
            )}
            {/* Emote with entrance animation */}
            <div className={`transition-all duration-1000 ${emoteVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
              {(() => {
                const lastAi = [...gameState.messages].reverse().find(m => m.sender === 'ai');
                const emoteAssets = lastAi?.emoteAssets;
                return emoteAssets ? (
                  <EmoteImage emoteAssets={emoteAssets} className="mr-0" />
                ) : null;
              })()}
            </div>
          </div>
        )}

        {/* User bubble at bottom-right: hide on feissari change until user types or replies */}
        {(() => {
          const isTyping = inputMessage.trim().length > 0 && !gameState.isLoading;
          const lastAiIndex = [...gameState.messages]
            .map((m, idx) => ({ m, idx }))
            .reverse()
            .find(({ m }) => m.sender === 'ai' && m.feissariName === gameState.currentFeissariName)?.idx ?? -1;
          const hasUserAfterLastAi = lastAiIndex >= 0
            ? gameState.messages.slice(lastAiIndex + 1).some((m: ChatMessage) => m.sender === 'user')
            : false;
          const showUser = isTyping || hasUserAfterLastAi;
          return showUser ? (
            <div className="pointer-events-none fixed bottom-[15%] right-[15%] z-10">
              <UserBubble gameState={gameState} inputMessage={inputMessage} />
            </div>
          ) : null;
        })()}
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

// Bubble components
function FeissariBubble({ gameState }: { gameState: GameState }) {
  // Decide content: show typing dots if waiting for AI and feissari not changing
  const lastAi = [...gameState.messages].reverse().find((m: ChatMessage) => m.sender === 'ai');
  const isSameFeissari = lastAi?.feissariName === gameState.currentFeissariName;
  // Show typing only when still conversing with the same feissari and the last AI message did not signal moving on
  const showTyping = Boolean(gameState.isLoading && isSameFeissari && !lastAi?.goToNext);
  const content = showTyping ? null : lastAi?.message;

  return (
    <div className="relative">
      <div className="max-w-[70vw] sm:max-w-[50vw] bg-white/95 dark:bg-gray-800/95 text-gray-800 dark:text-gray-100 shadow-xl px-4 py-3 rounded-2xl">
        {/* top corners rounded; keep bottom edge straight where tail is */}
        <div className="text-sm sm:text-base whitespace-pre-wrap">
          {showTyping ? (
            <TypingDots colorClass="bg-emerald-600" />
          ) : (
            content
          )}
        </div>
      </div>
      {/* Tail pointing down to emote */}
      <div className="absolute left-1/2 -translate-x-1/2 -bottom-1 w-3 h-3 rotate-45 bg-white dark:bg-gray-800 shadow-md"></div>
    </div>
  );
}

function UserBubble({ gameState, inputMessage }: { gameState: GameState; inputMessage: string }) {
  const lastUser = [...gameState.messages].reverse().find((m: ChatMessage) => m.sender === 'user');
  const isTyping = inputMessage.trim().length > 0 && !gameState.isLoading;
  const content = isTyping ? null : lastUser?.message;

  // Bubble with bottom-right corner not rounded (toward user position)
  return (
    <div className="max-w-[40vw] sm:max-w-[35vw] bg-emerald-600/95 text-white px-4 py-3 rounded-tl-2xl rounded-tr-2xl rounded-bl-2xl rounded-br-none shadow-xl">
      <div className="text-sm sm:text-base whitespace-pre-wrap">
        {isTyping ? <TypingDots colorClass="bg-white" /> : content}
      </div>
    </div>
  );
}

function TypingDots({ colorClass = 'bg-emerald-600' }: { colorClass?: string }) {
  return (
    <div className="flex items-center gap-1 h-4">
      <span className={`w-2 h-2 rounded-full ${colorClass} animate-bounce`}></span>
      <span className={`w-2 h-2 rounded-full ${colorClass} animate-bounce`} style={{ animationDelay: '0.12s' }}></span>
      <span className={`w-2 h-2 rounded-full ${colorClass} animate-bounce`} style={{ animationDelay: '0.24s' }}></span>
    </div>
  );
}
