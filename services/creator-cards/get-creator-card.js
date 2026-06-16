const validator = require('@app-core/validator');
const { throwAppError } = require('@app-core/errors');
const { appLogger } = require('@app-core/logger');
const CreatorCardRepo = require('@app/repository/creator-cards/creator-card');
const { CreatorCardMessages } = require('@app/messages');
const { serializeCard } = require('./create-creator-card');

const spec = `root {
  slug string<trim|minLength:1>
  access_code? string
}`;

const parsedSpec = validator.parse(spec);

async function getCreatorCard(serviceData, options = {}) {
  const data = validator.validate(serviceData, parsedSpec);
  let result;

  try {
    // Find card — exclude deleted
    const card = await CreatorCardRepo.findOne({
      query: { slug: data.slug, deleted: null },
    });

    // Rule 1: card not found
    if (!card) {
      throwAppError(CreatorCardMessages.CARD_NOT_FOUND, 'NF01');
    }

    // Rule 2: card is a draft
    if (card.status === 'draft') {
      throwAppError(CreatorCardMessages.CARD_IS_DRAFT, 'NF02');
    }

    // Rule 3: private card — access code not supplied
    if (card.access_type === 'private' && !data.access_code) {
      throwAppError(CreatorCardMessages.ACCESS_CODE_MISSING, 'AC03');
    }

    // Rule 4: private card — wrong access code
    if (card.access_type === 'private' && data.access_code !== card.access_code) {
      throwAppError(CreatorCardMessages.ACCESS_CODE_INVALID, 'AC04');
    }

    // Never expose access_code in retrieval responses
    result = serializeCard(card, false);
  } catch (error) {
    appLogger.error({ error: error.message }, 'get-creator-card-error');
    throw error;
  }

  return result;
}

module.exports = getCreatorCard;
