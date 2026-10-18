// src/lib/crypto.ts
import crypto from 'crypto';

function getMasterKey(): Buffer {
  if (typeof window !== 'undefined') {
    throw new Error('VIOLAÇÃO DE SEGURANÇA: Criptografia não pode ser executada no navegador!');
  }

  const envKey = process.env.STUDIO_FA_INTEGRATIONS_MASTER_KEY;
  if (!envKey) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('CRÍTICO: STUDIO_FA_INTEGRATIONS_MASTER_KEY não configurada em ambiente de produção.');
    }
    // Fallback determinístico seguro para desenvolvimento/testes
    return crypto.createHash('sha256').update('studio-fa-dev-integrations-master-key-seed').digest();
  }

  return crypto.createHash('sha256').update(envKey).digest();
}

/**
 * Criptografa um segredo utilizando AES-256-GCM com IV único de 12 bytes.
 * Retorna o payload no formato: iv_hex:auth_tag_hex:ciphertext_hex e os últimos 4 dígitos.
 */
export function encryptSecret(plainText: string): { encryptedSecret: string; lastFour: string } {
  if (!plainText || typeof plainText !== 'string') {
    throw new Error('Segredo inválido para criptografia.');
  }

  const key = getMasterKey();
  const iv = crypto.randomBytes(12); // 96-bit nonce para GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  const encryptedSecret = `${iv.toString('hex')}:${authTag}:${encrypted}`;
  const lastFour = plainText.length >= 4 ? plainText.slice(-4) : plainText;

  return { encryptedSecret, lastFour };
}

/**
 * Descriptografa um segredo salvo em formato iv:auth_tag:ciphertext.
 */
export function decryptSecret(encryptedPayload: string): string {
  if (!encryptedPayload) {
    throw new Error('Payload criptografado ausente.');
  }

  const parts = encryptedPayload.split(':');
  if (parts.length !== 3) {
    throw new Error('Formato de segredo criptografado inválido.');
  }

  const [ivHex, authTagHex, cipherTextHex] = parts;
  const key = getMasterKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(cipherTextHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Mascara o segredo para visualização segura no frontend.
 * Exemplo: sk-proj-••••••••••8K2P
 */
export function maskSecret(lastFour: string, prefix = 'sk-proj'): string {
  const cleanLastFour = (lastFour || '').replace(/[^a-zA-Z0-9]/g, '').slice(-4) || '••••';
  return `${prefix}-••••••••••${cleanLastFour}`;
}
