process.env.PINO_LOG_LEVEL = process.env.PINO_LOG_LEVEL || 'silent';

const { expect } = require('chai');
const createCreatorCard = require('@app/services/creator-cards/create-creator-card');

// These cases all fail during validation or the business-rule checks, i.e.
// before any database access, so they run against the template's mock models
// (USE_MOCK_MODEL=1, set by `npm test`) without needing a live connection.
const VALID = {
  title: 'Valid Title',
  creator_reference: 'crt_8f2k1m9x4p7w3q5z',
  status: 'published',
};

async function codeFor(payload) {
  try {
    await createCreatorCard(payload);
    return null;
  } catch (e) {
    return e.errorCode;
  }
}

describe('creator-cards/create-creator-card (error paths)', () => {
  it('rejects field-level violations with a 400 validation code', async () => {
    expect(await codeFor({ ...VALID, title: 'ab' })).to.equal('SPCL_VALIDATION');
    expect(
      await codeFor({ creator_reference: VALID.creator_reference, status: 'published' })
    ).to.equal('SPCL_VALIDATION');
    expect(await codeFor({ ...VALID, status: 'archived' })).to.equal('SPCL_VALIDATION');
    expect(await codeFor({ ...VALID, creator_reference: 'too-short' })).to.equal('SPCL_VALIDATION');
  });

  it('requires access_code on private cards (AC01)', async () => {
    expect(await codeFor({ ...VALID, access_type: 'private' })).to.equal('AC01');
  });

  it('forbids access_code on public cards (AC05)', async () => {
    expect(await codeFor({ ...VALID, access_type: 'public', access_code: 'A1B2C3' })).to.equal(
      'AC05'
    );
    expect(await codeFor({ ...VALID, access_code: 'A1B2C3' })).to.equal('AC05');
  });

  it('rejects a malformed access_code on a private card (400)', async () => {
    expect(await codeFor({ ...VALID, access_type: 'private', access_code: 'A1B2' })).to.equal(
      'VALIDATION_ERROR'
    );
  });

  it('rejects a link url without an http(s) scheme (400)', async () => {
    expect(await codeFor({ ...VALID, links: [{ title: 'X', url: 'ftp://x.com' }] })).to.equal(
      'VALIDATION_ERROR'
    );
  });

  it('rejects a non-integer rate amount (400)', async () => {
    const payload = {
      ...VALID,
      service_rates: { currency: 'USD', rates: [{ name: 'Svc', amount: 1.5 }] },
    };
    expect(await codeFor(payload)).to.equal('VALIDATION_ERROR');
  });
});
