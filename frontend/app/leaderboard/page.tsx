"use client";
import LeaderboardScreen from '@/components/leaderboard-screen';
import { useEffect, useState } from 'react';
import Cookies from 'js-cookie';

export default function LeaderboardPage() {
  const [userStats, setUserStats] = useState<{
    gameId?: string;
    score?: number;
    defeatedFeissari?: number;
    finalBalance?: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      setError(null);
      const sessionId = Cookies.get('feissari_session');
      if (!sessionId) {
        setError('No session found');
        setLoading(false);
        return;
      }
      try {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
        // Add cache-busting parameter to ensure fresh data
        const res = await fetch(`${backendUrl}/api/leaderboard/last-game?userId=${sessionId}&t=${Date.now()}`);
        if (!res.ok) {
          // If no previous games, just leave userStats as null and do not set error
          setUserStats(null);
          setLoading(false);
          return;
        }
        const data = await res.json();
        if (!data || Object.keys(data).length === 0) {
          setUserStats(null);
        } else {
          setUserStats({
            gameId: data.gameId,
            score: data.score,
            defeatedFeissari: data.defeatedFeissari,
            finalBalance: data.finalBalance,
          });
        }
      } catch (e) {
        setError('Failed to fetch user stats');
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [refreshKey]);

  // Refetch data when the page becomes visible (e.g., navigating back)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        setRefreshKey(prev => prev + 1);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  if (loading) return <div className="p-8 text-center">Loading...</div>;
  if (error) return <div className="p-8 text-center text-red-500">{error}</div>;

  // If no previous games, just don't show last game, but show leaderboard
  // Handler to clear last game stats before starting a new game
  const handleNewGame = () => {
    setUserStats(null);
    window.location.href = '/'; // Navigate to start page
  };

  return (
    <LeaderboardScreen
      gameId={userStats?.gameId}
      score={userStats?.score}
      defeatedFeissari={userStats?.defeatedFeissari}
      finalBalance={userStats?.finalBalance}
      onNewGame={handleNewGame}
    />
  );
}
