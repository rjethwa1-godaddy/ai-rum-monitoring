import { POST, GET } from './route';

describe('RUM Monitor API', () => {
  it('should handle POST requests with valid data', async () => {
    const request = new Request('http://localhost/api/rum-monitor', {
      method: 'POST',
      body: JSON.stringify({
        url: 'http://example.com',
        metrics: [
          { name: 'LCP', value: 3000 },
          { name: 'FCP', value: 2000 },
        ],
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toBe('Metrics received and processed');
    expect(data.incidents).toHaveLength(2);
  });

  it('should handle GET requests and return incidents', async () => {
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.incidents).toBeDefined();
  });
});