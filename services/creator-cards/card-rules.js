// Pure, dependency-free helpers for Creator Card field rules. Kept separate so
// they can be unit-tested in isolation. The template forbids regex, so every
// character-class check is done with explicit comparisons.

const SLUG_SUFFIX_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';
const MIN_SLUG_LENGTH = 5;
const MAX_SLUG_LENGTH = 50;
const SUFFIX_LENGTH = 6;
const ACCESS_CODE_LENGTH = 6;

function isAsciiLetter(ch) {
  return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z');
}

function isAsciiDigit(ch) {
  return ch >= '0' && ch <= '9';
}

function isAlphanumeric(ch) {
  return isAsciiLetter(ch) || isAsciiDigit(ch);
}

function isSlugChar(ch) {
  return isAlphanumeric(ch) || ch === '-' || ch === '_';
}

function isWhitespace(ch) {
  return ch.trim() === '';
}

function generateSlugFromTitle(title) {
  const lower = title.toLowerCase();
  let out = '';

  for (let i = 0; i < lower.length; i += 1) {
    const ch = lower[i];
    if (isWhitespace(ch)) {
      out += '-';
    } else if (isSlugChar(ch)) {
      out += ch;
    }
  }

  return out;
}

function randomAlphanumericSuffix() {
  let result = '';
  for (let i = 0; i < SUFFIX_LENGTH; i += 1) {
    result += SLUG_SUFFIX_CHARS[Math.floor(Math.random() * SLUG_SUFFIX_CHARS.length)];
  }
  return result;
}

function slugHasOnlyValidChars(slug) {
  for (let i = 0; i < slug.length; i += 1) {
    if (!isSlugChar(slug[i])) {
      return false;
    }
  }
  return true;
}

function isValidAccessCodeFormat(code) {
  if (typeof code !== 'string' || code.length !== ACCESS_CODE_LENGTH) {
    return false;
  }
  for (let i = 0; i < code.length; i += 1) {
    if (!isAlphanumeric(code[i])) {
      return false;
    }
  }
  return true;
}

function urlHasValidScheme(url) {
  return url.startsWith('http://') || url.startsWith('https://');
}

function stripTrailingHyphens(str) {
  let end = str.length;
  while (end > 0 && str[end - 1] === '-') {
    end -= 1;
  }
  return str.slice(0, end);
}

module.exports = {
  MIN_SLUG_LENGTH,
  MAX_SLUG_LENGTH,
  SUFFIX_LENGTH,
  ACCESS_CODE_LENGTH,
  generateSlugFromTitle,
  randomAlphanumericSuffix,
  slugHasOnlyValidChars,
  isValidAccessCodeFormat,
  urlHasValidScheme,
  stripTrailingHyphens,
};
