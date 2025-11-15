"use client"

import { useState, useEffect } from "react"
import Cookies from "js-cookie"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useRouter } from 'next/navigation'

const COOKIE_NAME = "feissari_session"
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001"

function generateSessionToken() {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
}

export default function StartScreen() {
  const [playerName, setPlayerName] = useState("")
  const [isStarted, setIsStarted] = useState(false)
  const [isClient, setIsClient] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const router = useRouter()

  useEffect(() => {
    // This effect runs only once on mount
    setIsClient(true)

    // Check if user already has a session token
    const existingToken = Cookies.get(COOKIE_NAME)

    if (existingToken) {
      // Verify session with backend and then navigate to /game on success
      fetchUserFromBackend(existingToken)
    }
  }, [])

  const fetchUserFromBackend = async (sessionId: string) => {
    try {
      setIsLoading(true)
      const response = await fetch(`${BACKEND_URL}/api/user/${sessionId}`)
      
      if (response.ok) {
        const data = await response.json()
        setPlayerName(data.name)
        // Go to /game so StartScreen stays independent of GameScreen
        router.push('/game')
      } else if (response.status === 404) {
        // User not found in backend, clear the cookie
        Cookies.remove(COOKIE_NAME)
      } else {
        console.error('Failed to fetch user from backend:', response.statusText)
      }
    } catch (err) {
      console.error('Error fetching user from backend:', err)
      // Don't clear cookie on network errors, user might be offline
    } finally {
      setIsLoading(false)
    }
  }

  const handleStartPlaying = async () => {
    if (playerName.trim()) {
      setIsLoading(true)
      setError(null)
      
      // Generate session token
      const sessionToken = generateSessionToken()
      
      try {
        // Save to backend first
        const response = await fetch(`${BACKEND_URL}/api/user`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: playerName.trim(),
            sessionId: sessionToken,
          }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to save user data')
        }

        // Only save cookie after successful backend save
        const isProduction = process.env.NODE_ENV === 'production'
        const cookieOptions = { 
          expires: 30,
          sameSite: 'strict' as const,
          secure: isProduction, // Only use secure flag in production with HTTPS
        }
        Cookies.set(COOKIE_NAME, sessionToken, cookieOptions)
        
        // Navigate to game page after successful save
        router.push('/game')
      } catch (err) {
        console.error('Error saving user:', err)
        setError(err instanceof Error ? err.message : 'Failed to start game. Please try again.')
      } finally {
        setIsLoading(false)
      }
    }
  }

  const handleReset = () => {
    // For testing purposes - clear cookies and reset
    Cookies.remove(COOKIE_NAME)
    setPlayerName("")
    setIsStarted(false)
    setError(null)
  }

  // Show loading state during SSR to prevent hydration mismatch
  if (!isClient) {
    return null
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-50 to-green-100 dark:from-gray-900 dark:to-emerald-950">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-emerald-600"></div>
          <p className="text-xl text-emerald-700 dark:text-emerald-300">Loading...</p>
        </div>
      </div>
    )
  }

  // StartScreen only handles starting / session management and routing.
  // Navigation to /game is done via router.push after creating/fetching session.

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-50 to-green-100 dark:from-gray-900 dark:to-emerald-950">
      <div className="w-full max-w-md space-y-8 rounded-lg bg-white p-10 shadow-2xl dark:bg-gray-800">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-emerald-800 dark:text-emerald-400 mb-2">
            Survive the Feissari
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300 mt-4">
            Enter your name to begin your journey
          </p>
        </div>
        
        <div className="space-y-6">
          {error && (
            <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded dark:bg-red-900 dark:border-red-700 dark:text-red-200">
              {error}
            </div>
          )}
          
          <div className="space-y-2">
            <label 
              htmlFor="player-name" 
              className="text-sm font-medium text-gray-700 dark:text-gray-200"
            >
              Player Name
            </label>
            <Input
              id="player-name"
              type="text"
              placeholder="Enter your name"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && playerName.trim() && !isLoading) {
                  handleStartPlaying()
                }
              }}
              className="text-base"
              disabled={isLoading}
            />
          </div>
          
          <Button
            onClick={handleStartPlaying}
            disabled={!playerName.trim() || isLoading}
            className="w-full h-14 text-lg font-semibold bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 dark:disabled:bg-gray-600"
            size="lg"
          >
            {isLoading ? "Starting..." : "Start Playing"}
          </Button>
        </div>
      </div>
    </div>
  )
}
