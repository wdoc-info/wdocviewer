import { Injectable } from '@angular/core';
import { Session, SupabaseClient } from '@supabase/supabase-js';
import { BehaviorSubject } from 'rxjs';
import { supabaseConfig } from '../config/supabase.config';
import { getSupabaseClient } from './supabase-client';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly supabase: SupabaseClient;
  private readonly emailStorageKey = 'wdoc-auth-email';
  private sessionSubject = new BehaviorSubject<Session | null>(null);
  session$ = this.sessionSubject.asObservable();

  constructor() {
    this.supabase = getSupabaseClient();
    void this.loadInitialSession();

    this.supabase.auth.onAuthStateChange((_event, session) => {
      this.sessionSubject.next(session);
      const email = session?.user?.email;
      if (email) {
        this.saveEmail(email);
      } else {
        this.clearEmail();
      }
    });
  }

  async loadInitialSession() {
    const { data } = await this.supabase.auth.getSession();
    const session = data.session ?? null;
    this.sessionSubject.next(session);
    const email = session?.user?.email;
    if (email) {
      this.saveEmail(email);
    }
  }

  async signInWithEmail(email: string) {
    const redirectTo = this.getRedirectUrl();
    this.saveEmail(email);
    return this.supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectTo,
      },
    });
  }

  async signOut() {
    this.clearEmail();
    return this.supabase.auth.signOut();
  }

  getStoredEmail(): string | null {
    if (typeof window === 'undefined') {
      return null;
    }
    return localStorage.getItem(this.emailStorageKey);
  }

  private saveEmail(email: string) {
    if (typeof window === 'undefined') {
      return;
    }
    localStorage.setItem(this.emailStorageKey, email);
  }

  private clearEmail() {
    if (typeof window === 'undefined') {
      return;
    }
    localStorage.removeItem(this.emailStorageKey);
  }

  private getRedirectUrl() {
    if (typeof window === 'undefined') {
      return supabaseConfig.redirectUrls.production;
    }
    if (window.location.origin.includes('localhost')) {
      return supabaseConfig.redirectUrls.local;
    }
    return supabaseConfig.redirectUrls.production;
  }
}
