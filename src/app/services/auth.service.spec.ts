import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Session } from '@supabase/supabase-js';
import { supabaseConfig } from '../config/supabase.config';
import { AuthService } from './auth.service';
import { setSupabaseClient } from './supabase-client';

describe('AuthService', () => {
  let service: AuthService;
  let stateChangeCallback: ((event: string, session: Session | null) => void) | undefined;
  const supabaseStub = {
    auth: {
      getSession: jasmine
        .createSpy('getSession')
        .and.resolveTo({ data: { session: null } }),
      signInWithOtp: jasmine.createSpy('signInWithOtp').and.resolveTo({ data: {} }),
      signOut: jasmine.createSpy('signOut').and.resolveTo({}),
      onAuthStateChange: jasmine.createSpy('onAuthStateChange').and.callFake((callback) => {
        stateChangeCallback = callback;
        return { data: { subscription: { unsubscribe: () => undefined } } } as never;
      }),
    },
  };

  beforeEach(() => {
    stateChangeCallback = undefined;
    supabaseStub.auth.getSession.and.resolveTo({ data: { session: null } });
    supabaseStub.auth.getSession.calls.reset();
    supabaseStub.auth.signInWithOtp.calls.reset();
    supabaseStub.auth.signOut.calls.reset();
    supabaseStub.auth.onAuthStateChange.calls.reset();
    localStorage.clear();

    setSupabaseClient(supabaseStub as never);
  });

  afterEach(() => {
    setSupabaseClient(null as never);
  });

  it('loads the initial session and stores the email', fakeAsync(() => {
    const session = { user: { email: 'person@example.com' } } as Session;
    supabaseStub.auth.getSession.and.resolveTo({ data: { session } });

    service = TestBed.inject(AuthService);
    tick();

    expect(service.getStoredEmail()).toBe('person@example.com');
  }));

  it('sends a sign-in email and persists the address', async () => {
    service = TestBed.inject(AuthService);

    await service.signInWithEmail('another@example.com');

    expect(supabaseStub.auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'another@example.com',
      options: { emailRedirectTo: supabaseConfig.redirectUrls.local },
    });
    expect(localStorage.getItem('wdoc-auth-email')).toBe('another@example.com');
  });

  it('clears stored email on sign out', async () => {
    localStorage.setItem('wdoc-auth-email', 'saved@example.com');
    service = TestBed.inject(AuthService);

    await service.signOut();

    expect(localStorage.getItem('wdoc-auth-email')).toBeNull();
    expect(supabaseStub.auth.signOut.calls.count()).toBe(1);
  });


  it('updates stored email when auth state changes', fakeAsync(() => {
    service = TestBed.inject(AuthService);
    tick();

    const session = { user: { email: 'stream@example.com' } } as Session;
    stateChangeCallback?.('SIGNED_IN', session);
    expect(service.getStoredEmail()).toBe('stream@example.com');

    stateChangeCallback?.('SIGNED_OUT', null);
    expect(service.getStoredEmail()).toBeNull();
  }));
});
