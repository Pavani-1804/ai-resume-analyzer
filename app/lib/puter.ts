import { create } from 'zustand';

declare global {
  interface Window {
    puter: {
      auth: {
        getUser: () => Promise<PuterUser>;
        isSignedIn: () => Promise<boolean>;
        signIn: () => Promise<void>;
        signOut: () => Promise<void>;
      };
      fs: {
        write: (path: string, data: string | File | Blob) => Promise<File | undefined>;
        read: (path: string) => Promise<Blob>;
        upload: (file: File[] | Blob[]) => Promise<FSItem>;
        delete: (path: string) => Promise<void>;
        readdir: (path: string) => Promise<FSItem[] | undefined>;
      };
      ai: {
        chat: (
          prompt: string | ChatMessage[],
          imageURL?: string | PuterChatOptions,
          testMode?: boolean,
          options?: PuterChatOptions,
        ) => Promise<Object>;
        img2txt: (
          image: string | File | Blob,
          testMode?: boolean,
        ) => Promise<string>;
      };
      kv: {
        get: (key: string) => Promise<string | null>;
        set: (key: string, value: string) => Promise<boolean>;
        delete: (key: string) => Promise<boolean>;
        list: (pattern: string, returnValues?: boolean) => Promise<string[]>;
        flush: () => Promise<boolean>;
      };
    };
  }
}

interface AIResponse {
  message: {
    content: string | Array<{ text: string }>;
  };
}

// Strong System Prompt for Reliable JSON Output
const SYSTEM_PROMPT = `
You are an expert ATS (Applicant Tracking System) and senior technical recruiter.

Analyze the resume image carefully for the given job.
Return **ONLY** valid JSON. No explanations, no markdown, no extra text before or after.

{
  "atsScore": number (0-100),
  "summary": "One paragraph professional summary of the candidate's fit",
  "strengths": ["strength 1", "strength 2", ...],
  "weaknesses": ["weakness 1", "weakness 2", ...],
  "improvements": ["specific actionable improvement 1", ...],
  "keywordMatches": ["keyword1", "keyword2", ...],
  "missingKeywords": ["missing1", "missing2", ...]
}

Start directly with { and end with }.
`;

interface PuterStore {
  isLoading: boolean;
  error: string | null;
  puterReady: boolean;
  auth: {
    user: PuterUser | null;
    isAuthenticated: boolean;
    signIn: () => Promise<void>;
    signOut: () => Promise<void>;
    refreshUser: () => Promise<void>;
    checkAuthStatus: () => Promise<boolean>;
    getUser: () => PuterUser | null;
  };
  fs: {
    write: (path: string, data: string | File | Blob) => Promise<File | undefined>;
    read: (path: string) => Promise<Blob | undefined>;
    upload: (file: File[] | Blob[]) => Promise<FSItem | undefined>;
    delete: (path: string) => Promise<void>;
    readDir: (path: string) => Promise<FSItem[] | undefined>;
  };
  ai: {
    chat: any;
    feedback: (path: string, message: string) => Promise<AIResponse | undefined>;
    img2txt: any;
  };
  kv: {
    get: (key: string) => Promise<string | null | undefined>;
    set: (key: string, value: string) => Promise<boolean | undefined>;
    delete: (key: string) => Promise<boolean | undefined>;
    list: (pattern: string, returnValues?: boolean) => Promise<string[] | KVItem[] | undefined>;
    flush: () => Promise<boolean | undefined>;
  };

  init: () => void;
  clearError: () => void;
}

const getPuter = (): typeof window.puter | null =>
  typeof window !== 'undefined' && window.puter ? window.puter : null;

export const usePuterStore = create<PuterStore>((set, get) => {
  const setError = (msg: string) => {
    set({
      error: msg,
      isLoading: false,
      auth: {
        user: null,
        isAuthenticated: false,
        signIn: get().auth.signIn,
        signOut: get().auth.signOut,
        refreshUser: get().auth.refreshUser,
        checkAuthStatus: get().auth.checkAuthStatus,
        getUser: get().auth.getUser,
      },
    });
  };

  // ==================== IMPROVED FEEDBACK FUNCTION ====================
  const feedback = async (path: string, message: string) => {
    const puter = getPuter();
    if (!puter) {
      setError('Puter.js not available');
      return undefined;
    }

    try {
      return (await puter.ai.chat(
        [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'image', puter_path: path },
              { type: 'text', text: message },
            ],
          },
        ],
        undefined,
        false,
        { model: 'gpt-4o' }
      )) as AIResponse | undefined;
    } catch (err) {
      console.error('AI Feedback Error:', err);
      setError('Failed to analyze resume with AI');
      return undefined;
    }
  };
  // =================================================================

  const checkAuthStatus = async (): Promise<boolean> => {
    const puter = getPuter();
    if (!puter) {
      setError('Puter.js not available');
      return false;
    }

    set({ isLoading: true, error: null });

    try {
      const isSignedIn = await puter.auth.isSignedIn();
      if (isSignedIn) {
        const user = await puter.auth.getUser();
        set({
          auth: {
            user,
            isAuthenticated: true,
            signIn: get().auth.signIn,
            signOut: get().auth.signOut,
            refreshUser: get().auth.refreshUser,
            checkAuthStatus: get().auth.checkAuthStatus,
            getUser: () => user,
          },
          isLoading: false,
        });
        return true;
      } else {
        set({
          auth: {
            user: null,
            isAuthenticated: false,
            signIn: get().auth.signIn,
            signOut: get().auth.signOut,
            refreshUser: get().auth.refreshUser,
            checkAuthStatus: get().auth.checkAuthStatus,
            getUser: () => null,
          },
          isLoading: false,
        });
        return false;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to check auth status';
      setError(msg);
      return false;
    }
  };

  const signIn = async (): Promise<void> => {
    const puter = getPuter();
    if (!puter) {
      setError('Puter.js not available');
      return;
    }
    set({ isLoading: true, error: null });
    try {
      await puter.auth.signIn();
      await checkAuthStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    }
  };

  const signOut = async (): Promise<void> => {
    const puter = getPuter();
    if (!puter) {
      setError('Puter.js not available');
      return;
    }
    set({ isLoading: true, error: null });
    try {
      await puter.auth.signOut();
      set({
        auth: {
          user: null,
          isAuthenticated: false,
          signIn: get().auth.signIn,
          signOut: get().auth.signOut,
          refreshUser: get().auth.refreshUser,
          checkAuthStatus: get().auth.checkAuthStatus,
          getUser: () => null,
        },
        isLoading: false,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign out failed');
    }
  };

  const refreshUser = async (): Promise<void> => {
    const puter = getPuter();
    if (!puter) return;
    set({ isLoading: true, error: null });
    try {
      const user = await puter.auth.getUser();
      set({
        auth: {
          user,
          isAuthenticated: true,
          signIn: get().auth.signIn,
          signOut: get().auth.signOut,
          refreshUser: get().auth.refreshUser,
          checkAuthStatus: get().auth.checkAuthStatus,
          getUser: () => user,
        },
        isLoading: false,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh user');
    }
  };

  const init = (): void => {
    const puter = getPuter();
    if (puter) {
      set({ puterReady: true });
      checkAuthStatus();
      return;
    }

    const interval = setInterval(() => {
      if (getPuter()) {
        clearInterval(interval);
        set({ puterReady: true });
        checkAuthStatus();
      }
    }, 100);

    setTimeout(() => {
      clearInterval(interval);
      if (!getPuter()) setError('Puter.js failed to load within 10 seconds');
    }, 10000);
  };

  // FS Helpers
  const write = async (path: string, data: string | File | Blob) => getPuter()?.fs.write(path, data);
  const readFile = async (path: string) => getPuter()?.fs.read(path);
  const upload = async (files: File[] | Blob[]) => getPuter()?.fs.upload(files);
  const deleteFile = async (path: string) => getPuter()?.fs.delete(path);
  const readDir = async (path: string) => getPuter()?.fs.readdir(path);

  // Other Helpers
  const chat = async (...args: any[]) => getPuter()?.ai.chat(...args);
  const img2txt = async (image: any, testMode?: boolean) => getPuter()?.ai.img2txt(image, testMode);

  const getKV = async (key: string) => getPuter()?.kv.get(key);
  const setKV = async (key: string, value: string) => getPuter()?.kv.set(key, value);
  const deleteKV = async (key: string) => getPuter()?.kv.delete(key);
  const listKV = async (pattern: string, returnValues = false) => getPuter()?.kv.list(pattern, returnValues);
  const flushKV = async () => getPuter()?.kv.flush();

  return {
    isLoading: true,
    error: null,
    puterReady: false,

    auth: {
      user: null,
      isAuthenticated: false,
      signIn,
      signOut,
      refreshUser,
      checkAuthStatus,
      getUser: () => get().auth.user,
    },

    fs: {
      write,
      read: readFile,
      upload,
      delete: deleteFile,
      readDir,
    },

    ai: {
      chat,
      feedback,
      img2txt,
    },

    kv: {
      get: getKV,
      set: setKV,
      delete: deleteKV,
      list: listKV,
      flush: flushKV,
    },

    init,
    clearError: () => set({ error: null }),
  };
});