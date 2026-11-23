export type KernelRequest =
  | { type: 'init' }
  /**
   * `files`: uploaded files (name → text) written to the working directory first.
   * `inspect`: datasets (variables) to profile afterwards for the inspection task.
   */
  | { type: 'run'; requestId: number; code: string; files: Record<string, string>; inspect: InspectRequest[] }
  | { type: 'reset'; requestId: number }

export type InspectRequest = { name: string; kind: 'example' | 'url' | 'file'; ref: string }

export type KernelStatus = 'idle' | 'loading' | 'ready' | 'failed'

export type KernelResponse =
  | { type: 'status'; status: KernelStatus; message?: string }
  | { type: 'result'; requestId: number; ok: true; payload: string }
  | { type: 'result'; requestId: number; ok: false; error: string }
