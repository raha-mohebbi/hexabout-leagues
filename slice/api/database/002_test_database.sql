CREATE DATABASE hexabout_leagues_test;
\connect hexabout_leagues_test
\i /docker-entrypoint-initdb.d/001_schema.sql
\i /docker-entrypoint-initdb.d/003_migration_member_limit.sql
\i /docker-entrypoint-initdb.d/004_migration_rewards.sql
\i /docker-entrypoint-initdb.d/005_migration_indexes.sql
