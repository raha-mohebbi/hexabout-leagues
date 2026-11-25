const URL = "http://localhost:4000/health";

const scenarios = [
  { name: "Baseline", vus: 1, duration: 30 },
  { name: "Normal Load", vus: 10, duration: 60 },
  { name: "Stress Test", vus: 25, duration: 60 },
];

function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(p * sorted.length) - 1] || 0;
}

async function runScenario({ name, vus, duration }) {
  console.log(`\nStarting ${name}: ${vus} VUs, ${duration}s`);

  const results = [];
  const start = Date.now();
  const end = start + duration * 1000;

  async function worker() {
    while (Date.now() < end) {
      const requestStart = performance.now();

      try {
        const response = await fetch(URL);
        await response.arrayBuffer();

        results.push({
          latency: performance.now() - requestStart,
          status: response.status,
          error: !response.ok,
        });
      } catch {
        results.push({
          latency: performance.now() - requestStart,
          status: 0,
          error: true,
        });
      }
    }
  }

  await Promise.all(Array.from({ length: vus }, worker));

  const elapsed = (Date.now() - start) / 1000;
  const latencies = results.map(r => r.latency);
  const errors = results.filter(r => r.error).length;

  const report = {
    scenario: name,
    virtualUsers: vus,
    durationSeconds: Number(elapsed.toFixed(2)),
    totalRequests: results.length,
    requestsPerSecond: Number((results.length / elapsed).toFixed(2)),
    averageLatencyMs: Number(
      (latencies.reduce((a, b) => a + b, 0) / (latencies.length || 1)).toFixed(2)
    ),
    p95LatencyMs: Number(percentile(latencies, 0.95).toFixed(2)),
    p99LatencyMs: Number(percentile(latencies, 0.99).toFixed(2)),
    errorCount: errors,
    errorRatePercent: Number((errors / (results.length || 1) * 100).toFixed(2)),
  };

  console.log(JSON.stringify(report, null, 2));
  return report;
}

const reports = [];

for (const scenario of scenarios) {
  reports.push(await runScenario(scenario));
}

console.log("\n=== FINAL RESULTS ===");
console.log(JSON.stringify(reports, null, 2));
