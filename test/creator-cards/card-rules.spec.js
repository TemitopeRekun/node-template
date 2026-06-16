const { expect } = require('chai');
const rules = require('@app/services/creator-cards/card-rules');

describe('creator-cards/card-rules', () => {
  describe('generateSlugFromTitle', () => {
    it('lowercases and hyphenates whitespace', () => {
      expect(rules.generateSlugFromTitle('George Cooks')).to.equal('george-cooks');
      expect(rules.generateSlugFromTitle('Ada Designs Things')).to.equal('ada-designs-things');
    });

    it('drops characters that are not letters, numbers, hyphen or underscore', () => {
      expect(rules.generateSlugFromTitle('Chef Georgé!!!')).to.equal('chef-georg');
      expect(rules.generateSlugFromTitle('a_b-c.d')).to.equal('a_b-cd');
    });

    it('keeps digits and underscores', () => {
      expect(rules.generateSlugFromTitle('Top 10 Recipes')).to.equal('top-10-recipes');
    });
  });

  describe('slugHasOnlyValidChars', () => {
    it('accepts letters, numbers, hyphens and underscores', () => {
      expect(rules.slugHasOnlyValidChars('george-cooks_01')).to.equal(true);
    });

    it('rejects spaces and other symbols', () => {
      expect(rules.slugHasOnlyValidChars('george cooks')).to.equal(false);
      expect(rules.slugHasOnlyValidChars('george!')).to.equal(false);
    });
  });

  describe('isValidAccessCodeFormat', () => {
    it('accepts exactly 6 alphanumeric characters', () => {
      expect(rules.isValidAccessCodeFormat('A1B2C3')).to.equal(true);
      expect(rules.isValidAccessCodeFormat('abcde9')).to.equal(true);
    });

    it('rejects wrong length or non-alphanumeric input', () => {
      expect(rules.isValidAccessCodeFormat('A1B2C')).to.equal(false);
      expect(rules.isValidAccessCodeFormat('A1B2C3X')).to.equal(false);
      expect(rules.isValidAccessCodeFormat('A1B2C!')).to.equal(false);
      expect(rules.isValidAccessCodeFormat(123456)).to.equal(false);
    });
  });

  describe('urlHasValidScheme', () => {
    it('accepts http and https', () => {
      expect(rules.urlHasValidScheme('http://x.com')).to.equal(true);
      expect(rules.urlHasValidScheme('https://x.com')).to.equal(true);
    });

    it('rejects other schemes', () => {
      expect(rules.urlHasValidScheme('ftp://x.com')).to.equal(false);
      expect(rules.urlHasValidScheme('x.com')).to.equal(false);
    });
  });

  describe('stripTrailingHyphens', () => {
    it('removes trailing hyphens only', () => {
      expect(rules.stripTrailingHyphens('abc---')).to.equal('abc');
      expect(rules.stripTrailingHyphens('a-b-c')).to.equal('a-b-c');
      expect(rules.stripTrailingHyphens('---')).to.equal('');
    });
  });

  describe('randomAlphanumericSuffix', () => {
    it('returns 6 alphanumeric characters', () => {
      const suffix = rules.randomAlphanumericSuffix();
      expect(suffix).to.have.lengthOf(6);
      expect(rules.slugHasOnlyValidChars(suffix)).to.equal(true);
    });
  });
});
