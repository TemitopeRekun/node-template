const { expect } = require('chai');
const serializeCard = require('@app/services/creator-cards/serialize-card');

const baseDoc = {
  _id: '01JG8XYZA2B3C4D5E6F7G8H9J0',
  title: 'George Cooks',
  slug: 'george-cooks',
  creator_reference: 'crt_8f2k1m9x4p7w3q5z',
  status: 'published',
  access_type: 'private',
  access_code: 'A1B2C3',
  created: 1767052800000,
  updated: 1767052800000,
  deleted: null,
};

describe('creator-cards/serialize-card', () => {
  it('exposes _id as id and never leaks _id', () => {
    const out = serializeCard(baseDoc);
    expect(out.id).to.equal(baseDoc._id);
    expect(out).to.not.have.property('_id');
  });

  it('includes access_code when requested (creation/deletion responses)', () => {
    const out = serializeCard(baseDoc, true);
    expect(out.access_code).to.equal('A1B2C3');
  });

  it('omits access_code entirely on public retrieval', () => {
    const out = serializeCard(baseDoc, false);
    expect(out).to.not.have.property('access_code');
  });

  it('defaults optional fields (description/links/service_rates/deleted)', () => {
    const out = serializeCard({
      _id: 'x',
      title: 't',
      slug: 's',
      status: 'draft',
      access_type: 'public',
    });
    expect(out.description).to.equal(null);
    expect(out.links).to.deep.equal([]);
    expect(out.service_rates).to.equal(null);
    expect(out.deleted).to.equal(null);
  });

  it('preserves a deleted timestamp', () => {
    const out = serializeCard({ ...baseDoc, deleted: 1767139200000 }, true);
    expect(out.deleted).to.equal(1767139200000);
  });
});
