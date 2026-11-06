-- CredentialShare stops holding the share token and the starting password in
-- plain text. New rows store sha256(token) and an AES-256-GCM ciphertext keyed
-- off the token; `CredentialShareService` converts existing rows at boot and
-- empties the legacy columns. Nothing is dropped here, so a rollback to the
-- previous build still finds its columns.
ALTER TABLE "CredentialShare" ADD COLUMN "tokenHash" TEXT,
ADD COLUMN "passwordCipher" TEXT,
ADD COLUMN "expiresAt" TIMESTAMP(3),
ALTER COLUMN "token" DROP NOT NULL,
ALTER COLUMN "password" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "CredentialShare_tokenHash_key" ON "CredentialShare"("tokenHash");
