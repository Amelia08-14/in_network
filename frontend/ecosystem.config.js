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
        PORT: 3000,
      },
      max_memory_restart: '300M',
    },
  ],
};
