const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync(new URL('../resume-analyzer.html', import.meta.url), 'utf8');

function loadFunction(name) {
  const match = html.match(new RegExp('function ' + name + '\\([^)]*\\) \\{[\\s\\S]*?\\n\\}', 'm'));
  assert.ok(match, 'Expected function ' + name + ' to exist in resume-analyzer.html');
  const sandbox = {};
  vm.runInNewContext(match[0] + '\\nthis.result = ' + name + ';', sandbox);
  return sandbox.result;
}

test('extractTerms removes common stop words and duplicate terms', () => {
  const extractTerms = loadFunction('extractTerms');
  const terms = extractTerms('Python Python and React are useful for machine learning projects');
  assert.ok(terms.includes('python'));
  assert.ok(terms.includes('react'));
  assert.ok(terms.includes('machine'));
  assert.equal(terms.filter(term => term === 'python').length, 1);
  assert.ok(!terms.includes('and'));
});

test('extractTerms preserves common technical tokens', () => {
  const extractTerms = loadFunction('extractTerms');
  const terms = extractTerms('Built APIs with C++ and Node.js, plus HTML and CSS');
  assert.ok(terms.includes('c++'));
  assert.ok(terms.includes('node.js'));
  assert.ok(terms.includes('html'));
  assert.ok(terms.includes('css'));
});

test('escapeHtml encodes markup characters', () => {
  const escapeHtml = loadFunction('escapeHtml');
  assert.equal(escapeHtml('<script>alert("x")</script>'), '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
  assert.equal(escapeHtml("Tom & Jerry's"), 'Tom &amp; Jerry&#39;s');
});

test('the app does not call an AI provider directly from the browser', () => {
  assert.ok(!html.includes('api.anthropic.com/v1/messages'));
  assert.ok(html.includes('not an official ATS score or an AI judgment'));
});

test('the analysis flow validates resume and job description length', () => {
  assert.ok(html.includes('resume.length < 80 || jd.length < 80'));
  assert.ok(html.includes('Please enter a fuller resume and job description'));
});
