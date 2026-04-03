export default async function handler(req, res) {
  // Allow CORS from any origin
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const base = req.query.base || 'HKD';
  const apiKey = process.env.EXCHANGE_RATE_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: 'API key not configured',
    });
  }

  try {
    const response = await fetch(
      `https://v6.exchangerate-api.com/v6/${apiKey}/latest/${base}`
    );
    const data = await response.json();

    if (data.result === 'success') {
      return res.status(200).json({
        base: data.base_code,
        rates: data.conversion_rates,
      });
    }

    return res.status(500).json({
      error: data['error-type'] || 'API error',
    });

  } catch (err) {
    return res.status(500).json({
      error: err.message,
    });
  }
}
