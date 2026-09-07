import * as argon2 from 'argon2';

export class PasswordHash {
  private constructor(public readonly value: string) {}

  /**
   * Creates a PasswordHash from an already hashed string (e.g. from the database)
   */
  public static fromHash(hash: string): PasswordHash {
    if (!hash || hash.trim() === '') {
      throw new Error('Password hash cannot be empty');
    }
    return new PasswordHash(hash);
  }

  /**
   * Hashes a raw password and returns a new PasswordHash instance using Argon2id
   */
  public static async hash(rawPassword: string): Promise<PasswordHash> {
    if (!rawPassword || rawPassword.trim() === '') {
      throw new Error('Password cannot be empty');
    }
    if (rawPassword.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }
    
    const hash = await argon2.hash(rawPassword, {
      type: argon2.argon2id,
      memoryCost: 2 ** 16, // 64 MB
      timeCost: 3,
      parallelism: 1,
    });
    
    return new PasswordHash(hash);
  }

  /**
   * Compares a raw password against this hash
   */
  public async compare(rawPassword: string): Promise<boolean> {
    try {
      return await argon2.verify(this.value, rawPassword);
// eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_err) {
      return false; // treat verification errors as invalid password
    }
  }
}
