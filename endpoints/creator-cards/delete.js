const { createHandler } = require('@app-core/server');
const { appLogger } = require('@app-core/logger');
const deleteCreatorCard = require('@app/services/creator-cards/delete-creator-card');
const { CreatorCardMessages } = require('@app/messages');

module.exports = createHandler({
  path: '/creator-cards/:slug',
  method: 'delete',
  middlewares: [],
  async onResponseEnd(rc, rs) {
    appLogger.info(
      { method: rc.properties.method, path: rc.properties.handlerPath, status: rs.statusCode },
      'delete-creator-card-completed'
    );
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
