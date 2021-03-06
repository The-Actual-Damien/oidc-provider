const { URL } = require('url');
const { strict: assert } = require('assert');

const { InvalidRequestUri } = require('../../helpers/errors');
const instance = require('../../helpers/weak_cache');

const allowedSchemes = new Set(['http:', 'https:', 'urn:']);

const loadPushedAuthorizationRequest = require('./load_pushed_authorization_request');
const rejectRequestAndUri = require('./reject_request_and_uri');

/*
 * Validates request_uri length, protocol and its presence in client whitelist and either uses
 * previously cached response or loads a fresh state. Removes request_uri form the parameters and
 * uses the response body as a value for the request parameter to be validated by a downstream
 * middleware
 *
 *
 * @throws: invalid_request
 * @throws: invalid_request_uri
 * @throws: request_not_supported
 * @throws: request_uri_not_supported
 */
module.exports = async function fetchRequestUri(ctx, next) {
  const { pushedAuthorizationRequests } = instance(ctx.oidc.provider).configuration('features');
  const pushedRequestURN = instance(ctx.oidc.provider).configuration('pushedRequestURN');
  const forceURNRequestURI = instance(ctx.oidc.provider).configuration('forceURNRequestURI');
  const requestURIParamRequired = instance(ctx.oidc.provider).configuration('requestURIParamRequired');

  const { params, route } = ctx.oidc;

  rejectRequestAndUri(ctx, () => {});

  if (requestURIParamRequired && params.request_uri === undefined && route === 'authorization') {
    throw new InvalidRequestUri('request_uri must be present');
  }

  if (requestURIParamRequired && params.request_uri === undefined && route === 'authorization') {
    throw new InvalidRequestUri('request_uri must be present');
  }

  if (params.request_uri !== undefined) {
    let protocol;
    try {
      ({ protocol } = new URL(params.request_uri));
      assert(allowedSchemes.has(protocol));
    } catch (err) {
      throw new InvalidRequestUri('invalid request_uri scheme');
    }

    if (forceURNRequestURI && protocol !== 'urn:') {
      throw new InvalidRequestUri('request_uri must be an URN');
    }

    let loadedRequestObject = ctx.oidc.entities.PushedAuthorizationRequest;
    if (
      !loadedRequestObject
      && pushedAuthorizationRequests.enabled
      && params.request_uri.startsWith(pushedRequestURN)
    ) {
      loadedRequestObject = await loadPushedAuthorizationRequest(ctx);
    } else if (!loadedRequestObject && (ctx.oidc.client.requestUris || protocol === 'urn:')) {
      if (!ctx.oidc.client.requestUriAllowed(params.request_uri)) {
        throw new InvalidRequestUri('provided request_uri is not whitelisted');
      }
    }

    if (protocol === 'http:') {
      ctx.oidc.insecureRequestUri = true;
    }


    try {
      if (loadedRequestObject) {
        params.request = loadedRequestObject.request;
      } else {
        const cache = instance(ctx.oidc.provider).requestUriCache;
        if (protocol === 'urn:') {
          params.request = await cache.resolveUrn(params.request_uri);
        } else {
          params.request = await cache.resolveWebUri(params.request_uri);
        }
      }
      assert(params.request);
      params.request_uri = undefined;
    } catch (err) {
      throw new InvalidRequestUri(`could not load or parse request_uri (${err.message})`);
    }
  }

  return next();
};
