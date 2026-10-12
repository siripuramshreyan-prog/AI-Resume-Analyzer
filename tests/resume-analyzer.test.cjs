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

test('term extraction filters generic job-posting noise words', () => {
  const text = 'Our company is looking for qualified candidates and we welcome applications';
  const terms = analyzer.extractTerms(text);
  assert.ok(!terms.includes('company'), 'should filter "company"');
  assert.ok(!terms.includes('welcome'), 'should filter "welcome"');
  assert.ok(!terms.includes('looking'), 'should filter "looking"');
  assert.ok(!terms.includes('candidates'), 'should filter "candidates"');
});

test('meaningful job-related skills and requirements are prioritized', () => {
  const jd = 'Our company is looking for candidates skilled in Python, Docker, and C++ to join our team';
  const terms = analyzer.extractTerms(jd);
  assert.ok(terms.includes('python'));
  assert.ok(terms.includes('docker'));
  assert.ok(terms.includes('c++'));
  assert.ok(!terms.includes('company'));
  assert.ok(!terms.includes('looking'));
  assert.ok(!terms.includes('candidates'));
});

test('keyword score accurately reflects matched versus missing keywords', () => {
  const resume = 'Summary: Python developer experienced in React and SQL. Skills: Python, React, SQL. Projects: Built APIs for 50 users. Education: Computer Science. Experience: Developed services and tested code. Certifications: Git.';
  const jdWithMissing = 'We require a Python developer with skills in React, Docker, Kubernetes, and Cloud. Experience developing scalable services is preferred for this role.';
  const result = analyzer.analyze(resume, jdWithMissing);
  assert.ok(result.matchedKeywords.length > 0, 'should have matched keywords');
  assert.ok(result.missingKeywords.length > 0, 'should have missing keywords');
  // Keyword score must accurately reflect ratio and not be artificially inflated to 100%
  assert.ok(result.keywordsScore < 100, 'keywordsScore should not be 100% when key requirements are missing');
  assert.ok(result.keywordsScore > 0, 'keywordsScore should be > 0 when some keywords match');
  assert.ok(result.matchedKeywords.includes('python'));
  assert.ok(result.missingKeywords.includes('docker') || result.missingKeywords.includes('kubernetes'));
});

test('analysis provides clear score explanations for each category', () => {
  const resume = 'Summary: Python developer. Skills: Python, SQL, React. Projects: Built a dashboard for 25 users. Education: Computer Science. Experience: Developed APIs and tested services. Certifications: Git.';
  const jd = 'We require a Python developer with SQL, React, Docker, cloud, and communication skills. Experience developing APIs and testing software is preferred for this role.';
  const result = analyzer.analyze(resume, jd);
  assert.ok(result.explanations, 'result must include explanations object');
  for (const cat of ['overall', 'skills', 'experience', 'keywords', 'formatting']) {
    assert.equal(typeof result.explanations[cat], 'string');
    assert.ok(result.explanations[cat].length > 10, `${cat} explanation should be substantive`);
    assert.match(result.explanations[cat], /\d+%/);
  }
});
