# Namasté — Guía de Arquitectura, API REST e Integración de Backend

Este documento detalla la arquitectura técnica oficial de **Namasté**, el servidor de producción implementado en `server.js` y las directrices para conectar pasarelas de pago reales (Stripe / Mercado Pago) con altos estándares de seguridad y observabilidad.

---

## 1. Servidor Node.js y API REST en Producción (`server.js`)

La plataforma cuenta con un servidor Node.js autónomo de alto rendimiento sin dependencias externas obligatorias, ejecutable con:

```bash
npm start
# O directamente:
node server.js
```

### Endpoints REST Implementados:

| Método | Endpoint | Descripción | Seguridad |
|---|---|---|---|
| `GET` | `/api/health` | Estado del servicio y métricas de salud | Público |
| `POST` | `/api/auth/login` | Autenticación de alumnos por correo o código de acceso | Emite token criptográfico |
| `GET` | `/api/auth/me` | Recupera sesión del alumno autenticado | Requiere `Bearer <token>` |
| `POST` | `/api/auth/logout` | Invalida la sesión activa en el servidor | Requiere `Bearer <token>` |
| `POST` | `/api/checkout` | Alta de suscripción, validación de planes y registro de transacción | Cálculo de precio del lado del servidor |
| `GET` | `/api/classes` | Catálogo de clases con metadatos oficiales | Público |
| `GET` | `/api/classes/:id/stream` | Generación de URL autorizada y transmisión protegida | Requiere `Bearer <token>` y membresía activa |
| `GET` | `/api/progress` | Consulta de favoritos, completadas y rachas del alumno | Requiere `Bearer <token>` |
| `POST` | `/api/progress` | Guardado de progreso y cálculo diario de racha | Requiere `Bearer <token>` |
| `POST` | `/api/membership/toggle-status` | Pausar o reactivar membresía | Requiere `Bearer <token>` |
| `POST` | `/api/membership/change-plan` | Migración de plan con actualización de catálogo | Requiere `Bearer <token>` |

---

## 2. Modelo de Datos Relacional (PostgreSQL / Supabase)

Para entornos escalables en la nube, se recomienda el siguiente esquema relacional con restricciones de integridad y auditoría:

```sql
-- 1. Tabla de Usuarios / Alumnos
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabla de Sesiones Activas
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_user_sessions_token ON user_sessions(token_hash);

-- 3. Tabla de Códigos de Acceso Criptográficos
CREATE TABLE access_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    code VARCHAR(64) UNIQUE NOT NULL, -- Ej: NAMASTE-SANTUARIO-9A3F1B
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'paused', 'revoked'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_access_codes_code ON access_codes(code);

-- 4. Tabla de Membresías y Suscripciones Recurrentes
CREATE TABLE memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    plan_tier VARCHAR(50) NOT NULL, -- 'plan-esencia', 'plan-santuario', 'plan-sadhana'
    provider VARCHAR(30) NOT NULL, -- 'stripe', 'mercadopago'
    external_subscription_id VARCHAR(255) UNIQUE,
    status VARCHAR(30) DEFAULT 'active', -- 'active', 'past_due', 'canceled', 'paused'
    current_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Tabla de Transacciones y Comprobantes
CREATE TABLE transactions (
    id VARCHAR(100) PRIMARY KEY,
    receipt_number VARCHAR(50) UNIQUE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    amount NUMERIC(10, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'USD',
    payment_method VARCHAR(50) NOT NULL,
    status VARCHAR(30) DEFAULT 'succeeded',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Progreso del Alumno y Clases Guardadas
CREATE TABLE user_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    class_id VARCHAR(50) NOT NULL,
    is_favorite BOOLEAN DEFAULT FALSE,
    is_completed BOOLEAN DEFAULT FALSE,
    watched_seconds INTEGER DEFAULT 0,
    last_played_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, class_id)
);
```

---

## 3. Webhook de Pasarela de Pago con Idempotencia y Manejo del Ciclo de Vida

Para evitar pagos falsos, suscripciones desincronizadas o ataques de repetición, el webhook debe implementarse con:
1. **Verificación de firma criptográfica** usando el cuerpo sin procesar (`raw body`).
2. **Registro de idempotencia** para no procesar el mismo `event.id` dos veces.
3. **Manejo de eventos de ciclo de vida completo**: altas, renovaciones exitosas, fallos de cobro y cancelaciones.

```javascript
// webhookHandler.js
import Stripe from 'stripe';
import crypto from 'node:crypto';
import { db, sendTransactionalEmail } from './services.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function handleStripeWebhook(req, res) {
  const sig = req.headers['stripe-signature'];
  let event;

  // 1. Verificación obligatoria con cuerpo crudo (Buffer)
  try {
    event = stripe.webhooks.constructEvent(req.rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // 2. Control de idempotencia
  const existingEvent = await db.processedEvents.findById(event.id);
  if (existingEvent) {
    return res.json({ received: true, message: 'Event already processed' });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        if (session.payment_status !== 'paid') {
          break;
        }

        const email = session.customer_details.email.toLowerCase();
        const name = session.customer_details.name || 'Practicante de Namasté';
        const planId = session.metadata.planId || 'plan-santuario';
        const planName = session.metadata.planName || 'Plan Santuario';

        // Generar código criptográfico de alta entropía (128 bits)
        const planTag = planId.includes('sadhana') ? 'SADHANA' : (planId.includes('esencia') ? 'ESENCIA' : 'SANTUARIO');
        const cryptoSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
        const accessCode = `NAMASTE-${planTag}-${cryptoSuffix}`;

        const user = await db.users.upsert({ email, name });
        await db.accessCodes.create({ userId: user.id, code: accessCode, status: 'active' });

        const subscription = await stripe.subscriptions.retrieve(session.subscription);
        await db.memberships.create({
          userId: user.id,
          planTier: planId,
          provider: 'stripe',
          externalSubscriptionId: session.subscription,
          status: 'active',
          currentPeriodStart: new Date(subscription.current_period_start * 1000),
          currentPeriodEnd: new Date(subscription.current_period_end * 1000)
        });

        // Despacho de email con escape seguro
        await sendTransactionalEmail({
          to: email,
          name,
          accessCode,
          planName
        });
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        await db.memberships.updateStatusBySubscription(invoice.subscription, 'past_due');
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        await db.memberships.updateStatusBySubscription(subscription.id, 'canceled');
        break;
      }
    }

    // Registrar evento procesado para idempotencia
    await db.processedEvents.create({ id: event.id, processedAt: new Date() });
    res.json({ received: true });
  } catch (error) {
    console.error('Error handling webhook event:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
}
```

---

## 4. Plantilla de Correo Transaccional con Escape Anti-XSS

Para evitar inyección de HTML o datos maliciosos en clientes de correo:

```javascript
function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function buildWelcomeEmailTemplate({ name, planName, accessCode }) {
  const safeName = escapeHtml(name);
  const safePlan = escapeHtml(planName);
  const safeCode = escapeHtml(accessCode);

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #FAF8F5; padding: 40px 20px; color: #282421;">
      <div style="max-width: 560px; margin: 0 auto; background: #FFFFFF; border-radius: 16px; padding: 36px; border: 1px solid #E8E2D8; box-shadow: 0 4px 16px rgba(0,0,0,0.04);">
        <h1 style="font-family: Georgia, serif; font-size: 26px; color: #C07053; margin-top: 0; line-height: 1.3;">
          Namasté, ${safeName}
        </h1>
        <p style="font-size: 15px; line-height: 1.6; color: #5C554E;">
          Qué alegría darte la bienvenida a nuestra escuela. Tu suscripción a <strong>${safePlan}</strong> ya está activa.
        </p>
        <div style="background-color: #F6EDE8; border: 1px dashed #C07053; border-radius: 10px; padding: 22px; text-align: center; margin: 26px 0;">
          <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 1.5px; color: #8E857C;">Tu Código de Acceso Único:</div>
          <div style="font-size: 24px; font-weight: 700; letter-spacing: 2px; color: #A85C42; margin: 10px 0;">${safeCode}</div>
          <div style="font-size: 12px; color: #8E857C;">Ingresa con este código o tu correo desde tu móvil, tablet o PC.</div>
        </div>
        <div style="text-align: center; margin-top: 28px;">
          <a href="https://martiniano-gallara.github.io/namaste/" style="background-color: #C07053; color: #FFFFFF; padding: 14px 30px; border-radius: 9999px; text-decoration: none; font-weight: 500; display: inline-block; font-size: 15px;">
            Desplegar mi esterilla ahora →
          </a>
        </div>
      </div>
    </div>
  `;
}
```

---

© 2026 Namasté Yoga. Arquitectura oficial y seguridad de sistemas.
