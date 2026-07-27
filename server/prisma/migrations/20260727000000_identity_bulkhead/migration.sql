-- Generated from server/prisma/schema.prisma with Prisma 5.3.1.
-- Do not apply until the live catalog collision and restore audit is complete.
-- This initial migration creates a new cp_identity_* namespace. It does not
-- alter or backfill an existing identity table. If a prefixed table already
-- exists, stop and reconcile ownership instead of modifying this migration.

CREATE TYPE "cp_identity_user_status" AS ENUM ('ACTIVE', 'SUSPENDED', 'DISABLED');
CREATE TYPE "cp_identity_membership_status" AS ENUM ('ACTIVE', 'SUSPENDED');
CREATE TYPE "cp_identity_invite_status" AS ENUM ('PENDING', 'CLAIMED', 'REVOKED', 'EXPIRED');
CREATE TYPE "cp_identity_billing_status" AS ENUM ('UNCONFIGURED', 'TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED');

CREATE TABLE "cp_identity_users" (
    "id" UUID NOT NULL,
    "username" VARCHAR(64) NOT NULL,
    "auth_provider" VARCHAR(32) NOT NULL,
    "provider_subject" VARCHAR(160) NOT NULL,
    "email" VARCHAR(320),
    "display_name" VARCHAR(120),
    "password_hash" VARCHAR(255),
    "status" "cp_identity_user_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "cp_identity_users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cp_identity_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(128) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "last_seen_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cp_identity_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cp_identity_api_keys" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "workspace_id" UUID,
    "name" VARCHAR(120),
    "key_prefix" VARCHAR(16) NOT NULL,
    "key_hash" VARCHAR(128) NOT NULL,
    "scopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "expires_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "last_used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cp_identity_api_keys_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cp_identity_workspaces" (
    "id" UUID NOT NULL,
    "tenant" VARCHAR(160) NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "scope_ref" VARCHAR(255) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "cp_identity_workspaces_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cp_identity_workspace_memberships" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "status" "cp_identity_membership_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "cp_identity_workspace_memberships_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cp_identity_roles" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "key" VARCHAR(64) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "permissions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "cp_identity_roles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cp_identity_invites" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,
    "claimed_by_id" UUID,
    "token_hash" VARCHAR(128) NOT NULL,
    "email" VARCHAR(320),
    "status" "cp_identity_invite_status" NOT NULL DEFAULT 'PENDING',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "claimed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cp_identity_invites_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cp_identity_billing_accounts" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "provider" VARCHAR(40),
    "provider_customer_id" VARCHAR(160),
    "provider_subscription_id" VARCHAR(160),
    "product_code" VARCHAR(120),
    "status" "cp_identity_billing_status" NOT NULL DEFAULT 'UNCONFIGURED',
    "seat_limit" INTEGER,
    "current_period_ends_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "cp_identity_billing_accounts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cp_identity_users_username_key" ON "cp_identity_users"("username");
CREATE UNIQUE INDEX "cp_identity_users_provider_subject_key" ON "cp_identity_users"("provider_subject");
CREATE UNIQUE INDEX "cp_identity_users_email_key" ON "cp_identity_users"("email");
CREATE UNIQUE INDEX "cp_identity_sessions_token_hash_key" ON "cp_identity_sessions"("token_hash");
CREATE INDEX "cp_identity_sessions_user_id_expires_at_idx" ON "cp_identity_sessions"("user_id", "expires_at");
CREATE UNIQUE INDEX "cp_identity_api_keys_key_hash_key" ON "cp_identity_api_keys"("key_hash");
CREATE INDEX "cp_identity_api_keys_user_id_idx" ON "cp_identity_api_keys"("user_id");
CREATE INDEX "cp_identity_api_keys_workspace_id_idx" ON "cp_identity_api_keys"("workspace_id");
CREATE INDEX "cp_identity_api_keys_key_prefix_idx" ON "cp_identity_api_keys"("key_prefix");
CREATE UNIQUE INDEX "cp_identity_workspaces_scope_ref_key" ON "cp_identity_workspaces"("scope_ref");
CREATE INDEX "cp_identity_workspaces_tenant_idx" ON "cp_identity_workspaces"("tenant");
CREATE UNIQUE INDEX "cp_identity_workspaces_tenant_slug_key" ON "cp_identity_workspaces"("tenant", "slug");
CREATE INDEX "cp_identity_workspace_memberships_user_id_status_idx" ON "cp_identity_workspace_memberships"("user_id", "status");
CREATE INDEX "cp_identity_workspace_memberships_role_id_idx" ON "cp_identity_workspace_memberships"("role_id");
CREATE UNIQUE INDEX "cp_identity_workspace_memberships_workspace_id_user_id_key" ON "cp_identity_workspace_memberships"("workspace_id", "user_id");
CREATE UNIQUE INDEX "cp_identity_roles_id_workspace_id_key" ON "cp_identity_roles"("id", "workspace_id");
CREATE UNIQUE INDEX "cp_identity_roles_workspace_id_key_key" ON "cp_identity_roles"("workspace_id", "key");
CREATE UNIQUE INDEX "cp_identity_invites_token_hash_key" ON "cp_identity_invites"("token_hash");
CREATE INDEX "cp_identity_invites_workspace_id_status_idx" ON "cp_identity_invites"("workspace_id", "status");
CREATE INDEX "cp_identity_invites_created_by_id_idx" ON "cp_identity_invites"("created_by_id");
CREATE INDEX "cp_identity_invites_claimed_by_id_idx" ON "cp_identity_invites"("claimed_by_id");
CREATE UNIQUE INDEX "cp_identity_billing_accounts_workspace_id_key" ON "cp_identity_billing_accounts"("workspace_id");
CREATE UNIQUE INDEX "cp_identity_billing_accounts_provider_customer_id_key" ON "cp_identity_billing_accounts"("provider_customer_id");
CREATE UNIQUE INDEX "cp_identity_billing_accounts_provider_subscription_id_key" ON "cp_identity_billing_accounts"("provider_subscription_id");

ALTER TABLE "cp_identity_sessions"
    ADD CONSTRAINT "cp_identity_sessions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "cp_identity_users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cp_identity_api_keys"
    ADD CONSTRAINT "cp_identity_api_keys_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "cp_identity_users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cp_identity_api_keys"
    ADD CONSTRAINT "cp_identity_api_keys_workspace_id_fkey"
    FOREIGN KEY ("workspace_id") REFERENCES "cp_identity_workspaces"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cp_identity_workspace_memberships"
    ADD CONSTRAINT "cp_identity_workspace_memberships_workspace_id_fkey"
    FOREIGN KEY ("workspace_id") REFERENCES "cp_identity_workspaces"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cp_identity_workspace_memberships"
    ADD CONSTRAINT "cp_identity_workspace_memberships_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "cp_identity_users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cp_identity_workspace_memberships"
    ADD CONSTRAINT "cp_identity_workspace_memberships_role_id_workspace_id_fkey"
    FOREIGN KEY ("role_id", "workspace_id")
    REFERENCES "cp_identity_roles"("id", "workspace_id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cp_identity_roles"
    ADD CONSTRAINT "cp_identity_roles_workspace_id_fkey"
    FOREIGN KEY ("workspace_id") REFERENCES "cp_identity_workspaces"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cp_identity_invites"
    ADD CONSTRAINT "cp_identity_invites_workspace_id_fkey"
    FOREIGN KEY ("workspace_id") REFERENCES "cp_identity_workspaces"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cp_identity_invites"
    ADD CONSTRAINT "cp_identity_invites_role_id_workspace_id_fkey"
    FOREIGN KEY ("role_id", "workspace_id")
    REFERENCES "cp_identity_roles"("id", "workspace_id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cp_identity_invites"
    ADD CONSTRAINT "cp_identity_invites_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "cp_identity_users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cp_identity_invites"
    ADD CONSTRAINT "cp_identity_invites_claimed_by_id_fkey"
    FOREIGN KEY ("claimed_by_id") REFERENCES "cp_identity_users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "cp_identity_billing_accounts"
    ADD CONSTRAINT "cp_identity_billing_accounts_workspace_id_fkey"
    FOREIGN KEY ("workspace_id") REFERENCES "cp_identity_workspaces"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
