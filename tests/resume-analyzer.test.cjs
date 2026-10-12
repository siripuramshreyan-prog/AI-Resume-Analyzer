const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'resume-analyzer.html'), 'utf8');

test('term extraction helper is present and removes common stop words', () => {
  assert.match(html, /function extractTerms\(text\)/);
  assert.match(html, /stopWords = new Set/);
  assert.match(html, /new Set\(\(text\.toLowerCase\(\)\.match/);
});

test('user-provided HTML output is escaped before rendering', () => {
  assert.match(html, /function escapeHtml\(value\)/);
  assert.match(html, /escapeHtml\(s\)/);
  assert.match(html, /escapeHtml\(k\)/);
});

test('the app does not call an AI provider directly from the browser', () => {
  assert.ok(!html.includes('api.anthropic.com/v1/messages'));
  assert.match(html, /not an official ATS score or an AI judgment/);
});

test('analysis validates resume and job-description length', () => {
  assert.match(html, /resume\.length < 80 \|\| jd\.length < 80/);
  assert.match(html, /Please enter a fuller resume and job description/);
});

test('analysis presents local processing feedback', () => {
  assert.match(html, /Analyzing locally\.\.\./);
  assert.match(html, /function analyzeResume\(\)/);
});
