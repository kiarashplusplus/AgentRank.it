/**
 * Ideas Generator
 *
 * Generates prioritized improvement opportunities based on scan signals.
 * Provides actionable suggestions with effort estimates.
 *
 * @license Apache-2.0
 * @author Kiarash Adl
 */

import type { Signals, SignalResult } from '../types/index.js';

/**
 * An improvement idea with priority and implementation guidance
 */
export interface Idea {
  priority: 'high' | 'medium' | 'low';
  signal: keyof Signals;
  title: string;
  description: string;
  implementation: string;
  effort: 'quick-win' | 'moderate' | 'major';
}

/**
 * Generate prioritized improvement ideas based on scan signals
 */
export function generateIdeas(signals: Signals): Idea[] {
  const ideas: Idea[] = [];

  // Analyze each signal and generate relevant ideas
  addPermissionsIdeas(signals.permissions, ideas);
  addStructureIdeas(signals.structure, ideas);
  addAccessibilityIdeas(signals.accessibility, ideas);
  addHydrationIdeas(signals.hydration, ideas);
  addHostilityIdeas(signals.hostility, ideas);

  // Sort by priority (high first) and effort (quick-wins first)
  return ideas.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    const effortOrder = { 'quick-win': 0, moderate: 1, major: 2 };

    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (priorityDiff !== 0) return priorityDiff;

    return effortOrder[a.effort] - effortOrder[b.effort];
  });
}

/**
 * Get top N quick-win ideas
 */
export function getQuickWins(signals: Signals, limit = 3): Idea[] {
  return generateIdeas(signals)
    .filter((idea) => idea.effort === 'quick-win')
    .slice(0, limit);
}

function addPermissionsIdeas(signal: SignalResult, ideas: Idea[]): void {
  if (signal.status === 'fail') {
    ideas.push({
      priority: 'high',
      signal: 'permissions',
      title: 'Unblock AI Agents in robots.txt',
      description:
        'Your robots.txt blocks AI agents, preventing them from accessing your site content.',
      implementation: `# Add to robots.txt
User-agent: GPTBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: Anthropic
Allow: /`,
      effort: 'quick-win',
    });
  } else if (signal.status === 'warn') {
    ideas.push({
      priority: 'medium',
      signal: 'permissions',
      title: 'Allow More AI Agents',
      description: 'Some AI agents are blocked. Consider allowing them for better visibility.',
      implementation: `# Update robots.txt to explicitly allow AI agents
User-agent: GPTBot
Allow: /

User-agent: ClaudeBot
Allow: /`,
      effort: 'quick-win',
    });
  }
}

function addStructureIdeas(signal: SignalResult, ideas: Idea[]): void {
  if (signal.status === 'fail') {
    ideas.push({
      priority: 'high',
      signal: 'structure',
      title: 'Replace Div Soup with Semantic HTML',
      description:
        'Your page uses too many generic <div> tags. AI agents rely on semantic HTML to understand page structure.',
      implementation: `<!-- Before: Div Soup -->
<div class="nav">...</div>
<div class="content">...</div>
<div class="sidebar">...</div>

<!-- After: Semantic HTML -->
<nav aria-label="Main">...</nav>
<main>...</main>
<aside>...</aside>`,
      effort: 'moderate',
    });

    ideas.push({
      priority: 'high',
      signal: 'structure',
      title: 'Add Page Heading (h1)',
      description: 'Ensure your page has a single h1 heading that describes its purpose.',
      implementation: `<h1>Your Page Title</h1>`,
      effort: 'quick-win',
    });
  } else if (signal.status === 'warn') {
    ideas.push({
      priority: 'medium',
      signal: 'structure',
      title: 'Improve Semantic Density',
      description: 'Add more semantic landmarks to help AI agents navigate your content.',
      implementation: `<!-- Add semantic landmarks -->
<header>...</header>
<nav aria-label="Main navigation">...</nav>
<main>
  <article>...</article>
  <section>...</section>
</main>
<footer>...</footer>`,
      effort: 'moderate',
    });
  }
}

function addAccessibilityIdeas(signal: SignalResult, ideas: Idea[]): void {
  if (signal.status === 'fail') {
    ideas.push({
      priority: 'high',
      signal: 'accessibility',
      title: 'Add Labels to Interactive Elements',
      description:
        'Many buttons and inputs lack accessible labels, making them invisible to AI agents.',
      implementation: `<!-- Add aria-label to icon buttons -->
<button aria-label="Close dialog">
  <svg>...</svg>
</button>

<!-- Associate labels with inputs -->
<label for="email">Email Address</label>
<input id="email" type="email">

<!-- Or use aria-label directly -->
<input aria-label="Search" type="search">`,
      effort: 'moderate',
    });
  } else if (signal.status === 'warn') {
    ideas.push({
      priority: 'medium',
      signal: 'accessibility',
      title: 'Complete Labeling of Elements',
      description:
        'Some interactive elements are missing labels. Complete labeling improves agent reliability.',
      implementation: `<!-- Ensure all buttons have text or aria-label -->
<button aria-label="Submit form">Submit</button>

<!-- Add alt text to images -->
<img src="chart.png" alt="Sales growth chart showing 25% increase">`,
      effort: 'quick-win',
    });
  }
}

function addHydrationIdeas(signal: SignalResult, ideas: Idea[]): void {
  if (signal.status === 'fail') {
    ideas.push({
      priority: 'high',
      signal: 'hydration',
      title: 'Implement Server-Side Rendering',
      description:
        'Your page takes too long to become interactive. SSR provides instant content for AI agents.',
      implementation: `// Next.js example: Enable SSR
export async function getServerSideProps() {
  const data = await fetchData();
  return { props: { data } };
}

// Or use static generation for even faster loads
export async function getStaticProps() {
  const data = await fetchData();
  return { props: { data }, revalidate: 3600 };
}`,
      effort: 'major',
    });

    ideas.push({
      priority: 'high',
      signal: 'hydration',
      title: 'Defer Non-Critical JavaScript',
      description: 'Load non-essential scripts after the page is interactive.',
      implementation: `<!-- Defer non-critical scripts -->
<script src="analytics.js" defer></script>
<script src="tracking.js" defer></script>

<!-- Or load them dynamically -->
<script>
  window.addEventListener('load', () => {
    const script = document.createElement('script');
    script.src = 'non-critical.js';
    document.body.appendChild(script);
  });
</script>`,
      effort: 'moderate',
    });
  } else if (signal.status === 'warn') {
    ideas.push({
      priority: 'medium',
      signal: 'hydration',
      title: 'Optimize JavaScript Bundle',
      description: 'Reduce hydration time by splitting your JavaScript bundle.',
      implementation: `// Dynamic imports for code-splitting
const HeavyComponent = dynamic(() => import('./HeavyComponent'), {
  loading: () => <Skeleton />,
  ssr: false,
});`,
      effort: 'moderate',
    });
  }
}

function addHostilityIdeas(signal: SignalResult, ideas: Idea[]): void {
  if (signal.status === 'fail') {
    if (signal.details.includes('CAPTCHA') || signal.details.includes('Turnstile')) {
      ideas.push({
        priority: 'high',
        signal: 'hostility',
        title: 'Use Agent-Friendly Bot Protection',
        description:
          'CAPTCHAs block AI agents. Consider alternatives that allow legitimate agent access.',
        implementation: `// Option 1: Allow known AI agents
// Add to your server configuration
const allowedAgents = ['GPTBot', 'ClaudeBot', 'Anthropic'];
if (allowedAgents.some(a => userAgent.includes(a))) {
  bypassCaptcha = true;
}

// Option 2: Use honeypot instead of CAPTCHA
<input type="text" name="website" style="display:none" tabindex="-1" autocomplete="off">
// If this hidden field is filled, it's a bot (spam bots fill all fields)`,
        effort: 'major',
      });
    }

    ideas.push({
      priority: 'high',
      signal: 'hostility',
      title: 'Remove Navigation Traps',
      description: 'Broken links and void JavaScript handlers trap AI agents in loops.',
      implementation: `<!-- Before: Navigation trap -->
<a href="javascript:void(0)" onclick="doSomething()">Click me</a>
<a href="#">Go somewhere</a>

<!-- After: Proper navigation -->
<button onclick="doSomething()">Click me</button>
<a href="/destination">Go somewhere</a>`,
      effort: 'quick-win',
    });
  } else if (signal.status === 'warn') {
    ideas.push({
      priority: 'medium',
      signal: 'hostility',
      title: 'Clean Up Navigation Traps',
      description: 'Remove remaining void links and JavaScript href handlers.',
      implementation: `// Convert JavaScript links to buttons
<button type="button" onclick="openModal()">Open</button>

// Use real href for navigation
<a href="/about">About Us</a>`,
      effort: 'quick-win',
    });
  }
}
