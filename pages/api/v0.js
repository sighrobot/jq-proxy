const jq = require('node-jq');
const { version } = require('../../package.json');

const allowCors = (fn) => async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET,OPTIONS,PATCH,DELETE,POST,PUT',
  );
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version',
  );
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  return await fn(req, res);
};

const makeFailFunction = (req, res) => (error) => {
  res.status(500).json({ error, query: req.query });
};

async function handler(req, res) {
  const fail = makeFailFunction(req, res);
  const { url, jq: filter, debug } = req.query;

  const missingParams = [];
  if (!url) {
    missingParams.push('url');
  }
  if (!filter) {
    missingParams.push('jq');
  }
  if (missingParams.length > 0) {
    return fail(`missing query parameters: [${missingParams.join(', ')}]`);
  }

  let fetched;
  try {
    fetched = await fetch(url);
  } catch {
    return fail('fetch failed: check that URL is valid and properly encoded.');
  }

  let rawJSON;
  try {
    rawJSON = await fetched.json();
  } catch {
    return fail(
      'JSON parse failed: check that original response is valid JSON.',
    );
  }

  let filteredJSON;
  try {
    filteredJSON = await jq.run(filter, rawJSON, {
      input: 'json',
      output: 'json',
    });
  } catch {
    return fail(
      'node-jq failed: check that filter expression is valid and properly encoded.',
    );
  }

  return res
    .status(200)
    .json(
      debug === 'true'
        ? { version, query: req.query, output: filteredJSON }
        : filteredJSON,
    );
}

module.exports = allowCors(handler);
