const { createProxyMiddleware } = require('http-proxy-middleware');
const dotenv = require('dotenv');

dotenv.config();

module.exports = function (app) {
  app.use(
    '/api/locker',
    createProxyMiddleware({
      target: 'https://apis.data.go.kr',
      changeOrigin: true,
      secure: true,
      logLevel: 'warn',
      onProxyReq: (proxyReq, req) => {
        const serviceKey = process.env.DATA_GO_SERVICE_KEY;
        if (!serviceKey) {
          return;
        }

        // req.originalUrl 예: /api/locker?type=JSON&stdgCd=...
        const incoming = new URL(req.originalUrl, 'http://localhost');

        const upstream = new URL(
          '/B551982/psl_v2/locker_info_v2',
          'https://apis.data.go.kr'
        );

        incoming.searchParams.forEach((value, key) => {
          upstream.searchParams.set(key, value);
        });

        if (!upstream.searchParams.get('serviceKey')) {
          upstream.searchParams.set('serviceKey', serviceKey);
        }

        proxyReq.path = upstream.pathname + upstream.search;
      },
    })
  );
};

