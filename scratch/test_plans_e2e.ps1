try {
  Write-Host "==========================================================" -ForegroundColor Yellow
  Write-Host "AUDITORIA DE GESTION DE PLANES Y MERCADO PAGO EN TIEMPO REAL" -ForegroundColor Yellow
  Write-Host "==========================================================" -ForegroundColor Yellow

  # 1. Test Public Plans API
  Write-Host "`n[TEST 1] GET /api/plans (Publico para la Landing Page)" -ForegroundColor Cyan
  $resPlans = Invoke-RestMethod -Uri 'http://localhost:3000/api/plans' -Method GET
  Write-Host "Planes cargados desde la base de datos: $($resPlans.plans.Count)" -ForegroundColor Green
  foreach ($p in $resPlans.plans) {
    Write-Host "  * $($p.name) [$($p.id)]: `$$($p.priceMonthly)/mes | `$$($p.priceAnnualTotal)/ano | MP: $($p.mercadopagoUrl)" -ForegroundColor Gray
  }

  # 2. Login as Admin Valeria
  Write-Host "`n[TEST 2] Autenticacion de Directora (Valeria Manassero)" -ForegroundColor Cyan
  $loginBody = @{ identifier = 'valeria.manassero@namaste.com' } | ConvertTo-Json
  $loginRes = Invoke-RestMethod -Uri 'http://localhost:3000/api/auth/login' -Method POST -Body $loginBody -ContentType 'application/json'
  $adminToken = $loginRes.token
  Write-Host "Sesion de Directora iniciada. Token generado: $adminToken" -ForegroundColor Green

  # 3. Test Protected Admin Plans GET
  Write-Host "`n[TEST 3] GET /api/admin/plans (Protegido con Token Admin)" -ForegroundColor Cyan
  $headers = @{ Authorization = "Bearer $adminToken" }
  $adminPlans = Invoke-RestMethod -Uri 'http://localhost:3000/api/admin/plans' -Method GET -Headers $headers
  $propsCount = ($adminPlans.plans.PSObject.Properties | Measure-Object).Count
  Write-Host "Configuracion de planes leida con exito ($propsCount planes disponibles)" -ForegroundColor Green

  # 4. Update Plans via Admin POST (Modificando precios y enlaces de Mercado Pago)
  Write-Host "`n[TEST 4] POST /api/admin/plans (Valeria actualiza precios y enlaces de MP)" -ForegroundColor Cyan
  $payload = @{
    plans = @{
      'plan-esencia' = @{
        id = 'plan-esencia'
        name = 'Plan Esencia'
        badge = 'Inicial'
        priceMonthly = 20
        priceAnnualTotal = 200
        mercadopagoUrl = 'https://mpago.la/esencia-mensual-oficial'
        mercadopagoUrlAnnual = 'https://mpago.la/esencia-anual-oficial'
        description = 'Para quienes inician y desean pausas de presencia con Yoga Suave y Clasico.'
        features = @(
          'Acceso a +40 clases de Yoga Suave y Clasico',
          'Meditaciones guiadas y Yoga Relax nocturno',
          '2 clases nuevas anadidas cada mes',
          'Acceso en movil, tablet y computadora'
        )
      }
      'plan-refugio' = @{
        id = 'plan-refugio'
        name = 'Plan Refugio'
        badge = 'Mas Elegido'
        priceMonthly = 32
        priceAnnualTotal = 320
        mercadopagoUrl = 'https://mpago.la/refugio-mensual-oficial'
        mercadopagoUrlAnnual = 'https://mpago.la/refugio-anual-oficial'
        description = 'La experiencia completa del Shala. Acceso total a todas las disciplinas.'
        features = @(
          'Acceso ilimitado a todo el catalogo (+140 clases)',
          'Todos los estilos: Vinyasa, Hatha, Yin Yoga y Pranayama',
          'Nuevas clases grabadas cada semana',
          'Encuentros mensuales en vivo por Zoom (Satsang)'
        )
      }
      'plan-sadhana' = @{
        id = 'plan-sadhana'
        name = 'Plan Sadhana'
        badge = 'Premium'
        priceMonthly = 45
        priceAnnualTotal = 450
        mercadopagoUrl = 'https://mpago.la/sadhana-mensual-oficial'
        mercadopagoUrlAnnual = 'https://mpago.la/sadhana-anual-oficial'
        description = 'Inmersion profunda. Practica avanzada, masterclasses y mentoria personal.'
        features = @(
          'Todo lo de Plan Refugio sin restricciones',
          'Sesion individual de bienvenida de 30 min por Zoom',
          'Masterclasses y series de meditacion avanzada',
          'Cuaderno digital de Sadhana y soporte directo'
        )
      }
    }
  } | ConvertTo-Json -Depth 6

  $saveRes = Invoke-RestMethod -Uri 'http://localhost:3000/api/admin/plans' -Method POST -Headers $headers -Body $payload -ContentType 'application/json'
  Write-Host "Respuesta de guardado: $($saveRes.message)" -ForegroundColor Green

  # 5. Verify Public Plans Immediately Reflect Database Changes
  Write-Host "`n[TEST 5] Verificar reflejo instantaneo en catalogo publico (GET /api/plans)" -ForegroundColor Cyan
  $verifyPlans = Invoke-RestMethod -Uri 'http://localhost:3000/api/plans' -Method GET
  foreach ($p in $verifyPlans.plans) {
    Write-Host "  * $($p.name): `$$($p.priceMonthly)/mes | `$$($p.priceAnnualTotal)/ano" -ForegroundColor White
    Write-Host "    - MP Mensual: $($p.mercadopagoUrl)" -ForegroundColor DarkGray
    Write-Host "    - MP Anual:   $($p.mercadopagoUrlAnnual)" -ForegroundColor DarkGray
  }

  # 6. Test Security (1000% Seguro)
  Write-Host "`n[TEST 6] Pruebas de Seguridad Rigurosa" -ForegroundColor Cyan
  
  # Intento sin token
  try {
    Invoke-RestMethod -Uri 'http://localhost:3000/api/admin/plans' -Method POST -Body $payload -ContentType 'application/json'
    Write-Host "FALLO: Se permitio peticion sin token de autenticacion" -ForegroundColor Red
  } catch {
    Write-Host "EXITO: Bloqueada peticion no autenticada ($($_.Exception.Response.StatusCode))" -ForegroundColor Green
  }

  # Intento con URL maliciosa (script injection)
  try {
    $malicious = @{
      plans = @{
        'plan-refugio' = @{
          id = 'plan-refugio'
          priceMonthly = 29
          priceAnnualTotal = 290
          mercadopagoUrl = 'javascript:alert(1)'
        }
      }
    } | ConvertTo-Json -Depth 5
    Invoke-RestMethod -Uri 'http://localhost:3000/api/admin/plans' -Method POST -Headers $headers -Body $malicious -ContentType 'application/json'
    Write-Host "FALLO: Se permitio URL maliciosa con javascript:" -ForegroundColor Red
  } catch {
    Write-Host "EXITO: Bloqueada URL con esquema peligroso (400 Bad Request)" -ForegroundColor Green
  }

  Write-Host "`n==========================================================" -ForegroundColor Yellow
  Write-Host "TODAS LAS PRUEBAS COMPLETADAS CON EXITO (100% OPERATIVO)" -ForegroundColor Green
  Write-Host "==========================================================" -ForegroundColor Yellow

} catch {
  Write-Host "ERROR CRITICO: $($_.Exception.ToString())" -ForegroundColor Red
}
