const validator = require('@app-core/validator');
const { throwAppError, ERROR_CODE } = require('@app-core/errors');
const { ulid } = require('@app-core/randomness');
const { appLogger } = require('@app-core/logger');
const CreatorCardRepo = require('@app/repository/creator-cards/creator-card');
const { CreatorCardMessages } = require('@app/messages');
const serializeCard = require('./serialize-card');
const {
  MIN_SLUG_LENGTH,
  MAX_SLUG_LENGTH,
  SUFFIX_LENGTH,
  generateSlugFromTitle,
  randomAlphanumericSuffix,
  slugHasOnlyValidChars,
  isValidAccessCodeFormat,
  urlHasValidScheme,
  stripTrailingHyphens,
} = require('./card-rules');

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

const MAX_CREATE_ATTEMPTS = 5;

// Uniqueness spans every card (including soft-deleted ones) to match the
// unique index on `slug` and avoid duplicate-key writes.
async function slugIsTaken(slug) {
  const existing = await CreatorCardRepo.findOne({ query: { slug } });
  return !!existing;
}

async function resolveSlug(data) {
  if (data.slug) {
    if (!slugHasOnlyValidChars(data.slug)) {
      throwAppError(CreatorCardMessages.SLUG_INVALID, ERROR_CODE.VALIDATIONERR);
    }
    if (await slugIsTaken(data.slug)) {
      throwAppError(CreatorCardMessages.SLUG_TAKEN, 'SL02');
    }
    return data.slug;
  }

  let generated = generateSlugFromTitle(data.title).slice(0, MAX_SLUG_LENGTH);
  if (!generated) {
    generated = 'card';
  }

  const needsSuffix = generated.length < MIN_SLUG_LENGTH || (await slugIsTaken(generated));
  if (!needsSuffix) {
    return generated;
  }

  // Keep room for the "-xxxxxx" suffix within the 50-char maximum.
  const base =
    stripTrailingHyphens(generated.slice(0, MAX_SLUG_LENGTH - SUFFIX_LENGTH - 1)) || 'card';
  let candidate = `${base}-${randomAlphanumericSuffix()}`;
  // eslint-disable-next-line no-await-in-loop
  while (await slugIsTaken(candidate)) {
    candidate = `${base}-${randomAlphanumericSuffix()}`;
  }
  return candidate;
}

function enforceBusinessRules(data, accessType) {
  if (accessType === 'private' && !data.access_code) {
    throwAppError(CreatorCardMessages.ACCESS_CODE_REQUIRED, 'AC01');
  }

  if (accessType !== 'private' && data.access_code) {
    throwAppError(CreatorCardMessages.ACCESS_CODE_NOT_ALLOWED, 'AC05');
  }

  if (data.access_code && !isValidAccessCodeFormat(data.access_code)) {
    throwAppError(CreatorCardMessages.ACCESS_CODE_INVALID_FORMAT, ERROR_CODE.VALIDATIONERR);
  }

  if (Array.isArray(data.links)) {
    data.links.forEach((link, index) => {
      if (!urlHasValidScheme(link.url)) {
        throwAppError(
          `links[${index}].url must start with http:// or https://`,
          ERROR_CODE.VALIDATIONERR
        );
      }
    });
  }

  if (data.service_rates && Array.isArray(data.service_rates.rates)) {
    data.service_rates.rates.forEach((rate, index) => {
      if (!Number.isInteger(rate.amount) || rate.amount < 1) {
        throwAppError(
          `service_rates.rates[${index}].amount must be a positive integer`,
          ERROR_CODE.VALIDATIONERR
        );
      }
    });
  }
}

// The repository factory converts a Mongo E11000 into a DUPLICATE_RECORD app
// error. `slug` is the only unique index, so any such error here is a slug clash.
function isDuplicateSlugError(error) {
  return !!error && error.errorCode === ERROR_CODE.DUPLRCRD;
}

function buildCardDocument(data, slug, accessType) {
  const now = Date.now();
  return {
    _id: ulid(),
    title: data.title,
    description: data.description != null ? data.description : null,
    slug,
    creator_reference: data.creator_reference,
    links: Array.isArray(data.links) ? data.links : [],
    service_rates: data.service_rates != null ? data.service_rates : null,
    status: data.status,
    access_type: accessType,
    access_code: data.access_code != null ? data.access_code : null,
    created: now,
    updated: now,
    deleted: null,
  };
}

// Persist with a retry loop so that a slug claimed by a concurrent request
// between the uniqueness check and the write is still handled correctly: a
// client-provided slug becomes SL02, an auto-generated one gets a fresh suffix.
/* eslint-disable no-await-in-loop */
async function persistCard(data, accessType) {
  const clientProvidedSlug = !!data.slug;

  for (let attempt = 1; attempt <= MAX_CREATE_ATTEMPTS; attempt += 1) {
    const slug = await resolveSlug(data);
    try {
      return await CreatorCardRepo.create(buildCardDocument(data, slug, accessType));
    } catch (error) {
      if (!isDuplicateSlugError(error)) {
        throw error;
      }
      if (clientProvidedSlug) {
        throwAppError(CreatorCardMessages.SLUG_TAKEN, 'SL02');
      }
      // Auto-generated slug raced; loop and resolveSlug will pick a new suffix.
    }
  }

  throwAppError(CreatorCardMessages.SLUG_TAKEN, 'SL02');
  return null;
}
/* eslint-enable no-await-in-loop */

async function createCreatorCard(serviceData) {
  const data = validator.validate(serviceData, parsedSpec);
  let result;

  try {
    const accessType = data.access_type || 'public';

    enforceBusinessRules(data, accessType);

    const cardDoc = await persistCard(data, accessType);
    result = serializeCard(cardDoc, true);
  } catch (error) {
    appLogger.error({ error: error.message }, 'create-creator-card-error');
    throw error;
  }

  return result;
}

module.exports = createCreatorCard;
