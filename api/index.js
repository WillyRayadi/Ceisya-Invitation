// Entry point Vercel (serverless function).
// Vercel otomatis menjadikan file di folder api/ sebagai serverless function,
// lalu semua request diarahkan ke sini lewat rewrites di vercel.json.
module.exports = require('../server');