const { expect } = require('chai');
const repo = require('@app/repository/creator-cards/creator-card');
const deleteCreatorCard = require('@app/services/creator-cards/delete-creator-card');

const REF = 'crt_unittestunittest'; // exactly 20 chars

describe('creator-cards/delete-creator-card', () => {
  let originalFindOne;
  let originalUpdateOne;

  beforeEach(() => {
    originalFindOne = repo.findOne;
    originalUpdateOne = repo.updateOne;
  });

  afterEach(() => {
    repo.findOne = originalFindOne;
    repo.updateOne = originalUpdateOne;
  });

  it('returns NF01 when the card does not exist', async () => {
    repo.findOne = async () => null;
    let code = null;
    try {
      await deleteCreatorCard({ slug: 'missing', creator_reference: REF });
    } catch (e) {
      code = e.errorCode;
    }
    expect(code).to.equal('NF01');
  });

  it('soft-deletes and returns the card in creation format', async () => {
    repo.findOne = async () => ({
      _id: '01HDEL',
      slug: 'pub',
      title: 'Pub',
      creator_reference: REF,
      status: 'published',
      access_type: 'public',
      access_code: null,
      created: 1,
      updated: 1,
      deleted: null,
    });
    let updateArgs = null;
    repo.updateOne = async (args) => {
      updateArgs = args;
      return { acknowledged: true, modifiedCount: 1 };
    };

    const out = await deleteCreatorCard({ slug: 'pub', creator_reference: REF });

    expect(out.id).to.equal('01HDEL');
    expect(out).to.have.property('access_code');
    expect(out.deleted).to.be.a('number');
    expect(updateArgs.updateValues.deleted).to.be.a('number');
  });
});
