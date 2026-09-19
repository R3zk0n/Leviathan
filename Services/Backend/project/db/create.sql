-- The official Postgres Docker entrypoint creates POSTGRES_DB before running
-- scripts in /docker-entrypoint-initdb.d, so this script is already connected
-- to the application database.

-- User Management
--------------------

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) UNIQUE,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Android App Information
---------------------------

-- Main Android info table
CREATE TABLE IF NOT EXISTS android_info (
    id SERIAL PRIMARY KEY,
    app_name VARCHAR(255) NOT NULL,
    package_name VARCHAR(255) NOT NULL,
    version VARCHAR(255) NOT NULL,
    developer VARCHAR(255),
    release_date DATE,
    manifest_xml TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (package_name, version)
);

-- Android activities
CREATE TABLE IF NOT EXISTS android_activities (
    id SERIAL PRIMARY KEY,
    android_info_id INT NOT NULL,
    activity_name VARCHAR(255) NOT NULL,
    activity_exported BOOLEAN,  -- tri-state: NULL = android:exported attribute absent (implicit-export resolved from intent-filters at read time)
    activity_permission VARCHAR(255),
    manifest_snippet TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (android_info_id) REFERENCES android_info(id) ON DELETE CASCADE
);

-- Activity actions
CREATE TABLE IF NOT EXISTS activity_actions (
    id SERIAL PRIMARY KEY,
    activity_id INT NOT NULL,
    action VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (activity_id) REFERENCES android_activities(id) ON DELETE CASCADE
);

-- Activity categories
CREATE TABLE IF NOT EXISTS activity_categories (
    id SERIAL PRIMARY KEY,
    activity_id INT NOT NULL,
    category VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (activity_id) REFERENCES android_activities(id) ON DELETE CASCADE
);

-- Activity schemes
CREATE TABLE IF NOT EXISTS activity_schemes (
    id SERIAL PRIMARY KEY,
    activity_id INT NOT NULL,
    scheme VARCHAR(255),
    host VARCHAR(255),
    path VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (activity_id) REFERENCES android_activities(id) ON DELETE CASCADE
);

-- Activity intent filters
CREATE TABLE IF NOT EXISTS activity_intent_filters (
    id SERIAL PRIMARY KEY,
    activity_id INT NOT NULL,
    intent_action TEXT,
    intent_category TEXT,
    intent_data_scheme TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (activity_id) REFERENCES android_activities(id) ON DELETE CASCADE
);

-- Android services
CREATE TABLE IF NOT EXISTS android_services (
    id SERIAL PRIMARY KEY,
    android_info_id INT NOT NULL,
    service_name VARCHAR(255) NOT NULL,
    service_exported BOOLEAN,  -- tri-state: NULL = android:exported attribute absent (implicit-export resolved from intent-filters at read time)
    service_permission VARCHAR(255),
    manifest_snippet TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (android_info_id) REFERENCES android_info(id) ON DELETE CASCADE
);

-- Android receivers
CREATE TABLE IF NOT EXISTS android_receivers (
    id SERIAL PRIMARY KEY,
    android_info_id INT NOT NULL,
    receiver_name VARCHAR(255) NOT NULL,
    receiver_exported BOOLEAN,  -- tri-state: NULL = android:exported attribute absent (implicit-export resolved from intent-filters at read time)
    receiver_permission VARCHAR(255),
    manifest_snippet TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (android_info_id) REFERENCES android_info(id) ON DELETE CASCADE
);

-- Android providers
CREATE TABLE IF NOT EXISTS android_providers (
    id SERIAL PRIMARY KEY,
    android_info_id INT NOT NULL,
    provider_name VARCHAR(255) NOT NULL,
    provider_exported BOOLEAN,  -- tri-state: NULL = android:exported attribute absent (implicit-export resolved from intent-filters at read time)
    provider_permission VARCHAR(255),
    grant_uri_permissions BOOLEAN DEFAULT FALSE,
    authorities TEXT,
    read_permission VARCHAR(255),
    write_permission VARCHAR(255),
    manifest_snippet TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (android_info_id) REFERENCES android_info(id) ON DELETE CASCADE
);

-- Provider actions
CREATE TABLE IF NOT EXISTS provider_actions (
    id SERIAL PRIMARY KEY,
    provider_id INT NOT NULL,
    action VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (provider_id) REFERENCES android_providers(id) ON DELETE CASCADE
);

-- Provider categories
CREATE TABLE IF NOT EXISTS provider_categories (
    id SERIAL PRIMARY KEY,
    provider_id INT NOT NULL,
    category VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (provider_id) REFERENCES android_providers(id) ON DELETE CASCADE
);

-- Provider schemes
CREATE TABLE IF NOT EXISTS provider_schemes (
    id SERIAL PRIMARY KEY,
    provider_id INT NOT NULL,
    scheme VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (provider_id) REFERENCES android_providers(id) ON DELETE CASCADE
);

-- Android source code
CREATE TABLE IF NOT EXISTS android_source_code (
    id SERIAL PRIMARY KEY,
    android_info_id INT NOT NULL,
    source_code TEXT NOT NULL,
    repository_type VARCHAR(50),
    branch VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (android_info_id) REFERENCES android_info(id) ON DELETE CASCADE
);


-- Service actions
CREATE TABLE IF NOT EXISTS service_actions (
    id SERIAL PRIMARY KEY,
    service_id INT NOT NULL,
    action VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (service_id) REFERENCES android_services(id) ON DELETE CASCADE
);

-- Service categories
CREATE TABLE IF NOT EXISTS service_categories (
    id SERIAL PRIMARY KEY,
    service_id INT NOT NULL,
    category VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (service_id) REFERENCES android_services(id) ON DELETE CASCADE
);

-- Service schemes
CREATE TABLE IF NOT EXISTS service_schemes (
    id SERIAL PRIMARY KEY,
    service_id INT NOT NULL,
    scheme VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (service_id) REFERENCES android_services(id) ON DELETE CASCADE
);


-- Receiver actions
CREATE TABLE IF NOT EXISTS receiver_actions (
    id SERIAL PRIMARY KEY,
    receiver_id INT NOT NULL,
    action VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (receiver_id) REFERENCES android_receivers(id) ON DELETE CASCADE
);

-- Receiver categories
CREATE TABLE IF NOT EXISTS receiver_categories (
    id SERIAL PRIMARY KEY,
    receiver_id INT NOT NULL,
    category VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (receiver_id) REFERENCES android_receivers(id) ON DELETE CASCADE
);

-- Receiver schemes
CREATE TABLE IF NOT EXISTS receiver_schemes (
    id SERIAL PRIMARY KEY,
    receiver_id INT NOT NULL,
    scheme VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (receiver_id) REFERENCES android_receivers(id) ON DELETE CASCADE
);





DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'unique_android_provider'
          AND conrelid = 'android_providers'::regclass
    ) THEN
        ALTER TABLE android_providers
            ADD CONSTRAINT unique_android_provider UNIQUE (android_info_id, provider_name);
    END IF;
END $$;


CREATE TABLE IF NOT EXISTS provider_metadata (
    id SERIAL PRIMARY KEY,
    provider_id INT NOT NULL,
    meta_name VARCHAR(255) NOT NULL,
    meta_resource VARCHAR(255),
    meta_content TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (provider_id) REFERENCES android_providers(id) ON DELETE CASCADE,
    UNIQUE (provider_id, meta_name)
);

CREATE TABLE IF NOT EXISTS apk_details (
    id SERIAL PRIMARY KEY,
    android_info_id INT NOT NULL,
    app_version VARCHAR(255),
    package_name VARCHAR(255) NOT NULL,
    sdk_version VARCHAR(255),
    debuggable BOOLEAN,
    main_activity VARCHAR(255),
    android_user VARCHAR(255),
    recon_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (android_info_id) REFERENCES android_info(id) ON DELETE CASCADE,
    UNIQUE (android_info_id)
);


-- New table for secrets storage
CREATE TABLE IF NOT EXISTS app_secrets (
    id SERIAL PRIMARY KEY,
    android_info_id INT NOT NULL,
    file_path VARCHAR(500),
    secret_type VARCHAR(255) NOT NULL,
    description TEXT,
    redacted_value TEXT NOT NULL,
    raw_value TEXT,
    secret_line INT,
    source_name VARCHAR(255),
    source_type VARCHAR(255),
    detector_type VARCHAR(255),
    decoder_name VARCHAR(255),
    is_verified BOOLEAN DEFAULT FALSE,
    verification_error TEXT,
    verification_cached BOOLEAN DEFAULT FALSE,
    scan_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (android_info_id) REFERENCES android_info(id) ON DELETE CASCADE
);

-- Add an index for faster lookups
CREATE INDEX IF NOT EXISTS idx_apk_details_package_name ON apk_details(package_name);

-- Index for faster lookups based on android_info_id
CREATE INDEX IF NOT EXISTS idx_app_secrets_android_info_id ON app_secrets(android_info_id);






-- iOS App Information
-----------------------

-- Main iOS info table
CREATE TABLE IF NOT EXISTS ios_info (
    id SERIAL PRIMARY KEY,
    app_name VARCHAR(255) NOT NULL,
    bundle_id VARCHAR(255) NOT NULL,
    version VARCHAR(50) NOT NULL,
    developer VARCHAR(255),
    release_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (bundle_id, version)
);

-- iOS source code
CREATE TABLE IF NOT EXISTS ios_source_code (
    id SERIAL PRIMARY KEY,
    ios_info_id INT NOT NULL,
    source_code TEXT NOT NULL,
    repository_type VARCHAR(50),
    branch VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ios_info_id) REFERENCES ios_info(id) ON DELETE CASCADE
);

-- ─────────────────────────────────────────────────────────────────────────────
-- iOS cross-reference index (hash-keyed, built once per binary, cached).
-- See Xref_Index_Redesign.md. Phase 1 populates ios_binary + ios_xref_index
-- (kind='msgsend') + ios_xref_status. ios_function_signature is created now but
-- populated in Phase 2 (function matching / version diffing) — no migration later.
-- ─────────────────────────────────────────────────────────────────────────────

-- Binary identity: content hash -> app + version. Enables version diffing later.
CREATE TABLE IF NOT EXISTS ios_binary (
    binary_hash  TEXT PRIMARY KEY,          -- sha256 of the arm64 Mach-O slice
    filename     TEXT,
    app_id       TEXT,                       -- CFBundleIdentifier
    version      TEXT,                       -- CFBundleShortVersionString
    build        TEXT,                       -- CFBundleVersion
    uploaded_at  TIMESTAMP DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_ios_binary_app ON ios_binary (app_id, version);

-- Cross-reference rows. One row per reference site.
CREATE TABLE IF NOT EXISTS ios_xref_index (
    id                BIGSERIAL PRIMARY KEY,
    binary_hash       TEXT   NOT NULL,
    kind              TEXT   NOT NULL,        -- 'msgsend' | 'call' | 'string' | 'classref'
    target            TEXT   NOT NULL,        -- selector / hex addr / string / class name
    caller_addr       BIGINT NOT NULL,        -- the referencing instruction
    caller_func_start BIGINT NOT NULL,        -- start of the containing function
    caller_func_name  TEXT,                   -- resolved symbol name if known
    receiver_class    TEXT                    -- msgsend only: class if statically known
);
CREATE INDEX IF NOT EXISTS ix_ios_xref_lookup ON ios_xref_index (binary_hash, kind, target);
CREATE INDEX IF NOT EXISTS ix_ios_xref_binary ON ios_xref_index (binary_hash);

-- Per-function signatures for matching/diffing (Phase 2; harmless empty now).
CREATE TABLE IF NOT EXISTS ios_function_signature (
    binary_hash      TEXT   NOT NULL,
    func_start       BIGINT NOT NULL,
    func_name        TEXT,
    normalized_hash  TEXT,                    -- address/register-masked instruction hash
    instr_count      INTEGER,
    calls_out        TEXT,                    -- JSON: imports/selectors it calls
    PRIMARY KEY (binary_hash, func_start)
);
CREATE INDEX IF NOT EXISTS ix_ios_fnsig_hash ON ios_function_signature (binary_hash, normalized_hash);

-- Build gate: "is the index ready?" — the role scan_tasks plays for scans.
CREATE TABLE IF NOT EXISTS ios_xref_status (
    binary_hash  TEXT PRIMARY KEY,
    filename     TEXT,
    state        TEXT NOT NULL DEFAULT 'BUILDING',  -- BUILDING | READY | ERROR
    total_refs   INTEGER DEFAULT 0,
    built_at     TIMESTAMP,
    error        TEXT
);

-- Decompiled pseudocode cache (r2ghidra + selector map). See Pseudocode_Redesign.md.
-- Keyed per function; decompile is fast so v1 fills this lazily on request.
CREATE TABLE IF NOT EXISTS ios_pseudocode (
    binary_hash  TEXT NOT NULL,
    func_start   BIGINT NOT NULL,
    code         TEXT,
    engine       TEXT DEFAULT 'r2ghidra',
    built_at     TIMESTAMP DEFAULT now(),
    PRIMARY KEY (binary_hash, func_start)
);

-- Decompiled Java class -> source-file index (Android).
-- Maps a fully-qualified class name (as *declared* in the produced .java:
-- `package` + top-level type name) to its relative path under
-- /tmp/decompiled/<file_name>/. Makes class->source resolution exact and
-- decompiler-agnostic: JADX and Vineflower emit different trees/paths/names, so
-- resolving by basename is unreliable; resolving by declared FQCN is not.
-- Rebuilt (DELETE + INSERT) on every successful decompile; keyed by file_name.
CREATE TABLE IF NOT EXISTS decompiled_class_index (
    id          BIGSERIAL PRIMARY KEY,
    file_name   TEXT    NOT NULL,        -- uploaded apk key (the /tmp/decompiled/<file_name> dir)
    engine      TEXT    NOT NULL,        -- 'jadx' | 'vineflower'
    fqcn        TEXT    NOT NULL,        -- com.insecureshop.AboutUsActivity
    simple_name TEXT    NOT NULL,        -- AboutUsActivity
    package     TEXT,                    -- com.insecureshop (NULL = default package)
    rel_path    TEXT    NOT NULL         -- sources/com/insecureshop/AboutUsActivity.java
);
CREATE INDEX IF NOT EXISTS ix_class_index_fqcn   ON decompiled_class_index (file_name, fqcn);
CREATE INDEX IF NOT EXISTS ix_class_index_simple ON decompiled_class_index (file_name, simple_name);

-- Task Management
-------------------

CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_type VARCHAR(255) NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(50) NOT NULL,
    progress INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- AppShark Scan Queue Management
-----------------------------------

-- Create scan_status enum type
DO $$ BEGIN
    CREATE TYPE scan_status AS ENUM ('WAITING', 'PROCESSING', 'FINISHED', 'ERROR');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Scan tasks queue table
CREATE TABLE IF NOT EXISTS scan_tasks (
    id SERIAL PRIMARY KEY,
    guid VARCHAR(50) UNIQUE NOT NULL,
    android_info_id INT,
    filename VARCHAR(255) NOT NULL,
    settings JSONB NOT NULL,
    status scan_status NOT NULL DEFAULT 'WAITING',
    celery_task_id VARCHAR(255),
    error_message TEXT,
    is_long_running BOOLEAN NOT NULL DEFAULT FALSE,
    long_running_detected_at TIMESTAMP,
    scan_duration_seconds INT,
    scan_started_at TIMESTAMP,
    scan_completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    FOREIGN KEY (android_info_id) REFERENCES android_info(id) ON DELETE CASCADE
);

-- Index for efficient queue queries
CREATE INDEX IF NOT EXISTS idx_scan_tasks_status ON scan_tasks(status);
CREATE INDEX IF NOT EXISTS idx_scan_tasks_created_at ON scan_tasks(created_at);
CREATE INDEX IF NOT EXISTS idx_scan_tasks_guid ON scan_tasks(guid);
CREATE INDEX IF NOT EXISTS idx_scan_tasks_long_running ON scan_tasks(is_long_running);

-- Keep long-running scan markers in sync at the database level.
CREATE OR REPLACE FUNCTION sync_scan_runtime_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_long_threshold_seconds INT := 1800; -- 30 minutes
    v_elapsed_seconds INT;
BEGIN
    IF NEW.scan_started_at IS NOT NULL THEN
        IF NEW.scan_completed_at IS NOT NULL THEN
            v_elapsed_seconds := GREATEST(
                0,
                EXTRACT(EPOCH FROM (NEW.scan_completed_at - NEW.scan_started_at))::INT
            );
        ELSE
            v_elapsed_seconds := GREATEST(
                0,
                EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - NEW.scan_started_at))::INT
            );
        END IF;

        NEW.scan_duration_seconds := v_elapsed_seconds;

        IF v_elapsed_seconds >= v_long_threshold_seconds THEN
            NEW.is_long_running := TRUE;
            NEW.long_running_detected_at := COALESCE(
                NEW.long_running_detected_at,
                NEW.scan_started_at + (v_long_threshold_seconds || ' seconds')::INTERVAL
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_scan_runtime_fields ON scan_tasks;
CREATE TRIGGER trg_sync_scan_runtime_fields
BEFORE INSERT OR UPDATE ON scan_tasks
FOR EACH ROW
EXECUTE FUNCTION sync_scan_runtime_fields();

-- AppShark Analysis
---------------------

-- AppShark scans
CREATE TABLE IF NOT EXISTS appshark_scans (
    id SERIAL PRIMARY KEY,
    android_info_id INT NOT NULL,
    scan_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    app_info JSONB,
    manifest_risks JSONB,
    is_partial BOOLEAN NOT NULL DEFAULT FALSE,
    scan_task_guid VARCHAR(50),
    FOREIGN KEY (android_info_id) REFERENCES android_info(id) ON DELETE CASCADE
);

-- AppShark security issues
CREATE TABLE IF NOT EXISTS appshark_security_issues (
    id SERIAL PRIMARY KEY,
    appshark_scan_id INT NOT NULL,
    category VARCHAR(255),
    name VARCHAR(255),
    detail TEXT,
    model VARCHAR(50),
    possibility VARCHAR(50),
    wiki TEXT,
    deobf_apk TEXT,
    FOREIGN KEY (appshark_scan_id) REFERENCES appshark_scans(id) ON DELETE CASCADE
);

-- AppShark vulnerabilities
CREATE TABLE IF NOT EXISTS appshark_vulnerabilities (
    id SERIAL PRIMARY KEY,
    security_issue_id INT NOT NULL,
    position TEXT,
    entry_method TEXT,
    sink TEXT[],
    source TEXT[],
    url TEXT,
    target TEXT[],
    manifest JSONB,
    hash VARCHAR(255),
    old_hash VARCHAR(255),
    possibility VARCHAR(50),
    -- How many raw Appshark flows collapsed into this row during ingestion dedup.
    -- Appshark emits one "vulner" per register-alias of the same source->sink flow
    -- (e.g. $r3/$r4/$r9 aliases of one deletePackage call), so a single reportable
    -- bug can appear dozens of times. Ingestion collapses them on
    -- (position, normalized-sink-signature, normalized-source) and records the
    -- collapse count here (1 = unique). Generic across all apps/rules.
    duplicate_count INT DEFAULT 1,
    -- SliceMode attribution recovery: sink class reachable from an exported component
    -- (review signal, not a hard exported claim); exported_via = reaching component FQN.
    exported_reachable BOOLEAN DEFAULT FALSE,
    exported_via TEXT,
    -- Pre-computed component accessibility info (populated at scan time)
    component_name VARCHAR(512),
    component_type VARCHAR(50),
    component_exported BOOLEAN DEFAULT FALSE,
    component_accessible BOOLEAN DEFAULT FALSE,
    component_has_intent_filters BOOLEAN DEFAULT FALSE,
    suppressed BOOLEAN NOT NULL DEFAULT FALSE,
    suppression_note TEXT,
    -- AI triage fields (populated by MCP validate_vulnerability tool)
    ai_verdict VARCHAR(50),
    ai_confidence VARCHAR(20),
    ai_reasoning TEXT,
    ai_reviewed_at TIMESTAMP,
    FOREIGN KEY (security_issue_id) REFERENCES appshark_security_issues(id) ON DELETE CASCADE
);

-- Stored Procedures
---------------------

-- Add Android info
CREATE OR REPLACE PROCEDURE add_android_info(
    IN p_app_name VARCHAR(255),
    IN p_package_name VARCHAR(255),
    IN p_version VARCHAR(50),
    IN p_developer VARCHAR(255),
    IN p_release_date DATE
)
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO android_info (app_name, package_name, version, developer, release_date)
    VALUES (p_app_name, p_package_name, p_version, p_developer, p_release_date)
    ON CONFLICT (package_name, version) DO NOTHING;
END;
$$;


CREATE OR REPLACE PROCEDURE upsert_apk_details(
    IN p_android_info_id INT,
    IN p_app_version VARCHAR(50),
    IN p_package_name VARCHAR(255),
    IN p_sdk_version VARCHAR(50),
    IN p_debuggable BOOLEAN,
    IN p_main_activity VARCHAR(255),
    IN p_android_user VARCHAR(255)
)
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO apk_details (
        android_info_id, app_version, package_name, sdk_version, debuggable, main_activity, android_user
    )
    VALUES (
        p_android_info_id, p_app_version, p_package_name, p_sdk_version, p_debuggable, p_main_activity,p_android_user
    )
    ON CONFLICT (android_info_id)
    DO UPDATE SET
        app_version = EXCLUDED.app_version,
        package_name = EXCLUDED.package_name,
        sdk_version = EXCLUDED.sdk_version,
        debuggable = EXCLUDED.debuggable,
        main_activity = EXCLUDED.main_activity,
        android_user = EXCLUDED.android_user,
        updated_at = CURRENT_TIMESTAMP;
END;
$$;

-- Add Android activity
CREATE OR REPLACE PROCEDURE add_android_activity(
    IN p_android_info_id INT,
    IN p_activity_name VARCHAR(255),
    IN p_activity_exported BOOLEAN,
    IN p_activity_permission VARCHAR(255)
)
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO android_activities (android_info_id, activity_name, activity_exported, activity_permission)
    VALUES (p_android_info_id, p_activity_name, p_activity_exported, p_activity_permission);
END;
$$;

-- Add activity action
CREATE OR REPLACE PROCEDURE add_activity_action(
    IN p_activity_id INT,
    IN p_action VARCHAR(255)
)
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO activity_actions (activity_id, action)
    VALUES (p_activity_id, p_action);
END;
$$;

-- Add activity category
CREATE OR REPLACE PROCEDURE add_activity_category(
    IN p_activity_id INT,
    IN p_category VARCHAR(255)
)
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO activity_categories (activity_id, category)
    VALUES (p_activity_id, p_category);
END;
$$;

-- Add activity scheme
CREATE OR REPLACE PROCEDURE add_activity_scheme(
    IN p_activity_id INT,
    IN p_scheme VARCHAR(255)
)
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO activity_schemes (activity_id, scheme)
    VALUES (p_activity_id, p_scheme);
END;
$$;

-- Add activity intent filter
CREATE OR REPLACE PROCEDURE add_activity_intent_filter(
    IN p_activity_id INT,
    IN p_intent_action VARCHAR(255),
    IN p_intent_category VARCHAR(255),
    IN p_intent_data_scheme VARCHAR(255)
)
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO activity_intent_filters (activity_id, intent_action, intent_category, intent_data_scheme)
    VALUES (p_activity_id, p_intent_action, p_intent_category, p_intent_data_scheme);
END;
$$;

-- Add Android service
CREATE OR REPLACE PROCEDURE add_android_service(
    IN p_android_info_id INT,
    IN p_service_name VARCHAR(255),
    IN p_service_exported BOOLEAN,
    IN p_service_permission VARCHAR(255)
)
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO android_services (android_info_id, service_name, service_exported, service_permission)
    VALUES (p_android_info_id, p_service_name, p_service_exported, p_service_permission);
END;
$$;

-- Add Android receiver
CREATE OR REPLACE PROCEDURE add_android_receiver(
    IN p_android_info_id INT,
    IN p_receiver_name VARCHAR(255),
    IN p_receiver_exported BOOLEAN,
    IN p_receiver_permission VARCHAR(255)
)
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO android_receivers (android_info_id, receiver_name, receiver_exported, receiver_permission)
    VALUES (p_android_info_id, p_receiver_name, p_receiver_exported, p_receiver_permission);
END;
$$;

-- Add Android provider
CREATE OR REPLACE PROCEDURE add_android_provider(
    IN p_android_info_id INT,
    IN p_provider_name VARCHAR(255),
    IN p_provider_exported BOOLEAN,
    IN p_provider_permission VARCHAR(255),
    IN p_grant_uri_permissions BOOLEAN,
    IN p_authorities TEXT,
    IN p_read_permission VARCHAR(255),
    IN p_write_permission VARCHAR(255),
    OUT provider_id INT
)
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO android_providers (
        android_info_id, provider_name, provider_exported, provider_permission,
        grant_uri_permissions, authorities, read_permission, write_permission
    )
    VALUES (
        p_android_info_id, p_provider_name, p_provider_exported, p_provider_permission,
        p_grant_uri_permissions, p_authorities, p_read_permission, p_write_permission
    )
    ON CONFLICT (android_info_id, provider_name)
    DO UPDATE SET
        provider_exported = EXCLUDED.provider_exported,
        provider_permission = EXCLUDED.provider_permission,
        grant_uri_permissions = EXCLUDED.grant_uri_permissions,
        authorities = EXCLUDED.authorities,
        read_permission = EXCLUDED.read_permission,
        write_permission = EXCLUDED.write_permission,
        updated_at = CURRENT_TIMESTAMP
    RETURNING id INTO provider_id;
END;
$$;


-- Stored procedure to add a new secret
CREATE OR REPLACE PROCEDURE add_app_secret(
    IN p_android_info_id INT,
    IN p_file_path VARCHAR(500),
    IN p_secret_type VARCHAR(255),
    IN p_description TEXT,
    IN p_redacted_value TEXT,
    IN p_raw_value TEXT,
    IN p_secret_line INT,
    IN p_source_name VARCHAR(255),
    IN p_source_type VARCHAR(255),
    IN p_detector_type VARCHAR(255),
    IN p_decoder_name VARCHAR(255),
    IN p_is_verified BOOLEAN,
    IN p_verification_error TEXT,
    IN p_verification_cached BOOLEAN
)
LANGUAGE plpgsql
AS $$
BEGIN
    -- Check if the secret already exists to avoid duplication
    IF NOT EXISTS (
        SELECT 1 FROM app_secrets
        WHERE android_info_id = p_android_info_id
        AND redacted_value = p_redacted_value
        AND file_path = p_file_path
    ) THEN
        INSERT INTO app_secrets (
            android_info_id, file_path, secret_type, description,
            redacted_value, raw_value, secret_line, source_name,
            source_type, detector_type, decoder_name, is_verified,
            verification_error, verification_cached
        )
        VALUES (
            p_android_info_id, p_file_path, p_secret_type, p_description,
            p_redacted_value, p_raw_value, p_secret_line, p_source_name,
            p_source_type, p_detector_type, p_decoder_name, p_is_verified,
            p_verification_error, p_verification_cached
        );
    ELSE
        -- Update the existing record with latest scan data
        UPDATE app_secrets
        SET
            secret_type = p_secret_type,
            description = p_description,
            raw_value = p_raw_value,
            secret_line = p_secret_line,
            source_name = p_source_name,
            source_type = p_source_type,
            detector_type = p_detector_type,
            decoder_name = p_decoder_name,
            is_verified = p_is_verified,
            verification_error = p_verification_error,
            verification_cached = p_verification_cached,
            scan_date = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE
            android_info_id = p_android_info_id
            AND redacted_value = p_redacted_value
            AND file_path = p_file_path;
    END IF;
END;
$$;


-- Add a procedure for adding provider metadata
-- Update the add_provider_metadata procedure
CREATE OR REPLACE PROCEDURE add_provider_metadata(
    IN p_provider_id INT,
    IN p_meta_name VARCHAR(255),
    IN p_meta_resource VARCHAR(255),
    IN p_meta_content TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
    IF p_provider_id IS NOT NULL THEN
        INSERT INTO provider_metadata (provider_id, meta_name, meta_resource, meta_content)
        VALUES (p_provider_id, p_meta_name, p_meta_resource, p_meta_content)
        ON CONFLICT (provider_id, meta_name)
        DO UPDATE SET
            meta_resource = p_meta_resource,
            meta_content = p_meta_content,
            updated_at = CURRENT_TIMESTAMP;
    ELSE
        RAISE NOTICE 'Skipping metadata insertion due to NULL provider_id';
    END IF;
END;
$$;

-- Add service action
CREATE OR REPLACE PROCEDURE add_service_action(
    IN p_service_id INT,
    IN p_action VARCHAR(255)
)
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO service_actions (service_id, action)
    VALUES (p_service_id, p_action);
END;
$$;

-- Add service category
CREATE OR REPLACE PROCEDURE add_service_category(
    IN p_service_id INT,
    IN p_category VARCHAR(255)
)
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO service_categories (service_id, category)
    VALUES (p_service_id, p_category);
END;
$$;

-- Add service scheme
CREATE OR REPLACE PROCEDURE add_service_scheme(
    IN p_service_id INT,
    IN p_scheme VARCHAR(255)
)
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO service_schemes (service_id, scheme)
    VALUES (p_service_id, p_scheme);
END;
$$;

-- Add Android source code
CREATE OR REPLACE PROCEDURE add_android_source_code(
    IN p_android_info_id INT,
    IN p_source_code TEXT,
    IN p_repository_type VARCHAR(50),
    IN p_branch VARCHAR(50)
)
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO android_source_code (android_info_id, source_code, repository_type, branch)
    VALUES (p_android_info_id, p_source_code, p_repository_type, p_branch);
END;
$$;

-- Add receiver action
CREATE OR REPLACE PROCEDURE add_receiver_action(
    IN p_receiver_id INT,
    IN p_action VARCHAR(255)
)
LANGUAGE plpgsql
AS $$
BEGIN
    IF p_action IS NOT NULL THEN
        INSERT INTO receiver_actions (receiver_id, action)
        VALUES (p_receiver_id, p_action);
    END IF;
END;
$$;

CREATE OR REPLACE PROCEDURE add_receiver_category(
    IN p_receiver_id INT,
    IN p_category VARCHAR(255)
)
LANGUAGE plpgsql
AS $$
BEGIN
    IF p_category IS NOT NULL THEN
        INSERT INTO receiver_categories (receiver_id, category)
        VALUES (p_receiver_id, p_category);
    END IF;
END;
$$;

-- Add receiver scheme
CREATE OR REPLACE PROCEDURE add_receiver_scheme(
    IN p_receiver_id INT,
    IN p_scheme VARCHAR(255)
)
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO receiver_schemes (receiver_id, scheme)
    VALUES (p_receiver_id, p_scheme);
END;
$$;

-- Add iOS info
CREATE OR REPLACE PROCEDURE add_ios_info(
    IN p_app_name VARCHAR(255),
    IN p_bundle_id VARCHAR(255),
    IN p_version VARCHAR(50),
    IN p_developer VARCHAR(255),
    IN p_release_date DATE
)
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO ios_info (app_name, bundle_id, version, developer, release_date)
    VALUES (p_app_name, p_bundle_id, p_version, p_developer, p_release_date)
    ON CONFLICT (bundle_id, version) DO NOTHING;
END;
$$;

-- Add iOS source code
CREATE OR REPLACE PROCEDURE add_ios_source_code(
    IN p_ios_info_id INT,
    IN p_source_code TEXT,
    IN p_repository_type VARCHAR(50),
    IN p_branch VARCHAR(50)
)
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO ios_source_code (ios_info_id, source_code, repository_type, branch)
    VALUES (p_ios_info_id, p_source_code, p_repository_type, p_branch);
END;
$$;

-- Add AppShark scan
CREATE OR REPLACE PROCEDURE add_appshark_scan(
    IN p_android_info_id INT,
    IN p_app_info JSONB,
    IN p_manifest_risks JSONB,
    OUT scan_id INT,
    IN p_is_partial BOOLEAN DEFAULT FALSE,
    IN p_scan_task_guid VARCHAR(50) DEFAULT NULL
)
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO appshark_scans (android_info_id, app_info, manifest_risks, is_partial, scan_task_guid)
    VALUES (p_android_info_id, p_app_info, p_manifest_risks, p_is_partial, p_scan_task_guid)
    RETURNING id INTO scan_id;
END;
$$;

-- Add AppShark vulnerability (continued)
CREATE OR REPLACE PROCEDURE add_appshark_vulnerability(
    IN p_security_issue_id INT,
    IN p_position TEXT,
    IN p_entry_method TEXT,
    IN p_sink TEXT[],
    IN p_source TEXT[],
    IN p_url TEXT,
    IN p_target TEXT[],
    IN p_manifest JSONB,
    IN p_hash VARCHAR(255),
    IN p_old_hash VARCHAR(255),
    IN p_possibility VARCHAR(50)
)
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO appshark_vulnerabilities (
        security_issue_id, position, entry_method, sink, source, url,
        target, manifest, hash, old_hash, possibility
    )
    VALUES (
        p_security_issue_id, p_position, p_entry_method, p_sink, p_source, p_url,
        p_target, p_manifest, p_hash, p_old_hash, p_possibility
    );
END;
$$;

-- Add task
CREATE OR REPLACE PROCEDURE add_task(
    IN p_task_type VARCHAR(255),
    IN p_payload JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO tasks (task_type, payload, status)
    VALUES (p_task_type, p_payload, 'PENDING');
END;
$$;

-- Scan Queue Management Procedures
-------------------------------------

-- Create a new scan task
CREATE OR REPLACE FUNCTION create_scan_task(
    IN p_guid VARCHAR(50),
    IN p_filename VARCHAR(255),
    IN p_settings JSONB,
    IN p_android_info_id INT DEFAULT NULL,
    OUT task_id INT,
    OUT should_start BOOLEAN
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_processing_count INT;
BEGIN
    -- Insert the new scan task with optional android_info_id
    INSERT INTO scan_tasks (guid, filename, settings, status, android_info_id)
    VALUES (p_guid, p_filename, p_settings, 'WAITING', p_android_info_id)
    RETURNING id INTO task_id;

    -- Check if there are any scans currently processing
    SELECT COUNT(*) INTO v_processing_count
    FROM scan_tasks
    WHERE status = 'PROCESSING';

    -- If no scans are processing, this task should start immediately
    should_start := (v_processing_count = 0);

    -- If should start, update status to PROCESSING
    IF should_start THEN
        UPDATE scan_tasks
        SET status = 'PROCESSING',
            scan_started_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = task_id;
    END IF;
END;
$$;

-- Get the next waiting scan task and mark it as processing
CREATE OR REPLACE FUNCTION get_next_scan_task(
    OUT task_id INT,
    OUT task_guid VARCHAR(50),
    OUT task_filename VARCHAR(255),
    OUT task_settings JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
    -- Find the oldest waiting task and lock it
    SELECT id, guid, filename, settings
    INTO task_id, task_guid, task_filename, task_settings
    FROM scan_tasks
    WHERE status = 'WAITING'
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    -- If a task was found, update its status to PROCESSING
    IF task_id IS NOT NULL THEN
        UPDATE scan_tasks
        SET status = 'PROCESSING',
            scan_started_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = task_id;
    END IF;
END;
$$;

-- Update scan task status
CREATE OR REPLACE PROCEDURE update_scan_task_status(
    IN p_guid VARCHAR(50),
    IN p_status VARCHAR(20),
    IN p_celery_task_id VARCHAR(255) DEFAULT NULL,
    IN p_error_message TEXT DEFAULT NULL
)
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE scan_tasks
    SET status = p_status::scan_status,
        celery_task_id = COALESCE(p_celery_task_id, celery_task_id),
        error_message = p_error_message,
        scan_completed_at = CASE WHEN p_status IN ('FINISHED', 'ERROR') THEN CURRENT_TIMESTAMP ELSE scan_completed_at END,
        updated_at = CURRENT_TIMESTAMP
    WHERE guid = p_guid;
END;
$$;

-- Get count of processing scans
CREATE OR REPLACE FUNCTION get_processing_scan_count()
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
    v_count INT;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM scan_tasks
    WHERE status = 'PROCESSING';

    RETURN v_count;
END;
$$;

-- Indexes
-----------

-- Add indexes to improve query performance
CREATE INDEX IF NOT EXISTS idx_android_info_package_version ON android_info(package_name, version);
CREATE INDEX IF NOT EXISTS idx_ios_info_bundle_version ON ios_info(bundle_id, version);
CREATE INDEX IF NOT EXISTS idx_appshark_scans_android_info_id ON appshark_scans(android_info_id);
CREATE INDEX IF NOT EXISTS idx_appshark_security_issues_scan_id ON appshark_security_issues(appshark_scan_id);
CREATE INDEX IF NOT EXISTS idx_appshark_vulnerabilities_security_issue_id ON appshark_vulnerabilities(security_issue_id);
CREATE INDEX IF NOT EXISTS idx_vuln_component_exported ON appshark_vulnerabilities(component_exported);
CREATE INDEX IF NOT EXISTS idx_vuln_component_accessible ON appshark_vulnerabilities(component_accessible);

-- Performance indexes: FK and filter columns that were filtered on hot paths
-- (component lookups, scan status polling, results resolution) but unindexed.
CREATE INDEX IF NOT EXISTS idx_android_info_app_name ON android_info(app_name);
CREATE INDEX IF NOT EXISTS idx_android_activities_info_id ON android_activities(android_info_id);
CREATE INDEX IF NOT EXISTS idx_android_services_info_id ON android_services(android_info_id);
CREATE INDEX IF NOT EXISTS idx_android_receivers_info_id ON android_receivers(android_info_id);
CREATE INDEX IF NOT EXISTS idx_android_providers_info_id ON android_providers(android_info_id);
CREATE INDEX IF NOT EXISTS idx_android_activities_name ON android_activities(activity_name);
CREATE INDEX IF NOT EXISTS idx_android_services_name ON android_services(service_name);
CREATE INDEX IF NOT EXISTS idx_android_receivers_name ON android_receivers(receiver_name);
CREATE INDEX IF NOT EXISTS idx_android_providers_name ON android_providers(provider_name);
CREATE INDEX IF NOT EXISTS idx_scan_tasks_filename ON scan_tasks(filename);
CREATE INDEX IF NOT EXISTS idx_scan_tasks_celery_task_id ON scan_tasks(celery_task_id);
CREATE INDEX IF NOT EXISTS idx_appshark_scans_scan_task_guid ON appshark_scans(scan_task_guid);

-- Child-side foreign keys on the manifest-component tables.
--
-- The parent side (android_activities.android_info_id etc.) was indexed above,
-- but the child side never was, so every intent-filter / action / category /
-- scheme lookup was a sequential scan. Two hot paths depend on these:
--
--   1. Component endpoints load these collections with selectinload, which
--      emits `WHERE <parent>_id IN (...)` per relationship. Unindexed, that is
--      a full scan of each child table per request.
--   2. All of these FKs are ON DELETE CASCADE. Postgres does NOT auto-index the
--      referencing side, so deleting an app scans every child table to find
--      rows to cascade.
--
-- NOTE: indexes are not what fixed the Activities endpoint hanging — that was a
-- cartesian product from stacking four joinedload()s on collections in one
-- query (Galaxy Store's launcher activity produced ~1.76M rows and the process
-- was OOM-killed). The ORM fix is selectinload in api/audit/endpoints.py; these
-- indexes are what make that fix scale.
CREATE INDEX IF NOT EXISTS idx_activity_actions_activity_id ON activity_actions(activity_id);
CREATE INDEX IF NOT EXISTS idx_activity_categories_activity_id ON activity_categories(activity_id);
CREATE INDEX IF NOT EXISTS idx_activity_schemes_activity_id ON activity_schemes(activity_id);
CREATE INDEX IF NOT EXISTS idx_activity_intent_filters_activity_id ON activity_intent_filters(activity_id);

CREATE INDEX IF NOT EXISTS idx_service_actions_service_id ON service_actions(service_id);
CREATE INDEX IF NOT EXISTS idx_service_categories_service_id ON service_categories(service_id);
CREATE INDEX IF NOT EXISTS idx_service_schemes_service_id ON service_schemes(service_id);

CREATE INDEX IF NOT EXISTS idx_receiver_actions_receiver_id ON receiver_actions(receiver_id);
CREATE INDEX IF NOT EXISTS idx_receiver_categories_receiver_id ON receiver_categories(receiver_id);
CREATE INDEX IF NOT EXISTS idx_receiver_schemes_receiver_id ON receiver_schemes(receiver_id);

CREATE INDEX IF NOT EXISTS idx_provider_actions_provider_id ON provider_actions(provider_id);
CREATE INDEX IF NOT EXISTS idx_provider_categories_provider_id ON provider_categories(provider_id);
CREATE INDEX IF NOT EXISTS idx_provider_schemes_provider_id ON provider_schemes(provider_id);

-- Remaining unindexed FKs on the same principle (cascade deletes + joins).
CREATE INDEX IF NOT EXISTS idx_android_source_code_info_id ON android_source_code(android_info_id);
CREATE INDEX IF NOT EXISTS idx_ios_source_code_info_id ON ios_source_code(ios_info_id);
CREATE INDEX IF NOT EXISTS idx_scan_tasks_android_info_id ON scan_tasks(android_info_id);

-- Views
---------

-- Create a view to easily get the latest scan for each Android app
CREATE OR REPLACE VIEW latest_android_scans AS
SELECT DISTINCT ON (ai.id)
    ai.id AS android_info_id,
    ai.app_name,
    ai.package_name,
    ai.version,
    aps.id AS scan_id,
    aps.scan_date
FROM
    android_info ai
LEFT JOIN
    appshark_scans aps ON ai.id = aps.android_info_id
ORDER BY
    ai.id, aps.scan_date DESC;

-- Create a view to get a summary of vulnerabilities for each app
CREATE OR REPLACE VIEW app_vulnerability_summary AS
SELECT
    ai.id AS android_info_id,
    ai.app_name,
    ai.package_name,
    ai.version,
    COUNT(DISTINCT aps.id) AS scan_count,
    COUNT(DISTINCT asi.id) AS security_issue_count,
    COUNT(DISTINCT av.id) AS vulnerability_count
FROM
    android_info ai
LEFT JOIN
    appshark_scans aps ON ai.id = aps.android_info_id
LEFT JOIN
    appshark_security_issues asi ON aps.id = asi.appshark_scan_id
LEFT JOIN
    appshark_vulnerabilities av ON asi.id = av.security_issue_id
GROUP BY
    ai.id, ai.app_name, ai.package_name, ai.version;


-- Create a view to easily get all secrets for a specific package/app
CREATE OR REPLACE VIEW app_secrets_view AS
SELECT
    s.id,
    ai.package_name,
    ai.app_name,
    ai.version,
    s.file_path,
    s.secret_type,
    s.description,
    s.redacted_value,
    s.raw_value,
    s.secret_line,
    s.source_name,
    s.detector_type,
    s.is_verified,
    s.scan_date
FROM
    app_secrets s
JOIN
    android_info ai ON s.android_info_id = ai.id
ORDER BY
    s.scan_date DESC;

REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON DATABASE leviathan_db FROM PUBLIC;

-- Comments
------------

COMMENT ON DATABASE leviathan_db IS 'Database for the Leviathan project, storing information about Android and iOS applications, including security scan results.';

COMMENT ON TABLE users IS 'Stores user accounts for authentication.';
COMMENT ON TABLE android_info IS 'Main table for Android application information.';
COMMENT ON TABLE ios_info IS 'Main table for iOS application information.';
COMMENT ON TABLE appshark_scans IS 'Stores information about AppShark scans performed on Android applications.';
COMMENT ON TABLE appshark_security_issues IS 'Stores security issues identified by AppShark scans.';
COMMENT ON TABLE appshark_vulnerabilities IS 'Stores detailed vulnerability information related to security issues.';

-- Add comments to other tables and columns as needed

-- Maintenance
---------------

-- Add a function to clean up old data (adjust the interval as needed)
CREATE OR REPLACE FUNCTION cleanup_old_data() RETURNS void AS $$
BEGIN
    DELETE FROM appshark_scans WHERE scan_date < NOW() - INTERVAL '1 year';
    DELETE FROM tasks WHERE created_at < NOW() - INTERVAL '6 months' AND status = 'COMPLETED';
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job to run the cleanup function (requires pg_cron extension)
-- Uncomment the following lines if you want to use pg_cron for scheduled cleanup
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
-- SELECT cron.schedule('0 2 * * 0', 'SELECT cleanup_old_data()');

-- End of schema