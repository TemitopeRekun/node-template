const { expect } = require('chai');
const repo = require('@app/repository/creator-cards/creator-card');
const getCreatorCard = require('@app/services/creator-cards/get-creator-card');

// The service calls repo.findOne dynamically, so stubbing the method on the
// shared (cached) repository object lets us drive each access-rule branch.
describe('creator-cards/get-creator-card', () => {
  let originalFindOne;

  beforeEach(() => {
    originalFindOne = repo.findOne;
  });

  afterEach(() => {
    repo.findOne = originalFindOne;
  });

  async function codeFor(serviceData) {
    try {
      await getCreatorCard(serviceData);
      return null;
    } catch (e) {
      return e.errorCode;
    }
  }

  const published = {
    _id: '01HGETPUB',
    slug: 'pub',
    title: 'Pub',
    status: 'published',
    access_type: 'public',
    access_code: null,
    created: 1,
    updated: 1,
    deleted: null,
  };

  it('returns NF01 when the card does not exist', async () => {
    repo.findOne = async () => null;
    expect(await codeFor({ slug: 'missing' })).to.equal('NF01');
  });

  it('returns NF02 when the card is a draft', async () => {
    repo.findOne = async () => ({ ...published, status: 'draft' });
    expect(await codeFor({ slug: 'pub' })).to.equal('NF02');
  });

  it('returns AC03 for a private card without an access_code', async () => {
    repo.findOne = async () => ({ ...published, access_type: 'private', access_code: 'A1B2C3' });
    expect(await codeFor({ slug: 'pub' })).to.equal('AC03');
  });

  it('returns AC04 for a private card with the wrong access_code', async () => {
    repo.findOne = async () => ({ ...published, access_type: 'private', access_code: 'A1B2C3' });
    expect(await codeFor({ slug: 'pub', access_code: 'WRONG1' })).to.equal('AC04');
  });

  it('returns the card (without access_code) for a public published card', async () => {
    repo.findOne = async () => ({ ...published });
    const out = await getCreatorCard({ slug: 'pub' });
    expect(out.id).to.equal('01HGETPUB');
    expect(out).to.not.have.property('access_code');
    expect(out).to.not.have.property('_id');
  });

  it('returns a private card with the correct code, still omitting access_code', async () => {
    repo.findOne = async () => ({ ...published, access_type: 'private', access_code: 'A1B2C3' });
    const out = await getCreatorCard({ slug: 'pub', access_code: 'A1B2C3' });
    expect(out.id).to.equal('01HGETPUB');
    expect(out).to.not.have.property('access_code');
  });
});
