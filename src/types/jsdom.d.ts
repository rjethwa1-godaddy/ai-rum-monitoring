declare module 'jsdom' {
  export class JSDOM {
    window: Window & typeof globalThis & {
      _collectedMetrics?: Array<{
        name: 'LCP' | 'FCP' | 'FID' | 'CLS';
        value: number;
        element: string;
        tagName: string;
        classList: string;
        id: string;
      }>;
    };
    constructor(html: string, options?: {
      url?: string;
      referrer?: string;
      contentType?: string;
      includeNodeLocations?: boolean;
      storageQuota?: number;
      runScripts?: 'dangerously' | 'outside-only' | undefined;
      resources?: 'usable' | undefined;
      pretendToBeVisual?: boolean;
    });
  }
}