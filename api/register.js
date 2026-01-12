// api/register.js
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const data = req.body;

    if (!data?.hunterId || !data?.telefono || !data?.zona) {
      return res.status(400).json({ error: 'Faltan datos obligatorios' });
    }

    console.log('[REGISTRO LET’S HUNT]', JSON.stringify(data, null, 2));

    res.status(200).json({
      success: true,
      redirectUrl: `app.html?id=${encodeURIComponent(data.hunterId)}&zona=${encodeURIComponent(data.zona)}`
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Registro fallido' });
  }
};