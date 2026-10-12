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
    'ideal','must','able','duties','overview','description',
    'skill','skills','offer','offers','offering','offered',
    'provide','provides','providing','provided',
    'include','includes','including','plus'
  ]);

  const COMPANY_NAMES = new Set([
    // Leading technology and enterprise companies
    'google','microsoft','amazon','apple','meta','netflix','uber','airbnb',
    'infosys','tcs','wipro','accenture','deloitte','cognizant','ibm','oracle',
    'intel','cisco','salesforce','adobe','flipkart','swiggy','zomato','stripe',
    'spotify','slack','zoom','twitter','linkedin','github','gitlab','paypal',
    'walmart','target','jpmorgan','goldman','bloomberg','acme','tesla','nvidia',
    'samsung','capgemini','hcl','qualcomm','broadcom','vmware','servicenow',
    'snowflake','databricks','palantir','atlassian','lyft','snap','pinterest',
    'reddit','ebay','shopify','bytedance','tiktok','intuit','square','block',
    // Corporate entity indicators and company suffixes
    'inc','incorporated','corp','corporation','ltd','limited','llc','gmbh',
    'technologies','solutions','enterprises','holdings','group','services',
    'consulting','systems','ventures','pvt','private'
  ]);

  const GENERIC_HIRING_WORDS = new Set([
    // Compensation, perks and benefits
    'salary','salaries','compensation','benefit','benefits','perk','perks',
    'bonus','bonuses','equity','stipend','stipends','insurance','health',
    'dental','vision','vacation','pto','package','competitive','remuneration',
    'allowance','allowances','pension','wellness','401k','relocation',
    // Education, academic credentials and degrees
    'bachelor','bachelors','master','masters','degree','degrees','phd',
    'doctorate','diploma','graduate','graduates','undergraduate','undergraduates',
    'fresher','freshers','student','students','university','college','school',
    'academic','education','gpa','alumni',
    // Generic capability and requirement filler
    'expertise','proficient','proficiency','knowledge','skilled','strong',
    'demonstrated','proven','competency','competencies','ability','abilities',
    // Employment terms, arrangement and location types
    'fulltime','parttime','contract','contractor','contractors','temporary',
    'permanent','remote','hybrid','onsite','office','location','locations',
    'commute','travel','shift','shifts','hourly','annual','annually',
    // Legal, visa, sponsorship and compliance
    'visa','sponsorship','citizenship','authorization','authorized','residency',
    'eligible','eligibility','clearance','background','equal','opportunity',
    'employer','eeo','affirmative','diversity','inclusion','disability',
    'veteran','veterans','gender','race','religion','creed','accommodation',
    'accommodations','compliance','lawful',
    // Hiring process, recruitment and application
    'interview','interviews','recruiter','recruiting','recruitment','screening',
    'applied','applicant','applicants','application','applications','apply','applying',
    'resume','resumes','cover','letter','portfolio','references','referral','referrals',
    'notice','period','immediate','join','joining','joins','opening','openings',
    'career','careers','hire','hiring','hired','seeking','seeks','candidate','candidates'
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

  function isExcludedTerm(term) {
    if (!term || typeof term !== 'string') return true;
    const clean = term.toLowerCase().replace(/^[.+#-]+|[.#-]+$/g, '');
    const stripped = clean.replace(/[-.]/g, '');
    return STOP_WORDS.has(clean) ||
           STOP_WORDS.has(stripped) ||
           COMPANY_NAMES.has(clean) ||
           COMPANY_NAMES.has(stripped) ||
           GENERIC_HIRING_WORDS.has(clean) ||
           GENERIC_HIRING_WORDS.has(stripped);
  }

  function extractTerms(text) {
    return [...new Set((String(text).toLowerCase().match(/[a-z][a-z0-9+#.-]{1,}/g) || [])
      .map(term => (term === 'c++' || term.startsWith('c++'))
        ? term.replace(/^[.+#-]+|[.#-]+$/g, '')
        : term.replace(/^[.+#-]+|[.+#-]+$/g, ''))
      .filter(term => term.length > 2 && !isExcludedTerm(term)))];
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[char]));
  }

  function isSkillTerm(term) {
    return SKILL_TERMS.some(s => {
      if (s === term) return true;
      if (s.length > 2 && term.includes(s)) return true;
      if (term.length > 3 && s.includes(term)) return true;
      return false;
    });
  }

  function analyze(resume, jobDescription) {
    const resumeText = String(resume || '').trim();
    const jdText = String(jobDescription || '').trim();
    if (resumeText.length < 80 || jdText.length < 80) {
      throw new Error('Resume and job description must each contain at least 80 characters.');
    }

    const resumeLower = resumeText.toLowerCase();
    const jdLower = jdText.toLowerCase();

    // Extract terms from JD and resume (filtering out excluded words)
    const jdExtracted = extractTerms(jdText).filter(term => (term.length > 3 || term === 'c++') && !isExcludedTerm(term));
    const resumeTerms = new Set(extractTerms(resumeText));

    // Identify target skills mentioned in the job description
    const jdSkills = SKILL_TERMS.filter(skill => jdLower.includes(skill));
    const matchedSkills = jdSkills.filter(skill => resumeLower.includes(skill));
    const missingSkills = jdSkills.filter(skill => !resumeLower.includes(skill));

    // Prioritize meaningful skills and requirements over generic terms
    const jdTerms = [...new Set(jdExtracted)]
      .filter(term => !isExcludedTerm(term))
      .sort((a, b) => {
        const aSkill = isSkillTerm(a);
        const bSkill = isSkillTerm(b);
        if (aSkill && !bSkill) return -1;
        if (!aSkill && bSkill) return 1;
        return 0;
      });

    const allMatched = jdTerms.filter(term => resumeTerms.has(term) && !isExcludedTerm(term));
    const allMissing = jdTerms.filter(term => !resumeTerms.has(term) && !isExcludedTerm(term));
    const totalRelevant = jdTerms.length;

    // Accurate keyword score directly reflecting matched vs total relevant keywords
    const keywordsScore = totalRelevant > 0
      ? Math.max(0, Math.min(100, Math.round((allMatched.length / totalRelevant) * 100)))
      : 0;

    const matchedKeywords = allMatched.slice(0, 12);
    const missingKeywords = allMissing.slice(0, 10);

    const skillsScore = jdSkills.length
      ? Math.max(0, Math.min(100, Math.round((matchedSkills.length / jdSkills.length) * 100)))
      : keywordsScore;

    const actionSignals = (resumeText.match(/\b(built|created|delivered|designed|developed|improved|increased|led|reduced|automated|implemented|managed|deployed|tested)\b/gi) || []).length;
    const experienceScore = Math.max(0, Math.min(100, Math.round(25 + actionSignals * 8)));
    const sections = ['education','skills','projects','experience','summary','certifications'];
    const sectionCount = sections.filter(section => new RegExp('\\b' + section + '\\b', 'i').test(resumeText)).length;
    const formattingScore = Math.max(0, Math.min(100, Math.round((sectionCount / sections.length) * 100)));
    const overallScore = Math.max(0, Math.min(100, Math.round(skillsScore * 0.35 + experienceScore * 0.20 + keywordsScore * 0.30 + formattingScore * 0.15)));

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

  const api = Object.freeze({
    analyze,
    extractTerms,
    escapeHtml,
    isSkillTerm,
    isExcludedTerm,
    SKILL_TERMS,
    COMPANY_NAMES,
    GENERIC_HIRING_WORDS,
    STOP_WORDS
  });
  root.ResumeAnalyzer = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
