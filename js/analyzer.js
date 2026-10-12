/* ResumeIQ analysis utilities. Runs locally; no network requests are made here. */
(function (root) {
  'use strict';

  const STOP_WORDS = new Set([
    // Common English stop words
    'about','above','after','again','also','and','any','are','because','been',
    'before','being','both','but','can','could','does','doing','down','each',
    'few','for','from','further','had','has','have','having','here','how',
    'into','its','just','more','most','not','now','off','once','only','other',
    'our','out','over','own','same','should','some','such','than','that',
    'the','their','them','then','there','these','they','this','those','through',
    'too','under','until','very','was','were','what','when','where','which',
    'while','who','will','with','would','you','your',
    // Generic job-posting filler and noise words
    'company','companies','welcome','welcomes','welcoming',
    'looking','look','looks','candidate','candidates',
    'applicant','applicants','application','applications','apply','applying',
    'join','joining','joins','seeking','seek','seeks',
    'opportunity','opportunities','position','positions',
    'role','roles','job','jobs','work','working',
    'team','teams','year','years','experience','experienced',
    'required','preferred','requirement','requirements','require','requires',
    'responsibility','responsibilities','responsible',
    'qualification','qualifications','qualified',
    'hire','hiring','hired','help','helping',
    'ideal','must','able','duties','overview','description'
  ]);

  const SKILL_TERMS = [
    'python','javascript','typescript','react','node','node.js','sql','java','c++','c#',
    'aws','docker','kubernetes','git','api','apis','testing','communication','leadership',
    'analysis','machine learning','data','agile','html','css','flask','django',
    'fastapi','mongodb','postgresql','linux','cloud','excel','ci/cd','devops',
    'graphql','rest','vue','angular','go','golang','rust','ruby','php','microservices',
    'scrum','redis','kafka','spark','pandas','numpy','scikit-learn','tensorflow','pytorch',
    'nosql','terraform','problem solving','collaboration'
  ];

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

  function isSkillTerm(term) {
    return SKILL_TERMS.some(s => s === term || s.includes(term) || term.includes(s));
  }

  function analyze(resume, jobDescription) {
    const resumeText = String(resume || '').trim();
    const jdText = String(jobDescription || '').trim();
    if (resumeText.length < 80 || jdText.length < 80) {
      throw new Error('Resume and job description must each contain at least 80 characters.');
    }

    const resumeLower = resumeText.toLowerCase();
    const jdLower = jdText.toLowerCase();

    // Extract terms from JD and resume
    const jdExtracted = extractTerms(jdText).filter(term => term.length > 3 || term === 'c++');
    const resumeTerms = new Set(extractTerms(resumeText));

    // Identify target skills mentioned in the job description
    const jdSkills = SKILL_TERMS.filter(skill => jdLower.includes(skill));
    const matchedSkills = jdSkills.filter(skill => resumeLower.includes(skill));
    const missingSkills = jdSkills.filter(skill => !resumeLower.includes(skill));

    // Prioritize meaningful skills and requirements over generic terms
    const jdTerms = [...new Set(jdExtracted)].sort((a, b) => {
      const aSkill = isSkillTerm(a);
      const bSkill = isSkillTerm(b);
      if (aSkill && !bSkill) return -1;
      if (!aSkill && bSkill) return 1;
      return 0;
    });

    const allMatched = jdTerms.filter(term => resumeTerms.has(term));
    const allMissing = jdTerms.filter(term => !resumeTerms.has(term));
    const totalRelevant = jdTerms.length;

    // Accurate keyword score directly reflecting matched vs total relevant keywords
    const keywordsScore = totalRelevant > 0
      ? Math.round((allMatched.length / totalRelevant) * 100)
      : 0;

    const matchedKeywords = allMatched.slice(0, 12);
    const missingKeywords = allMissing.slice(0, 10);

    const skillsScore = jdSkills.length
      ? Math.round((matchedSkills.length / jdSkills.length) * 100)
      : keywordsScore;

    const actionSignals = (resumeText.match(/\b(built|created|delivered|designed|developed|improved|increased|led|reduced|automated|implemented|managed|deployed|tested)\b/gi) || []).length;
    const experienceScore = Math.min(100, 25 + actionSignals * 8);
    const sections = ['education','skills','projects','experience','summary','certifications'];
    const sectionCount = sections.filter(section => new RegExp('\\b' + section + '\\b', 'i').test(resumeText)).length;
    const formattingScore = Math.round(sectionCount / sections.length * 100);
    const overallScore = Math.round(skillsScore * 0.35 + experienceScore * 0.20 + keywordsScore * 0.30 + formattingScore * 0.15);

    const explanations = {
      overall: `Overall score (${overallScore}%): Weighted combination of skills alignment (35%), keyword coverage (30%), experience fit (20%), and resume formatting (15%).`,
      skills: jdSkills.length
        ? `Skills alignment (${skillsScore}%): Matched ${matchedSkills.length} of ${jdSkills.length} target skills from the job description${matchedSkills.length ? ' (' + matchedSkills.slice(0, 4).join(', ') + ')' : ''}.`
        : `Skills alignment (${skillsScore}%): Derived from keyword overlap (${keywordsScore}%) as no explicit target skills were detected.`,
      experience: `Experience fit (${experienceScore}%): Found ${actionSignals} action verbs and contribution signals across project and work history.`,
      keywords: `Keywords match (${keywordsScore}%): Matched ${allMatched.length} of ${totalRelevant} relevant keywords with ${allMissing.length} missing.`,
      formatting: `Resume formatting (${formattingScore}%): Included ${sectionCount} of ${sections.length} recommended sections (${sections.filter(s => new RegExp('\\b' + s + '\\b', 'i').test(resumeText)).join(', ')}).`
    };

    const suggestions = [];
    if (missingSkills.length) suggestions.push('If accurate, highlight missing target skills such as: ' + missingSkills.slice(0, 4).join(', ') + '.');
    else if (missingKeywords.length) suggestions.push('If accurate, include relevant job-description terms such as: ' + missingKeywords.slice(0, 5).join(', ') + '.');
    if (sectionCount < 5) suggestions.push('Use clear standard sections such as Summary, Skills, Experience, Projects, Education, and Certifications where relevant.');
    if (!/\b(built|created|delivered|designed|developed|improved|increased|led|reduced|automated|implemented)\b/i.test(resumeText)) suggestions.push('Start project and experience bullets with specific action verbs that describe your contribution.');
    if (!/\b(\d+%|\d+\+|\$\d+|\d+ users|\d+ projects)\b/i.test(resumeText)) suggestions.push('Add truthful measurable outcomes where possible, such as users supported or performance improved.');
    if (!/\b(project|github|portfolio)\b/i.test(resumeText)) suggestions.push('Include relevant projects and links to code or a portfolio if available.');
    if (suggestions.length < 5) suggestions.push('Tailor the top section of your resume to the target role and prioritize relevant experience.');
    if (suggestions.length < 5) suggestions.push('Proofread for consistent dates, tense, punctuation, and bullet formatting.');

    const summary = 'This is a local keyword and resume-structure comparison, not an official ATS score or an AI judgment. It found ' +
      allMatched.length + ' overlapping terms and ' + allMissing.length +
      ' possible missing terms across ' + (jdSkills.length || totalRelevant) + ' relevant requirements. Overall match: ' + overallScore + '%. Only add information that accurately reflects your experience.';

    return {
      overallScore, skillsScore, experienceScore, keywordsScore, formattingScore,
      matchedKeywords, missingKeywords, suggestions: suggestions.slice(0, 5),
      explanations, summary
    };
  }

  const api = Object.freeze({ analyze, extractTerms, escapeHtml, SKILL_TERMS });
  root.ResumeAnalyzer = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
