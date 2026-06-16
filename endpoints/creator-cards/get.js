const { createHandler } = require('@app-core/server');
const { appLogger } = require('@app-core/logger');
const getCreatorCard = require('@app/services/creator-cards/get-creator-card');
const { CreatorCardMessages } = require('@app/messages');

module.exports = createHandler({
  path: '/creator-cards/:slug',
  method: 'get',
  middlewares: [],
  async onResponseEnd(rc, rs) {
    appLogger.info({ requestContext: rc, response: rs }, 'get-creator-card-request-completed');
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
