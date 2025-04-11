// Script to collect RUM metrics using PerformanceObserver and send them to the backend
(function () {
  const backendUrl = 'http://localhost:3000/api/rum-monitor';
  window._collectedMetrics = [];

  const sendMetrics = (metrics) => {
    window._collectedMetrics = metrics;
    fetch(backendUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: window.location.href,
        metrics,
      }),
    }).catch((err) => console.error('Failed to send RUM metrics:', err));
  };

  const observePerformance = () => {
    const metrics = [];

    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        if (entry.entryType === 'largest-contentful-paint') {
          const element = entry.element;
          metrics.push({
            name: 'LCP',
            value: entry.startTime,
            element: element ? element.innerHTML : 'Unknown',
            tagName: element ? element.tagName : 'Unknown',
            classList: element ? Array.from(element.classList).join(' ') : 'None',
            id: element ? element.id : 'None'
          });
          sendMetrics(metrics);
        } else if (entry.entryType === 'first-contentful-paint') {
          const element = entry.element;
          metrics.push({
            name: 'FCP',
            value: entry.startTime,
            element: element ? element.innerHTML : 'Unknown',
            tagName: element ? element.tagName : 'Unknown',
            classList: element ? Array.from(element.classList).join(' ') : 'None',
            id: element ? element.id : 'None'
          });
          sendMetrics(metrics);
        } else if (entry.entryType === 'layout-shift' && !entry.hadRecentInput) {
          const element = entry.sources[0]?.node;
          metrics.push({
            name: 'CLS',
            value: entry.value,
            element: element ? element.innerHTML : 'Unknown',
            tagName: element ? element.tagName : 'Unknown',
            classList: element ? Array.from(element.classList).join(' ') : 'None',
            id: element ? element.id : 'None'
          });
          sendMetrics(metrics);
        }
      });
    });

    observer.observe({ entryTypes: ['largest-contentful-paint', 'first-contentful-paint', 'layout-shift'] });

    // Send final metrics before page unload
    window.addEventListener('beforeunload', () => {
      sendMetrics(metrics);
    });
  };

  // Start observing performance metrics
  observePerformance();
})();