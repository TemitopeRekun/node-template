const validator = require('@app-core/validator');
const { throwAppError } = require('@app-core/errors');
const { appLogger } = require('@app-core/logger');
const CreatorCardRepo = require('@app/repository/creator-cards/creator-card');
const { CreatorCardMessages } = require('@app/messages');
const { serializeCard } = require('./create-creator-card');

const spec = `root {
  slug string<trim|minLength:1>
  creator_reference string<length:20>
}`;

const parsedSpec = validator.parse(spec);

async function deleteCreatorCard(serviceData, options = {}) {
  const data = validator.validate(serviceData, parsedSpec);
  let result;

  try {
    const card = await CreatorCardRepo.findOne({
      query: { slug: data.slug, deleted: null },
    });

    if (!card) {
      throwAppError(CreatorCardMessages.CARD_NOT_FOUND, 'NF01');
    }

    const deletedAt = Date.now();

    await CreatorCardRepo.updateOne({
      query: { _id: card._id },
      updateValues: { deleted: deletedAt, updated: deletedAt },
    });

    // Return card in creation response format (with access_code, with deleted timestamp)
    const updatedCard = {
      ...((card.toObject ? card.toObject() : { ...card })),
      deleted: deletedAt,
      updated: deletedAt,
    };
    result = serializeCard(updatedCard, true);
  } catch (error) {
    appLogger.error({ error: error.message }, 'delete-creator-card-error');
    throw error;
  }

  return result;
}

module.exports = deleteCreatorCard;
