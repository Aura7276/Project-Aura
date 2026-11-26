#!/bin/bash
# local helper: rebuild a scratch database and run the M11 SQL scenarios
psql -X -q -d postgres -c "drop database if exists m11t" -c "create database m11t" 2>/dev/null
for f in tests/db/fixtures/auth_stub.sql supabase/migrations/2026112[5-7]*.sql tests/db/fixtures/storage_stub.sql supabase/migrations/2026112[89]*.sql supabase/migrations/202612*.sql; do psql -X -q -v ON_ERROR_STOP=1 -d m11t -f $f 2>&1 | head -4; done
[ -f tests/db/m11_rls.sql ] && psql -X -q -v ON_ERROR_STOP=1 -d m11t -f tests/db/m11_rls.sql 2>&1 | tail -${1:-14}
