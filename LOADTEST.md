# Hexabout Leagues — Load Test Report

**Status:** Executed  
**Version:** 1.0  
**Test Date:** November 26, 2026

## 1. Objective

The purpose of this test was to evaluate the responsiveness and stability of the API health endpoint under increasing concurrent request loads.

The test measured request throughput, average response latency, p95 and p99 latency, and HTTP/network errors.

## 2. Test Environment

| Component | Configuration |
|---|---|
| Operating System | Windows |
| Node.js | v22.14.0 |
| API | Local development environment |
| API Port | 4000 |
| Test Runner | Node.js built-in Fetch API |
| Test Script | `tests/loadtest.mjs` |
| Target Endpoint | `GET /health` |
| Database | Not directly exercised by this test |

## 3. Test Scope

The test targeted:

`GET http://localhost:4000/health`

This endpoint was selected because it does not require authentication and provides a simple way to evaluate basic API responsiveness.

**Important:** This test evaluates the health endpoint only. It does not measure leaderboard performance, database query performance, or the capacity of business-critical API operations.

## 4. Test Scenarios

Three sequential load scenarios were executed.

| Scenario | Virtual Users | Duration |
|---|---:|---:|
| Baseline | 1 | 30 seconds |
| Normal Load | 10 | 60 seconds |
| Stress Test | 25 | 60 seconds |

The test runner used concurrent workers that repeatedly issued GET requests during each scenario.

## 5. Test Results

All three scenarios completed successfully.

| Metric | Baseline | Normal Load | Stress Test |
|---|---:|---:|---:|
| Virtual Users | 1 | 10 | 25 |
| Duration | 30s | 60s | 60s |
| Total Requests | 143,454 | 535,358 | 557,316 |
| Requests per Second | 4,781.80 | 8,922.63 | 9,288.29 |
| Average Latency | 0.21 ms | 1.12 ms | 2.69 ms |
| p95 Latency | 0.35 ms | 2.77 ms | 4.55 ms |
| p99 Latency | 0.84 ms | 3.38 ms | 5.84 ms |
| Error Count | 0 | 0 | 0 |
| Error Rate | 0% | 0% | 0% |

## 6. Results Analysis

### Baseline

The API handled 143,454 requests during the 30-second baseline scenario.

- Throughput: 4,781.80 requests/second
- Average latency: 0.21 ms
- p95 latency: 0.35 ms
- Error rate: 0%

### Normal Load

Under 10 concurrent virtual users, the endpoint processed 535,358 requests.

- Throughput: 8,922.63 requests/second
- Average latency: 1.12 ms
- p95 latency: 2.77 ms
- Error rate: 0%

### Stress Test

Under 25 concurrent virtual users, the endpoint processed 557,316 requests.

- Throughput: 9,288.29 requests/second
- Average latency: 2.69 ms
- p95 latency: 4.55 ms
- Error rate: 0%

The measured latency increased as concurrency increased, while the endpoint continued responding without recorded errors.

## 7. Limitations

The following limitations must be considered when interpreting these results:

- Testing was performed locally, not on production infrastructure.
- Only the `/health` endpoint was tested.
- The health endpoint does not represent database-intensive application workloads.
- The test did not exercise authentication or authorization.
- The test did not evaluate leaderboard queries or other business operations.
- Results may vary depending on hardware, operating system, and runtime conditions.
- The reported throughput represents this local test setup and should not be interpreted as production capacity.

## 8. Recommendations

For a more comprehensive performance evaluation:

1. Test authenticated leaderboard retrieval.
2. Measure PostgreSQL query performance under concurrent requests.
3. Monitor CPU, memory, and database connection usage.
4. Repeat tests in an environment representative of production.
5. Evaluate performance under longer sustained workloads.

## 9. Conclusion

The API health endpoint completed all three local load-test scenarios successfully.

A maximum measured throughput of 9,288.29 requests per second was observed during the 25-virtual-user scenario, with a p95 latency of 4.55 ms and no recorded errors.

These results demonstrate responsive behavior for the tested health endpoint in the local environment. They do not establish the performance or scalability limits of the complete Hexabout Leagues application.