/**
 * Transcript Generator Tests
 *
 * Tests for the transcript generation and error humanization.
 *
 * @license Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { generateTranscript, humanizeError, createNarrativeStep } from './generator.js';
import type { NarrativeStep } from '../types/index.js';

describe('Transcript Generator', () => {
  describe('generateTranscript', () => {
    it('should return default message for empty steps', () => {
      const result = generateTranscript([]);
      expect(result).toBe('No actions were recorded during this scan.');
    });

    it('should join multiple step narratives', () => {
      const steps: NarrativeStep[] = [
        { action: 'navigate', result: 'success', humanReadable: 'I navigated to the page.' },
        { action: 'analyze', result: 'success', humanReadable: 'I analyzed the structure.' },
      ];
      const result = generateTranscript(steps);
      expect(result).toBe('I navigated to the page. I analyzed the structure.');
    });

    it('should handle single step', () => {
      const steps: NarrativeStep[] = [
        { action: 'navigate', result: 'success', humanReadable: 'I navigated to the page.' },
      ];
      const result = generateTranscript(steps);
      expect(result).toBe('I navigated to the page.');
    });
  });

  describe('humanizeError', () => {
    describe('TimeoutError handling', () => {
      it('should humanize timeout with selector', () => {
        const result = humanizeError('TimeoutError: selector "btn-buy" not found');
        expect(result).toContain('btn-buy');
        expect(result).toContain('never appeared');
      });

      it('should humanize generic timeout', () => {
        const result = humanizeError('timeout after 30000ms');
        expect(result).toContain('waited too long');
        expect(result).toContain('performance issues');
      });
    });

    describe('Element not found handling', () => {
      it('should humanize element not found with name', () => {
        const result = humanizeError('NodeNotFound: "submit-button" not found');
        expect(result).toContain('submit-button');
        expect(result).toContain("couldn't find");
      });

      it('should humanize generic not found', () => {
        const result = humanizeError('Element not found');
        expect(result).toContain("couldn't find the element");
      });
    });

    describe('Element intercepted handling', () => {
      it('should humanize ElementIntercepted error', () => {
        const result = humanizeError('ElementIntercepted: button covered by modal');
        expect(result).toContain('blocking');
        expect(result).toContain('popup');
      });

      it('should humanize intercept variant', () => {
        const result = humanizeError('click intercept detected');
        expect(result).toContain('blocking');
      });
    });

    describe('Not clickable handling', () => {
      it('should humanize NotClickable error', () => {
        const result = humanizeError('NotClickable: element is disabled');
        expect(result).toContain("wasn't interactive");
      });

      it('should humanize disabled element', () => {
        const result = humanizeError('Button is disabled');
        expect(result).toContain("wasn't interactive");
      });
    });

    describe('Navigation error handling', () => {
      it('should humanize navigation error', () => {
        const result = humanizeError('Navigation failed unexpectedly');
        expect(result).toContain('trouble navigating');
      });

      it('should humanize navigate variant', () => {
        const result = humanizeError('Failed to navigate to page');
        expect(result).toContain('trouble navigating');
      });
    });

    describe('DNS/Network error handling', () => {
      it('should humanize ENOTFOUND error', () => {
        const result = humanizeError('ENOTFOUND example.com');
        expect(result).toContain("couldn't reach");
        expect(result).toContain('domain');
      });

      it('should humanize DNS error', () => {
        const result = humanizeError('DNS resolution failed');
        expect(result).toContain("couldn't reach");
      });
    });

    describe('SSL error handling', () => {
      it('should humanize SSL error', () => {
        const result = humanizeError('SSL_ERROR_HANDSHAKE_FAILURE');
        expect(result).toContain('security certificate');
      });

      it('should humanize certificate error', () => {
        const result = humanizeError('Invalid certificate chain');
        expect(result).toContain('certificate');
      });
    });

    describe('CAPTCHA handling', () => {
      it('should humanize captcha error', () => {
        const result = humanizeError('captcha detected on page');
        expect(result).toContain('CAPTCHA');
        expect(result).toContain('prevents automated');
      });

      it('should humanize CAPTCHA uppercase', () => {
        const result = humanizeError('CAPTCHA challenge required');
        expect(result).toContain('CAPTCHA');
      });
    });

    describe('Cloudflare handling', () => {
      it('should humanize cloudflare error', () => {
        const result = humanizeError('cloudflare protection active');
        expect(result).toContain('Cloudflare');
        expect(result).toContain('blocking');
      });

      it('should humanize cf- prefixed error', () => {
        const result = humanizeError('cf-challenge detected');
        expect(result).toContain('Cloudflare');
      });
    });

    describe('Default fallback', () => {
      it('should return truncated error for unknown type', () => {
        const result = humanizeError('Some random unknown error');
        expect(result).toContain('encountered an issue');
        expect(result).toContain('Some random unknown error');
      });

      it('should truncate long errors', () => {
        const longError = 'x'.repeat(200);
        const result = humanizeError(longError);
        expect(result.length).toBeLessThan(200);
        expect(result).toContain('...');
      });
    });
  });

  describe('createNarrativeStep', () => {
    describe('navigate action', () => {
      it('should create success narrative for navigate', () => {
        const step = createNarrativeStep('navigate', 'success');
        expect(step.action).toBe('navigate');
        expect(step.result).toBe('success');
        expect(step.humanReadable).toContain('successfully navigated');
      });

      it('should create failure narrative for navigate', () => {
        const step = createNarrativeStep('navigate', 'failure', 'ENOTFOUND example.com');
        expect(step.result).toBe('failure');
        expect(step.humanReadable).toContain("couldn't reach");
      });
    });

    describe('analyze action', () => {
      it('should create success narrative for analyze', () => {
        const step = createNarrativeStep('analyze', 'success');
        expect(step.humanReadable).toContain('analyzed the page');
      });

      it('should create failure narrative for analyze', () => {
        const step = createNarrativeStep('analyze', 'failure');
        expect(step.humanReadable).toContain('trouble analyzing');
      });
    });

    describe('hostility_check action', () => {
      it('should create success narrative for hostility_check', () => {
        const step = createNarrativeStep('hostility_check', 'success');
        expect(step.humanReadable).toContain('open to AI agents');
      });

      it('should create failure narrative with details', () => {
        const step = createNarrativeStep('hostility_check', 'failure', 'CAPTCHA detected');
        expect(step.humanReadable).toContain('barriers');
        expect(step.humanReadable).toContain('CAPTCHA');
      });
    });

    describe('escalation action', () => {
      it('should create escalation narrative', () => {
        const step = createNarrativeStep('escalation', 'success');
        expect(step.humanReadable).toContain('escalated');
        expect(step.humanReadable).toContain('visual analysis');
      });
    });

    describe('click action', () => {
      it('should create success narrative for click', () => {
        const step = createNarrativeStep('click', 'success');
        expect(step.humanReadable).toContain('clicked');
        expect(step.humanReadable).toContain('successfully');
      });

      it('should create failure narrative for click', () => {
        const step = createNarrativeStep('click', 'failure', 'ElementIntercepted');
        expect(step.humanReadable).toContain('blocking');
      });
    });

    describe('type action', () => {
      it('should create success narrative for type', () => {
        const step = createNarrativeStep('type', 'success');
        expect(step.humanReadable).toContain('entered the text');
      });

      it('should create failure narrative for type', () => {
        const step = createNarrativeStep('type', 'failure', 'NotClickable');
        expect(step.humanReadable).toContain("wasn't interactive");
      });
    });

    describe('unknown action', () => {
      it('should create success narrative for unknown action', () => {
        const step = createNarrativeStep('custom_action', 'success');
        expect(step.humanReadable).toContain('completed the custom_action action');
      });

      it('should create failure narrative for unknown action', () => {
        const step = createNarrativeStep('custom_action', 'failure', 'timeout');
        expect(step.humanReadable).toContain('waited too long');
      });
    });

    it('should preserve rawLog in step', () => {
      const step = createNarrativeStep('click', 'failure', 'Original error message');
      expect(step.rawLog).toBe('Original error message');
    });
  });
});
