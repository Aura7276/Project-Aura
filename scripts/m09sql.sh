#!/bin/bash
# local helper: rebuild a scratch database and run the M09 SQL scenarios
psql -X -q -d postgres -c "drop database if exists m09t" -c "create database m09t" 2>/dev/null
for f in tests/db/fixtures/auth_stub.sql supabase/migrations/2026112[5-7]*.sql tests/db/fixtures/storage_stub.sql supabase/migrations/2026112[89]*.sql supabase/migrations/20261201000100_m09_creator_profile.sql; do psql -X -q -v ON_ERROR_STOP=1 -d m09t -f $f 2>&1 | head -3; done
psql -X -q -v ON_ERROR_STOP=1 -d m09t -f tests/db/m09_rls.sql 2>&1 | tail -${1:-12}
