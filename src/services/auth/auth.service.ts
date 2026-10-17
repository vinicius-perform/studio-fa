// src/services/auth/auth.service.ts
import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { ProfileRow } from '@/types/domain/organization';
import { UnauthorizedError } from '@/lib/errors';
import { Logger } from '@/lib/logger';

export class AuthService {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async getUser(): Promise<User | null> {
    const {
      data: { user },
      error,
    } = await this.supabase.auth.getUser();

    if (error || !user) {
      return null;
    }

    return user;
  }

  async requireUser(): Promise<User> {
    const user = await this.getUser();
    if (!user) {
      throw new UnauthorizedError();
    }
    return user;
  }

  async getProfile(userId: string): Promise<ProfileRow | null> {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      Logger.error({ operation: 'getProfile', userId, result: 'error' }, error);
      return null;
    }

    return data;
  }

  async updateProfile(
    userId: string,
    updates: { full_name?: string; avatar_url?: string }
  ): Promise<ProfileRow> {
    const { data, error } = await this.supabase
      .from('profiles')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select()
      .single();

    if (error || !data) {
      throw error;
    }

    return data;
  }

  async signOut(): Promise<void> {
    const { error } = await this.supabase.auth.signOut();
    if (error) {
      Logger.error({ operation: 'signOut', result: 'error' }, error);
      throw error;
    }
  }
}
