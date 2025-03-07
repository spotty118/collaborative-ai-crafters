declare module 'https://esm.sh/@supabase/supabase-js@2.38.4' {
  export interface SupabaseClientOptions {
    auth?: {
      autoRefreshToken?: boolean;
      persistSession?: boolean;
      detectSessionInUrl?: boolean;
    };
    global?: {
      headers?: Record<string, string>;
      fetch?: typeof fetch;
    };
  }

  export interface User {
    id: string;
    app_metadata: Record<string, any>;
    user_metadata: Record<string, any>;
    aud: string;
    email?: string;
  }

  export interface Session {
    provider_token?: string;
    access_token: string;
    refresh_token: string;
    expires_in: number;
    expires_at?: number;
    user: User;
  }

  export interface PostgrestFilterBuilder<T> {
    eq: (column: string, value: any) => PostgrestFilterBuilder<T>;
    neq: (column: string, value: any) => PostgrestFilterBuilder<T>;
    gt: (column: string, value: any) => PostgrestFilterBuilder<T>;
    gte: (column: string, value: any) => PostgrestFilterBuilder<T>;
    lt: (column: string, value: any) => PostgrestFilterBuilder<T>;
    lte: (column: string, value: any) => PostgrestFilterBuilder<T>;
    like: (column: string, value: string) => PostgrestFilterBuilder<T>;
    ilike: (column: string, value: string) => PostgrestFilterBuilder<T>;
    is: (column: string, value: any) => PostgrestFilterBuilder<T>;
    in: (column: string, values: any[]) => PostgrestFilterBuilder<T>;
    contains: (column: string, value: any | any[]) => PostgrestFilterBuilder<T>;
    containedBy: (column: string, value: any[]) => PostgrestFilterBuilder<T>;
    rangeLt: (column: string, range: string) => PostgrestFilterBuilder<T>;
    rangeGt: (column: string, range: string) => PostgrestFilterBuilder<T>;
    rangeGte: (column: string, range: string) => PostgrestFilterBuilder<T>;
    rangeLte: (column: string, range: string) => PostgrestFilterBuilder<T>;
    rangeAdjacent: (column: string, range: string) => PostgrestFilterBuilder<T>;
    overlaps: (column: string, value: string) => PostgrestFilterBuilder<T>;
    textSearch: (column: string, value: string, options?: { type?: string, config?: string }) => PostgrestFilterBuilder<T>;
    filter: (column: string, operator: string, value: any) => PostgrestFilterBuilder<T>;
    or: (filters: string, options?: { foreignTable?: string }) => PostgrestFilterBuilder<T>;
    not: (column: string, operator: string, value: any) => PostgrestFilterBuilder<T>;
    match: (query: Record<string, any>) => PostgrestFilterBuilder<T>;
    single: () => Promise<{ data: T | null; error: Error | null }>;
    maybeSingle: () => Promise<{ data: T | null; error: Error | null }>;
    select: (columns?: string) => PostgrestFilterBuilder<T>;
    order: (column: string, options?: { ascending?: boolean, nullsFirst?: boolean, foreignTable?: string }) => PostgrestFilterBuilder<T>;
    limit: (count: number) => PostgrestFilterBuilder<T>;
    range: (from: number, to: number) => PostgrestFilterBuilder<T>;
    then: <U>(onFulfilled: (value: { data: T[] | null; error: Error | null }) => U) => Promise<U>;
  }

  export interface PostgrestQueryBuilder<T> {
    select: (columns?: string) => PostgrestFilterBuilder<T>;
    insert: (values: T | T[], options?: { returning?: boolean, count?: 'exact' | 'planned' | 'estimated' }) => Promise<{ data: T[] | null; error: Error | null }>;
    upsert: (values: T | T[], options?: { returning?: boolean, count?: 'exact' | 'planned' | 'estimated', onConflict?: string }) => Promise<{ data: T[] | null; error: Error | null }>;
    update: (values: Partial<T>, options?: { returning?: boolean }) => PostgrestFilterBuilder<T>;
    delete: (options?: { returning?: boolean }) => PostgrestFilterBuilder<T>;
  }

  export interface SupabaseClient {
    from<T = any>(table: string): PostgrestQueryBuilder<T>;
    auth: {
      signUp: (credentials: { email: string; password: string; options?: { data?: Record<string, any> } }) => Promise<{ data: { user: User | null; session: Session | null }; error: Error | null }>;
      signIn: (credentials: { email: string; password: string }) => Promise<{ data: { user: User | null; session: Session | null }; error: Error | null }>;
      signOut: () => Promise<{ error: Error | null }>;
      getSession: () => Promise<{ data: { session: Session | null }; error: Error | null }>;
      getUser: (token?: string) => Promise<{ data: { user: User | null }; error: Error | null }>;
      refreshSession: () => Promise<{ data: { user: User | null; session: Session | null }; error: Error | null }>;
    };
    storage: {
      from: (bucket: string) => {
        upload: (path: string, file: File | ArrayBuffer | ArrayBufferView | Blob | Buffer | string, options?: { cacheControl?: string, contentType?: string, upsert?: boolean }) => Promise<{ data: { Key: string } | null; error: Error | null }>;
        download: (path: string) => Promise<{ data: Blob | null; error: Error | null }>;
        getPublicUrl: (path: string) => { publicURL: string };
        remove: (paths: string | string[]) => Promise<{ data: {} | null; error: Error | null }>;
        list: (path?: string, options?: { limit?: number, offset?: number, search?: string }) => Promise<{ data: { name: string, id: string, metadata: any }[] | null; error: Error | null }>;
      };
    };
  }

  export function createClient(supabaseUrl: string, supabaseKey: string, options?: SupabaseClientOptions): SupabaseClient;
}
