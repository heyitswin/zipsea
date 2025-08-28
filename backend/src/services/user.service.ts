import { db } from '../db/connection';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import { logger } from '../config/logger';
import type { User, NewUser } from '../db/schema/users';

class UserService {
  /**
   * Create or update a user from Clerk webhook data
   */
  async syncFromClerk(clerkUser: any): Promise<User> {
    try {
      const userData: NewUser = {
        clerkUserId: clerkUser.id,
        email: clerkUser.email_addresses?.[0]?.email_address || '',
        firstName: clerkUser.first_name || null,
        lastName: clerkUser.last_name || null,
        phone: clerkUser.phone_numbers?.[0]?.phone_number || null,
        lastLoginAt: new Date(),
      };

      // Upsert user
      const result = await db
        .insert(users)
        .values(userData)
        .onConflictDoUpdate({
          target: users.clerkUserId,
          set: {
            email: userData.email,
            firstName: userData.firstName,
            lastName: userData.lastName,
            phone: userData.phone,
            lastLoginAt: userData.lastLoginAt,
            updatedAt: new Date(),
          },
        })
        .returning();

      logger.info('User synced from Clerk', { clerkUserId: clerkUser.id });
      return result[0];
    } catch (error) {
      logger.error('Error syncing user from Clerk:', error);
      throw error;
    }
  }

  /**
   * Get user by Clerk ID
   */
  async getByClerkId(clerkUserId: string): Promise<User | null> {
    try {
      const result = await db
        .select()
        .from(users)
        .where(eq(users.clerkUserId, clerkUserId))
        .limit(1);

      return result[0] || null;
    } catch (error) {
      logger.error('Error getting user by Clerk ID:', error);
      throw error;
    }
  }

  /**
   * Get user by email
   */
  async getByEmail(email: string): Promise<User | null> {
    try {
      const result = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      return result[0] || null;
    } catch (error) {
      logger.error('Error getting user by email:', error);
      throw error;
    }
  }

  /**
   * Get user by ID
   */
  async getById(userId: string): Promise<User | null> {
    try {
      const result = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      return result[0] || null;
    } catch (error) {
      logger.error('Error getting user by ID:', error);
      throw error;
    }
  }

  /**
   * Update user preferences
   */
  async updatePreferences(userId: string, preferences: any): Promise<User> {
    try {
      const result = await db
        .update(users)
        .set({
          preferences,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId))
        .returning();

      if (!result[0]) {
        throw new Error('User not found');
      }

      return result[0];
    } catch (error) {
      logger.error('Error updating user preferences:', error);
      throw error;
    }
  }

  /**
   * Update last login timestamp
   */
  async updateLastLogin(clerkUserId: string): Promise<void> {
    try {
      await db
        .update(users)
        .set({
          lastLoginAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(users.clerkUserId, clerkUserId));
    } catch (error) {
      logger.error('Error updating last login:', error);
      throw error;
    }
  }
}

export const userService = new UserService();