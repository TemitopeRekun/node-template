const { createHandler } = require('@app-core/server');
const { appLogger } = require('@app-core/logger');
const createCreatorCard = require('@app/services/creator-cards/create-creator-card');
const { CreatorCardMessages } = require('@app/messages');

module.exports = createHandler({
  path: '/creator-cards',
  method: 'post',
  middlewares: [],
  async onResponseEnd(rc, rs) {
    appLogger.info({ requestContext: rc, response: rs }, 'create-creator-card-request-completed');
  },
  async handler(rc, helpers) {
    const payload = rc.body;

    const response = await createCreatorCard(payload);

    return {
      status: helpers.http_statuses.HTTP_200_OK,
      message: CreatorCardMessages.CREATED,
      data: response,
    };
  },
});
