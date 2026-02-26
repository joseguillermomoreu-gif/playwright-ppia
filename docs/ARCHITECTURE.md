# Arquitectura — playwright-ppia

> Documento técnico de arquitectura detallada.
> Última revisión: 2026-02-26

---

## Visión de alto nivel

```
┌─────────────────────────────────────────────────────────────────┐
│                    QA Automatizador                             │
│  ppia generate / ppia run / ppia docs / ppia compare / ...     │
└─────────────────────────────┬───────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│              PPIA Framework — packages/core (TypeScript)        │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐   │
│  │   Agents     │  │  Playwright  │  │  Config & Setups   │   │
│  │ (orquesta)   │  │  (browser)   │  │  (ppia.yaml)       │   │
│  └──────┬───────┘  └──────┬───────┘  └────────────────────┘   │
│         │                 │                                     │
│  ┌──────▼─────────────────▼───────────────────────────────┐    │
│  │              AI Service Client (HTTP)                   │──┐ │
│  └────────────────────────────────────────────────────────┘  │ │
└──────────────────────────────────────────────────────────────┼─┘
                                                               │
                              HTTP (localhost:8765)            │
                                                               │
┌──────────────────────────────────────────────────────────────▼─┐
│         Python AI Service — packages/core/python/              │
│                          (interno, invisible al usuario)        │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐   │
│  │  Session     │  │  LLM Service │  │  Prompt Builder    │   │
│  │  Manager     │  │  OpenAI/     │  │  (por fase)        │   │
│  │              │  │  Anthropic   │  │                    │   │
│  └──────────────┘  └──────────────┘  └────────────────────┘   │
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  Generators: test.spec.ts / POM / Gherkin / cucumber   │    │
│  └────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Frontera de responsabilidades

| Responsabilidad | Quién |
|----------------|-------|
| Ejecutar acciones en el browser (click, fill, navigate...) | **TypeScript** (Playwright) |
| Extraer HTML de la página actual | **TypeScript** (Playwright) |
| Ejecutar tests generados (`npx playwright test`) | **TypeScript** (Playwright) |
| Scrapear precios de LLM (startup check) | **TypeScript** (Playwright) |
| CLI y UI de terminal | **TypeScript** |
| Orquestación del flujo (arrancar Python, llamar endpoints, ejecutar acciones) | **TypeScript** |
| **Todo lo demás** | **Python** |
| Leer `ppia.yaml` al arrancar (usuarios, modelos, límites, setups) | **Python** |
| Lógica de IA: prompts, llamadas a LLM, parsing de respuestas | **Python** |
| Gestión de sesiones (crear, mantener historial, cerrar) | **Python** |
| Leer/escribir Knowledge Base (`.ppia/knowledge.json`) | **Python** |
| Leer pricing cache (`.ppia/llm-pricing.json`) para calcular costes | **Python** |
| Calcular `estimated_cost` por llamada (`tokens × precio`) | **Python** |
| Generar test code, POM, Gherkin, cucumber | **Python** |
| Escribir ficheros generados a disco (`output/`) | **Python** (usa `--project-root` + config de `ppia.yaml`) |

**Principio rector**: TypeScript solo toca el browser y la terminal. Python es el cerebro — toda la lógica, datos y cálculos pasan por él.

### Project root

El Python AI Service necesita conocer la raíz del proyecto para acceder a `ppia.yaml` y `.ppia/`. Se le pasa al arrancar:

```bash
python -m ppia_ai.server --project-root /path/to/project --port 8765
```

Al arrancar, Python:
1. Lee `ppia.yaml` desde `--project-root` → carga usuarios, modelos, límites, setups
2. Lee `.ppia/knowledge.json` (si existe) → knowledge base disponible
3. Lee `.ppia/llm-pricing.json` (si existe) → precios cacheados disponibles

---

## Modelo de sesiones

El AI Service gestiona tres tipos de sesión con responsabilidades distintas.
El TypeScript orquesta cuándo crear, usar y cerrar cada sesión.

### Sesión 0 — Contexto inteligente (puntual, antes de la exploración)

Sesión sin estado propio: recibe el input del usuario, detecta si hay usuario nativo
o credenciales en texto libre, consulta la knowledge base y devuelve el input
formateado enriquecido con todo el contexto necesario para la sesión A.

```
Input usuario: "Validar área premium con usuario admin"
  → Sesión 0 detecta "admin" como usuario nativo (existe en ppia.yaml)
  → Señala: preload_setup = true, user = "admin"
  → SetupAgent autentica ANTES de arrancar sesión A

Input usuario: "Validar área premium, login con admin@ejemplo.com y contraseña secret"
  → Sesión 0 detecta descripción de login en lenguaje natural
  → Señala: preload_setup = false, login_context = { email, password, description }
  → Sesión A recibe login_context y gestiona el auth durante la exploración
```

**Detección de usuario — dos casos:**

Sesión 0 compara el input contra los usuarios definidos en `ppia.yaml` y decide:

| Caso | Ejemplo de input | Resultado |
|------|-----------------|-----------|
| Usuario nativo (existe en `ppia.yaml`) | "...con usuario admin" | SetupAgent precarga y autentica. Input pasa al generador **sin** la referencia al usuario — el browser ya está preparado |
| Cualquier otro caso | "...un usuario premium...", "...login con email X...", sin usuario | Input completo pasa al generador tal cual. Sesión A gestiona todo |

Solo se precarga el setup del usuario mencionado — nunca todos los setups de `ppia.yaml`.

**Knowledge base** — ubicación y gestión:

- Fichero por proyecto: `.ppia/knowledge.json` en la raíz del proyecto
- **Python la lee y la escribe** — TypeScript nunca toca este fichero
- Python la consulta en `/prepare-input` para inyectar pre-contexto de selectores conocidos
- Python la actualiza al recibir la orden de finalización de una sesión exitosa
- Los logs del AI Service se escriben en `.ppia/logs/`
- El usuario decide si commitear `.ppia/` o añadirlo al `.gitignore`

```json
{
  "url": "https://example.com/login",
  "elements": [
    {
      "description": "botón submit del formulario de login",
      "reliable_selector": "[data-testid='login-btn']",
      "problematic_selectors": ["#submit", ".btn-login"],
      "learned_from": "login_validacion_admin",
      "learned_at": "2026-02-25"
    }
  ]
}
```

El aprendizaje es **por URL + elemento**, no por similitud entre tests.
Cualquier test futuro que toque esa URL hereda el conocimiento acumulado,
independientemente de su objetivo.

### Sesión A — Exploración (una por ejecución de `ppia generate`)

Una única conversación continua que vive durante toda la fase de exploración.
En cada ronda, el LLM recibe el HTML actual y analiza desde **todos los ángulos posibles**
en la misma llamada: selectores candidatos, flujos alternativos, posibles trampas, acciones recomendadas.

```
Sesión A (persiste en memoria del servidor Python)

  Ronda 1:
    TypeScript → [HTML actual] → Python (sesión A)
    Python → analiza todos los ángulos → devuelve acción + análisis acumulado
    TypeScript ejecuta la acción con Playwright

  Ronda 2:
    TypeScript → [nuevo HTML] → Python (sesión A, mismo hilo)
    Python → analiza con contexto de ronda 1 → devuelve siguiente acción
    TypeScript ejecuta la acción con Playwright

  ...

  Ronda N:
    Python → completed = true

Al finalizar: la sesión A contiene el historial completo —
qué selectores funcionaron, qué acciones fallaron, qué flujo
llevó al objetivo. Esta riqueza informa directamente la generación.
```

### Sesión B — Generación (nueva sesión por cada intento)

Cada intento de generación arranca una sesión B fresca.
Recibe el informe de exploración de la sesión A como contexto inicial,
más el informe de fallo del intento anterior si lo hay.

La generación es **secuencial**: primero el test, luego los artefactos.
Los artefactos se generan en la misma sesión B que el test —
el LLM sabe POR QUÉ cada paso del test es como es.

```
Intento 1: sesión B fresca
  Contexto: informe de sesión A
  → genera test.spec.ts
  TypeScript ejecuta el test con Playwright

  ✅ pasa:
    Misma sesión B continúa:
    → genera POM.md
    → genera Gherkin spec
    → genera cucumber.md
    TypeScript valida todo → ✅ fin

  ❌ falla:
    Sesión B cerrada. Intento 2: nueva sesión B fresca
    Contexto: informe de sesión A + informe de fallo del intento 1
    → regenera test.spec.ts evitando los errores conocidos
    TypeScript ejecuta el test con Playwright
    → ...
```

**Por qué sesiones B frescas en cada intento**: evita que el LLM intente
"corregir" su intento anterior quedándose anclado en el mismo enfoque fallido.
Una sesión nueva con el fallo como contexto produce soluciones más creativas.

---

## Startup: health check y actualización de precios

Al arrancar `ppia generate`, antes de cualquier fase, el CLI ejecuta un **startup check** una vez por día. Si ya se ejecutó hoy (timestamp en `.ppia/last-startup.json`), se salta directamente al flujo.

### Secuencia del startup check

1. **Verificar herramientas locales**: Node.js, Python, Playwright (versiones mínimas)
2. **Arrancar Python AI Service**: `python -m ppia_ai.server --project-root ... --port 8765`
   - Python lee `ppia.yaml`, `.ppia/knowledge.json`, `.ppia/llm-pricing.json`
3. **Health check**: `GET /ping` → confirma que el AI Service responde
4. **Verificar API keys**: que al menos una key (OpenAI o Anthropic) esté configurada
5. **Scrapear precios** (Playwright): visita las páginas oficiales de precios de los modelos configurados
   - Escribe `.ppia/llm-pricing.json` con los precios actualizados
   - Si falla → fallback silencioso a la caché existente
6. **Mostrar estimación de coste** para el test actual

```
✦ playwright-ppia v0.1.0
  ─────────────────────────────────────────
  Comprobando herramientas...
    ✅ Playwright       v1.48.0
    ✅ Python           3.12.1
    ✅ AI Service       listo en localhost:8765
    ✅ OpenAI API key   configurada
    ✅ Anthropic key    configurada

  Actualizando precios...
    ✅ gpt-4o-mini      $0.15 / $0.60 MTok
    ✅ claude-haiku-4-5 $1.00 / $5.00 MTok

  Estimación para este test (~12 acciones):
    Exploración  gpt-4o-mini    ~$0.01
    Generación   claude-haiku   ~$0.08
    ────────────────────────────────────
    Total estimado               ~$0.09
```

### Actualización de precios

- Playwright scrapea las páginas oficiales de precios de OpenAI y Anthropic
- Solo actualiza los modelos configurados por el usuario (`model_fast` y `model_strong`)
- Los precios se cachean en `.ppia/llm-pricing.json`
- Si el scraping falla (sin conexión, web cambiada) → usa la caché existente como fallback silencioso
- La frecuencia es **una vez al día** — los precios raramente cambian intradía

### Estimación de coste

La estimación de acciones se infiere del input del usuario (sin llamada IA adicional):
- Objetivo corto y simple → ~8 acciones
- Objetivo con múltiples pasos o condiciones → ~15-20 acciones
- Objetivo complejo (multi-usuario, multi-página) → ~25+ acciones

La estimación es orientativa. El coste real se muestra al finalizar con desglose por fase.

---

## Flujo completo de `ppia generate`

```
ppia generate "Validar login como admin en staging"
│
├─ Startup check (solo 1 vez al día)
│   Health check de herramientas + scraping de precios + estimación de coste
│
├─ Fase 0: Sesión 0 — contexto inteligente
│   TypeScript → Python (puntual, sin estado)
│   → formatea input: url, objective, testName, parameters
│   → consulta knowledge base por URL
│   → devuelve input formateado + pre-contexto de selectores conocidos
│
├─ Fase 1: Setup del browser
│   TypeScript (Playwright) — carga entorno + auth del usuario indicado
│
├─ Fase 2: Exploración — Sesión A
│   Sesión A abierta en Python
│   Loop iterativo (máx. MAX_ITERATIONS):
│     TypeScript extrae HTML → envía a Python (sesión A)
│     Python analiza todos los ángulos → devuelve acción
│     TypeScript ejecuta acción con Playwright
│     Si completed=true → break
│     Si MAX_ITERATIONS alcanzado + hay análisis → break con completed=false
│     Si MAX_ITERATIONS alcanzado + sin análisis  → aborta con error al usuario
│   Sesión A produce informe de exploración (completo o parcial)
│
├─ Fase 3: Generación — Sesión B (intentos)
│   Intento 1: sesión B fresca con informe de sesión A
│     Python genera test.spec.ts
│     TypeScript ejecuta el test
│     ✅ → continúa en la misma sesión B:
│       Python genera POM.md, Gherkin spec, cucumber.md
│       TypeScript valida → ✅ fin
│     ❌ → sesión B cerrada, intento 2:
│       Nueva sesión B con informe A + fallo del intento 1
│       → regenera test.spec.ts
│       → ...
│
└─ Fase 4: Output final
    Guarda test + artefactos en la suite
    Actualiza knowledge base con selectores aprendidos en sesión A
    Muestra métricas (tokens, tiempo, coste, rondas de exploración, intentos de generación)
```

---

## Endpoints del Python AI Service

```
# Gestión de sesiones
POST   /session              → { session_id }   (crea sesión A o B)
  Body: { type: "exploration" | "generation" }
  # Python selecciona el modelo automáticamente: model_fast para exploration, model_strong para generation
DELETE /session/{id}         → cierra y libera la sesión

# Fase 0 — Sesión 0 (puntual, sin estado)
POST   /prepare-input        → { url, objective, test_name, parameters, pre_context, detected_user, estimated_actions, estimated_cost, tokens_used }
  Body: { raw_input }
  # Python ya tiene ppia.yaml cargado: conoce los usuarios disponibles, modelos, etc.
  # detected_user: usuario nativo detectado por la IA (nombre de ppia.yaml o null)
  # Python lee .ppia/knowledge.json internamente para inyectar pre_context
  # estimated_actions: heurística del nº de acciones inferida del input
  # estimated_cost: calculado por Python usando .ppia/llm-pricing.json

# Fase 2 — Sesión A (exploración)
POST   /session/{id}/explore → { action, target, value, completed, analysis, tokens_used, estimated_cost }
  Body: { html, context, last_action_error? }
  # last_action_error: si la acción anterior falló, el error se envía para que el LLM corrija
  # estimated_cost: calculado por Python para esta llamada

# Fase 3 — Sesión B (generación)
POST   /session/{id}/generate-test      → { code, file_path, tokens_used, estimated_cost }
  Body: { exploration_report, failure_report? }
  # Python genera el código, lo escribe a disco en output/ y devuelve el path
  # TypeScript usa file_path para ejecutar el test con Playwright

POST   /session/{id}/generate-artifacts → { pom_md, gherkin_md, cucumber_md, file_paths, tokens_used, estimated_cost }
  Body: {}   (la sesión ya tiene el contexto del test generado)
  # Python genera los artefactos y los escribe a disco junto al test

# Knowledge Base (Python gestiona lectura/escritura)
GET    /knowledge             → { entries: [...] }                    (todas las entradas)
GET    /knowledge?url=<url>   → { entries: [...] }                    (filtradas por URL)
DELETE /knowledge             → { deleted_count }                     (reset completo)
DELETE /knowledge?url=<url>   → { deleted_count }                     (reset por URL)
POST   /knowledge/update      → { updated_count }                     (llamado tras sesión exitosa)
  Body: { session_id }
  # Python extrae los datos de la sesión A que ya tiene en memoria

# Utilidades
GET    /ping                 → { status: "ok", version }
GET    /models               → { available: [...] }
```

---

## Framework TypeScript — Estructura

```
packages/core/
├── package.json
├── tsconfig.json
├── python/                          ← AI Service interno (bundleado con el npm)
│   ├── pyproject.toml
│   └── src/
│
└── src/
    ├── agents/                      # Agentes orquestadores
    │   ├── AbstractBaseAgent.ts     # Base: aiClient, browser, logger, config
    │   ├── InputAnalyzerAgent.ts    # Fase 0: optimiza input con IA (puntual)
    │   ├── SetupAgent.ts            # Fase 1: setup browser + auth
    │   ├── ExplorationAgent.ts      # Fase 2: gestiona sesión A + bucle iterativo
    │   └── GenerationAgent.ts       # Fase 3: gestiona sesiones B + reintentos
    │
    ├── ai/                          # Cliente del Python AI Service
    │   ├── AiServiceClient.ts       # HTTP client + lifecycle del servidor Python
    │   ├── AiServiceTypes.ts        # DTOs de request/response
    │   └── SessionManager.ts        # Crea/cierra sesiones A y B
    │
    ├── browser/                     # Playwright wrapper
    │   ├── BrowserManager.ts        # Gestión de contextos
    │   ├── HtmlExtractor.ts         # Extracción de HTML
    │   └── ActionExecutor.ts        # Ejecuta acciones (click, fill, navigate...)
    │
    ├── config/                      # Configuración de proyecto
    │   ├── ProjectConfig.ts         # Lee y valida ppia.yaml
    │   └── SetupManager.ts          # Gestión entornos + usuarios + auth flows
    │
    ├── executor/                    # Ejecución de tests generados
    │   ├── TestExecutor.ts          # Lanza playwright test + captura resultado
    │   └── ExecutionResult.ts       # Modelo: resultado (passed, failed, error)
    │
    ├── suite/                       # Gestión de suite viva
    │   ├── SuiteManager.ts          # Historial, índice, versiones
    │   ├── SuiteStorage.ts          # Persistencia (JSON files)
    │   ├── SuiteEntry.ts            # Modelo: una entrada del historial
    │   ├── KnowledgeBase.ts         # Client: delega lectura/escritura a Python AI Service
    │   └── KnowledgeEntry.ts        # Modelo TypeScript (para display en CLI)
    │
    ├── domain/                      # Modelos del dominio TypeScript
    │   ├── AgentContext.ts          # Contexto acumulado del pipeline
    │   ├── ExplorationReport.ts     # Output de sesión A
    │   ├── GeneratedTest.ts         # Test generado + artefactos
    │   └── GenerationResult.ts      # Resultado completo de una sesión
    │
    └── cli/                         # CLI pública
        ├── index.ts                 # Entry point: ppia
        ├── commands/
        │   ├── generate.ts          # ppia generate
        │   ├── run.ts               # ppia run
        │   ├── docs.ts              # ppia docs
        │   ├── compare.ts           # ppia compare
        │   └── suite.ts             # ppia suite
        └── ui/
            └── ProgressDisplay.ts   # Output de terminal (Chalk + Ora)
```

---

## Python AI Service — Estructura

```
packages/core/python/
├── pyproject.toml
├── .env.example
└── src/
    ├── server.py                        # FastAPI app + routes

    ├── domain/
    │   ├── repository/
    │   │   └── llm_service.py           # Port LLM (interfaz abstracta)
    │   ├── model/
    │   │   ├── session.py               # Modelo de sesión (A y B)
    │   │   ├── exploration_report.py    # Output de una sesión A completa
    │   │   ├── test_file.py
    │   │   ├── test_step.py
    │   │   ├── selector.py
    │   │   └── pom_structure.py
    │   └── service/
    │       └── test_analyzer.py

    ├── application/
    │   ├── dto/
    │   │   ├── prepare_input.py
    │   │   ├── explore_request.py
    │   │   ├── generate_test_request.py
    │   │   └── generate_artifacts_request.py
    │   └── use_cases/
    │       ├── prepare_input/           # Sesión 0: formatea input + inyecta pre-contexto
    │       ├── explore_iteration/       # Una ronda de sesión A
    │       ├── generate_test/           # Sesión B: genera test
    │       ├── generate_pom/            # Sesión B continua: POM
    │       ├── generate_gherkin/        # Sesión B continua: Gherkin spec
    │       └── generate_cucumber/       # Sesión B continua: cucumber

    └── infrastructure/
        ├── session/
        │   └── session_store.py         # Mantiene sesiones en memoria
        ├── ai/
        │   ├── openai/
        │   │   └── openai_llm_service.py
        │   └── anthropic/
        │       └── claude_llm_service.py
        ├── prompts/
        │   ├── exploration_prompt.py    # Prompt del análisis multi-ángulo
        │   ├── generation_prompt.py     # Prompt de generación de test
        │   └── artifacts_prompt.py      # Prompt de generación de artefactos
        ├── config/
        │   ├── settings.py
        │   ├── dependency_injection.py  # Selección OpenAI/Anthropic por modelo
        │   └── project_config.py       # Lee y parsea ppia.yaml (usuarios, modelos, límites)
        ├── knowledge/
        │   └── knowledge_store.py      # Lee/escribe .ppia/knowledge.json
        └── pricing/
            └── pricing_store.py        # Lee .ppia/llm-pricing.json para calcular costes
```

---

## Modelo de datos: AgentContext

```typescript
interface AgentContext {
  // Fase 0: Input analizado
  rawInput: string;
  url: string;
  objective: string;
  testName: string;
  parameters: Record<string, string>;
  estimatedActions: number;              // heurística de Sesión 0, usada para estimar coste

  // Config de proyecto (de ppia.yaml)
  config: {
    modelFast: string;                   // Sesión A (exploración) — default: gpt-4o-mini
    modelStrong: string;                 // Sesión B (generación) — default: gpt-4o
    maxIterations: number;               // default: 25
    maxGenerationAttempts: number;       // default: 3
    outputDir: string;                   // default: ./output
    artifacts: 'integrated' | 'docs';    // default: integrated
  };

  // Setup de entorno (opcional)
  setup?: {
    environment: EnvironmentConfig;
    user?: UserConfig;
  };

  // Fase 1: Browser setup
  browserContext?: BrowserContext;

  // Fase 2: Resultado de exploración (sesión A)
  explorationReport?: ExplorationReport;

  // Fase 3: Resultado de generación (sesión B)
  generatedTest?: GeneratedTest;
  generationAttempts: number;

  // Métricas agregadas
  metrics: {
    totalTokensUsed: number;
    totalTimeMs: number;
    estimatedCost: number;
    explorationRounds: number;
    generationAttempts: number;
  };
}
```

---

## Setup & User Manager

### Dos flujos independientes

#### Flujo A — Generador de tests (usa setups)

El setup es **opcional**. ppia funciona sin él:

```bash
# Sin setup previo — ppia descubre el auth durante la exploración
ppia generate "Validar área premium" --user admin@ejemplo.com --password secret

# Con setup previo — más rápido, sesión A centrada solo en el objetivo
ppia generate "Validar área premium" --setup staging --user admin
```

Sin setup: la sesión A recibe las credenciales como contexto y descubre el flujo
de autenticación durante el análisis. Más lento, más rondas de exploración.

Con setup: el `SetupAgent` autentica antes de arrancar la exploración.
La sesión A arranca ya en el estado correcto, menos rondas necesarias.

#### Flujo B — Generador de setups (`ppia setup add`)

Flujo independiente del generador de tests. Guía al usuario interactivamente
para crear un setup y lo persiste en `ppia.yaml`.

Internamente usa la misma arquitectura de sesiones pero enfocada en login:
- **Mini sesión A**: explora el formulario de login (campos, selectores, submit)
- **Mini sesión B**: genera la configuración del setup (auth flow, selectores fiables, cookies)

```bash
ppia setup add              # flujo interactivo: entorno, URL, usuario, auth
ppia setup list             # ver setups disponibles
ppia setup test staging admin  # verificar que un setup funciona
ppia setup remove staging   # eliminar un setup de ppia.yaml
```

`ppia.yaml` puede escribirse a mano, pero `ppia setup add` lo genera
y valida automáticamente mediante IA.

### SetupManager (usado por el Flujo A)

```typescript
class SetupManager {
  async resolveSetup(envName?: string, userName?: string): Promise<ResolvedSetup>
  async authenticate(page: Page, setup: ResolvedSetup): Promise<void>
  // auth flows: login_form | cookie_injection | extensible
}
```

---

## Suite Manager

```typescript
interface SuiteEntry {
  id: string;
  testName: string;
  objective: string;
  createdAt: Date;
  setup?: { environment: string; user?: string };
  testPath: string;
  artifactsPaths: { pomMd?: string; gherkinMd?: string; cucumberMd?: string };
  metrics: {
    tokensUsed: number;
    timeMs: number;
    estimatedCost: number;
    generationAttempts: number;
    breakdown: {
      exploration: { model: string; tokens: number; cost: number };
      generation: { model: string; tokens: number; cost: number };
    };
  };
  version: number;
}
```

---

## CLI pública — Subcomandos

```bash
# Flujo A — Generación de tests
# Sin setup previo (ppia descubre el auth durante la exploración)
ppia generate "Validar área premium" --user admin@ejemplo.com --password secret

# Con setup previo (más rápido, exploración centrada en el objetivo)
ppia generate "Validar login" [--setup staging] [--user admin] [--model claude-opus-4-6]

# Ejecutar tests de la suite
ppia run [--test login_validacion] [--suite login/] [--user suscriptor] [--setup staging]

# Regenerar artefactos desde test existente
ppia docs --input output/login_validacion/test.spec.ts
ppia docs --suite login/

# Comparar versiones
ppia compare --test login_validacion --before v1 --after v2

# Gestión de suite
ppia suite list [--filter login]
ppia suite show login_validacion
ppia suite versions login_validacion
ppia suite clean [--older-than 30d]

# Flujo B — Generador de setups (independiente del generador de tests)
ppia setup add              # flujo interactivo: crea entorno + usuario + auth flow
ppia setup list             # ver setups disponibles en ppia.yaml
ppia setup test staging admin  # verificar que un setup funciona correctamente
ppia setup remove staging   # eliminar un setup de ppia.yaml
```

---

## Decisiones de arquitectura

| # | Decisión | Elección | Motivo |
|---|----------|----------|--------|
| D1 | Lenguaje del framework | TypeScript + Playwright | El QA ya está en ese entorno |
| D2 | Capa de IA | Python AI Service (interno) | Python más maduro para LLMs |
| D3 | Python para el usuario | Invisible (bundleado en npm) | El QA no toca Python |
| D4 | Comunicación TS↔Python | HTTP local (localhost:8765) | Mantiene sesiones en memoria |
| D5 | Modelo de sesiones | A (exploración) + B (generación) | Separa responsabilidades, reintentos limpios |
| D6 | Multi-ángulo por ronda | Una sola sesión A acumula todo | Más rico que 6 estrategias paralelas |
| D7 | Reintentos de generación | Sesión B fresca por intento | Evita que el LLM quede anclado en el error |
| D8 | Artefactos en sesión B | Misma sesión que el test | El LLM sabe POR QUÉ cada paso |
| D9 | Proveedores LLM | OpenAI + Anthropic | Selección automática por nombre de modelo |
| D10 | Config de proyecto | ppia.yaml | Legible, versionable, no requiere programar |
| D11 | Aprendizaje de selectores | Knowledge base por URL + elemento | Cualquier test que toque esa URL hereda el conocimiento, independiente del objetivo |
| D12 | Sesión 0 | Puntual sin estado, consulta knowledge base | El pre-contexto enriquece sesión A antes de arrancar |
| D13 | Detección de usuario en input | Sesión 0 compara input contra ppia.yaml | Nativo → preload setup; credenciales en texto → login_context a sesión A |
| D14 | Generador de setups | Mini sesión A + mini sesión B enfocadas en login | Coherente con la arquitectura general, reutiliza la misma maquinaria |
| D15 | Package manager TypeScript | pnpm | Más rápido que npm, workspaces nativos, mejor para monorepos |
| D16 | Test runner TypeScript | Vitest | ESM nativo, TypeScript sin config extra, API compatible con Jest |
| D17 | Suite storage | JSON files | Sin dependencias extra, versionable con git, suficiente para el caso de uso |
| D18 | Quién lee ppia.yaml | Python al arrancar | Simplifica la API: Python ya tiene usuarios, modelos y límites sin necesidad de recibirlos en cada body |

## Requisitos del sistema

| Requisito | Versión mínima | Notas |
|-----------|---------------|-------|
| Node.js | 18+ | Para el framework TypeScript y el CLI |
| Python | 3.11+ | Para el AI Service (gestionado internamente por el CLI) |
| Playwright | según `package.json` del proyecto del usuario | Debe estar instalado en el proyecto donde se usa ppia |

El CLI verifica la versión de Python antes de crear el venv en el primer uso. Si no se cumple, muestra un error legible con instrucciones.

---

## Modelos por defecto

Dos perfiles de modelo: rápido/barato para exploración (muchas llamadas), potente para generación (pocas llamadas, más críticas).

| Perfil | OpenAI | Anthropic |
|--------|--------|-----------|
| Fast (sesión A, exploración) | `gpt-4o-mini` | `claude-haiku-4-5` |
| Strong (sesión B, generación + artefactos) | `gpt-4o` | `claude-sonnet-4-6` |

Configurables en `ppia.yaml` con `model_fast` y `model_strong`. El usuario puede sobreescribir ambos.

---

## Configuración de proyecto: `ppia.yaml`

Fichero de configuración por proyecto. Todos los campos son opcionales salvo `project.name`.

```yaml
project:
  name: mi-proyecto
  description: Suite de tests E2E

ai_service:
  port: 8765                         # default: 8765
  model_fast: gpt-4o-mini            # Sesión A (exploración) — default: gpt-4o-mini
  model_strong: gpt-4o               # Sesión B (generación + artefactos) — default: gpt-4o
  max_iterations: 25                 # Máximo de rondas en Sesión A — default: 25
  max_generation_attempts: 3         # Reintentos de Sesión B — default: 3

environments:
  staging:
    base_url: https://www.ejemplo.pre
    cookies: .auth/staging_cookies.json   # opcional: cookies pre-inyectadas
  production:
    base_url: https://www.ejemplo.com

users:
  admin:
    email: admin@ejemplo.com
    password: ${ADMIN_PASSWORD}           # variables de entorno soportadas
    role: administrator
    auth_flow: login_form                 # login_form | cookie_injection
  suscriptor:
    email: suscriptor@ejemplo.com
    password: ${SUSCRIPTOR_PASSWORD}
    role: subscriber
    auth_flow: login_form
  anonimo:
    role: anonymous

setup_combinations:
  - environment: staging
    users: [admin, suscriptor, anonimo]
  - environment: production
    users: [anonimo]

output:
  dir: ./output                          # default: ./output
  artifacts: integrated                  # integrated | docs — default: integrated
  # integrated → artefactos junto al test en output/{test_name}/
  # docs       → artefactos en docs/{test_name}/
```

---

## Variables de entorno

El usuario configura API keys como variables de entorno estándar. El CLI las pasa al Python AI Service al arrancarlo.

```bash
# Obligatoria (al menos una)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Opcionales (el AI Service las lee del entorno)
AI_SERVICE_PORT=8765          # default: 8765
TEMPERATURE=0.3               # default: 0.3
DEBUG_PROMPTS=false            # default: false
```

---

## Proyectos de referencia (para desarrollo)

Código fuente de los proyectos originales de los que se porta:

| Proyecto | Path local | Qué aporta |
|----------|-----------|------------|
| **POM-PPIA** | `/var/www/EC2/code/pom-ppia/` | Base del Python AI Service: LLM service, domain models, generadores |
| **PPIA original** | `/var/www/EC2/code/End2EndTests/ppia/` | Base del Framework TypeScript: agents, browser tools, toon parser |
| **PPIA tests** | `/var/www/EC2/code/End2EndTests/tests/ppia/` | Tests del framework original |
| **PPIA arquitectura** | `/var/www/EC2/code/End2EndTests/tests/ppia/PPIA-ARCHITECTURE.md` | Documento de referencia de arquitectura original |
