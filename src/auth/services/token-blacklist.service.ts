import { Injectable } from '@nestjs/common';

@Injectable()
export class TokenBlacklistService {
  private blacklistedTokens = new Set<string>();

  /**
   * Add a token to the blacklist
   * @param token - The JWT token to blacklist
   */
  addToBlacklist(token: string): void {
    this.blacklistedTokens.add(token);
  }

  /**
   * Check if a token is blacklisted
   * @param token - The JWT token to check
   * @returns true if the token is blacklisted, false otherwise
   */
  isBlacklisted(token: string): boolean {
    return this.blacklistedTokens.has(token);
  }

  /**
   * Remove a token from the blacklist (useful for testing or admin purposes)
   * @param token - The JWT token to remove from blacklist
   */
  removeFromBlacklist(token: string): void {
    this.blacklistedTokens.delete(token);
  }

  /**
   * Get the current size of the blacklist
   * @returns The number of blacklisted tokens
   */
  getBlacklistSize(): number {
    return this.blacklistedTokens.size;
  }

  /**
   * Clear all blacklisted tokens (useful for testing or admin purposes)
   */
  clearBlacklist(): void {
    this.blacklistedTokens.clear();
  }
}
