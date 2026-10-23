module.exports = {
  apps: [
    {
      name: 'in-network-web',
      cwd: __dirname,
      script: '.next/standalone/server.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        // 3001 : port attendu par nginx pour in-network.dz sur le VPS (3000 est pris par
        // un autre site). La valeur de ce bloc l'emporte sur un PORT=... passé en ligne de commande.
        PORT: 3001,
      },
      max_memory_restart: '300M',
    },
  ],
};
