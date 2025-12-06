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
  .description('The PageSpeed Insights for the Agentic Web')
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
  .description('Run a custom Skyvern task (Vision-LLM)')
  .argument('<url>', 'URL to navigate to')
  .argument('<goal>', 'The task goal (e.g., "Click the Sign Up button")')
  .option('-t, --timeout <seconds>', 'Timeout in seconds', '300')
  .action(async (url: string, goal: string, options: Record<string, unknown>) => {
    const spinner = ora('Initializing Skyvern task...').start();

    try {
      const { SkyvernEngine } = await import('../engines/skyvern.js');
      const skyvern = new SkyvernEngine({
        timeout: parseInt(options.timeout as string, 10) * 1000,
      });

      const available = await skyvern.isAvailable();
      if (!available) {
        spinner.fail('Skyvern not available');
        console.error(chalk.red('Start Skyvern with: docker-compose -f docker-compose.skyvern.yml up -d'));
        process.exit(1);
      }

      spinner.text = `Running task: ${chalk.cyan(goal)}`;

      const result = await skyvern.customTask(url, goal);

      spinner.stop();

      if (result.success) {
        console.log(chalk.green('\n✓ Task completed successfully'));
        console.log(chalk.gray(`Task ID: ${result.taskId}`));
        if (result.screenshotPath) {
          console.log(chalk.gray(`Screenshot: ${result.screenshotPath}`));
        }
        console.log(chalk.gray(`Result: ${result.transcript}`));
      } else {
        console.log(chalk.red('\n✗ Task failed'));
        console.log(chalk.red(`Error: ${result.error}`));
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
