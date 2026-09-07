export class Email {
  private constructor(public readonly value: string) {}

  public static create(email: string): Email {
    if (!email || email.trim() === '') {
      throw new Error('Email cannot be empty');
    }
    const normalizedEmail = email.trim().toLowerCase();
    
    // Basic email validation regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      throw new Error('Invalid email format');
    }

    return new Email(normalizedEmail);
  }
}
