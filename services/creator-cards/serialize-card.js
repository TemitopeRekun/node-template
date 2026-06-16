/**
 * Map a Creator Card document to the API response shape: `_id` becomes `id`,
 * and `access_code` is included only when requested (never on public reads).
 * @param {Object} doc
 * @param {boolean} [includeAccessCode=true]
 * @returns {Object}
 */
function serializeCard(doc, includeAccessCode = true) {
  const obj = doc && typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };

  const serialized = {
    id: obj._id,
    title: obj.title,
    description: obj.description != null ? obj.description : null,
    slug: obj.slug,
    creator_reference: obj.creator_reference,
    links: Array.isArray(obj.links) ? obj.links : [],
    service_rates: obj.service_rates != null ? obj.service_rates : null,
    status: obj.status,
    access_type: obj.access_type,
  };

  if (includeAccessCode) {
    serialized.access_code = obj.access_code != null ? obj.access_code : null;
  }

  serialized.created = obj.created;
  serialized.updated = obj.updated;
  serialized.deleted = obj.deleted != null ? obj.deleted : null;

  return serialized;
}

module.exports = serializeCard;
