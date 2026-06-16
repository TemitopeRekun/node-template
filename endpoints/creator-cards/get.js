const { createHandler } = require('@app-core/server');
const { appLogger } = require('@app-core/logger');
const getCreatorCard = require('@app/services/creator-cards/get-creator-card');
const { CreatorCardMessages } = require('@app/messages');

module.exports = createHandler({
  path: '/creator-cards/:slug',
  method: 'get',
  middlewares: [],
  async onResponseEnd(rc, rs) {
    appLogger.info(
      { method: rc.properties.method, path: rc.properties.handlerPath, status: rs.statusCode },
      'get-creator-card-completed'
    );
  },
  async handler(rc, helpers) {
    const response = await getCreatorCard({
      slug: rc.params.slug,
      access_code: rc.query.access_code,
    });

    return {
      status: helpers.http_statuses.HTTP_200_OK,
      message: CreatorCardMessages.RETRIEVED,
      data: response,
    };
  },
});
