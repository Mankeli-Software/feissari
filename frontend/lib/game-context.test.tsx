import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GameProvider, useGame } from './game-context';
import Cookies from 'js-cookie';

// Test component that uses the game context
function TestComponent() {
  const { gameState, startGame, sendMessage, resetGame } = useGame();

  return (
    <div>
      <div data-testid="game-id">{gameState.gameId || 'no-game'}</div>
      <div data-testid="balance">{gameState.balance}</div>
      <div data-testid="time-remaining">{gameState.timeRemaining}</div>
      <div data-testid="messages-count">{gameState.messages.length}</div>
      <div data-testid="is-loading">{gameState.isLoading.toString()}</div>
      <div data-testid="is-active">{gameState.isActive.toString()}</div>
      <button onClick={startGame}>Start Game</button>
      <button onClick={() => sendMessage('test message')}>Send Message</button>
      <button onClick={resetGame}>Reset Game</button>
    </div>
  );
}

describe('GameContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockClear();
    (Cookies.get as any).mockReturnValue('test-session-id');
  });

  describe('Initial State', () => {
    it('should render with initial state', () => {
      render(
        <GameProvider>
          <TestComponent />
        </GameProvider>
      );

      expect(screen.getByTestId('game-id')).toHaveTextContent('no-game');
      expect(screen.getByTestId('balance')).toHaveTextContent('100');
      expect(screen.getByTestId('time-remaining')).toHaveTextContent('180');
      expect(screen.getByTestId('messages-count')).toHaveTextContent('0');
      expect(screen.getByTestId('is-loading')).toHaveTextContent('false');
      expect(screen.getByTestId('is-active')).toHaveTextContent('false');
    });
  });

  describe('startGame', () => {
    it('should create a new game successfully', async () => {
      const user = userEvent.setup();
      
      // Mock game creation
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          gameId: 'test-game-123',
          createdAt: new Date().toISOString(),
          initialBalance: 100,
        }),
      });

      // Mock initial AI message
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          message: 'Hei! Olen Matti Myyjä.',
          balance: 100,
          emoteAssets: ['excited-1.svg'],
          goToNext: false,
          gameOver: false,
          feissariName: 'Matti Myyjä',
        }),
      });

      render(
        <GameProvider>
          <TestComponent />
        </GameProvider>
      );

      await act(async () => {
        await user.click(screen.getByText('Start Game'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('is-active')).toHaveTextContent('true');
      });

      expect(screen.getByTestId('game-id')).toHaveTextContent('test-game-123');
      expect(screen.getByTestId('messages-count')).toHaveTextContent('1');
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should handle error when creating game fails', async () => {
      const user = userEvent.setup();
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      render(
        <GameProvider>
          <TestComponent />
        </GameProvider>
      );

      await act(async () => {
        await user.click(screen.getByText('Start Game'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('is-loading')).toHaveTextContent('false');
      });

      expect(screen.getByTestId('is-active')).toHaveTextContent('false');
      consoleSpy.mockRestore();
    });
  });

  describe('sendMessage', () => {
    it('should send message and update game state', async () => {
      const user = userEvent.setup();
      
      // Mock game creation
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          gameId: 'test-game-123',
          createdAt: new Date().toISOString(),
          initialBalance: 100,
        }),
      });

      // Mock initial AI response
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          message: 'Hei!',
          balance: 100,
          emoteAssets: ['excited-1.svg'],
          goToNext: false,
          gameOver: false,
          feissariName: 'Matti',
        }),
      });

      // Mock user message response
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          message: 'Kiitos mielenkiinnosta!',
          balance: 90,
          emoteAssets: ['pushy-1.svg'],
          goToNext: false,
          gameOver: false,
          feissariName: 'Matti',
        }),
      });

      render(
        <GameProvider>
          <TestComponent />
        </GameProvider>
      );

      await act(async () => {
        await user.click(screen.getByText('Start Game'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('messages-count')).toHaveTextContent('1');
      });

      await act(async () => {
        await user.click(screen.getByText('Send Message'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('messages-count')).toHaveTextContent('3');
      });

      expect(screen.getByTestId('balance')).toHaveTextContent('90');
    });

    it('should handle game over when balance reaches zero', async () => {
      const user = userEvent.setup();
      
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          gameId: 'test-game-123',
          createdAt: new Date().toISOString(),
          initialBalance: 100,
        }),
      });

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          message: 'Hei!',
          balance: 100,
          emoteAssets: ['excited-1.svg'],
          goToNext: false,
          gameOver: false,
          feissariName: 'Matti',
        }),
      });

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          message: 'Kiitos ostoksesta!',
          balance: 0,
          emoteAssets: ['celebrating-1.svg'],
          goToNext: true,
          gameOver: true,
          feissariName: 'Matti',
        }),
      });

      render(
        <GameProvider>
          <TestComponent />
        </GameProvider>
      );

      await act(async () => {
        await user.click(screen.getByText('Start Game'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('is-active')).toHaveTextContent('true');
      });

      await act(async () => {
        await user.click(screen.getByText('Send Message'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('is-active')).toHaveTextContent('false');
      });

      expect(screen.getByTestId('balance')).toHaveTextContent('0');
    });
  });

  describe('resetGame', () => {
    it('should reset game to initial state', async () => {
      const user = userEvent.setup();
      
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          gameId: 'test-game-123',
          createdAt: new Date().toISOString(),
          initialBalance: 100,
          message: 'Test',
          balance: 50,
          emoteAssets: [],
          goToNext: false,
          gameOver: false,
          feissariName: 'Test',
        }),
      });

      render(
        <GameProvider>
          <TestComponent />
        </GameProvider>
      );

      await act(async () => {
        await user.click(screen.getByText('Start Game'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('is-active')).toHaveTextContent('true');
      });

      await act(async () => {
        await user.click(screen.getByText('Reset Game'));
      });

      expect(screen.getByTestId('game-id')).toHaveTextContent('no-game');
      expect(screen.getByTestId('balance')).toHaveTextContent('100');
      expect(screen.getByTestId('is-active')).toHaveTextContent('false');
      expect(screen.getByTestId('messages-count')).toHaveTextContent('0');
    });
  });

  describe('Session Management', () => {
    it('should use session ID from cookie', async () => {
      const user = userEvent.setup();
      
      (Cookies.get as any).mockReturnValue('custom-session-123');
      
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          gameId: 'test-game-123',
          createdAt: new Date().toISOString(),
          initialBalance: 100,
        }),
      });

      render(
        <GameProvider>
          <TestComponent />
        </GameProvider>
      );

      await act(async () => {
        await user.click(screen.getByText('Start Game'));
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/game'),
          expect.objectContaining({
            body: JSON.stringify({ userId: 'custom-session-123' }),
          })
        );
      });
    });
  });
});
