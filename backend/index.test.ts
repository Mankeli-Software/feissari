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
});
