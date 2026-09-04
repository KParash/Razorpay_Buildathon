"""
test_connection.py — Diagnose Supabase PostgreSQL connectivity.

Tests:
  1. psycopg2  — single connection (keyword args)
  2. psycopg2  — single connection (URI)
  3. psycopg3  — single connection
  4. psycopg_pool.ConnectionPool — connection pool (min/max, checkout, return)
  5. psycopg_pool — concurrent workers sharing a pool
  6. SQLAlchemy — engine pool (mirrors db.py setup)
"""
import os
import sys
import time
import threading
from dotenv import load_dotenv
from urllib.parse import urlparse

load_dotenv(override=True)

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    print("ERROR: DATABASE_URL not set in .env")
    sys.exit(1)

# Parse the URL into components
parsed = urlparse(DATABASE_URL)
HOST = parsed.hostname
PORT = parsed.port or 5432
USER = parsed.username
PASS = parsed.password
DB = parsed.path.lstrip("/") or "postgres"

print("=" * 60)
print("  Supabase PostgreSQL Connection Diagnostics")
print("=" * 60)
print(f"  Host:     {HOST}")
print(f"  Port:     {PORT}")
print(f"  User:     {USER}")
print(f"  Password: {PASS}")
print(f"  Database: {DB}")
print("=" * 60)
print()


# ── Test 1: psycopg2 with keyword args ──────────────────────────
def test_psycopg2_keywords():
    print("1. psycopg2 — single connection (keyword args)...")
    try:
        import psycopg2
        conn = psycopg2.connect(
            host=HOST, port=PORT, user=USER, password=PASS, dbname=DB,
            connect_timeout=10, sslmode="require",
        )
        cur = conn.cursor()
        cur.execute("SELECT version();")
        print(f"   SUCCESS: {cur.fetchone()[0][:60]}...")
        cur.close()
        conn.close()
    except Exception as e:
        print(f"   FAILED: {e}")


# ── Test 2: psycopg2 with URI ───────────────────────────────────
def test_psycopg2_uri():
    print("\n2. psycopg2 — single connection (URI)...")
    try:
        import psycopg2
        conn = psycopg2.connect(DATABASE_URL, connect_timeout=10)
        cur = conn.cursor()
        cur.execute("SELECT version();")
        print(f"   SUCCESS: {cur.fetchone()[0][:60]}...")
        cur.close()
        conn.close()
    except Exception as e:
        print(f"   FAILED: {e}")


# ── Test 3: psycopg (v3) single connection ──────────────────────
def test_psycopg3():
    print("\n3. psycopg3 — single connection...")
    try:
        import psycopg
        from psycopg.rows import dict_row
        conninfo = (
            f"host={HOST} port={PORT} user={USER} password={PASS} "
            f"dbname={DB} sslmode=require connect_timeout=10"
        )
        conn = psycopg.connect(conninfo, autocommit=True, row_factory=dict_row)
        row = conn.execute("SELECT version();").fetchone()
        print(f"   SUCCESS: {row['version'][:60]}...")
        conn.close()
    except Exception as e:
        print(f"   FAILED: {e}")


# ── Test 4: psycopg_pool.ConnectionPool ─────────────────────────
def test_psycopg_pool_basic():
    print("\n4. psycopg_pool — ConnectionPool (basic checkout/return)...")
    try:
        from psycopg_pool import ConnectionPool

        pool = ConnectionPool(
            conninfo=DATABASE_URL,
            min_size=2,
            max_size=5,
            open=True,
        )
        # Wait for the pool to be ready (connections warmed up)
        pool.wait(timeout=15)
        print(f"   Pool created — min_size=2, max_size=5")

        stats = pool.get_stats()
        print(f"   Pool stats: pool_size={stats['pool_size']}, "
              f"pool_available={stats['pool_available']}, "
              f"requests_waiting={stats['requests_waiting']}")

        # Checkout a connection and run a query
        with pool.connection() as conn:
            row = conn.execute("SELECT current_database(), current_user, pg_backend_pid();").fetchone()
            print(f"   Checkout OK — db={row[0]}, user={row[1]}, pid={row[2]}")

        # After returning, pool_available should go back up
        stats_after = pool.get_stats()
        print(f"   After return: pool_available={stats_after['pool_available']}")

        pool.close()
        print("   SUCCESS: Pool opened, used, and closed cleanly.")
    except Exception as e:
        print(f"   FAILED: {e}")


# ── Test 5: psycopg_pool concurrent workers ─────────────────────
def test_psycopg_pool_concurrent():
    print("\n5. psycopg_pool — concurrent workers (5 threads, pool max=3)...")
    try:
        from psycopg_pool import ConnectionPool

        pool = ConnectionPool(
            conninfo=DATABASE_URL,
            min_size=1,
            max_size=3,
            open=True,
        )
        pool.wait(timeout=15)

        results = []
        errors = []

        def worker(worker_id):
            try:
                with pool.connection() as conn:
                    row = conn.execute(
                        "SELECT pg_backend_pid(), pg_sleep(0.2);"
                    ).fetchone()
                    results.append((worker_id, row[0]))
            except Exception as exc:
                errors.append((worker_id, str(exc)))

        threads = [threading.Thread(target=worker, args=(i,)) for i in range(5)]
        t0 = time.perf_counter()
        for t in threads:
            t.start()
        for t in threads:
            t.join(timeout=30)
        elapsed = time.perf_counter() - t0

        stats = pool.get_stats()
        print(f"   Completed {len(results)}/5 workers in {elapsed:.2f}s")
        print(f"   Backend PIDs used: {sorted(set(pid for _, pid in results))}")
        print(f"   Pool stats: pool_size={stats['pool_size']}, "
              f"requests_num={stats['requests_num']}")
        if errors:
            for wid, err in errors:
                print(f"   Worker {wid} ERROR: {err}")
        else:
            print("   SUCCESS: All workers completed without errors.")

        pool.close()
    except Exception as e:
        print(f"   FAILED: {e}")


# ── Test 6: SQLAlchemy engine pool ──────────────────────────────
def test_sqlalchemy_pool():
    print("\n6. SQLAlchemy — engine pool (mirrors db.py setup)...")
    try:
        from sqlalchemy import create_engine, text

        engine = create_engine(
            DATABASE_URL,
            echo=False,
            pool_size=3,
            max_overflow=5,
            pool_pre_ping=True,
        )

        with engine.connect() as conn:
            row = conn.execute(text("SELECT version();")).fetchone()
            print(f"   SUCCESS: {row[0][:60]}...")

        pool = engine.pool
        print(f"   Pool class:   {pool.__class__.__name__}")
        print(f"   Pool size:    {pool.size()}")
        print(f"   Checked-in:   {pool.checkedin()}")
        print(f"   Checked-out:  {pool.checkedout()}")
        print(f"   Overflow:     {pool.overflow()}")

        engine.dispose()
        print("   Engine disposed cleanly.")
    except Exception as e:
        print(f"   FAILED: {e}")


# ── Run all tests ───────────────────────────────────────────────
if __name__ == "__main__":
    test_psycopg2_keywords()
    test_psycopg2_uri()
    test_psycopg3()
    test_psycopg_pool_basic()
    test_psycopg_pool_concurrent()
    test_sqlalchemy_pool()
    print("\n" + "=" * 60)
    print("  All tests finished.")
    print("=" * 60)




