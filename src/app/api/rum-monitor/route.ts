import { NextResponse } from 'next/server';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import urlsJson from '../../../../urls.json';
import { getSimulatedDOM } from '../../../utils/domSimulator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Define the type for urls.json data
interface UrlData {
  url: string;
  name?: string;
}

interface UrlsJson {
  urls: UrlData[];
}

const urlsData: UrlsJson = urlsJson;

// Use our custom DOM simulator instead of JSDOM
const getJSDOM = async () => {
  return getSimulatedDOM();
};

// Add proper type annotations to resolve type issues
interface Incident {
  timestamp: string;
  url: string;
  metric: 'LCP' | 'FCP' | 'FID' | 'CLS';
  value: number;
  reason: string;
  anomaly?: boolean;
}

interface Prediction {
  metric: 'LCP' | 'FCP' | 'FID' | 'CLS';
  predictedValue: number;
  reason: string;
}

interface MetricData {
  name: 'LCP' | 'FCP' | 'FID' | 'CLS';
  value: number;
  element: string;
  tagName: string;
  classList: string;
  id: string;
}

// Thresholds for each metric
const thresholds = {
  LCP: 2500, // ms
  FCP: 2000, // ms
  FID: 100,  // ms
  CLS: 0.1,  // unitless
};

// Global array to store incidents
const incidents: Incident[] = [];

// Load URLs from urls.json
const monitoredUrls: string[] = urlsData.urls.map(item => item.url);

console.log(`Loaded ${monitoredUrls.length} URLs for monitoring:`, monitoredUrls.slice(0, 5));

// Function to format timestamp to use PST and make it human-readable while ensuring it's in a format JavaScript can parse
const formatTimestamp = (date: Date) => {
  // First convert to PST
  const pstDate = new Date(date.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  
  // Then return an ISO string which is universally parseable by JavaScript
  return pstDate.toISOString();
  
  // Note: If you need human-readable dates for display purposes,
  // it's better to format them in the frontend component
};

// Import a simple anomaly detection library or implement basic anomaly detection logic
const detectAnomaly = (value: number, metric: keyof typeof thresholds): boolean => {
  return value > thresholds[metric] * 1.6; // 60% above threshold is considered anomalous
};

// Function to simulate RUM score monitoring for a batch of URLs
async function monitorRUMBatch(urls: string[]) {
  console.log(`Monitoring batch of URLs:`, urls);
  const JSDOM = await getJSDOM();

  for (const url of urls) {
    try {
      // Fetch the page to collect actual performance metrics
      const response = await fetch(url);
      const html = await response.text();
      
      // Create a DOM parser
      const dom = new JSDOM(html, {
        url: url,
        runScripts: 'dangerously',
        resources: 'usable',
        pretendToBeVisual: true
      });

      // Inject our RUM collector script
      const scriptContent = await fs.promises.readFile(
        path.join(process.cwd(), 'public', 'rum-collector.js'),
        'utf-8'
      );
      
      const script = dom.window.document.createElement('script');
      script.textContent = scriptContent;
      dom.window.document.head.appendChild(script);

      // Wait for metrics to be collected
      const metrics = await new Promise<MetricData[]>((resolve) => {
        const checkMetrics = () => {
          if (dom.window._collectedMetrics) {
            resolve(dom.window._collectedMetrics);
          } else {
            setTimeout(checkMetrics, 100);
          }
        };
        checkMetrics();
      });

      // Process the collected metrics
      metrics.forEach(({ name, value, element, tagName, classList, id }) => {
        const isAnomaly = detectAnomaly(value, name);
        if (value > thresholds[name] || isAnomaly) {
          const incident: Incident = {
            timestamp: formatTimestamp(new Date()),
            url,
            metric: name,
            value,
            reason: `<${tagName}${id ? ` id="${id}"` : ''}${classList !== 'None' ? ` class="${classList}"` : ''}>${element}</${tagName}>`,
            anomaly: isAnomaly,
          };
          incidents.push(incident);
          console.log(`Logged incident for ${url}:`, incident);
        }
      });

    } catch (error) {
      console.error(`Failed to monitor URL ${url}:`, error);
    }
  }

  return incidents;
}

// Add a function to perform root cause analysis
const analyzeRootCause = (urlIncidents: Incident[]): string => {
  const elementFrequency: Record<string, number> = {};

  // Count the frequency of elements causing issues
  urlIncidents.forEach((incident) => {
    if (!elementFrequency[incident.reason]) {
      elementFrequency[incident.reason] = 0;
    }
    elementFrequency[incident.reason] += 1;
  });

  // Find the most frequent element
  const rootCause = Object.entries(elementFrequency).reduce((max, entry) => {
    return entry[1] > max[1] ? entry : max;
  }, ['', 0]);

  return rootCause[0]; // Return the element causing the most issues
};

// Add a function for predictive monitoring
const predictIssues = (urlIncidents: Incident[]): Prediction[] => {
  const predictions: Prediction[] = [];
  const metrics: Array<'LCP' | 'FCP' | 'FID' | 'CLS'> = ['LCP', 'FCP', 'FID', 'CLS'];

  metrics.forEach((metric) => {
    const metricValues = urlIncidents
      .filter((incident) => incident.metric === metric)
      .map((incident) => incident.value);

    if (metricValues.length > 1) {
      const lastValue = metricValues[metricValues.length - 1];
      const secondLastValue = metricValues[metricValues.length - 2];

      // Simple prediction: If the last value is increasing, predict a spike
      if (lastValue > secondLastValue) {
        predictions.push({
          metric,
          predictedValue: lastValue * 1.1, // Predict a 10% increase
          reason: `Trend indicates a potential spike in ${metric}`,
        });
      }
    }
  });

  return predictions;
};

// Add a function to generate natural language summaries for incidents
const generateSummary = (incident: Incident): string => {
  const metricDescriptions: Record<'LCP' | 'FCP' | 'FID' | 'CLS', string> = {
    LCP: 'The largest visible content on the page took too long to load.',
    FCP: 'The first visible content on the page took too long to render.',
    FID: 'The page took too long to respond to user input.',
    CLS: 'The page layout shifted unexpectedly, causing a poor user experience.',
  };

  return `For the URL ${incident.url}, the ${incident.metric} metric recorded a value of ${incident.value}. ${metricDescriptions[incident.metric]} The element causing the issue is: ${incident.reason}.`;
};

// Add a function to generate automated fix suggestions for incidents
const generateFixSuggestion = (incident: Incident): string => {
  const fixSuggestions: Record<'LCP' | 'FCP' | 'FID' | 'CLS', string> = {
    LCP: `Optimize the loading of the element ${incident.reason}. Consider lazy-loading images, compressing assets, or using a CDN.`,
    FCP: `Reduce render-blocking resources for the element ${incident.reason}. Minify CSS/JS and optimize server response time.`,
    FID: `Improve input handling for the element ${incident.reason}. Minimize JavaScript execution and avoid long tasks.`,
    CLS: `Ensure dimensions are set for the element ${incident.reason} to prevent layout shifts. Use reserved spaces for ads/images.`,
  };

  return fixSuggestions[incident.metric] || 'No specific fix suggestion available.';
};

// Store the last run time
let lastRunTime = 0;
const ONE_HOUR = 60 * 60 * 1000; // 1 hour in milliseconds

// For testing purposes, we'll add a shorter interval
const DEBUG_INTERVAL = 60 * 1000; // 1 minute - match the frontend polling interval

// Add a testing flag to enable more frequent updates
const ENABLE_FREQUENT_UPDATES = true;

// Generate a random test incident for development/testing
function generateTestIncident(): Incident {
  const metrics: Array<'LCP' | 'FCP' | 'FID' | 'CLS'> = ['LCP', 'FCP', 'FID', 'CLS'];
  const randomMetric = metrics[Math.floor(Math.random() * metrics.length)];
  const randomUrl = monitoredUrls[Math.floor(Math.random() * monitoredUrls.length)];
  const baseValue = 
    randomMetric === 'LCP' ? 2500 : 
    randomMetric === 'FCP' ? 2000 :
    randomMetric === 'FID' ? 100 : 0.1;
  
  // Add some randomness to the value
  const randomFactor = 0.5 + Math.random() * 1.5;
  const value = baseValue * randomFactor;
  
  // 30% chance of being an anomaly
  const isAnomaly = Math.random() < 0.3;
  
  return {
    timestamp: formatTimestamp(new Date()),
    url: randomUrl,
    metric: randomMetric,
    value: value,
    reason: `Random test element for ${randomMetric}`,
    anomaly: isAnomaly,
  };
}

// Initial monitoring of URLs - run once at startup
(async () => {
  console.log('Starting initial URL monitoring...');
  lastRunTime = Date.now();
  
  for (let i = 0; i < monitoredUrls.length; i += 10) {
    const batch = monitoredUrls.slice(i, i + 10);
    await monitorRUMBatch(batch);
  }
  console.log('Initial URL monitoring completed at:', new Date().toLocaleString());
})();

// Run monitoring only if an hour has passed since the last run
async function runHourlyMonitoring() {
  const currentTime = Date.now();
  if (currentTime - lastRunTime >= ONE_HOUR) {
    console.log(`Starting hourly URL monitoring task at: ${new Date().toLocaleString()}`);
    lastRunTime = currentTime;
    
    for (let i = 0; i < monitoredUrls.length; i += 10) {
      const batch = monitoredUrls.slice(i, i + 10);
      await monitorRUMBatch(batch);
    }
    console.log(`Hourly URL monitoring task completed at: ${new Date().toLocaleString()}`);
  } else {
    console.log(`Skipping monitoring, next run in ${Math.round((ONE_HOUR - (currentTime - lastRunTime))/60000)} minutes`);
    
    // For testing: Add a random incident every minute if enabled
    if (ENABLE_FREQUENT_UPDATES && (currentTime - lastRunTime) % DEBUG_INTERVAL < 5000) {
      const testIncident = generateTestIncident();
      incidents.push(testIncident);
      console.log(`Added test incident for development purposes: ${testIncident.url} - ${testIncident.metric}`);
    }
  }
}

// Check every 5 minutes if an hour has passed
// For development, check more frequently to add test incidents
setInterval(runHourlyMonitoring, ENABLE_FREQUENT_UPDATES ? 10 * 1000 : 5 * 60 * 1000); // 10 seconds in dev, 5 minutes in prod

// Update the POST endpoint to accept real RUM metrics
export async function POST(request: Request) {
  const { url, metrics }: { url: string; metrics: Array<{ name: 'LCP' | 'FCP' | 'FID' | 'CLS'; value: number; element?: string }> } = await request.json();

  if (!url || !metrics) {
    return NextResponse.json({ error: 'URL and metrics are required' }, { status: 400 });
  }

  metrics.forEach(({ name, value, element }) => {
    const isAnomaly = detectAnomaly(value, name);
    incidents.push({
      timestamp: formatTimestamp(new Date()),
      url,
      metric: name,
      value,
      reason: element || 'Unknown element',
      anomaly: isAnomaly,
    });
  });

  return NextResponse.json({ message: 'Metrics received and processed', incidents });
}

// Enhance the GET endpoint to include root cause analysis, predictive monitoring results, and natural language summaries
export async function GET() {
  const groupedIncidents = incidents.reduce<Record<string, Incident[]>>((acc, incident) => {
    if (!acc[incident.url]) {
      acc[incident.url] = [];
    }
    acc[incident.url].push(incident);
    return acc;
  }, {});

  const rootCauses = Object.entries(groupedIncidents).map(([url, urlIncidents]) => {
    return { url, rootCause: analyzeRootCause(urlIncidents) };
  });

  const predictions = Object.entries(groupedIncidents).map(([url, urlIncidents]) => {
    return { url, predictions: predictIssues(urlIncidents) };
  });

  const summaries = incidents.map((incident) => ({
    ...incident,
    summary: generateSummary(incident),
    fixSuggestion: generateFixSuggestion(incident), // Add fix suggestions
  }));

  // Calculate and include the actual next run time
  const currentTime = Date.now();
  const nextRunTimeMs = lastRunTime + ONE_HOUR;
  const nextRunTime = new Date(nextRunTimeMs).toISOString();
  const minutesRemaining = Math.round((nextRunTimeMs - currentTime) / 60000);

  return NextResponse.json({ 
    incidents: summaries, 
    rootCauses, 
    predictions,
    lastRunTime: new Date(lastRunTime).toISOString(),
    nextRunTime,
    minutesRemaining
  });
}