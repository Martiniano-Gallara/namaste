# Namasté — Guía de Arquitectura e Integración de Backend

Este documento detalla la estructura técnica preparada en el frontend y cómo conectar la plataforma de **Namasté** con una base de datos real (PostgreSQL / Supabase / Firebase), pasarelas de pago reales (Stripe / Mercado Pago) y el despacho transaccional de correos con los códigos únicos de acceso.

---

## 1. Modelo de Datos Relacional (PostgreSQL / Supabase)

A continuación se presenta el esquema SQL sugerido para persistir alumnos, códigos de acceso, suscripciones recurrentes y progreso de práctica:

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

-- 2. Tabla de Códigos de Acceso Únicos
CREATE TABLE access_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    code VARCHAR(40) UNIQUE NOT NULL, -- Ej: NAMASTE-SANTUARIO-8492
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'paused', 'revoked'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_access_codes_code ON access_codes(code);

-- 3. Tabla de Membresías y Suscripciones
CREATE TABLE memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    plan_tier VARCHAR(50) NOT NULL, -- 'esencia', 'santuario', 'sadhana'
    provider VARCHAR(30) NOT NULL, -- 'stripe', 'mercadopago'
    external_subscription_id VARCHAR(255) UNIQUE,
    status VARCHAR(30) DEFAULT 'active', -- 'active', 'past_due', 'canceled', 'paused'
    current_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Progreso del Alumno y Clases Guardadas
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

## 2. Flujo de Pago y Generación Automática de Códigos

### Secuencia del Webhook:
```
1. Alumno completa el checkout en la Landing (Stripe / Mercado Pago)
               │
               ▼
2. Pasarela dispara Webhook (ej. 'checkout.session.completed' o 'subscription.created')
               │
               ▼
3. Backend (Node.js / Python / Edge Function):
   a. Verifica la firma del Webhook (Stripe-Signature).
   b. Crea o localiza al usuario por su email.
   c. Genera un código cripto-aleatorio: `NAMASTE-${PLAN}-${CRYPTO_ID}`.
   d. Inserta registro en la tabla `access_codes` y `memberships`.
   e. Dispara correo transaccional (Resend / SendGrid) con el diseño de bienvenida de Namasté y el código.
               │
               ▼
4. Alumno recibe el código en pantalla de inmediato y en su bandeja de entrada.
```

### Implementación del Webhook en Node.js / Express:

```javascript
// webhookHandler.js
import Stripe from 'stripe';
import { generateAccessCode, sendWelcomeEmail, db } from './services.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function handleStripeWebhook(req, res) {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const customerEmail = session.customer_details.email;
    const customerName = session.customer_details.name || 'Practicante';
    const planId = session.metadata.planId || 'plan-santuario';

    // 1. Generar código de acceso
    const planTag = planId.includes('santuario') ? 'SANTUARIO' : (planId.includes('sadhana') ? 'SADHANA' : 'ESENCIA');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const accessCode = `NAMASTE-${planTag}-${randomSuffix}`;

    // 2. Guardar en Base de Datos
    const user = await db.users.upsert({ email: customerEmail, name: customerName });
    await db.accessCodes.create({ userId: user.id, code: accessCode, status: 'active' });
    await db.memberships.create({
      userId: user.id,
      planTier: planId,
      externalSubscriptionId: session.subscription,
      status: 'active'
    });

    // 3. Enviar Correo con el Código
    await sendWelcomeEmail({
      to: customerEmail,
      name: customerName,
      code: accessCode,
      planName: planId
    });
  }

  res.json({ received: true });
}
```

---

## 3. Conexión de `js/services/auth.js` con API REST

Actualmente, `js/services/auth.js` valida contra `localStorage` para demostración inmediata y fluida. Para migrar a un backend en producción, solo se debe reemplazar el método `loginWithCode`:

```javascript
// Migración a producción en js/services/auth.js:
const loginWithCode = async (code) => {
  try {
    const response = await fetch('https://api.namasteyoga.com/v1/auth/access-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: code.trim().toUpperCase() })
    });

    const data = await response.json();
    if (!response.ok) {
      return { success: false, message: data.message || 'Código inválido' };
    }

    localStorage.setItem(SESSION_KEY, JSON.stringify(data.user));
    window.dispatchEvent(new CustomEvent('namaste:auth-changed', { detail: data.user }));
    return { success: true, user: data.user };
  } catch (error) {
    return { success: false, message: 'Error de conexión con el servidor.' };
  }
};
```

---

## 4. Plantilla de Email de Bienvenida (Cálida y Minimalista)

Asunto: **«Bienvenida a tu santuario — Tu código de acceso a Namasté»**

```html
<div style="font-family: 'Helvetica Neue', sans-serif; background-color: #FAF8F5; padding: 40px; color: #282421;">
  <div style="max-width: 540px; margin: 0 auto; background: #FFFFFF; border-radius: 16px; padding: 32px; border: 1px solid #E8E2D8;">
    <h1 style="font-family: Georgia, serif; font-size: 28px; color: #C07053; margin-top: 0;">Namasté, {{name}}</h1>
    <p style="font-size: 16px; line-height: 1.6; color: #5C554E;">
      Qué alegría darte la bienvenida a nuestra escuela. A partir de este momento, tu membresía a <strong>{{planName}}</strong> está activa.
    </p>
    <div style="background-color: #F6EDE8; border: 1px dashed #C07053; border-radius: 10px; padding: 20px; text-align: center; margin: 25px 0;">
      <div style="font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: #8E857C;">Tu Código de Acceso Único:</div>
      <div style="font-size: 24px; font-weight: bold; letter-spacing: 2px; color: #A85C42; margin: 10px 0;">{{accessCode}}</div>
      <div style="font-size: 12px; color: #8E857C;">Ingresa con este código desde tu móvil, tablet o PC sin recordar contraseñas.</div>
    </div>
    <div style="text-align: center; margin-top: 30px;">
      <a href="https://namasteyoga.com" style="background-color: #C07053; color: #FFFFFF; padding: 14px 28px; border-radius: 9999px; text-decoration: none; font-weight: 500; display: inline-block;">
        Desplegar mi esterilla ahora
      </a>
    </div>
  </div>
</div>
```
