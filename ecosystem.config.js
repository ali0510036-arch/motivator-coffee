module.exports = {
  apps: [{
    name: 'motivator',
    script: 'server/index.js',
    instances: 1,
    autorestart: true,
    max_memory_restart: '300M',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
    },
  }],
};
