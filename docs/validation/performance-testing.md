# XelLabs LIMS — Performance Testing Guide

## Tool: Locust (Python-based load tester)

### Install
```bash
pip install locust
```

### Locustfile
Save as `docs/validation/locustfile.py` and run from that directory.

```python
from locust import HttpUser, task, between

TOKEN = "your-analyst-token-here"

class LIMSUser(HttpUser):
    wait_time = between(1, 3)
    headers = {"Authorization": f"Token {TOKEN}"}

    @task(3)
    def list_samples(self):
        self.client.get("/api/samples/", headers=self.headers)

    @task(2)
    def dashboard(self):
        self.client.get("/api/dashboard/", headers=self.headers)

    @task(1)
    def list_results(self):
        self.client.get("/api/results/", headers=self.headers)

    @task(1)
    def list_worksheets(self):
        self.client.get("/api/worksheets/", headers=self.headers)
```

### Run
```bash
# Headless — 50 users ramping up over 10 seconds, run for 60 seconds
locust -f docs/validation/locustfile.py \
    --host http://localhost:8001 \
    --users 50 --spawn-rate 10 \
    --run-time 60s --headless \
    --csv docs/validation/perf-results
```

### Acceptance Criteria

| Metric | Target |
|---|---|
| 95th percentile response time | < 500 ms for GET endpoints |
| Error rate | < 1% |
| Requests/second | > 50 rps sustained |

### Django Performance Settings (Production)

```python
# config/settings.py — add for production
CONN_MAX_AGE = 60          # persistent DB connections
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.redis.RedisCache",
        "LOCATION": "redis://redis:6379/1",
        "TIMEOUT": 300,
    }
}
```

### Gunicorn Workers Formula
```
workers = (2 × CPU cores) + 1
# 4-core server → 9 workers
```
