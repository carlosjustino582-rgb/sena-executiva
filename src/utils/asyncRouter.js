'use strict';

function asyncRoute(handler) {
  return function wrappedRoute(req, res, next) {
    return Promise.resolve().then(() => handler(req, res, next)).catch(next);
  };
}

function wrapRouter(router) {
  for (const method of ['get', 'post', 'put', 'patch', 'delete', 'use']) {
    const register = router[method].bind(router);
    router[method] = (...args) => {
      const start = method === 'use' && typeof args[0] === 'string' ? 1 : 0;
      return register(...args.map((handler, index) => (
        index >= start && typeof handler === 'function' ? asyncRoute(handler) : handler
      )));
    };
  }
  return router;
}

module.exports = { asyncRoute, wrapRouter };
