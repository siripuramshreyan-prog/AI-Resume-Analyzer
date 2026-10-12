/* ResumeIQ analysis utilities. Runs locally; no network requests are made here. */
(function (root) {
  'use strict';

  const STOP_WORDS = new Set(
    'about above after again also and any are because been before being both but can could does doing down each few for from further had has have having here how into its just more most not now off once only other our out over own same should some such than that the their them then there these they this those through too under until very was were what when where which while who will with would you your job role work team years experience required preferred'.split(' ')
  );

  function extractTerms(text) {
    return [...new Set((String(text).toLowerCase().match(/[a-z][a-z0-9+#.-]{1,}/g) || [])
      .map(term => (term === 'c++' || term.startsWith('c++'))
        ? term.replace(/^[.+#-]+|[.#-]+$/g, '')
        : term.replace(/^[.+#-]+|[.+#-]+$/g, ''))
      .filter(term => term.length > 2 && !STOP_WORDS.has(term)))];
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[char]));
  }

  function analyze(resume, jobDescription) {
    const resumeText = String(resume || '').trim();
    const jdText = String(jobDescription || '').trim();
    if (resumeText.length < 80 || jdText.length < 80) {
      throw new Error('Resume and job description must each contain at least 80 characters.');
    }

    const resumeLower = resumeText.toLowerCase();
    const jdLower = jdText.toLowerCase();
    const jdTerms = [...new Set(extractTerms(jdText).filter(term => term.length > 3 || term === 'c++'))];
    const resumeTerms = new Set(extractTerms(resumeText));
    const matchedKeywords = jdTerms.filter(term => resumeTerms.has(term)).slice(0, 12);
    const missingKeywords = jdTerms.filter(term => !resumeTerms.has(term)).slice(0, 10);
    const keywordsScore = jdTerms.length
      ? Math.round(Math.min(100, matchedKeywords.length / Math.min(jdTerms.length, 12) * 100))
      : 0;

    const skillTerms = [
      'python','javascript','typescript','react','node','sql','java','c++','aws',
      'docker','kubernetes','git','api','testing','communication','leadership',
      'analysis','machine learning','data','agile','html','css','flask','django',
      'fastapi','mongodb','postgresql','linux','cloud','excel'
    ];
    const jdSkills = skillTerms.filter(skill => jdLower.includes(skill));
    const skillsScore = jdSkills.length
      ? Math.round(jdSkills.filter(skill => resumeLower.includes(skill)).length / jdSkills.length * 100)
      : keywordsScore;

    const actionSignals = (resumeText.match(/\b(built|created|delivered|designed|developed|improved|increased|led|reduced|automated|implemented|managed|deployed|tested)\b/gi) || []).length;
    const experienceScore = Math.min(100, 25 + actionSignals * 8);
    const sections = ['education','skills','projects','experience','summary','certifications'];
    const sectionCount = sections.filter(section => new RegExp('\\b' + section + '\\b', 'i').test(resumeText)).length;
    const formattingScore = Math.round(sectionCount / sections.length * 100);
    const overallScore = Math.round(skillsScore * 0.35 + experienceScore * 0.20 + keywordsScore * 0.30 + formattingScore * 0.15);

    const suggestions = [];
    if (missingKeywords.length) suggestions.push('If accurate, include relevant job-description terms such as: ' + missingKeywords.slice(0, 5).join(', ') + '.');
    if (sectionCount < 5) suggestions.push('Use clear standard sections such as Summary, Skills, Experience, Projects, Education, and Certifications where relevant.');
    if (!/\b(built|created|delivered|designed|developed|improved|increased|led|reduced|automated|implemented)\b/i.test(resumeText)) suggestions.push('Start project and experience bullets with specific action verbs that describe your contribution.');
    if (!/\b(\d+%|\d+\+|\$\d+|\d+ users|\d+ projects)\b/i.test(resumeText)) suggestions.push('Add truthful measurable outcomes where possible, such as users supported or performance improved.');
    if (!/\b(project|github|portfolio)\b/i.test(resumeText)) suggestions.push('Include relevant projects and links to code or a portfolio if available.');
    if (suggestions.length < 5) suggestions.push('Tailor the top section of your resume to the target role and prioritize relevant experience.');
    if (suggestions.length < 5) suggestions.push('Proofread for consistent dates, tense, punctuation, and bullet formatting.');

    return {
      overallScore, skillsScore, experienceScore, keywordsScore, formattingScore,
      matchedKeywords, missingKeywords, suggestions: suggestions.slice(0, 5),
      summary: 'This is a local keyword and resume-structure comparison, not an official ATS score or an AI judgment. It found ' +
        matchedKeywords.length + ' overlapping terms and ' + missingKeywords.length +
        ' possible missing terms. Only add information that accurately reflects your experience.'
    };
  }

  const api = Object.freeze({ analyze, extractTerms, escapeHtml });
  root.ResumeAnalyzer = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
