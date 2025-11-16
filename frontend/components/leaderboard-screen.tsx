"use client"

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import Cookies from 'js-cookie';
import {
  TopLeaderboardResponse,
  RecentLeaderboardResponse,
  LeaderboardStatsResponse
} from '@/lib/types';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

interface LeaderboardScreenProps {
  gameId?: string;
  score?: number;
  defeatedFeissari?: number;
  finalBalance?: number;
  onNewGame?: () => void;
}

export default function LeaderboardScreen({
  gameId,
  score,
  defeatedFeissari,
  finalBalance,
  onNewGame
}: LeaderboardScreenProps) {
  const [topLeaderboard, setTopLeaderboard] = useState<TopLeaderboardResponse | null>(null);
  const [recentLeaderboard, setRecentLeaderboard] = useState<RecentLeaderboardResponse | null>(null);
  const [stats, setStats] = useState<LeaderboardStatsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      const sessionId = Cookies.get('feissari_session');
      if (!sessionId) {
        setError('No session found');
        setIsLoading(false);
        return;
      }
      try {
        await new Promise(resolve => setTimeout(resolve, 500));
        const [topResponse, recentResponse, statsResponse] = await Promise.all([
          fetch(`${BACKEND_URL}/api/leaderboard/top?userId=${sessionId}`),
          fetch(`${BACKEND_URL}/api/leaderboard/recent?userId=${sessionId}`),
          fetch(`${BACKEND_URL}/api/leaderboard/stats`)
        ]);
        if (topResponse.ok) {
          const topData = await topResponse.json();
          setTopLeaderboard(topData);
        }
        if (recentResponse.ok) {
          const recentData = await recentResponse.json();
          setRecentLeaderboard(recentData);
        }
        if (statsResponse.ok) {
          const statsData = await statsResponse.json();
          setStats(statsData);
        }
      } catch (err) {
        console.error('Error fetching leaderboard:', err);
        setError('Failed to load leaderboard');
      } finally {
        setIsLoading(false);
      }
    };
    fetchLeaderboard();
  }, [gameId]);

  const sessionId = Cookies.get('feissari_session');

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-orange-50 to-orange-100 dark:from-gray-900 dark:to-orange-950 p-4">
      <div className="w-full max-w-4xl space-y-6">
        {/* Header with score (only if previous game exists) */}
        {(score !== undefined && defeatedFeissari !== undefined && finalBalance !== undefined) && (
          <div className="rounded-lg bg-white p-8 shadow-2xl dark:bg-gray-800">
            <h1 className="text-5xl font-bold text-primary mb-4 text-center">
              🏆 Your Last Game!
            </h1>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Score</p>
                <p className="text-3xl font-bold text-primary">{score}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Feissari Defeated</p>
                <p className="text-3xl font-bold text-primary">{defeatedFeissari}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Final Balance</p>
                <p className="text-3xl font-bold text-primary">€{finalBalance}</p>
              </div>
            </div>
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="rounded-lg bg-white p-8 shadow-2xl dark:bg-gray-800 text-center">
            <div className="flex justify-center space-x-2">
              <div className="w-3 h-3 bg-primary rounded-full animate-bounce"></div>
              <div className="w-3 h-3 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
              <div className="w-3 h-3 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
            </div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Loading leaderboard...</p>
          </div>
        )}

        {/* Error state */}
        {error && !isLoading && (
          <div className="rounded-lg bg-white p-8 shadow-2xl dark:bg-gray-800 text-center">
            <p className="text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Leaderboards */}
        {!isLoading && !error && (
          <>
            {/* Stats */}
            {stats && (
              <div className="rounded-lg bg-white p-6 shadow-2xl dark:bg-gray-800">
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Total Games Played</p>
                    <p className="text-2xl font-bold text-gray-800 dark:text-gray-200">{stats.totalGamesPlayed}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">💸 Meme Token Churn™</p>
                    <p className="text-2xl font-bold text-primary">{stats.tokenChurn}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-500 italic">*Totally accurate AI costs</p>
                  </div>
                </div>
              </div>
            )}

            {/* Top 10 All-Time */}
            {topLeaderboard && (
              <div className="rounded-lg bg-white p-6 shadow-2xl dark:bg-gray-800">
                <h2 className="text-2xl font-bold text-primary mb-4">
                  🌟 Top 10 All-Time High Scores
                </h2>
                <div className="space-y-2">
                  {topLeaderboard.entries.map((entry, index) => {
                    const isCurrentUser = entry.userId === sessionId;
                    return (
                      <div
                        key={index}
                        className={`flex justify-between items-center p-3 rounded ${isCurrentUser
                            ? 'bg-orange-100 dark:bg-orange-900 border-2 border-primary'
                            : 'bg-gray-50 dark:bg-gray-700'
                          }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-lg w-8">{entry.rank}.</span>
                          <span className={isCurrentUser ? 'font-bold' : ''}>{entry.userName}</span>
                        </div>
                        <div className="flex gap-4 text-sm">
                          <span className="font-semibold">Score: {entry.score}</span>
                          <span className="text-gray-600 dark:text-gray-400">
                            {entry.defeatedFeissari} defeated × €{entry.finalBalance}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Show current user if not in top 10 */}
                {topLeaderboard.currentUserEntry && !topLeaderboard.entries.find(e => e.userId === sessionId) && (
                  <>
                    <div className="my-4 border-t border-gray-300 dark:border-gray-600"></div>
                    <div className="bg-orange-100 dark:bg-orange-900 border-2 border-primary p-3 rounded">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-lg w-8">#{topLeaderboard.currentUserRank}</span>
                          <span className="font-bold">{topLeaderboard.currentUserEntry.userName} (You)</span>
                        </div>
                        <div className="flex gap-4 text-sm">
                          <span className="font-semibold">Score: {topLeaderboard.currentUserEntry.score}</span>
                          <span className="text-gray-600 dark:text-gray-400">
                            {topLeaderboard.currentUserEntry.defeatedFeissari} defeated × €{topLeaderboard.currentUserEntry.finalBalance}
                          </span>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Recent 10 */}
            {recentLeaderboard && (
              <div className="rounded-lg bg-white p-6 shadow-2xl dark:bg-gray-800">
                <h2 className="text-2xl font-bold text-primary mb-4">
                  🕒 10 Most Recent Games
                </h2>
                <div className="space-y-2">
                  {recentLeaderboard.entries.map((entry, index) => {
                    const isCurrentUser = entry.userId === sessionId;
                    return (
                      <div
                        key={index}
                        className={`flex justify-between items-center p-3 rounded ${isCurrentUser
                            ? 'bg-orange-100 dark:bg-orange-900 border-2 border-primary'
                            : 'bg-gray-50 dark:bg-gray-700'
                          }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-lg w-8">{index + 1}.</span>
                          <span className={isCurrentUser ? 'font-bold' : ''}>{entry.userName}</span>
                        </div>
                        <div className="flex gap-4 text-sm">
                          <span className="font-semibold">Score: {entry.score}</span>
                          <span className="text-gray-600 dark:text-gray-400">
                            {entry.defeatedFeissari} defeated × €{entry.finalBalance}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Show current user if not in recent 10 */}
                {recentLeaderboard.currentUserEntry && !recentLeaderboard.entries.find(e => e.userId === sessionId) && (
                  <>
                    <div className="my-4 border-t border-gray-300 dark:border-gray-600"></div>
                    <div className="bg-orange-100 dark:bg-orange-900 border-2 border-primary p-3 rounded">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-lg w-8">#{recentLeaderboard.currentUserPosition}</span>
                          <span className="font-bold">{recentLeaderboard.currentUserEntry.userName} (You)</span>
                          <span className="text-xs text-gray-600 dark:text-gray-400">
                            {recentLeaderboard.currentUserPosition! - 1} more recent
                          </span>
                        </div>
                        <div className="flex gap-4 text-sm">
                          <span className="font-semibold">Score: {recentLeaderboard.currentUserEntry.score}</span>
                          <span className="text-gray-600 dark:text-gray-400">
                            {recentLeaderboard.currentUserEntry.defeatedFeissari} defeated × €{recentLeaderboard.currentUserEntry.finalBalance}
                          </span>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}

        {/* New Game Button */}
        <div className="flex justify-center">
          <NewGameButton onNewGame={onNewGame} />
        </div>
      </div>
    </div>
  );
}

function NewGameButton({ onNewGame }: { onNewGame?: () => void }) {
  const router = useRouter();

  const handle = () => {
    if (onNewGame) {
      onNewGame();
    } else {
      // Default behaviour: go to start page
      router.push('/');
    }
  };

  return (
    <Button
      onClick={handle}
      className="w-full max-w-md h-14 text-lg font-semibold bg-primary hover:bg-primary/90"
      size="lg"
    >
      🎮 Play New Game
    </Button>
  );
}
