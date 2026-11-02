require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cron = require('node-cron');
const path = require('path');
const db = require('./config/db');

const authRoutes = require('./routes/authRoutes');
const usuarioRoutes = require('./routes/usuarioRoutes');
const catalogoRoutes = require('./routes/catalogoRoutes');
const citaRoutes = require('./routes/citaRoutes');
const fidelidadRoutes = require('./routes/fidelidadRoutes');
const recompensaRoutes = require('./routes/recompensaRoutes');
const configuracionRoutes = require('./routes/configuracionRoutes');
const horarioRoutes = require('./routes/horarioRoutes');
const ingresoRoutes = require('./routes/ingresoRoutes'); 
const perfilRoutes = require('./routes/perfilRoutes');

const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
const corsOptions = {
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
};
app.use(cors(corsOptions));app.use(express.json({ limit: '10kb' }));

app.use('/assets', express.static(path.join(__dirname, '../frontend/assets')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 15, 
    message: { success: false, error: 'Demasiados intentos desde esta IP, por favor intenta de nuevo en 15 minutos.' },
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api/login', authLimiter);
app.use('/api/registro', authLimiter);
app.use('/api/recuperar-password', authLimiter);

app.use('/api', authRoutes);
app.use('/api', usuarioRoutes);
app.use('/api', catalogoRoutes);
app.use('/api', citaRoutes);
app.use('/api', fidelidadRoutes);
app.use('/api/recompensas', recompensaRoutes);
app.use('/api/configuracion', configuracionRoutes);
app.use('/api/horarios', horarioRoutes); 
app.use('/api/finanzas-historial', ingresoRoutes); 
app.use('/api/perfil', perfilRoutes);

cron.schedule('*/5 * * * *', () => {
    const queryLimpieza = `
        UPDATE citas 
        SET estado = 'no_asistio' 
        WHERE estado = 'pendiente' 
        AND TIMESTAMPDIFF(MINUTE, fecha_hora, NOW()) > (
            SELECT COALESCE((SELECT tiempo_tolerancia_cita FROM configuracion WHERE id = 1), 15)
        )
    `;
    db.query(queryLimpieza, (err, result) => {
        if (err) {
            console.error('[CRON ERROR] Error limpiando citas vencidas:', err.message);
        } else if (result && result.affectedRows > 0) {
            console.log(`[CRON] ${result.affectedRows} cita(s) marcada(s) como 'no_asistio' por tiempo de tolerancia.`);
        }
    });
});

app.use((req, res) => {
    res.status(404).json({ success: false, error: 'Endpoint no encontrado' });
});

app.use((err, req, res, next) => {
    console.error('[ERROR GLOBAL]', {
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
        url: req.url,
        method: req.method,
        timestamp: new Date().toISOString()
    });

    const statusCode = err.statusCode || err.status || 500;
    const mensajeCliente = process.env.NODE_ENV === 'production' 
        ? 'Error interno del servidor.' 
        : (err.message || 'Error interno del servidor');
        
    res.status(statusCode).json({ success: false, error: mensajeCliente });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor Node.js corriendo en http://localhost:${PORT}`);
});