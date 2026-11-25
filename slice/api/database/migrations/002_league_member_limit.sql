CREATE OR REPLACE FUNCTION enforce_league_member_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    member_count INTEGER;
BEGIN
    IF TG_OP = 'UPDATE' AND NEW.league_id = OLD.league_id THEN
        RETURN NEW;
    END IF;

    PERFORM 1
    FROM leagues
    WHERE id = NEW.league_id
    FOR UPDATE;

    SELECT COUNT(*)
    INTO member_count
    FROM league_members
    WHERE league_id = NEW.league_id;

    IF member_count >= 50 THEN
        RAISE EXCEPTION 'A league cannot contain more than 50 players'
            USING ERRCODE = '23514',
                  CONSTRAINT = 'league_member_limit';
    END IF;

    RETURN NEW;
END;
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'enforce_league_member_limit_trigger'
          AND tgrelid = 'league_members'::regclass
          AND NOT tgisinternal
    ) THEN
        CREATE TRIGGER enforce_league_member_limit_trigger
        BEFORE INSERT OR UPDATE OF league_id ON league_members
        FOR EACH ROW
        EXECUTE FUNCTION enforce_league_member_limit();
    END IF;
END;
$$;
