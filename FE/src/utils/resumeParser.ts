export interface CandidateInfo {
  name: string;
  email: string;
  phone: string;
  experience: string;
  currentRole: string;
  location: string;
  linkedIn: string;
  github: string;
  portfolio: string;
  education: string;
  summary: string;
}

const extractEmail = (text: string): string => {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
  const matches = text.match(emailRegex);
  if (matches && matches.length > 0) {
    const personalEmails = matches.filter(
      (email) =>
        !email.toLowerCase().includes("example") &&
        !email.toLowerCase().includes("company") &&
        !email.toLowerCase().includes("support")
    );
    return personalEmails[0] || matches[0];
  }
  return "";
};

const extractPhone = (text: string): string => {
  const phonePatterns = [
    /(?:\+91[-.\s]?)?[6-9]\d{9}/g,
    /(?:\+1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
    /\+?\d{1,3}[-.\s]?\d{2,4}[-.\s]?\d{3,4}[-.\s]?\d{3,4}/g,
  ];

  for (const pattern of phonePatterns) {
    const matches = text.match(pattern);
    if (matches && matches.length > 0) {
      return matches[0].replace(/[-.\s]/g, " ").trim();
    }
  }
  return "";
};

const extractName = (text: string): string => {
  const lines = text.split("\n").filter((line) => line.trim().length > 0);
  
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const line = lines[i].trim();
    
    if (
      line.includes("@") ||
      line.match(/^\+?\d/) ||
      line.toLowerCase().includes("resume") ||
      line.toLowerCase().includes("curriculum vitae") ||
      line.toLowerCase().includes("cv")
    ) {
      continue;
    }
    
    const words = line.split(/\s+/);
    if (words.length >= 1 && words.length <= 4) {
      const isLikelyName = words.every(
        (word) =>
          /^[A-Z][a-z]*$/.test(word) ||
          /^[A-Z]+$/.test(word) ||
          /^[a-z]+$/.test(word)
      );
      
      if (isLikelyName && line.length > 3 && line.length < 50) {
        return line
          .split(" ")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(" ");
      }
    }
  }
  return "";
};

const extractExperience = (text: string): string => {
  const patterns = [
    /(\d+)\+?\s*(?:years?|yrs?)\s*(?:of\s*)?(?:experience|exp)/gi,
    /(?:experience|exp)[\s:]*(\d+)\+?\s*(?:years?|yrs?)/gi,
    /(?:total|overall)\s*(?:experience|exp)[\s:]*(\d+)\+?\s*(?:years?|yrs?)/gi,
    /(\d+)\+?\s*(?:years?|yrs?)\s*(?:in|of)\s*(?:software|development|engineering|it)/gi,
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match) {
      const years = match[1];
      return `${years} years`;
    }
  }

  const dateRanges = text.match(
    /(?:19|20)\d{2}\s*[-–]\s*(?:present|current|(?:19|20)\d{2})/gi
  );
  if (dateRanges && dateRanges.length > 0) {
    let totalYears = 0;
    const currentYear = new Date().getFullYear();
    
    for (const range of dateRanges) {
      const years = range.match(/\d{4}/g);
      if (years && years.length >= 1) {
        const startYear = parseInt(years[0]);
        const endYear = years[1]
          ? parseInt(years[1])
          : range.toLowerCase().includes("present") ||
            range.toLowerCase().includes("current")
          ? currentYear
          : startYear;
        totalYears += endYear - startYear;
      }
    }
    
    if (totalYears > 0) {
      return `${totalYears} years`;
    }
  }

  return "";
};

const extractCurrentRole = (text: string): string => {
  const rolePatterns = [
    /(?:current\s*)?(?:role|position|title)[\s:]+([^\n,]+)/i,
    /(?:^|\n)\s*((?:senior\s+|junior\s+|lead\s+|principal\s+|staff\s+)?(?:software\s+)?(?:engineer|developer|architect|manager|analyst|consultant|designer)[^\n]*)/i,
    /(?:working\s+as\s+(?:a\s+)?|designation[\s:]+)([^\n,]+)/i,
  ];

  for (const pattern of rolePatterns) {
    const match = pattern.exec(text);
    if (match && match[1]) {
      const role = match[1].trim();
      if (role.length > 3 && role.length < 100) {
        return role;
      }
    }
  }

  const titles = [
    "Software Engineer",
    "Senior Software Engineer",
    "Full Stack Developer",
    "Frontend Developer",
    "Backend Developer",
    "DevOps Engineer",
    "Data Scientist",
    "Data Engineer",
    "Product Manager",
    "Project Manager",
    "UI/UX Designer",
    "Technical Lead",
    "Engineering Manager",
    "Solutions Architect",
    "Cloud Architect",
    "QA Engineer",
    "Test Engineer",
  ];

  for (const title of titles) {
    if (text.toLowerCase().includes(title.toLowerCase())) {
      return title;
    }
  }

  return "";
};

const extractLinkedIn = (text: string): string => {
  const linkedInPattern =
    /(?:linkedin\.com\/in\/|linkedin:?\s*)([a-zA-Z0-9_-]+)/i;
  const match = text.match(linkedInPattern);
  if (match) {
    return `https://linkedin.com/in/${match[1]}`;
  }
  
  const urlPattern = /https?:\/\/(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9_-]+/i;
  const urlMatch = text.match(urlPattern);
  return urlMatch ? urlMatch[0] : "";
};

const extractGitHub = (text: string): string => {
  const githubPattern = /(?:github\.com\/|github:?\s*)([a-zA-Z0-9_-]+)/i;
  const match = text.match(githubPattern);
  if (match) {
    return `https://github.com/${match[1]}`;
  }
  
  const urlPattern = /https?:\/\/(?:www\.)?github\.com\/[a-zA-Z0-9_-]+/i;
  const urlMatch = text.match(urlPattern);
  return urlMatch ? urlMatch[0] : "";
};

const extractLocation = (text: string): string => {
  const locationPatterns = [
    /(?:location|address|city|based\s+in|residing\s+in)[\s:]+([^\n,]+)/i,
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s*(?:India|USA|UK|Canada|Australia)/i,
  ];

  for (const pattern of locationPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  const cities = [
    "Bangalore",
    "Bengaluru",
    "Mumbai",
    "Delhi",
    "Hyderabad",
    "Chennai",
    "Pune",
    "Kolkata",
    "Noida",
    "Gurgaon",
    "Gurugram",
  ];
  
  for (const city of cities) {
    if (text.includes(city)) {
      return city;
    }
  }

  return "";
};

const extractEducation = (text: string): string => {
  const educationPatterns = [
    /(?:B\.?Tech|B\.?E\.?|Bachelor(?:'s)?)\s*(?:in\s+)?([^\n,]+)/i,
    /(?:M\.?Tech|M\.?S\.?|Master(?:'s)?)\s*(?:in\s+)?([^\n,]+)/i,
    /(?:Ph\.?D\.?|Doctorate)\s*(?:in\s+)?([^\n,]+)/i,
    /(?:MBA|BBA|BCA|MCA)\s*(?:in\s+)?([^\n,]*)/i,
  ];

  const educations: string[] = [];
  
  for (const pattern of educationPatterns) {
    const match = text.match(pattern);
    if (match) {
      educations.push(match[0].trim());
    }
  }

  return educations.length > 0 ? educations[0] : "";
};

const extractPortfolio = (text: string): string => {
  const urlPattern =
    /https?:\/\/(?!(?:www\.)?(?:linkedin|github)\.com)[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}[^\s]*/gi;
  const matches = text.match(urlPattern);
  
  if (matches) {
    for (const url of matches) {
      if (
        !url.includes("linkedin") &&
        !url.includes("github") &&
        !url.includes("@")
      ) {
        return url;
      }
    }
  }
  return "";
};

const extractSummary = (text: string): string => {
  const summaryPatterns = [
    /(?:summary|objective|profile|about\s+me)[\s:]*\n*([^\n]+(?:\n[^\n]+){0,3})/i,
  ];

  for (const pattern of summaryPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const summary = match[1].trim();
      if (summary.length > 20 && summary.length < 500) {
        return summary;
      }
    }
  }
  return "";
};

export const parseResume = (text: string): CandidateInfo => {
  return {
    name: extractName(text),
    email: extractEmail(text),
    phone: extractPhone(text),
    experience: extractExperience(text),
    currentRole: extractCurrentRole(text),
    location: extractLocation(text),
    linkedIn: extractLinkedIn(text),
    github: extractGitHub(text),
    portfolio: extractPortfolio(text),
    education: extractEducation(text),
    summary: extractSummary(text),
  };
};

export const getExtractionConfidence = (info: CandidateInfo): number => {
  let score = 0;
  const weights = {
    name: 15,
    email: 20,
    phone: 10,
    experience: 15,
    currentRole: 15,
    location: 5,
    linkedIn: 5,
    github: 5,
    portfolio: 5,
    education: 5,
  };

  if (info.name) score += weights.name;
  if (info.email) score += weights.email;
  if (info.phone) score += weights.phone;
  if (info.experience) score += weights.experience;
  if (info.currentRole) score += weights.currentRole;
  if (info.location) score += weights.location;
  if (info.linkedIn) score += weights.linkedIn;
  if (info.github) score += weights.github;
  if (info.portfolio) score += weights.portfolio;
  if (info.education) score += weights.education;

  return score;
};

export default parseResume;
