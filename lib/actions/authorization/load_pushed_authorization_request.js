const { InvalidRequestUri } = require('../../helpers/errors');
const instance = require('../../helpers/weak_cache');

module.exports = async function loadPushedAuthorizationRequest(ctx) {
  const { params } = ctx.oidc;
  const pushedRequestURN = instance(ctx.oidc.provider).configuration('pushedRequestURN');
  const [, id] = params.request_uri.split(pushedRequestURN);
  const requestObject = await ctx.oidc.provider.PushedAuthorizationRequest.find(id);
  if (!requestObject) {
    throw new InvalidRequestUri('request_uri is invalid or expired');
  }
  ctx.oidc.entity('PushedAuthorizationRequest', requestObject);
  return requestObject;
};
