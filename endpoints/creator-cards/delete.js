const { createHandler } = require('@app-core/server');
const { appLogger } = require('@app-core/logger');
const deleteCreatorCard = require('@app/services/creator-cards/delete-creator-card');
const { CreatorCardMessages } = require('@app/messages');

module.exports = createHandler({
  path: '/creator-cards/:slug',
  method: 'delete',
  middlewares: [],
  async onResponseEnd(rc, rs) {
    appLogger.info({ requestContext: rc, response: rs }, 'delete-creator-card-request-completed');
  },
  async handler(rc, helpers) {
    const body = rc.body || {};

    const response = await deleteCreatorCard({
      slug: rc.params.slug,
      creator_reference: body.creator_reference,
    });

    return {
      status: helpers.http_statuses.HTTP_200_OK,
      message: CreatorCardMessages.DELETED,
      data: response,
    };
  },
});
