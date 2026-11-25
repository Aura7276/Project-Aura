#!/bin/bash
# local helper: rebuild a scratch database and run the M06 SQL scenarios
psql -X -q -d postgres -c "drop database if exists m06t" -c "create database m06t"
for f in tests/db/fixtures/auth_stub.sql tests/db/fixtures/storage_stub.sql supabase/migrations/2026112[5-9]*.sql; do psql -X -q -v ON_ERROR_STOP=1 -d m06t -f $f 2>&1 | head -3; done
psql -X -q -v ON_ERROR_STOP=1 -d m06t -f tests/db/m06_rls.sql 2>&1 | tail -${1:-15}
