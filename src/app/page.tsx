"use client";

import React from 'react';
import { useState, useEffect, useMemo } from 'react';
import urlsData from '../../urls.json';
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Select,
  SelectItem,
  Input
} from "@nextui-org/react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { AlertTriangle, Zap, Clock, Filter, ArrowUpCircle, ArrowDownCircle, RefreshCw } from 'lucide-react';

// Add proper type annotations to resolve type issues
interface Incident {
  timestamp: string;
  url: string;
  metric: 'LCP' | 'FCP' | 'FID' | 'CLS';
  value: number;
  reason: string;
  anomaly?: boolean;
  summary?: string;
  fixSuggestion?: string;
}

interface RootCause {
  url: string;
  rootCause: string;
}

interface Prediction {
  url: string;
  predictions: Array<{ metric: 'LCP' | 'FCP' | 'FID' | 'CLS'; reason: string }>;
}

// Define metric threshold values
const METRIC_THRESHOLDS = {
  LCP: { good: 2500, poor: 4000 }, // milliseconds
  FCP: { good: 1000, poor: 3000 }, // milliseconds (updated from 1800 to 1000)
  FID: { good: 100, poor: 300 },   // milliseconds
  CLS: { good: 0.1, poor: 0.25 }   // unitless (representing percentage as decimal: 10% = 0.1, 25% = 0.25)
};

// Generate colors for different states
const getMetricStatusColor = (metric: 'LCP' | 'FCP' | 'FID' | 'CLS', value: number) => {
  const threshold = METRIC_THRESHOLDS[metric];
  if (value <= threshold.good) return "success";
  if (value >= threshold.poor) return "danger";
  return "warning";
};

const getMetricStatusLabel = (metric: 'LCP' | 'FCP' | 'FID' | 'CLS', value: number) => {
  const threshold = METRIC_THRESHOLDS[metric];
  if (value <= threshold.good) return "Good";
  if (value >= threshold.poor) return "Poor";
  return "Needs Improvement";
};

// Format metric values for display
const formatMetricValue = (metric: 'LCP' | 'FCP' | 'FID' | 'CLS', value: number) => {
  if (metric === 'CLS') return value.toFixed(2);
  return `${value.toFixed(0)}ms`;
};

// Safely format date strings
const formatSafeDate = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return "Not available";
    }
    return date.toLocaleString();
  } catch (error) {
    return "Not available";
  }
};

// Validate timestamp and provide a safe default
const getSafeTimestamp = (): string => {
  return new Date().toISOString();
};

// Format URL for display with smart truncation
const formatUrl = (url: string): { domain: string, path: string } => {
  try {
    const urlObj = new URL(url);
    return {
      domain: urlObj.hostname,
      path: urlObj.pathname + urlObj.search + urlObj.hash
    };
  } catch (e) {
    // Fallback if URL parsing fails
    const parts = url.split('/');
    if (parts.length >= 3) {
      return {
        domain: parts[2],
        path: '/' + parts.slice(3).join('/')
      };
    }
    return { domain: url, path: '' };
  }
};

// Chart colors
const COLORS = ['#00C49F', '#FFBB28', '#FF8042', '#0088FE'];

export default function Home() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [rootCauses, setRootCauses] = useState<RootCause[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [status, setStatus] = useState('Initializing...');
  const [lastRunTime, setLastRunTime] = useState<Date | null>(null);
  const [nextRunTime, setNextRunTime] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [filterMetric, setFilterMetric] = useState<'all' | 'LCP' | 'FCP' | 'FID' | 'CLS'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'anomaly' | 'normal'>('all');
  const [filterUrl, setFilterUrl] = useState<string>('');
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  const [displayedTimeRemaining, setDisplayedTimeRemaining] = useState<string>('Calculating...');
  const [displayedCardCount, setDisplayedCardCount] = useState<number>(8);

  // Function to toggle card expansion
  const toggleCardExpansion = (cardId: string) => {
    setExpandedCards(prev => ({
      ...prev,
      [cardId]: !prev[cardId]
    }));
  };

  const fetchIncidentsIncrementally = async () => {
    try {
      setIsLoading(true);
      setStatus('Fetching incidents...');
      const response = await fetch('/api/rum-monitor');
      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }
      const data = await response.json();
      
      if (data.incidents && data.incidents.length > 0) {
        setIncidents(data.incidents);
        setRootCauses(data.rootCauses || []);
        setPredictions(data.predictions || []);
        
        // Update last run time from API
        if (data.lastRunTime) {
          setLastRunTime(new Date(data.lastRunTime));
        } else {
          // Fallback to old method if API doesn't provide lastRunTime
          const timestamps = data.incidents.map((i: Incident) => new Date(i.timestamp).getTime());
          const mostRecentTimestamp = Math.max(...timestamps);
          const mostRecentDate = new Date(mostRecentTimestamp);
          setLastRunTime(mostRecentDate);
        }
        
        // Use nextRunTime directly from API if available
        if (data.nextRunTime) {
          setNextRunTime(new Date(data.nextRunTime));
          // If API provides minutes remaining, update the displayed time immediately
          if (data.minutesRemaining !== undefined) {
            setDisplayedTimeRemaining(`${data.minutesRemaining}m 0s`);
          }
        } else {
          // Fallback to old method if API doesn't provide nextRunTime
          const nextRun = new Date(lastRunTime || new Date());
          nextRun.setHours(nextRun.getHours() + 1);
          setNextRunTime(nextRun);
        }
        
        setStatus(`Updated ${data.incidents.length} incidents`);
      } else {
        setStatus('No incidents found. Waiting for data...');
      }
    } catch (error) {
      console.error('Failed to fetch incidents:', error);
      setStatus('Failed to fetch incidents.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Fetch data immediately on component mount
    fetchIncidentsIncrementally();
    
    // Then fetch data every minute instead of every 5 seconds
    // This is frequent enough to detect when new hourly data is available
    // but not so frequent as to overload the server
    const interval = setInterval(fetchIncidentsIncrementally, 60000);
    return () => clearInterval(interval);
  }, []);

  // Function to calculate time remaining
  const calculateTimeRemaining = () => {
    if (!nextRunTime) return 'Calculating...';
    
    const now = new Date();
    const timeDiff = nextRunTime.getTime() - now.getTime();
    
    if (timeDiff <= 0) return 'Due soon';
    
    const minutes = Math.floor(timeDiff / (1000 * 60));
    const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  // Update the time remaining every second
  useEffect(() => {
    // Initial update
    setDisplayedTimeRemaining(calculateTimeRemaining());
    
    // Set up interval to update every second
    const interval = setInterval(() => {
      setDisplayedTimeRemaining(calculateTimeRemaining());
    }, 1000);
    
    // Clean up interval on unmount
    return () => clearInterval(interval);
  }, [nextRunTime]);

  // Filter incidents based on selected filters
  const filteredIncidents = useMemo(() => {
    return incidents.filter(incident => {
      const metricsMatch = filterMetric === 'all' || incident.metric === filterMetric;
      const statusMatch = filterStatus === 'all' || 
        (filterStatus === 'anomaly' && incident.anomaly === true) ||
        (filterStatus === 'normal' && !incident.anomaly);
      const urlMatch = !filterUrl || incident.url.includes(filterUrl);
      return metricsMatch && statusMatch && urlMatch;
    });
  }, [incidents, filterMetric, filterStatus, filterUrl]);

  // Group incidents by URL
  const groupedIncidents = useMemo(() => {
    return filteredIncidents.reduce((acc, incident) => {
      if (!acc[incident.url]) {
        acc[incident.url] = [];
      }
      acc[incident.url].push(incident);
      return acc;
    }, {} as Record<string, Incident[]>);
  }, [filteredIncidents]);

  // Prepare data for charts
  const chartData = useMemo(() => {
    const metricCounts = {
      LCP: { total: 0, anomalies: 0 },
      FCP: { total: 0, anomalies: 0 },
      FID: { total: 0, anomalies: 0 },
      CLS: { total: 0, anomalies: 0 }
    };

    incidents.forEach(incident => {
      metricCounts[incident.metric].total += 1;
      if (incident.anomaly) {
        metricCounts[incident.metric].anomalies += 1;
      }
    });

    const metricPerformance = Object.keys(metricCounts).map(metric => ({
      name: metric,
      total: metricCounts[metric as keyof typeof metricCounts].total,
      anomalies: metricCounts[metric as keyof typeof metricCounts].anomalies,
    }));

    // Calculate average values by metric
    const metricAverages = incidents.reduce((acc, incident) => {
      if (!acc[incident.metric]) {
        acc[incident.metric] = { sum: 0, count: 0 };
      }
      acc[incident.metric].sum += incident.value;
      acc[incident.metric].count += 1;
      return acc;
    }, {} as Record<string, { sum: number; count: number }>);

    const averageData = Object.entries(metricAverages).map(([metric, data]) => ({
      metric,
      average: data.count > 0 ? data.sum / data.count : 0,
    }));

    // Group performance by URL
    const urlPerformance = Object.entries(groupedIncidents).map(([url, urlIncidents]) => {
      const metrics: Record<string, number> = {
        LCP: 0,
        FCP: 0,
        FID: 0,
        CLS: 0
      };

      const counts: Record<string, number> = {
        LCP: 0,
        FCP: 0,
        FID: 0,
        CLS: 0
      };

      urlIncidents.forEach(incident => {
        metrics[incident.metric] += incident.value;
        counts[incident.metric] += 1;
      });

      return {
        url: url.split('/').slice(2).join('/'),  // Remove the protocol part for display
        LCP: counts.LCP ? metrics.LCP / counts.LCP : 0,
        FCP: counts.FCP ? metrics.FCP / counts.FCP : 0,
        FID: counts.FID ? metrics.FID / counts.FID : 0,
        CLS: counts.CLS ? metrics.CLS / counts.CLS : 0,
      };
    });

    return { metricPerformance, averageData, urlPerformance };
  }, [incidents, groupedIncidents]);

  // Summary stats
  const summaryStats = useMemo(() => {
    const totalIncidents = incidents.length;
    const anomalyIncidents = incidents.filter(i => i.anomaly).length;
    const impactedUrls = new Set(incidents.map(i => i.url)).size;
    const pctAnomalies = totalIncidents > 0 ? (anomalyIncidents / totalIncidents * 100).toFixed(0) : '0';

    return {
      totalIncidents,
      anomalyIncidents,
      impactedUrls,
      pctAnomalies
    };
  }, [incidents]);

  // Combine incidents and predictions for the unified table
  const combinedTableData = useMemo(() => {
    // Map incidents to the table format
    const incidentRows = filteredIncidents.map(incident => ({
      url: incident.url,
      metric: incident.metric,
      value: incident.value,
      timestamp: incident.timestamp || getSafeTimestamp(), // Ensure we have a valid timestamp
      reason: incident.reason,
      isAnomaly: incident.anomaly,
      isPrediction: false,
      summary: incident.summary,
      fixSuggestion: incident.fixSuggestion,
    }));

    // Map predictions to the table format
    const predictionRows = predictions.flatMap(prediction => 
      prediction.predictions.map(p => ({
        url: prediction.url,
        metric: p.metric,
        value: null, // Predictions don't have values yet
        timestamp: getSafeTimestamp(), // Use our safe timestamp generator
        reason: p.reason,
        isAnomaly: true, // Predictions are highlighting potential issues
        isPrediction: true,
        summary: null,
        fixSuggestion: null,
      }))
    );

    // Combine and sort by timestamp (latest first) and then by URL
    return [...incidentRows, ...predictionRows]
      .sort((a, b) => {
        // First sort by isPrediction (predictions appear first)
        if (a.isPrediction !== b.isPrediction) {
          return a.isPrediction ? -1 : 1;
        }
        
        // Then by timestamp (most recent first)
        try {
          const dateA = new Date(a.timestamp);
          const dateB = new Date(b.timestamp);
          
          // Check if dates are valid before comparison
          if (isNaN(dateA.getTime())) return 1;
          if (isNaN(dateB.getTime())) return -1;
          if (isNaN(dateA.getTime()) && isNaN(dateB.getTime())) return 0;
          
          return dateB.getTime() - dateA.getTime();
        } catch (e) {
          return 0; // If dates can't be compared, maintain existing order
        }
      });
  }, [filteredIncidents, predictions]);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">RUM Monitoring Dashboard</h1>
          <p className="text-surface-600 mt-1">
            Real user monitoring metrics and performance insights
          </p>
        </div>
        <Button
          color="default"
          startContent={<RefreshCw size={16} className="text-blue-600" />}
          onClick={fetchIncidentsIncrementally}
          isLoading={isLoading}
          className="bg-blue-100 hover:bg-blue-200 text-blue-700 font-medium border border-blue-300"
        >
          Refresh Data
        </Button>
      </div>

      {/* Status indicator with timing information */}
      <div className="flex items-center justify-between gap-2 p-3 bg-surface-50 rounded-lg">
        <div className="flex items-center gap-2">
          <Zap size={16} className="text-success" />
          <span className="text-sm text-surface-600">{status}</span>
        </div>
        <div className="flex flex-col text-right text-sm">
          <div className="text-surface-600">
            <span className="font-medium">Last run:</span> {lastRunTime ? lastRunTime.toLocaleString() : 'Not yet run'}
          </div>
          <div className="text-surface-600">
            <span className="font-medium">Next run in:</span> {displayedTimeRemaining}
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
          <CardBody className="p-4">
            <div className="text-xs font-medium uppercase tracking-wider opacity-80">Total Incidents</div>
            <div className="text-3xl font-bold mt-1">{summaryStats.totalIncidents}</div>
            <div className="mt-2 flex items-center text-xs">
              <span className="flex items-center">
                <Clock size={14} className="mr-1" />
                Updated hourly
              </span>
            </div>
          </CardBody>
        </Card>

        <Card className="bg-gradient-to-r from-amber-500 to-amber-600 text-white">
          <CardBody className="p-4">
            <div className="text-xs font-medium uppercase tracking-wider opacity-80">Anomalies</div>
            <div className="text-3xl font-bold mt-1">{summaryStats.anomalyIncidents}</div>
            <div className="mt-2 flex items-center text-xs">
              <span className="flex items-center">
                <AlertTriangle size={14} className="mr-1" />
                {summaryStats.pctAnomalies}% of total incidents
              </span>
            </div>
          </CardBody>
        </Card>

        <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
          <CardBody className="p-4">
            <div className="text-xs font-medium uppercase tracking-wider opacity-80">URLs Monitored</div>
            <div className="text-3xl font-bold mt-1">{urlsData.urls.length}</div>
            <div className="mt-2 flex items-center text-xs">
              <span className="flex items-center">
                <ArrowUpCircle size={14} className="mr-1" />
                {urlsData.urls.length} active monitors
              </span>
            </div>
          </CardBody>
        </Card>

        <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
          <CardBody className="p-4">
            <div className="text-xs font-medium uppercase tracking-wider opacity-80">Impacted URLs</div>
            <div className="text-3xl font-bold mt-1">{summaryStats.impactedUrls}</div>
            <div className="mt-2 flex items-center text-xs">
              <span className="flex items-center">
                <ArrowDownCircle size={14} className="mr-1" />
                {((summaryStats.impactedUrls / urlsData.urls.length) * 100).toFixed(0)}% of monitored URLs
              </span>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Add filters for metric and status */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
        <div className="flex items-center">
          <Filter size={16} className="mr-2" />
          <span className="text-sm font-medium">Filters:</span>
        </div>
        
        <Select 
          label="Metric" 
          className="max-w-xs"
          value={filterMetric}
          onChange={(e) => setFilterMetric(e.target.value as 'all' | 'LCP' | 'FCP' | 'FID' | 'CLS')}
        >
          <SelectItem key="all" value="all">All Metrics</SelectItem>
          <SelectItem key="LCP" value="LCP">LCP (Largest Contentful Paint)</SelectItem>
          <SelectItem key="FCP" value="FCP">FCP (First Contentful Paint)</SelectItem>
          <SelectItem key="FID" value="FID">FID (First Input Delay)</SelectItem>
          <SelectItem key="CLS" value="CLS">CLS (Cumulative Layout Shift)</SelectItem>
        </Select>
        
        <Select 
          label="Status" 
          className="max-w-xs"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as 'all' | 'anomaly' | 'normal')}
        >
          <SelectItem key="all" value="all">All Status</SelectItem>
          <SelectItem key="anomaly" value="anomaly">Anomalies Only</SelectItem>
          <SelectItem key="normal" value="normal">Normal Only</SelectItem>
        </Select>

        <Input 
          label="URL" 
          className="max-w-xs"
          value={filterUrl}
          onChange={(e) => setFilterUrl(e.target.value)}
          placeholder="Enter URL or part of it"
        />
      </div>
      
      {/* Charts section */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex gap-3">
            <div>
              <p className="text-md font-semibold">Metric Performance Overview</p>
              <p className="text-sm text-surface-500">Distribution of metrics across all monitored URLs</p>
            </div>
          </CardHeader>
          <CardBody>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData.metricPerformance}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="total" fill="#8884d8" name="Total Measurements" />
                <Bar dataKey="anomalies" fill="#ff5252" name="Anomalies" />
              </BarChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="flex gap-3">
            <div>
              <p className="text-md font-semibold">Average Values by Metric</p>
              <p className="text-sm text-surface-500">Average performance values across all URLs</p>
            </div>
          </CardHeader>
          <CardBody>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData.averageData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="metric" />
                <YAxis />
                <Tooltip formatter={(value, name, props) => {
                  const metric = props.payload.metric;
                  return [formatMetricValue(metric as any, value as number), 'Average Value'];
                }} />
                <Legend />
                <Bar dataKey="average" fill="#4caf50" name="Average Value" />
              </BarChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>
      </div>

      {/* Modern card-based grid for insights and predictions - replacing the table */}
      <Card>
        <CardHeader className="flex justify-between items-center">
          <div>
            <p className="text-md font-semibold">Performance Insights & Predictions</p>
            <p className="text-sm text-surface-500">Current metrics and potential future issues</p>
          </div>
          
          <div className="flex items-center gap-2 text-sm">
            <div className="flex items-center">
              <div className="w-3 h-3 rounded-full bg-purple-200 mr-1"></div>
              <span>Predictions</span>
            </div>
            <div className="flex items-center ml-3">
              <div className="w-3 h-3 rounded-full bg-red-200 mr-1"></div>
              <span>Anomalies</span>
            </div>
            <div className="flex items-center ml-3">
              <div className="w-3 h-3 rounded-full bg-green-200 mr-1"></div>
              <span>Normal</span>
            </div>
          </div>
        </CardHeader>
        <CardBody>
          {combinedTableData.length === 0 ? (
            <div className="py-6 text-center text-surface-500">
              No data matches the current filters. Try changing your filter criteria.
            </div>
          ) : (
            <div className="space-y-6">
              {/* Grid for cards with expandable details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {combinedTableData.slice(0, displayedCardCount).map((item, idx) => {
                  const cardId = `${item.url}-${item.metric}-${idx}`;
                  const isExpanded = expandedCards[cardId] || false;
                  
                  return (
                    <Card 
                      key={cardId}
                      className={`border-l-4 ${
                        item.isPrediction 
                          ? "border-l-purple-500 bg-purple-50" 
                          : item.isAnomaly 
                            ? "border-l-red-500 bg-red-50" 
                            : "border-l-green-500 bg-green-50"
                      }`}
                      onClick={() => toggleCardExpansion(cardId)}
                    >
                      <CardBody className="p-5">
                        {/* URL and badge row */}
                        <div className="flex justify-between items-start mb-3">
                          <div className="mr-2 w-3/4">
                            <div className="text-sm text-surface-600">{formatUrl(item.url).domain}</div>
                            <div className="font-medium text-base">
                              {formatUrl(item.url).path || "/"}
                            </div>
                          </div>
                          <div 
                            className={`text-sm px-2 py-1 rounded-md font-medium ${
                              item.isPrediction 
                                ? "bg-purple-100 text-purple-700" 
                                : item.isAnomaly 
                                  ? "bg-red-100 text-red-700" 
                                  : "bg-green-100 text-green-700"
                            }`}
                          >
                            {item.isPrediction ? "Prediction" : (item.isAnomaly ? "Anomaly" : "Normal")}
                          </div>
                        </div>
                        
                        {/* Metric info */}
                        <div className="flex justify-between items-center mb-4">
                          <div>
                            <div 
                              className={`inline-block text-sm px-2 py-1 rounded-md font-medium ${
                                item.metric === "LCP" ? "bg-amber-100 text-amber-700" : 
                                item.metric === "FCP" ? "bg-blue-100 text-blue-700" : 
                                item.metric === "FID" ? "bg-purple-100 text-purple-700" : 
                                "bg-green-100 text-green-700"
                              }`}
                            >
                              {item.metric}
                            </div>
                            {item.value !== null && (
                              <span className={`ml-2 text-base font-medium text-${
                                getMetricStatusColor(item.metric, item.value)
                              }`}>
                                {formatMetricValue(item.metric, item.value)} 
                                <span className="text-xs ml-1">({getMetricStatusLabel(item.metric, item.value)})</span>
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-surface-500">
                            {item.isPrediction ? "Upcoming" : formatSafeDate(item.timestamp)}
                          </div>
                        </div>
                        
                        {/* Basic content when not expanded */}
                        {!isExpanded && (
                          <p className="text-base text-surface-700 line-clamp-3" title={item.reason}>
                            {item.reason}
                          </p>
                        )}

                        {/* Expanded content with details */}
                        {isExpanded && (
                          <div className="space-y-4">
                            {/* Element causing the issue */}
                            <div>
                              <div className="text-sm font-semibold text-surface-700 mb-1">Element</div>
                              <p className="text-base text-surface-800">
                                {item.reason}
                              </p>
                            </div>
                            
                            {/* Issue Summary */}
                            {item.summary && (
                              <div>
                                <div className="text-sm font-semibold text-surface-700 mb-1">Issue Summary</div>
                                <p className="text-base text-surface-800">
                                  {item.summary}
                                </p>
                              </div>
                            )}
                            
                            {/* Fix Suggestion */}
                            {item.fixSuggestion && (
                              <div>
                                <div className="text-sm font-semibold text-surface-700 mb-1">Recommended Fix</div>
                                <p className="text-base text-surface-800">
                                  {item.fixSuggestion}
                                </p>
                              </div>
                            )}
                            
                            {/* Full URL */}
                            <div>
                              <div className="text-sm font-semibold text-surface-700 mb-1">Full URL</div>
                              <p className="text-sm text-surface-700 break-all">
                                {item.url}
                              </p>
                            </div>
                          </div>
                        )}
                        
                        {/* Show toggle instruction */}
                        <div className="text-center mt-3 pt-1 border-t border-surface-200">
                          <Button 
                            size="sm"
                            variant="light"
                            color="primary"
                            className="mx-auto mt-1"
                            onClick={(e) => {
                              e.stopPropagation(); // Prevent triggering the card's onPress
                              toggleCardExpansion(cardId);
                            }}
                          >
                            {isExpanded ? "Show less" : "Show more details"}
                          </Button>
                        </div>
                      </CardBody>
                    </Card>
                  );
                })}
              </div>
              
              {/* Pagination indicator */}
              {combinedTableData.length > displayedCardCount && (
                <div className="flex justify-center mt-6">
                  <Button 
                    size="md" 
                    color="default" 
                    variant="bordered"
                    className="mx-auto"
                    onClick={() => setDisplayedCardCount(prev => Math.min(prev + 8, combinedTableData.length))}
                  >
                    Load more ({combinedTableData.length - displayedCardCount} remaining)
                  </Button>
                </div>
              )}
              
              {/* Show "All items loaded" message when everything is displayed */}
              {displayedCardCount >= combinedTableData.length && combinedTableData.length > 8 && (
                <div className="text-center text-surface-500 mt-6">
                  All items loaded
                </div>
              )}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Root cause analysis section for anomalies */}
      {filterStatus === 'anomaly' && rootCauses.length > 0 && (
        <Card>
          <CardHeader>
            <div>
              <p className="text-md font-semibold">Root Cause Analysis</p>
              <p className="text-sm text-surface-500">AI-generated insights on anomalies</p>
            </div>
          </CardHeader>
          <CardBody>
            <div className="space-y-4">
              {rootCauses.map((item, idx) => (
                <div key={idx} className="p-4 bg-surface-50 rounded-lg border border-surface-200">
                  <div className="font-medium mb-2 truncate max-w-full" title={item.url}>
                    {item.url.split('/').slice(2).join('/')}
                  </div>
                  <div className="text-sm text-surface-600">
                    {item.rootCause}
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}