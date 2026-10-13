import { createServer } from 'vite';

const port = Number(process.env.PORT || 5173);
const server = await createServer({
  plugins: [{
    name: 'review-api-guard',
    configureServer(vite) {
      vite.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/api')) return next();
        const pathname = new URL(req.url, 'http://localhost').pathname;
        if (!['GET', 'HEAD'].includes(req.method)
          || pathname.startsWith('/api/collect')
          || pathname.startsWith('/api/me')
          || pathname.startsWith('/api/auth')) {
          res.statusCode = 403;
          res.end('This preview only serves public data.');
          return;
        }
        next();
      });
    },
  }],
  server: {
    host: '127.0.0.1',
    port,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'https://agriforecast.duckdns.org',
        changeOrigin: true,
        configure(proxy) {
          proxy.on('proxyReq', (request) => {
            request.removeHeader('authorization');
            request.removeHeader('cookie');
          });
        },
      },
    },
  },
});

await server.listen();
server.printUrls();
