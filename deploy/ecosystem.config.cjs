/** PM2 process config — used on the remote server */
module.exports = {
  apps: [
    {
      name: "vibe-live",
      cwd: "/opt/vibe-live",
      script: "node_modules/.bin/next",
      args: "start -p 3001 -H 0.0.0.0",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        PORT: "3001",
      },
    },
  ],
};
