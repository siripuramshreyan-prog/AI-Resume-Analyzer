const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const analyzer = require('../js/analyzer.js');

const html = fs.readFileSync(path.join(__dirname, '..', 'resume-analyzer.html'), 'utf8');

test('term extraction removes common stop words and duplicate terms', () => {
  const terms = analyzer.extractTerms('Python Python and React are useful for machine learning projects');
  assert.ok(terms.includes('python'));
  assert.ok(terms.includes('react'));
  assert.ok(terms.includes('machine'));
  assert.equal(terms.filter(term => term === 'python').length, 1);
  assert.ok(!terms.includes('and'));
});

test('term extraction preserves common technical tokens', () => {
  const terms = analyzer.extractTerms('Built APIs with C++ and Node.js, plus HTML and CSS');
  assert.ok(terms.includes('c++'));
  assert.ok(terms.includes('node.js'));
  assert.ok(terms.includes('html'));
  assert.ok(terms.includes('css'));
});

test('HTML escaping encodes markup characters', () => {
  assert.equal(analyzer.escapeHtml('<script>alert("x")</script>'), '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
  assert.equal(analyzer.escapeHtml("Tom & Jerry's"), 'Tom &amp; Jerry&#39;s');
});

test('analysis returns bounded scores and keyword lists', () => {
  const resume = 'Summary: Python developer. Skills: Python, SQL, React. Projects: Built a dashboard for 25 users. Education: Computer Science. Experience: Developed APIs and tested services. Certifications: Git.';
  const jd = 'We require a Python developer with SQL, React, Docker, cloud, and communication skills. Experience developing APIs and testing software is preferred for this role.';
  const result = analyzer.analyze(resume, jd);
  for (const key of ['overallScore','skillsScore','experienceScore','keywordsScore','formattingScore']) {
    assert.ok(Number.isFinite(result[key]), key + ' should be a finite number');
    assert.ok(result[key] >= 0 && result[key] <= 100, key + ' should be between 0 and 100');
  }
  assert.ok(result.matchedKeywords.includes('python'));
  assert.ok(result.missingKeywords.includes('docker'));
  assert.ok(result.suggestions.length <= 5);
});

test('analysis rejects too-short inputs', () => {
  assert.throws(() => analyzer.analyze('short', 'also short'), /at least 80 characters/);
});

test('the browser UI loads the module and does not call an AI provider directly', () => {
  assert.ok(html.includes('<script src="js/analyzer.js"></script>'));
  assert.ok(!html.includes('api.anthropic.com/v1/messages'));
  assert.match(html, /not an official ATS score or an AI judgment/);
});

test('analysis UI validates input and reports local processing', () => {
  assert.match(html, /resume\.length < 80 \|\| jd\.length < 80/);
  assert.match(html, /Analyzing locally\.\.\./);
  assert.match(html, /window\.ResumeAnalyzer\.analyze\(resume, jd\)/);
});
