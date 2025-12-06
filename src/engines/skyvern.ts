/**
 * Skyvern Engine (Level 2: Visual Resolver)
 *
 * Fallback engine using Vision-LLM for visual element identification.
 * Triggered when Level 1 (Browser Use) throws specific exceptions.
 *
 * Requires self-hosted Skyvern: docker-compose -f docker-compose.skyvern.yml up -d
 *
 * @license Apache-2.0
 * @author Kiarash Adl
 */

/**
 * Skyvern analysis result
 */
export interface SkyvernResult {
  success: boolean;
  screenshotPath?: string;
  elementFound: boolean;
  action?: string;
  error?: string;
  taskId?: string;
  transcript?: string;
}

/**
 * Skyvern engine configuration
 */
export interface SkyvernConfig {
  apiEndpoint?: string;
  apiKey?: string;
  timeout?: number;
}

/**
 * Skyvern task status
 */
interface SkyvernTaskStatus {
  task_id: string;
  status: 'created' | 'queued' | 'running' | 'completed' | 'failed' | 'terminated';
  output?: {
    screenshot_url?: string;
    navigation_goal_achieved?: boolean;
    extracted_information?: Record<string, unknown>;
  };
  failure_reason?: string;
}

/**
 * Skyvern Visual Resolver Engine
 *
 * Uses Skyvern's Vision-LLM API to analyze and interact with pages
 * that fail accessibility tree parsing.
 */
export class SkyvernEngine {
  private config: Required<SkyvernConfig>;

  constructor(config: SkyvernConfig = {}) {
    this.config = {
      apiEndpoint: config.apiEndpoint ?? process.env.SKYVERN_API_ENDPOINT ?? 'http://localhost:8000/api/v1',
      apiKey: config.apiKey ?? process.env.SKYVERN_API_KEY ?? 'agentrank-local-key',
      timeout: config.timeout ?? 300000, // 5 minutes for visual analysis
    };
  }

  /**
   * Analyze a page visually using Skyvern's Vision-LLM
   *
   * @param url - The URL to analyze
   * @param goal - The goal to achieve (e.g., "Navigate the page and identify all interactive elements")
   */
  async visualResolve(url: string, goal: string): Promise<SkyvernResult> {
    try {
      // Create a task
      const taskId = await this.createTask(url, goal);

      // Poll for completion
      const status = await this.waitForTask(taskId);

      if (status.status === 'completed') {
        return {
          success: true,
          taskId,
          elementFound: status.output?.navigation_goal_achieved ?? false,
          screenshotPath: status.output?.screenshot_url,
          transcript: `Visual analysis completed. Goal achieved: ${status.output?.navigation_goal_achieved}`,
        };
      } else {
        return {
          success: false,
          taskId,
          elementFound: false,
          error: status.failure_reason ?? `Task ${status.status}`,
        };
      }
    } catch (error) {
      return {
        success: false,
        elementFound: false,
        error: error instanceof Error ? error.message : 'Skyvern API error',
      };
    }
  }

  /**
   * Create a Skyvern task
   */
  private async createTask(url: string, goal: string): Promise<string> {
    const response = await fetch(`${this.config.apiEndpoint}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
      },
      body: JSON.stringify({
        url,
        navigation_goal: goal,
        data_extraction_goal: 'Extract all form fields, buttons, and interactive elements visible on the page',
        navigation_payload: null,
        proxy_location: null,
        webhook_callback_url: null,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create Skyvern task: ${error}`);
    }

    const data = await response.json() as { task_id: string };
    return data.task_id;
  }

  /**
   * Wait for task completion with polling
   */
  private async waitForTask(taskId: string): Promise<SkyvernTaskStatus> {
    const startTime = Date.now();
    const pollInterval = 2000; // 2 seconds

    while (Date.now() - startTime < this.config.timeout) {
      const status = await this.getTaskStatus(taskId);

      if (['completed', 'failed', 'terminated'].includes(status.status)) {
        return status;
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error(`Task ${taskId} timed out after ${this.config.timeout}ms`);
  }

  /**
   * Get task status
   */
  private async getTaskStatus(taskId: string): Promise<SkyvernTaskStatus> {
    const response = await fetch(`${this.config.apiEndpoint}/tasks/${taskId}`, {
      headers: {
        'x-api-key': this.config.apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get task status: ${response.statusText}`);
    }

    return response.json() as Promise<SkyvernTaskStatus>;
  }

  /**
   * Check if Skyvern is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      // Skyvern doesn't have a /health endpoint, so we check if the API responds
      const response = await fetch(`${this.config.apiEndpoint}/tasks`, {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000),
      });
      // 405 Method Not Allowed is also valid - means the API is running
      return response.ok || response.status === 405;
    } catch {
      return false;
    }
  }

  /**
   * Get the cost for a visual analysis
   */
  estimateCost(): number {
    // Approximate cost per Skyvern analysis (GPU time + Vision API)
    return 0.02;
  }

  /**
   * Perform a deep scan with visual analysis
   */
  async deepScan(url: string): Promise<SkyvernResult> {
    const goal = `
      Navigate to the page and perform a comprehensive accessibility audit:
      1. Identify all interactive elements (buttons, links, forms)
      2. Check if elements are properly labeled
      3. Verify that the page can be navigated without a mouse
      4. Look for any anti-bot measures or CAPTCHAs
      5. Take a screenshot of the final state
    `;

    return this.visualResolve(url, goal);
  }

  /**
   * Run a custom task with a specific goal
   * 
   * @param url - The URL to navigate to
   * @param customGoal - The specific task to perform (e.g., "Click the Sign Up button")
   */
  async customTask(url: string, customGoal: string): Promise<SkyvernResult> {
    return this.visualResolve(url, customGoal);
  }
}

/**
 * Check if an error should trigger Skyvern escalation
 */
export function shouldEscalateToSkyvern(errorMessage: string): boolean {
  const triggers = [
    'InteractionFailed',
    'NodeNotClickable',
    'ElementIntercepted',
    'VisuallyHidden',
    'OverlayBlocking',
  ];

  return triggers.some((trigger) => errorMessage.includes(trigger));
}
