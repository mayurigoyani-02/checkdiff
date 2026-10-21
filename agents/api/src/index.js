const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', agent: 'api', time: new Date().toISOString() });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  console.log('[API] Login:', email);
  if (email === 'test@example.com' && password === 'password123') {
    res.json({ token: 'fake-token-' + Date.now(), user: { email, id: '1' } });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

app.post('/api/payment/create', (req, res) => {
  const { amount } = req.body;
  console.log('[API] Payment create:', amount);
  res.json({ clientSecret: 'secret_' + Date.now(), amount });
});

app.get('/api/products', (req, res) => {
  res.json({ products: [{ id: '123', name: 'Test Product', price: 100 }] });
});

app.get('/api/products/:id', (req, res) => {
  res.json({ id: req.params.id, name: 'Product ' + req.params.id, price: 100 });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`API Agent running on http://localhost:${PORT}`);
  console.log(`Health: http://localhost:${PORT}/health`);
});
