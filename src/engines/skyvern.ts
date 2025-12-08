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
  /** Extracted information from the page (goal confirmation, errors, etc) */
  extractedInfo?: Record<string, unknown>;
  /** Raw Skyvern API response (for debugging) */
  rawResponse?: unknown;
}

/**
 * Progress callback for status updates
 */
export type ProgressCallback = (status: {
  phase: 'connecting' | 'queued' | 'running' | 'processing' | 'completed' | 'failed';
  message: string;
  elapsed?: number;
  taskId?: string;
  screenshotCount?: number;
  stepCount?: number;
}) => void;

/**
 * Skyvern engine configuration
 */
export interface SkyvernConfig {
  apiEndpoint?: string;
  apiKey?: string;
  timeout?: number;
  onProgress?: ProgressCallback;
  /** If true, include raw API response in results */
  debug?: boolean;
}

/**
 * Skyvern task status - full API response
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
  // Actually at root level, not inside output
  extracted_information?: {
    goal_achieved?: boolean;
    visual_confirmation?: string;
    error_messages?: string | null;
    [key: string]: unknown;
  } | null;
  // Rich status fields from Skyvern API
  screenshot_urls?: string[];
  action_screenshot_urls?: string[];
  recording_url?: string;
  created_at?: string;
  started_at?: string;
  finished_at?: string;
  // Step tracking
  steps?: {
    step_id: string;
    status: string;
    output?: {
      action_type?: string;
      action_description?: string;
    };
  }[];
}

/**
 * Skyvern Visual Resolver Engine
 *
 * Uses Skyvern's Vision-LLM API to analyze and interact with pages
 * that fail accessibility tree parsing.
 */
export class SkyvernEngine {
  private config: SkyvernConfig & { apiEndpoint: string; apiKey: string; timeout: number };

  constructor(config: SkyvernConfig = {}) {
    this.config = {
      apiEndpoint:
        config.apiEndpoint ?? process.env.SKYVERN_API_ENDPOINT ?? 'http://localhost:8000/api/v1',
      apiKey: config.apiKey ?? process.env.SKYVERN_API_KEY ?? 'agentrank-local-key',
      timeout: config.timeout ?? 300000, // 5 minutes for visual analysis
      onProgress: config.onProgress,
      debug: config.debug,
    };
  }

  /**
   * Analyze a page visually using Skyvern's Vision-LLM
   *
   * @param url - The URL to analyze
   * @param goal - The goal to achieve (e.g., "Navigate the page and identify all interactive elements")
   */
  async visualResolve(url: string, goal: string): Promise<SkyvernResult> {
    const startTime = Date.now();

    try {
      this.config.onProgress?.({
        phase: 'connecting',
        message: 'Creating Skyvern task...',
        elapsed: 0,
      });

      // Create a task
      const taskId = await this.createTask(url, goal);

      this.config.onProgress?.({
        phase: 'queued',
        message: 'Task created, waiting for agent...',
        elapsed: Date.now() - startTime,
        taskId,
      });

      // Poll for completion
      const status = await this.waitForTask(taskId, startTime);

      if (status.status === 'completed') {
        // Check goal achievement from extracted_information (root level, not inside output)
        const extractedInfo = status.extracted_information;
        const goalAchieved = extractedInfo?.goal_achieved;
        const visualConfirmation = extractedInfo?.visual_confirmation;

        const goalStatus =
          goalAchieved === true ? 'Yes' : goalAchieved === false ? 'No' : 'Unable to determine';

        // Build informative transcript
        let transcript = `Goal achieved: ${goalStatus}`;
        if (visualConfirmation) {
          transcript += ` | Visual confirmation: ${visualConfirmation}`;
        }

        // Get best available screenshot
        const screenshotPath =
          status.action_screenshot_urls?.[0] ??
          status.screenshot_urls?.[status.screenshot_urls?.length - 1] ??
          status.output?.screenshot_url;

        return {
          success: true,
          taskId,
          elementFound: goalAchieved ?? false,
          screenshotPath,
          transcript,
          extractedInfo: extractedInfo ?? undefined,
          rawResponse: this.config.debug ? status : undefined,
        };
      } else {
        return {
          success: false,
          taskId,
          elementFound: false,
          error: status.failure_reason ?? `Task ${status.status}`,
          rawResponse: this.config.debug ? status : undefined,
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
   *
   * Wraps the user's goal with explicit completion criteria for Skyvern's validator agent.
   */
  private async createTask(url: string, goal: string): Promise<string> {
    // Wrap goal with completion criteria so Skyvern can validate success
    // Skyvern looks for keywords like "complete" and "terminate" to understand when done
    const enhancedGoal = `
Your task: ${goal}

IMPORTANT - Completion Criteria:
- Your goal is COMPLETE when you have successfully performed the action described above.
- You will know your goal is COMPLETE when you can visually confirm the expected result on the page.
- If you cannot find the element or complete the action after reasonable attempts, terminate and report failure.
- Take a final screenshot showing the result of your action.
`.trim();

    const response = await fetch(`${this.config.apiEndpoint}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
      },
      body: JSON.stringify({
        url,
        navigation_goal: enhancedGoal,
        data_extraction_goal:
          'After completing the navigation goal, extract: (1) whether the goal was achieved (true/false), (2) what visual confirmation you see, (3) any error messages or issues encountered',
        navigation_payload: null,
        proxy_location: null,
        webhook_callback_url: null,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create Skyvern task: ${error}`);
    }

    const data = (await response.json()) as { task_id: string };
    return data.task_id;
  }

  /**
   * Wait for task completion with polling
   */
  private async waitForTask(taskId: string, startTime: number): Promise<SkyvernTaskStatus> {
    const pollInterval = 2000; // 2 seconds
    let lastScreenshotCount = 0;
    let lastStepCount = 0;

    while (Date.now() - startTime < this.config.timeout) {
      const status = await this.getTaskStatus(taskId);
      const elapsed = Date.now() - startTime;

      // Track screenshot count for progress indication
      const screenshotCount = status.screenshot_urls?.length ?? 0;
      const stepCount = status.steps?.length ?? 0;
      const newScreenshots = screenshotCount > lastScreenshotCount;
      const newSteps = stepCount > lastStepCount;

      // Get the latest step action description if available
      const latestStep = status.steps?.[status.steps.length - 1];
      const latestAction =
        latestStep?.output?.action_description ?? latestStep?.output?.action_type;

      // Map Skyvern status to our progress phases
      const phaseMap: Record<string, 'queued' | 'running' | 'processing' | 'completed' | 'failed'> =
        {
          created: 'queued',
          queued: 'queued',
          running: 'running',
          completed: 'completed',
          failed: 'failed',
          terminated: 'failed',
        };

      const phase = phaseMap[status.status] ?? 'running';

      // Generate descriptive message based on real status
      let message: string;
      if (status.status === 'created' || status.status === 'queued') {
        message = 'Waiting for agent to start...';
      } else if (status.status === 'running') {
        if (latestAction) {
          // Use the actual action from Skyvern
          message = latestAction;
        } else if (newSteps) {
          message = `Executing step ${stepCount}...`;
        } else if (newScreenshots) {
          message = `Captured ${screenshotCount} screenshot${screenshotCount > 1 ? 's' : ''}...`;
        } else if (screenshotCount > 0) {
          message = `Processing page (${screenshotCount} screenshot${screenshotCount > 1 ? 's' : ''})...`;
        } else {
          message = 'Agent is working...';
        }
      } else {
        message = `Task ${status.status}`;
      }

      this.config.onProgress?.({
        phase,
        message,
        elapsed,
        taskId,
        screenshotCount,
        stepCount,
      });

      lastScreenshotCount = screenshotCount;
      lastStepCount = stepCount;

      if (['completed', 'failed', 'terminated'].includes(status.status)) {
        return status;
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval));
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
