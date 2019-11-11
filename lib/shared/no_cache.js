module.exports = async function noCache(ctx, next) {
  const { response } = ctx;
  if (!response.get('Pragma')) response.set('Pragma', 'no-cache');
  if (!response.get('Cache-Control')) response.set('Cache-Control', 'no-cache, no-store');
  await next();
};
