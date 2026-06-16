const validator = require('@app-core/validator');
const { throwAppError } = require('@app-core/errors');
const { appLogger } = require('@app-core/logger');
const CreatorCardRepo = require('@app/repository/creator-cards/creator-card');
const { CreatorCardMessages } = require('@app/messages');
const serializeCard = require('./serialize-card');

const spec = `root {
  slug string<trim|minLength:1>
  access_code? string
}`;

const parsedSpec = validator.parse(spec);

async function getCreatorCard(serviceData) {
  const data = validator.validate(serviceData, parsedSpec);
  let result;

  try {
    // Access checks run in order: existence, draft, then private-pin rules.
    const card = await CreatorCardRepo.findOne({
      query: { slug: data.slug, deleted: null },
    });

    if (!card) {
      throwAppError(CreatorCardMessages.CARD_NOT_FOUND, 'NF01');
    }

    if (card.status === 'draft') {
      throwAppError(CreatorCardMessages.CARD_IS_DRAFT, 'NF02');
    }

    if (card.access_type === 'private' && !data.access_code) {
      throwAppError(CreatorCardMessages.ACCESS_CODE_MISSING, 'AC03');
    }

    if (card.access_type === 'private' && data.access_code !== card.access_code) {
      throwAppError(CreatorCardMessages.ACCESS_CODE_INVALID, 'AC04');
    }

    result = serializeCard(card, false);
  } catch (error) {
    appLogger.error({ error: error.message }, 'get-creator-card-error');
    throw error;
  }

  return result;
}

module.exports = getCreatorCard;
