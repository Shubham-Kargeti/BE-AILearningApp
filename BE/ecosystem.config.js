module.exports = {
  apps: [{
    name: 'ai-learning-backend',
    script: '/home/ec2-user/BE-AILearningApp/BE/venv/bin/uvicorn',
    args: 'app.main:app --host 0.0.0.0 --port 8000',
    interpreter: '/home/ec2-user/BE-AILearningApp/BE/venv/bin/python',
    cwd: '/home/ec2-user/BE-AILearningApp/BE',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      PYTHONPATH: '/home/ec2-user/BE-AILearningApp/BE',
      NODE_ENV: 'production'
    },
    error_file: '/home/ec2-user/logs/backend-error.log',
    out_file: '/home/ec2-user/logs/backend-out.log',
    time: true,
    
    // Post-deployment commands
    post_update: ['alembic upgrade head'],
    
    // Auto-restart configuration
    min_uptime: '10s',
    max_restarts: 10,
    
    // Graceful shutdown
    kill_timeout: 5000,
    wait_ready: true,
    listen_timeout: 3000
  }]
};
