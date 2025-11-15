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

  useEffect(() => {
    const fetchStats = async () => {
      const sessionId = Cookies.get('feissari_session');
      if (!sessionId) {
        setError('No session found');
        setLoading(false);
        return;
      }
      try {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
        const res = await fetch(`${backendUrl}/api/leaderboard/last-game?userId=${sessionId}`);
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
  }, []);

  if (loading) return <div className="p-8 text-center">Loading...</div>;
  if (error) return <div className="p-8 text-center text-red-500">{error}</div>;

  // If no previous games, just don't show last game, but show leaderboard
  return (
    <LeaderboardScreen
      gameId={userStats?.gameId}
      score={userStats?.score}
      defeatedFeissari={userStats?.defeatedFeissari}
      finalBalance={userStats?.finalBalance}
    />
  );
}
