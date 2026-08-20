const app = require('./app');
const env = require('./config/env');

app.listen(env.port, () => {
  console.log(`FloodNet API listening on port ${env.port}`);
});
