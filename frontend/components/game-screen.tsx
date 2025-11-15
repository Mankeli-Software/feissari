"use client"

import { useState, useRef, useEffect } from 'react';
import { useGame, EmoteImage } from '@/lib/game-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import LeaderboardScreen from '@/components/leaderboard-screen';

export default function GameScreen() {
  const { gameState, startGame, sendMessage, resetGame } = useGame();
  const [inputMessage, setInputMessage] = useState('');
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [prevScore, setPrevScore] = useState<number>(0);
  const [animatingScore, setAnimatingScore] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

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

  // Auto-show leaderboard after 2 seconds when game is over
  useEffect(() => {
    if (!gameState.isActive && gameState.messages.length > 0 && !showLeaderboard) {
      const timer = setTimeout(() => {
        setShowLeaderboard(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [gameState.isActive, gameState.messages.length, showLeaderboard]);

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
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-50 to-green-100 dark:from-gray-900 dark:to-emerald-950">
        <div className="w-full max-w-md space-y-8 rounded-lg bg-white p-10 shadow-2xl dark:bg-gray-800">
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

  // Game over screen - show leaderboard
  if (!gameState.isActive && gameState.messages.length > 0) {
    if (showLeaderboard && gameState.gameId) {
      return (
        <LeaderboardScreen
          gameId={gameState.gameId}
          score={gameState.score ?? 0}
          defeatedFeissari={gameState.defeatedFeissari ?? 0}
          finalBalance={gameState.balance}
          onNewGame={() => {
            setShowLeaderboard(false);
            resetGame();
          }}
        />
      );
    }

    // Show transition screen before leaderboard
    const survived = gameState.balance > 0;

    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-50 to-green-100 dark:from-gray-900 dark:to-emerald-950">
        <div className="w-full max-w-md space-y-8 rounded-lg bg-white p-10 shadow-2xl dark:bg-gray-800">
          <div className="text-center">
            <h1 className={`text-5xl font-bold mb-4 ${
              survived 
                ? 'text-emerald-600 dark:text-emerald-400' 
                : 'text-red-600 dark:text-red-400'
            }`}>
              {survived ? '🎉 You Survived!' : '💸 Game Over'}
            </h1>
            <div className="space-y-4 text-lg">
              <p className="text-gray-700 dark:text-gray-300">
                Final Balance: <span className="font-bold text-2xl">€{gameState.balance}</span>
              </p>
              <p className="text-gray-700 dark:text-gray-300">
                Feissari Defeated: <span className="font-bold text-2xl">{gameState.defeatedFeissari || 0}</span>
              </p>
              <p className="text-gray-700 dark:text-gray-300">
                Final Score: <span className="font-bold text-2xl">{gameState.score || 0}</span>
              </p>
              <p className="text-gray-600 dark:text-gray-400">
                {survived 
                  ? 'You successfully resisted the feissarit!' 
                  : 'The feissarit got all your money!'}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500 animate-pulse">
                Loading leaderboard...
              </p>
            </div>
          </div>
          
          <Button
            onClick={() => setShowLeaderboard(true)}
            className="w-full h-14 text-lg font-semibold bg-emerald-600 hover:bg-emerald-700"
            size="lg"
          >
            View Leaderboard
          </Button>
        </div>
      </div>
    );
  }

  // Active game screen
  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-emerald-50 to-green-100 dark:from-gray-900 dark:to-emerald-950">
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
  );
}
