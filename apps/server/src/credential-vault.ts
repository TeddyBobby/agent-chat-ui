import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";
import { AppDatabase } from "./database.js";

const API_KEY_NAME = "model-api-key";

export class CredentialVault {
  private readonly key: Buffer;

  constructor(
    private readonly database: AppDatabase,
    keyFile?: string,
  ) {
    this.key = loadMasterKey(keyFile);
  }

  hasApiKey(): boolean {
    return Boolean(this.database.getCredential(API_KEY_NAME));
  }

  saveApiKey(apiKey: string) {
    const value = apiKey.trim();
    if (!value) throw new Error("API key cannot be empty");
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    this.database.saveCredential({
      name: API_KEY_NAME,
      ciphertext: ciphertext.toString("base64"),
      iv: iv.toString("base64"),
      authTag: cipher.getAuthTag().toString("base64"),
    });
  }

  getApiKey(): string {
    const stored = this.database.getCredential(API_KEY_NAME);
    if (!stored) return "";
    const decipher = createDecipheriv(
      "aes-256-gcm",
      this.key,
      Buffer.from(stored.iv, "base64"),
    );
    decipher.setAuthTag(Buffer.from(stored.authTag, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(stored.ciphertext, "base64")),
      decipher.final(),
    ]).toString("utf8");
  }

  clearApiKey() {
    this.database.deleteCredential(API_KEY_NAME);
  }
}

function loadMasterKey(keyFile?: string): Buffer {
  const configured = process.env.PI_AGENT_MASTER_KEY;
  if (configured) {
    const key = Buffer.from(configured, "base64");
    if (key.length !== 32) throw new Error("PI_AGENT_MASTER_KEY must be a base64-encoded 32-byte key");
    return key;
  }
  if (!keyFile) return randomBytes(32);
  if (existsSync(keyFile)) {
    chmodSync(keyFile, 0o600);
    const key = Buffer.from(readFileSync(keyFile, "utf8").trim(), "base64");
    if (key.length !== 32) throw new Error(`Invalid credential key file: ${keyFile}`);
    return key;
  }
  mkdirSync(dirname(keyFile), { recursive: true });
  const key = randomBytes(32);
  writeFileSync(keyFile, key.toString("base64"), { mode: 0o600, flag: "wx" });
  chmodSync(keyFile, 0o600);
  return key;
}
