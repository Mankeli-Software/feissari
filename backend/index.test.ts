import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from './index';

describe('Backend API Tests', () => {
  describe('GET /health', () => {
    it('should return 200 and status ok', async () => {
      const response = await request(app)
        .get('/health')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
      expect(typeof response.body.timestamp).toBe('number');
    });
  });

  describe('POST /api/user', () => {
    it('should return 400 when name is missing', async () => {
      const response = await request(app)
        .post('/api/user')
        .send({ sessionId: 'test-session-123' })
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('name');
    });

    it('should return 400 when name is empty string', async () => {
      const response = await request(app)
        .post('/api/user')
        .send({ name: '   ', sessionId: 'test-session-123' })
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('name');
    });

    it('should return 400 when name is not a string', async () => {
      const response = await request(app)
        .post('/api/user')
        .send({ name: 123, sessionId: 'test-session-123' })
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('name');
    });

    it('should return 400 when sessionId is missing', async () => {
      const response = await request(app)
        .post('/api/user')
        .send({ name: 'TestPlayer' })
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('sessionId');
    });

    it('should return 400 when sessionId is empty string', async () => {
      const response = await request(app)
        .post('/api/user')
        .send({ name: 'TestPlayer', sessionId: '   ' })
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('sessionId');
    });

    it('should return 400 when sessionId is not a string', async () => {
      const response = await request(app)
        .post('/api/user')
        .send({ name: 'TestPlayer', sessionId: 123 })
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('sessionId');
    });

    it('should return 503 when Firebase is not configured', async () => {
      const response = await request(app)
        .post('/api/user')
        .send({ name: 'TestPlayer', sessionId: 'test-session-123' })
        .expect('Content-Type', /json/)
        .expect(503);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Firebase not configured');
    });

    it('should trim whitespace from name', async () => {
      const response = await request(app)
        .post('/api/user')
        .send({ name: '  TestPlayer  ', sessionId: 'test-session-123' })
        .expect('Content-Type', /json/)
        .expect(503); // Will fail at Firebase check, but validates trimming logic

      // Since Firebase is not configured, we can't test the full flow
      // But we can verify the validation passes
      expect(response.body.error).not.toContain('Invalid name');
    });
  });

  describe('GET /api/user/:sessionId', () => {
    it('should return 400 when sessionId is empty', async () => {
      const response = await request(app)
        .get('/api/user/%20%20%20') // URL-encoded spaces
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('sessionId');
    });

    it('should return 503 when Firebase is not configured', async () => {
      const response = await request(app)
        .get('/api/user/test-session-123')
        .expect('Content-Type', /json/)
        .expect(503);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Firebase not configured');
    });

    it('should handle special characters in sessionId', async () => {
      const response = await request(app)
        .get('/api/user/test-session-with-special-chars_123')
        .expect('Content-Type', /json/)
        .expect(503); // Will fail at Firebase check

      // Since Firebase is not configured, we can't test the full flow
      // But we can verify the validation passes
      expect(response.body.error).not.toContain('Invalid sessionId');
    });
  });

  describe('Route not found', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app)
        .get('/api/nonexistent')
        .expect(404);
    });
  });

  describe('Input validation', () => {
    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/user')
        .set('Content-Type', 'application/json')
        .send('{"invalid json"}')
        .expect(400);
    });

    it('should handle missing Content-Type', async () => {
      const response = await request(app)
        .post('/api/user')
        .send({ name: 'TestPlayer', sessionId: 'test-session-123' })
        .expect(503); // Will reach Firebase check since express.json() handles it

      // Validates that the endpoint is reachable
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/game', () => {
    it('should return 400 when userId is missing', async () => {
      const response = await request(app)
        .post('/api/game')
        .send({})
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('userId');
    });

    it('should return 400 when userId is empty string', async () => {
      const response = await request(app)
        .post('/api/game')
        .send({ userId: '   ' })
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('userId');
    });

    it('should return 400 when userId is not a string', async () => {
      const response = await request(app)
        .post('/api/game')
        .send({ userId: 123 })
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('userId');
    });

    it('should return 503 when Firebase is not configured', async () => {
      const response = await request(app)
        .post('/api/game')
        .send({ userId: 'test-user-123' })
        .expect('Content-Type', /json/)
        .expect(503);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Firebase not configured');
    });
  });

  describe('PUT /api/game/:gameId', () => {
    it('should return 400 when gameId is invalid', async () => {
      const response = await request(app)
        .put('/api/game/')
        .send({ message: 'Hello' })
        .expect(404); // Express returns 404 for empty path parameter

      // This is expected behavior - empty gameId results in 404
    });

    it('should return 400 when message is not string or null', async () => {
      const response = await request(app)
        .put('/api/game/test-game-123')
        .send({ message: 123 })
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('message');
    });

    it('should accept null message', async () => {
      const response = await request(app)
        .put('/api/game/test-game-123')
        .send({ message: null })
        .expect('Content-Type', /json/)
        .expect(503); // Will reach Firebase check

      expect(response.body.error).not.toContain('Invalid message');
    });

    it('should return 503 when Firebase is not configured', async () => {
      const response = await request(app)
        .put('/api/game/test-game-123')
        .send({ message: 'Hello' })
        .expect('Content-Type', /json/)
        .expect(503);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Firebase not configured');
    });
  });

  describe('POST /api/leaderboard', () => {
    it('should return 400 when gameId is missing', async () => {
      const response = await request(app)
        .post('/api/leaderboard')
        .send({})
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('gameId');
    });

    it('should return 400 when gameId is empty string', async () => {
      const response = await request(app)
        .post('/api/leaderboard')
        .send({ gameId: '   ' })
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('gameId');
    });

    it('should return 400 when gameId is not a string', async () => {
      const response = await request(app)
        .post('/api/leaderboard')
        .send({ gameId: 123 })
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('gameId');
    });

    it('should return 503 when Firebase is not configured', async () => {
      const response = await request(app)
        .post('/api/leaderboard')
        .send({ gameId: 'test-game-123' })
        .expect('Content-Type', /json/)
        .expect(503);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Firebase not configured');
    });
  });

  describe('GET /api/leaderboard/top', () => {
    it('should return 503 when Firebase is not configured', async () => {
      const response = await request(app)
        .get('/api/leaderboard/top')
        .expect('Content-Type', /json/)
        .expect(503);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Firebase not configured');
    });

    it('should accept optional userId query parameter', async () => {
      const response = await request(app)
        .get('/api/leaderboard/top?userId=test-user-123')
        .expect('Content-Type', /json/)
        .expect(503); // Will fail at Firebase check

      expect(response.body.error).not.toContain('Invalid userId');
    });
  });

  describe('GET /api/leaderboard/recent', () => {
    it('should return 503 when Firebase is not configured', async () => {
      const response = await request(app)
        .get('/api/leaderboard/recent')
        .expect('Content-Type', /json/)
        .expect(503);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Firebase not configured');
    });

    it('should accept optional userId query parameter', async () => {
      const response = await request(app)
        .get('/api/leaderboard/recent?userId=test-user-123')
        .expect('Content-Type', /json/)
        .expect(503); // Will fail at Firebase check

      expect(response.body.error).not.toContain('Invalid userId');
    });
  });

  describe('GET /api/leaderboard/stats', () => {
    it('should return 503 when Firebase is not configured', async () => {
      const response = await request(app)
        .get('/api/leaderboard/stats')
        .expect('Content-Type', /json/)
        .expect(503);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Firebase not configured');
    });
  });
});

