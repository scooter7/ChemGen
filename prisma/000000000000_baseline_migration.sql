-- Ensure pgvector extension is enabled in the public schema first:
-- CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;

-- CreateEnum IF NOT EXISTS for ProcessingStatus
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ProcessingStatus' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')) THEN
        CREATE TYPE "public"."ProcessingStatus" AS ENUM ('UPLOADED', 'PROCESSING', 'INDEXED', 'FAILED');
    END IF;
END$$;

-- CreateTable Institution
CREATE TABLE IF NOT EXISTS "public"."Institution" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "emailDomains" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Institution_pkey" PRIMARY KEY ("id")
);

-- CreateTable BrandArchetype
CREATE TABLE IF NOT EXISTS "public"."BrandArchetype" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL, -- This will be constrained later
    "name" TEXT NOT NULL,
    "description" TEXT,
    "keywords" TEXT,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BrandArchetype_pkey" PRIMARY KEY ("id")
);

-- CreateTable User
CREATE TABLE IF NOT EXISTS "public"."User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "hashedPassword" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    -- "institutionId" TEXT, -- Column will be added by ALTER TABLE if it doesn't exist
    "department" TEXT,
    "title" TEXT,
    "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "recruitmentRegion" TEXT,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- Ensure "institutionId" column exists on "User" table before adding FK
ALTER TABLE "public"."User"
ADD COLUMN IF NOT EXISTS "institutionId" TEXT;

-- CreateTable Account
CREATE TABLE IF NOT EXISTS "public"."Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL, -- This will be constrained later
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable Session
CREATE TABLE IF NOT EXISTS "public"."Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL, -- This will be constrained later
    "expires" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable VerificationToken
CREATE TABLE IF NOT EXISTS "public"."VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable ContentGeneration
CREATE TABLE IF NOT EXISTS "public"."ContentGeneration" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL, -- This will be constrained later
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "promptText" TEXT NOT NULL,
    "audience" TEXT,
    "mediaType" TEXT,
    "textCountTarget" INTEGER,
    "textCountUnit" TEXT,
    "archetypesConfig" JSONB,
    "sourceMaterialIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "generatedSubject" TEXT,
    "generatedHeader" TEXT,
    "generatedBodyHtml" TEXT,
    "generatedBodyText" TEXT,
    "justification" TEXT,
    "parentGenerationId" TEXT, -- This will be constrained later
    CONSTRAINT "ContentGeneration_pkey" PRIMARY KEY ("id")
);

-- CreateTable SourceMaterial
CREATE TABLE IF NOT EXISTS "public"."SourceMaterial" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL, -- This will be constrained later
    "fileName" TEXT NOT NULL,
    "fileType" TEXT,
    "storagePath" TEXT NOT NULL,
    "description" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fileSize" INTEGER,
    "status" "public"."ProcessingStatus" NOT NULL DEFAULT 'UPLOADED',
    "processedAt" TIMESTAMP(3),
    CONSTRAINT "SourceMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable DocumentChunk
CREATE TABLE IF NOT EXISTS "public"."DocumentChunk" (
    "id" TEXT NOT NULL,
    "sourceMaterialId" TEXT NOT NULL, -- This will be constrained later
    "content" TEXT NOT NULL,
    "embedding" public.vector(768),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable ImageResource
CREATE TABLE IF NOT EXISTS "public"."ImageResource" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL, -- This will be constrained later
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "publicUrl" TEXT,
    "aiGeneratedDescription" TEXT,
    "embedding" public.vector(768),
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "fileSize" INTEGER,
    CONSTRAINT "ImageResource_pkey" PRIMARY KEY ("id")
);

-- Create Indexes (IF NOT EXISTS)
CREATE UNIQUE INDEX IF NOT EXISTS "Institution_name_key" ON "public"."Institution"("name");
CREATE INDEX IF NOT EXISTS "BrandArchetype_institutionId_idx" ON "public"."BrandArchetype"("institutionId");
CREATE UNIQUE INDEX IF NOT EXISTS "BrandArchetype_institutionId_name_key" ON "public"."BrandArchetype"("institutionId", "name");
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "public"."User"("email");
CREATE INDEX IF NOT EXISTS "User_institutionId_idx" ON "public"."User"("institutionId");
CREATE UNIQUE INDEX IF NOT EXISTS "Account_provider_providerAccountId_key" ON "public"."Account"("provider", "providerAccountId");
CREATE INDEX IF NOT EXISTS "Account_userId_idx" ON "public"."Account"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "Session_sessionToken_key" ON "public"."Session"("sessionToken");
CREATE INDEX IF NOT EXISTS "Session_userId_idx" ON "public"."Session"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "VerificationToken_token_key" ON "public"."VerificationToken"("token");
CREATE UNIQUE INDEX IF NOT EXISTS "VerificationToken_identifier_token_key" ON "public"."VerificationToken"("identifier", "token");
CREATE INDEX IF NOT EXISTS "ContentGeneration_userId_idx" ON "public"."ContentGeneration"("userId");
CREATE INDEX IF NOT EXISTS "ContentGeneration_parentGenerationId_idx" ON "public"."ContentGeneration"("parentGenerationId");
CREATE INDEX IF NOT EXISTS "SourceMaterial_userId_idx" ON "public"."SourceMaterial"("userId");
CREATE INDEX IF NOT EXISTS "DocumentChunk_sourceMaterialId_idx" ON "public"."DocumentChunk"("sourceMaterialId");
CREATE INDEX IF NOT EXISTS "ImageResource_userId_idx" ON "public"."ImageResource"("userId");

-- Add Foreign Key Constraints (using DO $$ blocks for idempotency)
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BrandArchetype_institutionId_fkey' AND conrelid = 'public."BrandArchetype"'::regclass) THEN ALTER TABLE "public"."BrandArchetype" ADD CONSTRAINT "BrandArchetype_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "public"."Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Table for BrandArchetype_institutionId_fkey does not exist, skipping.'; WHEN duplicate_object THEN RAISE NOTICE 'Constraint BrandArchetype_institutionId_fkey already exists, skipping.'; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'User_institutionId_fkey' AND conrelid = 'public."User"'::regclass) THEN ALTER TABLE "public"."User" ADD CONSTRAINT "User_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "public"."Institution"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF; EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Table for User_institutionId_fkey does not exist, skipping.'; WHEN undefined_column THEN RAISE NOTICE 'Column institutionId for User_institutionId_fkey does not exist, skipping.'; WHEN duplicate_object THEN RAISE NOTICE 'Constraint User_institutionId_fkey already exists, skipping.'; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Account_userId_fkey' AND conrelid = 'public."Account"'::regclass) THEN ALTER TABLE "public"."Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Table for Account_userId_fkey does not exist, skipping.'; WHEN duplicate_object THEN RAISE NOTICE 'Constraint Account_userId_fkey already exists, skipping.'; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Session_userId_fkey' AND conrelid = 'public."Session"'::regclass) THEN ALTER TABLE "public"."Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Table for Session_userId_fkey does not exist, skipping.'; WHEN duplicate_object THEN RAISE NOTICE 'Constraint Session_userId_fkey already exists, skipping.'; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ContentGeneration_userId_fkey' AND conrelid = 'public."ContentGeneration"'::regclass) THEN ALTER TABLE "public"."ContentGeneration" ADD CONSTRAINT "ContentGeneration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Table for ContentGeneration_userId_fkey does not exist, skipping.'; WHEN duplicate_object THEN RAISE NOTICE 'Constraint ContentGeneration_userId_fkey already exists, skipping.'; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ContentGeneration_parentGenerationId_fkey' AND conrelid = 'public."ContentGeneration"'::regclass) THEN ALTER TABLE "public"."ContentGeneration" ADD CONSTRAINT "ContentGeneration_parentGenerationId_fkey" FOREIGN KEY ("parentGenerationId") REFERENCES "public"."ContentGeneration"("id") ON DELETE NO ACTION ON UPDATE NO ACTION; END IF; EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Table for ContentGeneration_parentGenerationId_fkey does not exist, skipping.'; WHEN duplicate_object THEN RAISE NOTICE 'Constraint ContentGeneration_parentGenerationId_fkey already exists, skipping.'; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SourceMaterial_userId_fkey' AND conrelid = 'public."SourceMaterial"'::regclass) THEN ALTER TABLE "public"."SourceMaterial" ADD CONSTRAINT "SourceMaterial_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Table for SourceMaterial_userId_fkey does not exist, skipping.'; WHEN duplicate_object THEN RAISE NOTICE 'Constraint SourceMaterial_userId_fkey already exists, skipping.'; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DocumentChunk_sourceMaterialId_fkey' AND conrelid = 'public."DocumentChunk"'::regclass) THEN ALTER TABLE "public"."DocumentChunk" ADD CONSTRAINT "DocumentChunk_sourceMaterialId_fkey" FOREIGN KEY ("sourceMaterialId") REFERENCES "public"."SourceMaterial"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Table for DocumentChunk_sourceMaterialId_fkey does not exist, skipping.'; WHEN duplicate_object THEN RAISE NOTICE 'Constraint DocumentChunk_sourceMaterialId_fkey already exists, skipping.'; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ImageResource_userId_fkey' AND conrelid = 'public."ImageResource"'::regclass) THEN ALTER TABLE "public"."ImageResource" ADD CONSTRAINT "ImageResource_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'Table for ImageResource_userId_fkey does not exist, skipping.'; WHEN duplicate_object THEN RAISE NOTICE 'Constraint ImageResource_userId_fkey already exists, skipping.'; END $$;

-- Vector Indexes (run these as separate statements in the Supabase SQL editor AFTER the tables are created)
-- CREATE INDEX IF NOT EXISTS idx_document_chunk_embedding_cosine ON "public"."DocumentChunk" USING hnsw (embedding public.vector_cosine_ops);
-- CREATE INDEX IF NOT EXISTS idx_imageresource_embedding_cosine ON "public"."ImageResource" USING hnsw (embedding public.vector_cosine_ops);