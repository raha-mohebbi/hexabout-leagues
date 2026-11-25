Hexabout Leagues --- Capacity Planning
Status: Draft v0.1
1. Workload Assumptions
The following estimates are planning assumptions, not measured
production traffic.

  Metric                                        Assumption
  Daily Active Users (DAU)                          60,000
Matches per player per day                             8
Matches per day                                  480,000
Players per league                                    50
Average match-result reports                 1 per match
Peak-hour traffic concentration     20% of daily traffic
Primary database                              PostgreSQL

The workload assumes one result-report request per completed match.
Additional API traffic from authentication, leaderboard reads, league
listings, and administration must be measured separately.
2. Request Rate Estimation
Daily match-result reports:

60,000 × 8 = 480,000 reports/day

Average result-report throughput:

480,000 / 86,400 ≈ 5.56 requests/second

Estimated peak-hour throughput:

480,000 × 0.20 / 3,600 ≈ 26.67 requests/second

The initial planning target is approximately 27 match-result reports per
second at 60,000 DAU.

This is a workload estimate, not a measured capacity claim. A production
load test must validate the actual peak distribution and include
leaderboard reads, authentication, and administrative traffic.
3. DAU Scenarios
Assuming eight matches per player per day and 20% of daily match traffic
concentrated in the busiest hour:
    DAU   Matches/day   Average reports/sec   Estimated peak reports/sec

  1,000         8,000                  0.09                         0.44
 10,000        80,000                  0.93                         4.44
 60,000       480,000                  5.56                        26.67
100,000       800,000                  9.26                        44.44
These figures cover match-result reporting only. Read traffic and other
API operations require separate workload modeling.
4. Database and Connection Planning
PostgreSQL is the initial source of truth for player league membership,
match results, scores, and administrative audit records.

Initial database strategy:
- Use indexed relational queries for league and leaderboard access.
- Use transactions for result processing and invalidation.
- Enforce uniqueness at the database level for match processing and
  reward settlement.
- Use connection pooling to bound concurrent database connections.
- Keep transactions short and avoid external network calls inside
  transactions.
- Monitor active connections, connection wait time, query latency,
  locks, and slow queries.
The application must not open an unbounded database connection per
request.

A conservative initial deployment can start with a small application
connection pool, for example 10 connections per API instance, and a
bounded PostgreSQL connection budget. The final pool size must be
selected based on database limits, application instance count, and
load-test measurements.
5. Scaling Strategy
Initial stage --- up to 10k DAU
- Modular monolith.
- PostgreSQL as the primary database.
- Indexed queries and pagination.
- Bounded connection pooling.
- Basic request rate limiting.
- Structured logs and latency metrics.
Growth stage --- around 60k DAU
- Load-test the API and database under representative read/write
  traffic.
- Tune indexes and expensive queries.
- Evaluate leaderboard caching based on measured read volume.
- Consider Redis for frequently accessed, safely invalidatable
  leaderboard data.
- Introduce background workers for asynchronous settlement and
  non-critical processing when justified.
Larger stage --- around 100k DAU and beyond
- Evaluate horizontal API scaling.
- Reassess database CPU, I/O, lock contention, and connection
  pressure.
- Consider read replicas for read-heavy workloads.
- Partition high-volume historical match data if retention and query
  patterns justify it.
- Separate background processing from latency-sensitive API requests.
- Revisit architecture only when observed bottlenecks justify the
  added operational complexity.
6. Cost Model and Measurement Plan
Infrastructure costs depend on provider, region, database size,
availability requirements, storage retention, bandwidth, and monitoring
choices.

No production cost is claimed without a defined provider and deployment
configuration.

The initial cost model should include:
- API compute.
- PostgreSQL compute and storage.
- Backup and recovery storage.
- Network egress.
- Monitoring and logging.
- Optional Redis.
- Background worker compute.
- AI coding assistant subscription and usage costs.
The implementation exercise should record actual local resource usage
and load-test results rather than presenting local benchmark numbers as
production capacity.
7. Scaling Triggers
Scaling decisions should be driven by measured symptoms rather than DAU
alone.

Review infrastructure when any of these conditions persist:
- API p95 latency exceeds the agreed service target.
- Database CPU or I/O remains saturated.
- Connection pool wait time becomes significant.
- Slow queries or lock contention increase.
- Error rates rise under peak traffic.
- Leaderboard reads materially compete with transactional writes.
The first scaling action should target the measured bottleneck, not
introduce infrastructure preemptively.

Current limitation: All throughput figures in this document are
analytical estimates. Actual capacity, latency, and infrastructure cost
must be validated through load testing and a selected deployment
provider.