"use client"

import { useState, useEffect } from "react"
import Cookies from "js-cookie"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const COOKIE_NAME = "feissari_session"
const COOKIE_NAME_USERNAME = "feissari_username"

function generateSessionToken() {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
}

export default function StartScreen() {
  const [playerName, setPlayerName] = useState("")
  const [isStarted, setIsStarted] = useState(false)
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    // This effect runs only once on mount
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsClient(true)
    
    // Check if user already has a session token
    const existingToken = Cookies.get(COOKIE_NAME)
    const existingUsername = Cookies.get(COOKIE_NAME_USERNAME)
    
    if (existingToken && existingUsername) {
      setPlayerName(existingUsername)
      setIsStarted(true)
    }
  }, [])

  const handleStartPlaying = () => {
    if (playerName.trim()) {
      // Generate and save session token
      const sessionToken = generateSessionToken()
      
      // Save cookies (expires in 30 days)
      const isProduction = process.env.NODE_ENV === 'production'
      const cookieOptions = { 
        expires: 30,
        sameSite: 'strict' as const,
        secure: isProduction, // Only use secure flag in production with HTTPS
      }
      Cookies.set(COOKIE_NAME, sessionToken, cookieOptions)
      Cookies.set(COOKIE_NAME_USERNAME, playerName, cookieOptions)
      
      setIsStarted(true)
    }
  }

  const handleReset = () => {
    // For testing purposes - clear cookies and reset
    Cookies.remove(COOKIE_NAME)
    Cookies.remove(COOKIE_NAME_USERNAME)
    setPlayerName("")
    setIsStarted(false)
  }

  // Show loading state during SSR to prevent hydration mismatch
  if (!isClient) {
    return null
  }

  if (isStarted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-50 to-green-100 dark:from-gray-900 dark:to-emerald-950">
        <div className="flex flex-col items-center gap-8 text-center">
          <h1 className="text-6xl font-bold text-emerald-800 dark:text-emerald-400">
            Welcome, {playerName}!
          </h1>
          <p className="text-2xl text-emerald-700 dark:text-emerald-300">
            The game is loading...
          </p>
          <Button 
            onClick={handleReset}
            variant="outline"
            className="mt-4"
          >
            Reset Session (For Testing)
          </Button>
        </div>
      </div>
    )
  }

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
                if (e.key === "Enter" && playerName.trim()) {
                  handleStartPlaying()
                }
              }}
              className="text-base"
            />
          </div>
          
          <Button
            onClick={handleStartPlaying}
            disabled={!playerName.trim()}
            className="w-full h-14 text-lg font-semibold bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 dark:disabled:bg-gray-600"
            size="lg"
          >
            Start Playing
          </Button>
        </div>
      </div>
    </div>
  )
}
