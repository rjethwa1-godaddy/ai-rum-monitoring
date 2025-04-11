# Project Progress

## Overview
This project involves monitoring Real User Metrics (RUM) for web performance and anomaly detection. The system fetches URLs from a sitemap, monitors their performance metrics, detects anomalies, and provides insights.

## Technologies Used
- **Node.js**: For server-side scripting.
- **Next.js**: Framework for building the web application.
- **TypeScript**: For type-safe development.
- **XML2JS**: For parsing XML sitemaps.
- **Node-Fetch**: For making HTTP requests.
- **File System (fs)**: For reading and writing local files.

## Current Tasks
1. Fetch URLs from a sitemap and save them to a local `urls.json` file.
2. Monitor RUM metrics for the fetched URLs.
3. Detect anomalies in RUM metrics and log incidents.
4. Provide root cause analysis and predictive monitoring.

## Progress
### April 10, 2025
- **Debugging Sitemap Fetching**:
  - Identified that the sitemap format does not follow the standard XML structure.
  - Updated the `fetchSitemapUrls` function to handle the custom sitemap format.
  - Added detailed logging to verify the fetched sitemap content and extracted URLs.
  - Enhanced the `saveUrlsToFile` function with additional logging to confirm data being written to `urls.json`.

### Next Steps
- Verify if the `urls.json` file is being populated correctly.
- Ensure the script has the necessary file write permissions.
- Test the monitoring and anomaly detection logic for the fetched URLs.