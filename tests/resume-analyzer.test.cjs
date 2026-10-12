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

test('company names are excluded from missing keywords and term extraction', () => {
  const companySentence = 'Acme Corp is hiring at Google, Microsoft, Amazon, Meta, and Netflix headquarters.';
  const terms = analyzer.extractTerms(companySentence);
  for (const company of ['acme', 'corp', 'google', 'microsoft', 'amazon', 'meta', 'netflix']) {
    assert.ok(!terms.includes(company), `extractTerms should exclude company name: ${company}`);
  }

  const resume = 'Summary: Python developer. Skills: Python, SQL, React. Projects: Built web application for 100 users. Education: Computer Science. Experience: Developed APIs and tested code. Certifications: Git.';
  const jdWithCompanies = 'Acme Corp and Google are seeking candidates with Python, Docker, Kubernetes, and Cloud. Our team at Microsoft partner solutions welcomes applicants.';
  const result = analyzer.analyze(resume, jdWithCompanies);

  for (const company of ['acme', 'corp', 'google', 'microsoft']) {
    assert.ok(!result.missingKeywords.includes(company), `missingKeywords must not include company name: ${company}`);
    assert.ok(!result.matchedKeywords.includes(company), `matchedKeywords must not include company name: ${company}`);
  }
  assert.ok(result.missingKeywords.includes('docker') || result.missingKeywords.includes('kubernetes'), 'should still capture actual missing skills');
});

test('generic hiring words and HR boilerplate are excluded from missing keywords and term extraction', () => {
  const boilerplate = 'Competitive salary, 401k benefits, health insurance, visa sponsorship, bachelor degree or master degree required for full-time remote role.';
  const terms = analyzer.extractTerms(boilerplate);
  for (const word of ['salary', 'benefits', 'insurance', 'visa', 'sponsorship', 'bachelor', 'degree', 'master', 'fulltime', 'remote']) {
    assert.ok(!terms.includes(word), `extractTerms should exclude generic hiring word: ${word}`);
  }

  const resume = 'Summary: Python developer. Skills: Python, SQL, React. Projects: Built web application for 100 users. Education: Computer Science. Experience: Developed APIs and tested code. Certifications: Git.';
  const jdWithBoilerplate = 'We offer competitive salary, health benefits, insurance, and visa sponsorship. Candidate must have a bachelor degree or master degree. Required skills: Python, Docker, and Kubernetes.';
  const result = analyzer.analyze(resume, jdWithBoilerplate);

  for (const word of ['salary', 'benefits', 'insurance', 'visa', 'sponsorship', 'bachelor', 'degree', 'master']) {
    assert.ok(!result.missingKeywords.includes(word), `missingKeywords must not include generic hiring word: ${word}`);
  }
  assert.ok(result.missingKeywords.includes('docker') || result.missingKeywords.includes('kubernetes'), 'should still include actual technical skills');
});

test('keyword score calculation is mathematically validated across boundaries', () => {
  // Test 0% match: Resume has completely disjoint skills from JD
  const resumeNoMatch = 'Summary: Ruby developer. Skills: Ruby, Rails, Heroku. Projects: Built legacy system for 10 users. Education: Computer Science. Experience: Maintained databases and code. Certifications: Linux.';
  const jdTech = 'We require a Python engineer with Docker, Kubernetes, AWS, and TypeScript expertise for cloud platform infrastructure.';
  const resultZero = analyzer.analyze(resumeNoMatch, jdTech);
  assert.equal(resultZero.keywordsScore, 0, 'keywordsScore should be 0% when zero keywords match');
  assert.equal(resultZero.matchedKeywords.length, 0, 'matchedKeywords should be empty when zero keywords match');
  assert.ok(resultZero.missingKeywords.length > 0, 'missingKeywords should contain JD requirements');

  // Test 100% match: Resume contains all relevant keywords in JD
  const resumeFullMatch = 'Summary: Python and Docker developer. Skills: Python, Docker, Kubernetes, AWS, TypeScript, cloud, platform, infrastructure. Projects: Built cloud platform systems for 500 users. Education: Computer Science. Experience: Deployed Kubernetes clusters and AWS infrastructure. Certifications: AWS.';
  const jdTechMatching = 'We require an experienced Python developer with Docker, Kubernetes, and AWS expertise for cloud platform infrastructure.';
  const resultFull = analyzer.analyze(resumeFullMatch, jdTechMatching);
  assert.equal(resultFull.keywordsScore, 100, 'keywordsScore should be 100% when all relevant keywords match');
  assert.equal(resultFull.missingKeywords.length, 0, 'missingKeywords should be empty when all keywords match');

  // Test ratio precision and non-inflation with corporate and HR noise
  const resumePartial = 'Summary: Python engineer with Docker. Skills: Python, Docker. Projects: Built containerized tools for 40 users. Education: Computer Science. Experience: Developed microservices and tested code. Certifications: Git.';
  const jdClean = 'Seeking an experienced engineer with skills in Python, Docker, Kubernetes, and AWS for cloud platform services.';
  const resultClean = analyzer.analyze(resumePartial, jdClean);

  const jdWithJunk = 'Google and Acme Corp offer competitive salary, health insurance, 401k benefits, visa sponsorship, bachelor degree. Seeking an experienced engineer with skills in Python, Docker, Kubernetes, and AWS for cloud platform services.';
  const resultWithJunk = analyzer.analyze(resumePartial, jdWithJunk);

  // Both should have identical technical keyword score because noise is excluded
  assert.equal(resultClean.keywordsScore, resultWithJunk.keywordsScore, 'keywordsScore should not be deflated by company names or HR boilerplate');
  assert.ok(resultWithJunk.keywordsScore >= 0 && resultWithJunk.keywordsScore <= 100, 'keywordsScore must be bounded between 0 and 100');
});

test('isExcludedTerm helper correctly filters noise while preserving valid technical tokens', () => {
  // Excluded entities
  assert.ok(analyzer.isExcludedTerm('google'));
  assert.ok(analyzer.isExcludedTerm('microsoft'));
  assert.ok(analyzer.isExcludedTerm('acme'));
  assert.ok(analyzer.isExcludedTerm('salary'));
  assert.ok(analyzer.isExcludedTerm('benefits'));
  assert.ok(analyzer.isExcludedTerm('visa'));
  assert.ok(analyzer.isExcludedTerm('sponsorship'));
  assert.ok(analyzer.isExcludedTerm('bachelor'));
  assert.ok(analyzer.isExcludedTerm('degree'));
  assert.ok(analyzer.isExcludedTerm('full-time'));

  // Valid technical terms preserved
  assert.ok(!analyzer.isExcludedTerm('python'));
  assert.ok(!analyzer.isExcludedTerm('react'));
  assert.ok(!analyzer.isExcludedTerm('docker'));
  assert.ok(!analyzer.isExcludedTerm('kubernetes'));
  assert.ok(!analyzer.isExcludedTerm('c++'));
  assert.ok(!analyzer.isExcludedTerm('node.js'));
  assert.ok(!analyzer.isExcludedTerm('ci/cd'));
});

test('UI template has all "Powered by Claude AI" branding removed', () => {
  assert.ok(!html.includes('Powered by Claude AI'), 'should not contain "Powered by Claude AI"');
  assert.ok(!html.includes('Claude AI'), 'should not contain any Claude AI branding');
  assert.ok(html.includes('nav-badge'), 'nav-badge should still exist');
});

test('UI includes sample data loaders and local file upload support', () => {
  assert.ok(html.includes('loadSampleResume'), 'UI should include loadSampleResume helper');
  assert.ok(html.includes('loadSampleJD'), 'UI should include loadSampleJD helper');
  assert.ok(html.includes('handleFileUpload'), 'UI should support local file reading');
  assert.ok(html.includes('updateCharCount'), 'UI should include live character counter');
  assert.ok(html.includes('clearAll'), 'UI should include clearAll function');
});

test('matched and missing keywords focus primarily on relevant technical skills', () => {
  const resume = 'Summary: Python developer. Skills: Python, React, SQL, Git. Projects: Built APIs in Python and React. Education: Computer Science. Experience: Developed APIs and tested services. Certifications: AWS.';
  const jd = 'Seeking a Software Engineer with skills in Python, React, Docker, Kubernetes, and FastAPI. Experience with cloud services and testing automation.';
  const result = analyzer.analyze(resume, jd);

  // Matched keywords should prioritize technical skills
  assert.ok(result.matchedKeywords.includes('python'), 'matched keywords should include python');
  assert.ok(result.matchedKeywords.includes('react'), 'matched keywords should include react');
  assert.ok(analyzer.SKILL_TERMS.includes(result.matchedKeywords[0]), 'first matched keyword should be a recognized skill term');

  // Missing keywords should prioritize technical skills
  assert.ok(result.missingKeywords.includes('docker'), 'missing keywords should prioritize docker');
  assert.ok(result.missingKeywords.includes('kubernetes'), 'missing keywords should prioritize kubernetes');
  assert.ok(result.missingKeywords.includes('fastapi'), 'missing keywords should prioritize fastapi');
  assert.ok(analyzer.SKILL_TERMS.includes(result.missingKeywords[0]), 'first missing keyword should be a recognized skill term');
});

test('scoring accuracy reflects calibrated formula and explanations are fully defined', () => {
  const resume = 'Summary: Python developer. Skills: Python, React, SQL, Git. Projects: Built web dashboard for 100 users. Education: Computer Science. Experience: Automated testing and deployed code. Certifications: AWS.';
  const jd = 'Seeking an experienced Python developer with React, Docker, Kubernetes, and AWS skills for cloud platform services.';
  const result = analyzer.analyze(resume, jd);

  // Test calibrated weighted formula
  const expectedOverall = Math.max(0, Math.min(100, Math.round(
    result.skillsScore * 0.35 +
    result.experienceScore * 0.20 +
    result.keywordsScore * 0.30 +
    result.formattingScore * 0.15
  )));
  assert.equal(result.overallScore, expectedOverall, 'overallScore should match exact weighted breakdown');

  // Test explanations completeness
  assert.ok(result.explanations.overall.includes(String(result.overallScore) + '%'));
  assert.ok(result.explanations.skills.includes(String(result.skillsScore) + '%'));
  assert.ok(result.explanations.experience.includes(String(result.experienceScore) + '%'));
  assert.ok(result.explanations.keywords.includes(String(result.keywordsScore) + '%'));
  assert.ok(result.explanations.formatting.includes(String(result.formattingScore) + '%'));
});


