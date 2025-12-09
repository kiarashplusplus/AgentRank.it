#!/usr/bin/env node
/**
 * AgentRank.it CLI
 *
 * The command-line interface for auditing websites for AI agent accessibility.
 *
 * @license Apache-2.0
 * @author Kiarash Adl
 */

import 'dotenv/config';

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { scanUrl } from '../core/scanner.js';
import { startMCPServer } from '../mcp/server.js';
import type { ScanOptions, ScanResult } from '../types/index.js';

const program = new Command();

program
  .name('agentrank')
  .description('The Page Speed for the Agentic Web')
  .version('0.1.0');

program
  .command('audit')
  .description('Audit a URL for AI agent accessibility')
  .argument('<url>', 'URL to audit')
  .option('-m, --mode <mode>', 'Scan mode: quick or deep', 'quick')
  .option('-t, --timeout <seconds>', 'Timeout in seconds', '30')
  .option('--no-escalation', 'Disable visual escalation fallback')
  .option('-v, --verbose', 'Verbose output')
  .option('--json', 'Output raw JSON')
  .action(async (url: string, options: Record<string, unknown>) => {
    const spinner = ora('Initializing scan...').start();

    try {
      const scanOptions: ScanOptions = {
        url,
        mode: options.mode as 'quick' | 'deep',
        timeout: parseInt(options.timeout as string, 10) * 1000,
        skipEscalation: options.escalation === false,
        verbose: options.verbose as boolean,
      };

      spinner.text = `Scanning ${chalk.cyan(url)}...`;

      const result: ScanResult = await scanUrl(scanOptions);

      spinner.stop();

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      // Pretty print results
      printResults(result);
    } catch (error) {
      spinner.fail('Scan failed');
      console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'));
      process.exit(1);
    }
  });

program
  .command('mcp')
  .description('Start the MCP server for IDE integration')
  .option('-p, --port <port>', 'Port to listen on', '3000')
  .option('-H, --host <host>', 'Host to bind to', 'localhost')
  .action(async (options: Record<string, unknown>) => {
    const port = parseInt(options.port as string, 10);
    const host = options.host as string;

    try {
      await startMCPServer({ port, host });

      // Handle graceful shutdown
      const shutdown = () => {
        console.log(chalk.gray('\nShutting down MCP server...'));
        process.exit(0);
      };

      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);
    } catch (error) {
      console.error(chalk.red('Failed to start MCP server:'));
      console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'));
      process.exit(1);
    }
  });

program
  .command('task')
  .description('Run a browser automation task (browser-use or Skyvern)')
  .argument('<url>', 'URL to navigate to')
  .argument('<goal>', 'The task goal (e.g., "Click the Sign Up button")')
  .option('-t, --timeout <seconds>', 'Timeout in seconds', '300')
  .option('-v, --verbose', 'Show detailed progress')
  .option('-d, --debug', 'Show raw Skyvern API response')
  .option('-e, --engine <engine>', 'Engine to use: browser-use or skyvern', 'browser-use')
  .action(async (url: string, goal: string, options: Record<string, unknown>) => {
    const startTime = Date.now();
    const engineType = options.engine as string;

    const spinner = ora({
      text: `Connecting to ${engineType}...`,
      spinner: 'dots',
    }).start();

    try {
      // Common result interface
      interface TaskResult {
        success: boolean;
        taskId?: string;
        elementFound?: boolean;
        transcript?: string;
        extractedInfo?: Record<string, unknown>;
        rawResponse?: unknown;
        error?: string;
        screenshotPath?: string;
      }

      // Format elapsed time helper
      const formatElapsed = (ms: number): string => {
        if (ms < 1000) return `${ms}ms`;
        const secs = Math.floor(ms / 1000);
        if (secs < 60) return `${secs}s`;
        const mins = Math.floor(secs / 60);
        return `${mins}m ${secs % 60}s`;
      };

      let result: TaskResult;
      let lastTaskId: string | undefined;

      if (engineType === 'browser-use') {
        const { BrowserUseServerEngine } = await import('../engines/browser-use-server.js');
        const engine = new BrowserUseServerEngine({
          debug: options.debug as boolean,
          timeout: parseInt(options.timeout as string, 10) * 1000,
        });

        const available = await engine.isAvailable();
        if (!available) {
          spinner.fail('Browser-Use Engine not available');
          console.error(chalk.red('\n  Start the engine with: docker-compose up -d'));
          process.exit(1);
        }

        spinner.text = `🎯 Starting task: ${chalk.cyan(goal)}`;
        const engineResult = await engine.runTask(url, goal);

        // Map to common result format
        result = {
          success: engineResult.success,
          taskId: 'local-task',
          elementFound: engineResult.success,
          transcript: engineResult.output,
          extractedInfo: engineResult.success
            ? { output: engineResult.output, steps: engineResult.steps }
            : undefined,
          rawResponse: engineResult.rawResponse,
          error: engineResult.error,
        };
      } else {
        // Skyvern Engine (Legacy)
        const { SkyvernEngine } = await import('../engines/skyvern.js');

        // Phase icons and colors
        const phaseConfig: Record<
          string,
          { icon: string; color: 'cyan' | 'yellow' | 'blue' | 'green' | 'red' }
        > = {
          connecting: { icon: '🔌', color: 'cyan' },
          queued: { icon: '⏳', color: 'yellow' },
          running: { icon: '🤖', color: 'blue' },
          processing: { icon: '⚙️', color: 'blue' },
          completed: { icon: '✓', color: 'green' },
          failed: { icon: '✗', color: 'red' },
        };

        const skyvern = new SkyvernEngine({
          timeout: parseInt(options.timeout as string, 10) * 1000,
          debug: options.debug as boolean,
          onProgress: (status) => {
            const config = phaseConfig[status.phase] ?? { icon: '•', color: 'cyan' as const };
            const elapsed = status.elapsed ? chalk.gray(` [${formatElapsed(status.elapsed)}]`) : '';

            // Build stats string
            const stats: string[] = [];
            if (status.stepCount && status.stepCount > 0) {
              stats.push(`${status.stepCount} step${status.stepCount > 1 ? 's' : ''}`);
            }
            if (status.screenshotCount && status.screenshotCount > 0) {
              stats.push(`📸 ${status.screenshotCount}`);
            }
            const statsStr = stats.length > 0 ? chalk.gray(` (${stats.join(', ')})`) : '';

            spinner.text = `${config.icon} ${chalk[config.color](status.message)}${statsStr}${elapsed}`;
            if (status.taskId) lastTaskId = status.taskId;
          },
        });

        const available = await skyvern.isAvailable();
        if (!available) {
          spinner.fail('Skyvern not available');
          console.error(
            chalk.red('\n  Start Skyvern with: docker-compose -f docker-compose.skyvern.yml up -d')
          );
          process.exit(1);
        }

        spinner.text = `🎯 Starting task: ${chalk.cyan(goal)}`;

        result = await skyvern.customTask(url, goal);
      } // End of else block for Skyvern

      const totalTime = Date.now() - startTime;

      spinner.stop();

      // Print header
      console.log('\n' + chalk.bold('═══════════════════════════════════════════════════════'));
      console.log(
        chalk.bold(`  ${engineType === 'browser-use' ? 'Browser-Use' : 'Skyvern'} Task Result`)
      );
      console.log(chalk.bold('═══════════════════════════════════════════════════════\n'));

      // Task info
      console.log(chalk.gray('  URL:      ') + chalk.cyan(url));
      console.log(chalk.gray('  Goal:     ') + goal);
      console.log(chalk.gray('  Task ID:  ') + (lastTaskId ?? result.taskId ?? 'unknown'));
      console.log(chalk.gray('  Duration: ') + formatElapsed(totalTime));
      console.log('');

      if (result.success) {
        console.log(chalk.green.bold('  ✓ TASK COMPLETED'));
        console.log('');

        // Goal achievement
        if (result.elementFound) {
          console.log(chalk.green('  🎯 Goal Achieved: Yes'));
        } else {
          console.log(chalk.yellow('  🎯 Goal Achieved: Unable to determine'));
        }

        // Screenshot
        if (result.screenshotPath) {
          console.log(chalk.gray('  📸 Screenshot: ') + result.screenshotPath);
        }

        // Transcript
        if (result.transcript && options.verbose) {
          console.log('');
          console.log(chalk.gray('  Transcript:'));
          console.log(chalk.italic('  ' + result.transcript));
        }

        // Extracted info
        if (result.extractedInfo && Object.keys(result.extractedInfo).length > 0) {
          console.log('');
          console.log(chalk.gray('  Extracted Info:'));
          for (const [key, value] of Object.entries(result.extractedInfo)) {
            console.log(chalk.gray(`    ${key}: `) + String(value));
          }
        }
      } else {
        console.log(chalk.red.bold('  ✗ TASK FAILED'));
        console.log('');
        console.log(chalk.red('  Error: ') + (result.error ?? 'Unknown error'));
      }

      // Debug output
      if (options.debug && result.rawResponse) {
        console.log('');
        console.log(
          chalk.gray(`  Raw ${engineType === 'browser-use' ? 'Browser-Use' : 'Skyvern'} Response:`)
        );
        console.log(chalk.gray(JSON.stringify(result.rawResponse, null, 2)));
      }

      console.log('\n' + chalk.bold('═══════════════════════════════════════════════════════\n'));

      if (!result.success) {
        process.exit(1);
      }
    } catch (error) {
      spinner.fail('Task failed');
      console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'));
      process.exit(1);
    }
  });

/**
 * Pretty print scan results to the console
 */
function printResults(result: ScanResult): void {
  console.log('\n' + chalk.bold('═══════════════════════════════════════════════════════'));
  console.log(chalk.bold('  AgentRank.it Audit Report'));
  console.log(chalk.bold('═══════════════════════════════════════════════════════\n'));

  // Meta info
  console.log(chalk.gray(`URL: ${result.meta.url}`));
  console.log(chalk.gray(`Mode: ${result.meta.mode}`));
  console.log(chalk.gray(`Duration: ${result.meta.durationMs}ms`));
  console.log(chalk.gray(`Cost: $${result.meta.costUsd.toFixed(4)}`));
  console.log('');

  // Agent Score
  const scoreColor = result.agentScore >= 80 ? 'green' : result.agentScore >= 50 ? 'yellow' : 'red';
  console.log(
    chalk.bold('Agent Visibility Score: ') + chalk[scoreColor](`${result.agentScore}/100`)
  );
  console.log('');

  // Signals
  console.log(chalk.bold('Signals:'));
  const signalOrder: (keyof typeof result.signals)[] = [
    'permissions',
    'structure',
    'accessibility',
    'hydration',
    'hostility',
  ];

  for (const signal of signalOrder) {
    const s = result.signals[signal];
    const statusIcon = s.status === 'pass' ? '✓' : s.status === 'warn' ? '⚠' : '✗';
    const statusColor = s.status === 'pass' ? 'green' : s.status === 'warn' ? 'yellow' : 'red';
    console.log(
      `  ${chalk[statusColor](statusIcon)} ${signal.padEnd(15)} ${chalk.gray(`(${s.weight}%)`)} ${s.details}`
    );
  }
  console.log('');

  // Escalation
  if (result.escalation.triggered) {
    console.log(chalk.yellow('⚠ Escalation triggered: ') + result.escalation.reason);
    console.log('');
  }

  // Narrative
  console.log(chalk.bold('Transcript:'));
  console.log(chalk.italic(result.narrative.transcript));
  console.log('');

  console.log(chalk.bold('═══════════════════════════════════════════════════════\n'));
}

program.parse();
