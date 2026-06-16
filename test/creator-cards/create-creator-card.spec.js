process.env.PINO_LOG_LEVEL = process.env.PINO_LOG_LEVEL || 'silent';

const { expect } = require('chai');
const repo = require('@app/repository/creator-cards/creator-card');
const createCreatorCard = require('@app/services/creator-cards/create-creator-card');

function duplicateError() {
  const e = new Error('An existing slug record exists.');
  e.isApplicationError = true;
  e.errorCode = 'DUPLICATE_RECORD';
  return e;
}

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

describe('creator-cards/create-creator-card (happy path & concurrency)', () => {
  let originalFindOne;
  let originalCreate;

  beforeEach(() => {
    originalFindOne = repo.findOne;
    originalCreate = repo.create;
  });

  afterEach(() => {
    repo.findOne = originalFindOne;
    repo.create = originalCreate;
  });

  it('creates a card and serializes it (id exposed, access_code included)', async () => {
    repo.findOne = async () => null; // slug is free
    repo.create = async (doc) => ({ ...doc });

    const out = await createCreatorCard({ ...VALID, slug: 'happy-path' });

    expect(out.id).to.be.a('string');
    expect(out).to.not.have.property('_id');
    expect(out).to.have.property('access_code');
    expect(out.slug).to.equal('happy-path');
  });

  it('maps a client-slug duplicate-key write to SL02', async () => {
    repo.findOne = async () => null; // passes the pre-check
    repo.create = async () => {
      throw duplicateError();
    };
    expect(await codeFor({ ...VALID, slug: 'raced-slug' })).to.equal('SL02');
  });

  it('retries an auto-generated slug after a duplicate-key write', async () => {
    let createCalls = 0;
    repo.findOne = async () => null;
    repo.create = async (doc) => {
      createCalls += 1;
      if (createCalls === 1) {
        throw duplicateError();
      }
      return { ...doc };
    };

    const out = await createCreatorCard({ ...VALID, title: 'Auto Retry' });

    expect(createCalls).to.equal(2);
    expect(out.id).to.be.a('string');
  });
});
