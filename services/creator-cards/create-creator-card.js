const validator = require('@app-core/validator');
const { throwAppError } = require('@app-core/errors');
const { ulid, randomBytes } = require('@app-core/randomness');
const { appLogger } = require('@app-core/logger');
const CreatorCardRepo = require('@app/repository/creator-cards/creator-card');
const { CreatorCardMessages } = require('@app/messages');

const spec = `root {
  title string<trim|minLength:3|maxLength:100>
  description? string<trim|maxLength:500>
  slug? string<trim|minLength:5|maxLength:50>
  creator_reference string<length:20>
  links[]? {
    title string<trim|minLength:1|maxLength:100>
    url string<trim|maxLength:200>
  }
  service_rates? {
    currency string(NGN|USD|GBP|GHS)
    rates[] {
      name string<trim|minLength:3|maxLength:100>
      description? string<trim|maxLength:250>
      amount number
    }
  }
  status string(draft|published)
  access_type? string(public|private)
  access_code? string
}`;

const parsedSpec = validator.parse(spec);

/**
 * Generate a slug from a title
 * @param {string} title
 * @returns {string}
 */
function generateSlugFromTitle(title) {
  return title
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-_]/g, '');
}

/**
 * Generate a random 6-char alphanumeric suffix
 * @returns {string}
 */
function randomAlphanumericSuffix() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

/**
 * Serialize a creator card document to the API response shape.
 * Always exposes _id as id; optionally includes access_code.
 * @param {Object} doc
 * @param {boolean} [includeAccessCode=true]
 * @returns {Object}
 */
function serializeCard(doc, includeAccessCode = true) {
  const obj = doc.toObject ? doc.toObject() : { ...doc };
  const serialized = {
    id: obj._id,
    title: obj.title,
    description: obj.description || null,
    slug: obj.slug,
    creator_reference: obj.creator_reference,
    links: obj.links || [],
    service_rates: obj.service_rates || null,
    status: obj.status,
    access_type: obj.access_type,
    access_code: includeAccessCode ? (obj.access_code || null) : undefined,
    created: obj.created,
    updated: obj.updated,
    deleted: obj.deleted !== undefined ? obj.deleted : null,
  };
  if (!includeAccessCode) {
    delete serialized.access_code;
  }
  return serialized;
}

module.exports = { serializeCard };

async function createCreatorCard(serviceData, options = {}) {
  const data = validator.validate(serviceData, parsedSpec);
  let result;

  try {
    const resolvedAccessType = data.access_type || 'public';

    // Business rule: access_code required on private cards
    if (resolvedAccessType === 'private' && !data.access_code) {
      throwAppError(CreatorCardMessages.ACCESS_CODE_REQUIRED, 'AC01');
    }

    // Business rule: access_code must not be set on public cards
    if (resolvedAccessType !== 'private' && data.access_code) {
      throwAppError(CreatorCardMessages.ACCESS_CODE_NOT_ALLOWED, 'AC05');
    }

    // Business rule: access_code must be exactly 6 alphanumeric chars if set
    if (data.access_code && !/^[a-zA-Z0-9]{6}$/.test(data.access_code)) {
      throwAppError('access_code must be exactly 6 alphanumeric characters', 'AC01');
    }

    // Business rule: service_rates.rates must be non-empty if service_rates is present
    if (data.service_rates && (!data.service_rates.rates || data.service_rates.rates.length === 0)) {
      throwAppError('service_rates.rates must be a non-empty array', 'SPCL_VALIDATION');
    }

    // Business rule: each rate amount must be a positive integer
    if (data.service_rates && data.service_rates.rates) {
      data.service_rates.rates.forEach((rate, i) => {
        if (!Number.isInteger(rate.amount) || rate.amount < 1) {
          throwAppError(
            `service_rates.rates[${i}].amount must be a positive integer`,
            'SPCL_VALIDATION'
          );
        }
      });
    }

    // Business rule: link urls must start with http:// or https://
    if (data.links && data.links.length > 0) {
      data.links.forEach((link, i) => {
        if (!/^https?:\/\//.test(link.url)) {
          throwAppError(
            `links[${i}].url must start with http:// or https://`,
            'SPCL_VALIDATION'
          );
        }
      });
    }

    // Slug handling
    let slug;
    const clientProvidedSlug = !!data.slug;

    if (clientProvidedSlug) {
      // Validate slug format
      if (!/^[a-zA-Z0-9\-_]+$/.test(data.slug)) {
        throwAppError('slug may only contain letters, numbers, hyphens and underscores', 'SPCL_VALIDATION');
      }
      // Check uniqueness
      const existing = await CreatorCardRepo.findOne({
        query: { slug: data.slug, deleted: null },
      });
      if (existing) {
        throwAppError(CreatorCardMessages.SLUG_TAKEN, 'SL02');
      }
      slug = data.slug;
    } else {
      // Auto-generate slug from title
      let generated = generateSlugFromTitle(data.title);

      // If too short (< 5 chars), append suffix
      if (generated.length < 5) {
        generated = `${generated}-${randomAlphanumericSuffix()}`;
      }

      // Check uniqueness; append suffix if taken
      const existing = await CreatorCardRepo.findOne({
        query: { slug: generated, deleted: null },
      });
      if (existing) {
        generated = `${generated}-${randomAlphanumericSuffix()}`;
      }

      slug = generated;
    }

    const now = Date.now();
    const id = ulid();

    const cardDoc = await CreatorCardRepo.create({
      _id: id,
      title: data.title,
      description: data.description || null,
      slug,
      creator_reference: data.creator_reference,
      links: data.links || [],
      service_rates: data.service_rates || null,
      status: data.status,
      access_type: resolvedAccessType,
      access_code: data.access_code || null,
      created: now,
      updated: now,
      deleted: null,
    });

    result = serializeCard(cardDoc, true);
  } catch (error) {
    appLogger.error({ error: error.message }, 'create-creator-card-error');
    throw error;
  }

  return result;
}

module.exports = createCreatorCard;
module.exports.serializeCard = serializeCard;
