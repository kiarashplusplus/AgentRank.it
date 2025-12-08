/**
 * Browser Use Server Engine (Level 2: Visual Resolver)
 * 
 * Connects to the self-hosted Python engine running browser-use.
 */

export interface BrowserUseServerConfig {
    endpoint?: string;
    timeout?: number;
    debug?: boolean;
}

export interface BrowserUseServerResult {
    success: boolean;
    output?: string;
    steps?: number;
    transcript?: string[];
    videoUrl?: string;
    scanId?: string;
    error?: string;
    rawResponse?: unknown;
}

export class BrowserUseServerEngine {
    private config: Required<BrowserUseServerConfig>;

    constructor(config: BrowserUseServerConfig = {}) {
        this.config = {
            endpoint: config.endpoint ?? process.env.BROWSER_USE_ENDPOINT ?? 'http://localhost:8001',
            timeout: config.timeout ?? 300000, // 5 minutes
            debug: config.debug ?? false,
        };
    }

    /**
     * Check if the engine is available
     */
    async isAvailable(): Promise<boolean> {
        try {
            const response = await fetch(`${this.config.endpoint}/health`, {
                signal: AbortSignal.timeout(2000),
            });
            return response.ok;
        } catch {
            return false;
        }
    }

    /**
     * Run a task on the self-hosted engine
     */
    async runTask(url: string, task: string): Promise<BrowserUseServerResult> {
        try {
            const response = await fetch(`${this.config.endpoint}/task`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    url,
                    task,
                }),
                signal: AbortSignal.timeout(this.config.timeout),
            });

            if (!response.ok) {
                throw new Error(`Engine returned ${response.status}: ${response.statusText}`);
            }

            const data = await response.json() as any;

            if (data.success) {
                return {
                    success: true,
                    output: data.output,
                    steps: data.steps,
                    transcript: data.transcript,
                    videoUrl: data.videoUrl,
                    scanId: data.scanId,
                    rawResponse: this.config.debug ? data : undefined,
                };
            } else {
                return {
                    success: false,
                    error: data.error ?? 'Unknown engine error',
                    rawResponse: this.config.debug ? data : undefined,
                };
            }
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Connection error',
            };
        }
    }
}
