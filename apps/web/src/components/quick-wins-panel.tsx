"use client";

import { Lightbulb, Zap, Copy, Check } from "lucide-react";
import { useState } from "react";

/**
 * An improvement idea with priority and implementation guidance
 */
interface Idea {
    priority: "high" | "medium" | "low";
    signal: string;
    title: string;
    description: string;
    implementation: string;
    effort: "quick-win" | "moderate" | "major";
}

interface Signal {
    name: string;
    status: "pass" | "warn" | "fail";
    score: number;
    weight: number;
    details: string;
    recommendations?: string[];
}

interface QuickWinsPanelProps {
    signals: Signal[];
}

const effortConfig = {
    "quick-win": { label: "Quick Win", className: "bg-green-500/10 text-green-600" },
    "moderate": { label: "Moderate", className: "bg-yellow-500/10 text-yellow-600" },
    "major": { label: "Major", className: "bg-orange-500/10 text-orange-600" },
};

const priorityConfig = {
    high: { label: "High Priority", className: "text-red-500" },
    medium: { label: "Medium", className: "text-yellow-500" },
    low: { label: "Low", className: "text-gray-500" },
};

/**
 * Generate improvement ideas based on signals
 */
function generateIdeas(signals: Signal[]): Idea[] {
    const ideas: Idea[] = [];

    for (const signal of signals) {
        if (signal.status === "fail") {
            switch (signal.name) {
                case "permissions":
                    ideas.push({
                        priority: "high",
                        signal: "permissions",
                        title: "Unblock AI Agents",
                        description: "Your robots.txt blocks AI agents from accessing your site.",
                        implementation: `# Add to robots.txt
User-agent: GPTBot
Allow: /

User-agent: ClaudeBot
Allow: /`,
                        effort: "quick-win",
                    });
                    break;
                case "structure":
                    ideas.push({
                        priority: "high",
                        signal: "structure",
                        title: "Add Semantic HTML",
                        description: "Replace generic <div> tags with semantic elements.",
                        implementation: `<!-- Before -->
<div class="nav">...</div>

<!-- After -->
<nav aria-label="Main">...</nav>
<main>...</main>`,
                        effort: "moderate",
                    });
                    break;
                case "accessibility":
                    ideas.push({
                        priority: "high",
                        signal: "accessibility",
                        title: "Add ARIA Labels",
                        description: "Interactive elements need accessible labels.",
                        implementation: `<button aria-label="Close dialog">
  <svg>...</svg>
</button>

<input aria-label="Search" type="search">`,
                        effort: "moderate",
                    });
                    break;
                case "hydration":
                    ideas.push({
                        priority: "high",
                        signal: "hydration",
                        title: "Reduce Time to Interactive",
                        description: "Page takes too long to become interactive.",
                        implementation: `// Code-split heavy components
const HeavyComponent = dynamic(
  () => import('./Heavy'),
  { ssr: false }
);

// Defer non-critical scripts
<script src="analytics.js" defer />`,
                        effort: "major",
                    });
                    break;
                case "hostility":
                    ideas.push({
                        priority: "high",
                        signal: "hostility",
                        title: "Use Agent-Friendly Bot Protection",
                        description: "CAPTCHAs block AI agents from accessing your site.",
                        implementation: `// Allow known AI agents
const allowedAgents = ['GPTBot', 'ClaudeBot'];
if (allowedAgents.some(a => userAgent.includes(a))) {
  bypassCaptcha = true;
}`,
                        effort: "major",
                    });
                    break;
            }
        } else if (signal.status === "warn") {
            switch (signal.name) {
                case "structure":
                    ideas.push({
                        priority: "medium",
                        signal: "structure",
                        title: "Improve Semantic Density",
                        description: "Add more semantic landmarks for better agent navigation.",
                        implementation: `<header>...</header>
<nav>...</nav>
<main>
  <article>...</article>
</main>
<footer>...</footer>`,
                        effort: "quick-win",
                    });
                    break;
                case "hydration":
                    ideas.push({
                        priority: "medium",
                        signal: "hydration",
                        title: "Optimize JavaScript Loading",
                        description: "Consider code-splitting to improve load times.",
                        implementation: `// Dynamic imports for code-splitting
import dynamic from 'next/dynamic';

const Charts = dynamic(() => import('./Charts'), {
  loading: () => <Skeleton />
});`,
                        effort: "moderate",
                    });
                    break;
            }
        }
    }

    // Sort by priority and effort
    return ideas.sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        const effortOrder = { "quick-win": 0, moderate: 1, major: 2 };
        const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (priorityDiff !== 0) return priorityDiff;
        return effortOrder[a.effort] - effortOrder[b.effort];
    });
}

export function QuickWinsPanel({ signals }: QuickWinsPanelProps) {
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
    const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

    const ideas = generateIdeas(signals);
    const quickWins = ideas.filter((idea) => idea.effort === "quick-win").slice(0, 3);
    const otherIdeas = ideas.filter((idea) => idea.effort !== "quick-win").slice(0, 3);

    const allIdeas = [...quickWins, ...otherIdeas].slice(0, 5);

    if (allIdeas.length === 0) {
        return null;
    }

    const copyToClipboard = (text: string, index: number) => {
        navigator.clipboard.writeText(text);
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex(null), 2000);
    };

    return (
        <div className="rounded-lg border bg-card p-6">
            <div className="flex items-center gap-2 mb-4">
                <Zap className="h-5 w-5 text-yellow-500" />
                <h2 className="text-lg font-semibold">Improvement Ideas</h2>
            </div>

            <div className="space-y-4">
                {allIdeas.map((idea, idx) => (
                    <div
                        key={idx}
                        className="border rounded-lg p-4 hover:border-primary/50 transition-colors"
                    >
                        <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <Lightbulb className={`h-4 w-4 ${priorityConfig[idea.priority].className}`} />
                                    <span className="font-medium">{idea.title}</span>
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${effortConfig[idea.effort].className}`}>
                                        {effortConfig[idea.effort].label}
                                    </span>
                                </div>
                                <p className="text-sm text-muted-foreground">{idea.description}</p>
                            </div>
                        </div>

                        <button
                            onClick={() => setExpandedIndex(expandedIndex === idx ? null : idx)}
                            className="text-xs text-primary hover:underline mt-2"
                        >
                            {expandedIndex === idx ? "Hide code" : "Show code"}
                        </button>

                        {expandedIndex === idx && (
                            <div className="mt-3 relative">
                                <pre className="bg-muted p-3 rounded-md text-xs overflow-x-auto">
                                    <code>{idea.implementation}</code>
                                </pre>
                                <button
                                    onClick={() => copyToClipboard(idea.implementation, idx)}
                                    className="absolute top-2 right-2 p-1.5 rounded bg-background/80 hover:bg-background transition-colors"
                                    title="Copy code"
                                >
                                    {copiedIndex === idx ? (
                                        <Check className="h-3.5 w-3.5 text-green-500" />
                                    ) : (
                                        <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
