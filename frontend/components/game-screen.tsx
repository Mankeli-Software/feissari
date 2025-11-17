"use client"

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation'
import { useGame, EmoteImage, useAudioMute } from '@/lib/game-context';
import ThreatStars from '@/components/threat-stars';
import type { GameState, ChatMessage } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Cookies from 'js-cookie';
import { getVoiceForFeissari, resetVoiceCache } from '@/lib/feissariVoiceCache';

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
  stepsAudioRef,
  isMuted,
}: {
  isLoading: boolean;
  messages: any[];
  isActive: boolean;
  isTransitioning: boolean;
  stepsAudioRef: React.RefObject<HTMLAudioElement | null>;
  isMuted: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const prevIsActive = useRef<boolean>(false);

  // Track the last AI message we've seen (id) and whether it had goToNext.
  const prevLastAiName = useRef<string | number | null>(null);
  const prevLastAiHadGoToNext = useRef<boolean>(false);

  useEffect(() => {
    const v = videoRef.current;
    const a = audioRef.current;
    if (!v) return;

    // If a new game just started, play by default
    if (!prevIsActive.current && isActive) {
      v.play().catch(() => { });
      if (a) {
        a.play().catch(() => { });
      }
    }

    // Find the last AI message
    const lastAi = [...messages].reverse().find((m) => m && m.sender === 'ai');
    const lastAiName = lastAi?.feissariName ?? null;
    const lastAiGoToNext = !!lastAi?.goToNext;

    // Control background based on transition and AI messages
    // Only play at the beginning of the game (handled above) or while transitioning between feissari
    if (isTransitioning) {
      v.play().catch(() => { });
      if (a) {
        a.play().catch(() => { });
      }
    } else {
      // If a new AI response has arrived for a feissari (i.e., not goToNext), pause immediately
      if ((lastAiName !== prevLastAiName.current || prevLastAiHadGoToNext.current) && !lastAiGoToNext) {
        try { 
          v.pause(); 
          if (a) {
            a.pause();
          }
        } catch (_) { }
      }
    }

    prevLastAiHadGoToNext.current = lastAiGoToNext;
    prevLastAiName.current = lastAiName;

    prevIsActive.current = isActive;
  }, [messages, isActive, isLoading, isTransitioning]);

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
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
      {/* Walking sound synchronized with video */}
      <audio
        ref={(el) => {
          audioRef.current = el;
          if (stepsAudioRef) {
            stepsAudioRef.current = el;
          }
        }}
        src="/audio/steps.wav"
        loop
        preload="auto"
        muted={isMuted}
        aria-hidden
        className="hidden"
      />
    </>
  );
}

export default function GameScreen() {
  const { gameState, startGame, sendMessage, resetGame } = useGame();
  const { isMuted, toggleMute } = useAudioMute();

  // Video background ref is kept in a component below; expose it here if needed later
  const router = useRouter()
  // Background music player (loops while game is active)
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [inputMessage, setInputMessage] = useState('');
  // Ref for feissari speech audio
  const feissariAudioRef = useRef<HTMLAudioElement | null>(null);
  const [prevScore, setPrevScore] = useState<number>(0);
  const [animatingScore, setAnimatingScore] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevFeissariRef = useRef<string | null>(null);
  const [emoteVisible, setEmoteVisible] = useState(false);
  const [showFeissariBubble, setShowFeissariBubble] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevIsLoadingRef = useRef<boolean>(false);
  const stepsAudioRef = useRef<HTMLAudioElement | null>(null);

  // Start game + kick off background audio from a user gesture to satisfy autoplay policies
  const handleStartGame = async () => {
    const a = audioRef.current;
    if (a) {
      try {
        a.loop = true;
        a.volume = 0.25; // keep it subtle
        a.muted = isMuted;
        await a.play();
      } catch (_) {
        // ignore autoplay errors; we'll try again in the effect below
      }
    }
    await startGame();
  };

  // Effect to handle muting/unmuting all audio elements
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = isMuted;
    }
    if (feissariAudioRef.current) {
      feissariAudioRef.current.muted = isMuted;
    }
    if (stepsAudioRef.current) {
      stepsAudioRef.current.muted = isMuted;
    }
  }, [isMuted]);

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
        } finally {
          router.push('/leaderboard');
        }
      })();


    }
  }, [gameState.isActive, gameState.messages.length, gameState.gameId, gameState.score, gameState.defeatedFeissari, gameState.balance, router]);

  // Manage background music playback according to game activity
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;

    if (gameState.isActive) {
      // Try to play (in case it didn't start from a gesture)
      a.loop = true;
      a.volume = 0.25;
      a.play().catch(() => { /* noop */ });
    } else {
      try {
        a.pause();
        a.currentTime = 0;
      } catch (_) { /* noop */ }
    }

    return () => {
      try {
        a.pause();
      } catch (_) { /* noop */ }
    };
  }, [gameState.isActive]);

  // Ensure the input is focused when it's the user's turn to reply (new AI response)
  useEffect(() => {
    // Focus only during active gameplay and when not loading
    if (!gameState.isActive || gameState.isLoading) {
      prevIsLoadingRef.current = gameState.isLoading;
      return;
    }

    // If loading just finished, and last AI message doesn't signal moving on, focus the input
    const lastAi = [...gameState.messages].reverse().find((m) => m.sender === 'ai');
    const awaitingUser = !!lastAi && lastAi.goToNext !== true;

    if (awaitingUser) {
      // Use rAF to ensure the element is enabled/rendered before focusing
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }

    prevIsLoadingRef.current = gameState.isLoading;
  }, [gameState.isActive, gameState.isLoading, gameState.messages.length]);

  const handleSendMessage = () => {
    if (inputMessage.trim() && !gameState.isLoading) {
      sendMessage(inputMessage);
      setInputMessage('');
      // Keep the caret in the input after sending
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Play feissari voice when a new AI message is received
  useEffect(() => {
    // Find the last AI message
    const lastAi = [...gameState.messages].reverse().find((m) => m.sender === 'ai');
    if (!lastAi || !lastAi.feissariName || !lastAi.message) return;
    // Only play if this is a new message (track by message content)
    // Use a ref to store the last played message id/content
    if (!feissariAudioRef.current) return;
    if ((feissariAudioRef.current as any)._lastPlayedMessage === lastAi.message) return;
    (feissariAudioRef.current as any)._lastPlayedMessage = lastAi.message;
    // Get the assigned voice for this feissari
    const voiceFile = getVoiceForFeissari(lastAi.feissariName);
    feissariAudioRef.current.src = `/audio/${voiceFile}`;
    feissariAudioRef.current.currentTime = 0;
    feissariAudioRef.current.play().catch(() => {});
  }, [gameState.messages]);

  // Show start screen if game hasn't started
  if (!gameState.isActive && gameState.messages.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center relative p-4">
        {/* Hidden audio element for background music */}
        <audio ref={audioRef} src="/audio/metrobackgroundsound.mp3" loop preload="auto" aria-hidden className="hidden" />
        <VideoBackground isLoading={gameState.isLoading} messages={gameState.messages} isActive={gameState.isActive} isTransitioning={!!gameState.isTransitioning} stepsAudioRef={stepsAudioRef} isMuted={isMuted} />
        <div className="w-full max-w-md space-y-6 sm:space-y-8 rounded-lg bg-white p-6 sm:p-10 shadow-2xl dark:bg-gray-800 relative z-10">
          <div className="text-center">
            <h1 className="text-3xl sm:text-5xl font-bold text-primary mb-3 sm:mb-4">
              Survive the Feissari
            </h1>
            <p className="text-base sm:text-lg text-gray-600 dark:text-gray-300 mb-4 sm:mb-6">
              Can you uncover the characters' weaknesses, or will you resort to using force?
            </p>
            <div className="space-y-3 sm:space-y-4 text-left bg-secondary dark:bg-gray-900 p-4 sm:p-6 rounded-lg">
              <h2 className="font-bold text-lg sm:text-xl text-primary">Game Rules:</h2>
              <ul className="space-y-2 text-sm sm:text-base text-gray-700 dark:text-gray-300">
                <li>💰 Starting balance: €{gameState.balance}</li>
                <li>⏱️ Time limit: 3 minutes</li>
                <li>🎯 Goal: Don't let them sell you anything!</li>
                <li>💬 Talk your way out of their sales pitches</li>
              </ul>
            </div>
          </div>

          <Button
            onClick={handleStartGame}
            disabled={gameState.isLoading}
            className="w-full h-12 sm:h-14 text-base sm:text-lg font-semibold bg-primary hover:bg-primary/90"
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
      <div className="flex min-h-screen items-center justify-center relative p-4">
        {/* Hidden audio element for background music */}
        <audio ref={audioRef} src="/audio/metrobackgroundsound.mp3" loop preload="auto" aria-hidden className="hidden" />
        <VideoBackground isLoading={gameState.isLoading} messages={gameState.messages} isActive={gameState.isActive} isTransitioning={!!gameState.isTransitioning} stepsAudioRef={stepsAudioRef} isMuted={isMuted} />
        <div className="w-full max-w-sm space-y-4 rounded-lg bg-white p-6 sm:p-8 shadow-2xl dark:bg-gray-800 text-center relative z-10">
          <p className="text-base sm:text-lg text-gray-700 dark:text-gray-300">Saving your result and redirecting to leaderboard...</p>
          <div className="flex justify-center mt-4">
            <div className="w-6 h-6 border-4 border-primary border-dashed rounded-full animate-spin"></div>
          </div>
        </div>
      </div>
    );
  }

  // Active game screen
  return (
    <div className="relative">
      {/* Hidden audio element for background music */}
      <audio ref={audioRef} src="/audio/metrobackgroundsound.mp3" loop preload="auto" aria-hidden className="hidden" />
      {/* Hidden audio element for feissari speech */}
      <audio ref={feissariAudioRef} preload="auto" aria-hidden className="hidden" />
      <VideoBackground isLoading={gameState.isLoading} messages={gameState.messages} isActive={gameState.isActive} isTransitioning={!!gameState.isTransitioning} stepsAudioRef={stepsAudioRef} isMuted={isMuted} />
      <div className="flex flex-col h-screen relative z-10">
        {/* Header with stats */}
        <div className="bg-white dark:bg-gray-800 shadow-lg p-2 sm:p-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex flex-wrap justify-between items-center gap-2 sm:gap-6">
              <div className="flex flex-wrap items-center gap-2 sm:gap-6">
                <div className="text-center">
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Score</p>
                  <p className={`text-lg sm:text-2xl font-bold text-primary transition-all duration-300 ${animatingScore ? 'scale-125' : 'scale-100'
                    }`}>
                    {currentScore}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Balance</p>
                  <p className={`text-lg sm:text-2xl font-bold ${gameState.balance < 30
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-primary'
                    }`}>
                    €{gameState.balance}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Threat</p>
                  <p className="text-lg sm:text-2xl font-bold leading-[2rem] h-6 sm:h-8 flex items-center justify-center">
                    <ThreatStars className="align-middle" level={gameState.threatLevel ?? 0} size={16} />
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Defeated</p>
                  <p className="text-lg sm:text-2xl font-bold text-gray-800 dark:text-gray-200">
                    {gameState.defeatedFeissari || 0}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Time</p>
                  <p className={`text-lg sm:text-2xl font-bold ${gameState.timeRemaining < 30
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-gray-800 dark:text-gray-200'
                    }`}>
                    {formatTime(gameState.timeRemaining)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:gap-4">
                {gameState.currentFeissariName && (
                  <div className="text-right">
                    <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Talking to</p>
                    <p className="text-sm sm:text-lg font-semibold text-gray-800 dark:text-gray-200">
                      {gameState.currentFeissariName}
                    </p>
                  </div>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleMute}
                  className="p-2 h-8 w-8 sm:h-10 sm:w-10"
                  title={isMuted ? "Unmute sound" : "Mute sound"}
                >
                {isMuted ? (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 sm:w-5 sm:h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75L19.5 12m0 0l2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6l4.72-4.72a.75.75 0 011.28.531V19.94a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.506-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.395C2.806 8.757 3.63 8.25 4.51 8.25H6.75z" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 sm:w-5 sm:h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
                  </svg>
                )}
              </Button>
            </div>
          </div>
        </div>
        </div>

        {/* Focused chat UI: only newest feissari message and newest own message */}
        <div className="flex-1 relative">
          {/* Feissari emote + bubble centered X, 1/3 from bottom Y */}
          {gameState.currentFeissariName && (
            <div className="pointer-events-none fixed left-[10%] sm:left-1/2 bottom-[24%] sm:-translate-x-2/3 flex flex-col items-center gap-3 z-10 max-w-[80vw] sm:max-w-none">
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
              <div className="pointer-events-none fixed bottom-[20%] right-[5%] sm:right-[15%] z-10 max-w-[80vw] sm:max-w-none">
                <UserBubble gameState={gameState} inputMessage={inputMessage} />
              </div>
            ) : null;
          })()}
        </div>

        {/* Input area */}
        <div className="bg-white dark:bg-gray-800 shadow-lg p-2 sm:p-4">
          {/* Quick action buttons above the input field */}
          {(() => {
            const lastAi = [...gameState.messages].reverse().find((m) => m.sender === 'ai');
            const actions: string[] = lastAi?.quickActions ?? [];
            const shouldHide = lastAi?.goToNext === true; // hide if moving to next
            if (shouldHide || !actions || actions.length === 0) return null;
            return (
              <div className="max-w-4xl mx-auto mb-2 sm:mb-3">
                <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1 sm:mb-2">Quick Actions</div>
                <div className="flex flex-wrap gap-1 sm:gap-2">
                  {actions.map((action, idx) => (
                    <Button
                      key={`${action}-${idx}`}
                      variant="outline"
                      size="sm"
                      disabled={gameState.isLoading}
                      onClick={() => {
                        if (gameState.isLoading) return;
                        const payload = `*${action}*`;
                        sendMessage(payload);
                        setInputMessage('');
                        // Return focus to the text input after using a quick action
                        requestAnimationFrame(() => inputRef.current?.focus());
                      }}
                      className="whitespace-nowrap text-xs sm:text-sm"
                    >
                      {action}
                    </Button>
                  ))}
                </div>
              </div>
            );
          })()}
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
              className="flex-1 text-sm sm:text-base"
              ref={inputRef}
            />
            <Button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || gameState.isLoading}
              className="bg-primary hover:bg-primary/90 text-sm sm:text-base px-3 sm:px-4"
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
      <div className="w-full max-w-[75vw] sm:max-w-[50vw] bg-white/95 dark:bg-gray-800/95 text-gray-800 dark:text-gray-100 shadow-xl px-4 py-3 rounded-2xl">
        {/* top corners rounded; keep bottom edge straight where tail is */}
        <div className="text-sm sm:text-base whitespace-pre-wrap">
          {showTyping ? (
            <TypingDots colorClass="bg-primary" />
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
    <div className="w-full max-w-[70vw] sm:max-w-[35vw] bg-primary/95 text-white px-4 py-3 rounded-tl-2xl rounded-tr-2xl rounded-bl-2xl rounded-br-none shadow-xl">
      <div className="text-sm sm:text-base whitespace-pre-wrap">
        {isTyping ? <TypingDots colorClass="bg-white" /> : content}
      </div>
    </div>
  );
}

function TypingDots({ colorClass = 'bg-primary' }: { colorClass?: string }) {
  return (
    <div className="flex items-center gap-1 h-4">
      <span className={`w-2 h-2 rounded-full ${colorClass} animate-bounce`}></span>
      <span className={`w-2 h-2 rounded-full ${colorClass} animate-bounce`} style={{ animationDelay: '0.12s' }}></span>
      <span className={`w-2 h-2 rounded-full ${colorClass} animate-bounce`} style={{ animationDelay: '0.24s' }}></span>
    </div>
  );
}
