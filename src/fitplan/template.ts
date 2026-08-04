/** Marcado de los 5 pasos de FitPlan, portado de App FitPlan KROTON (sin header/footer propios: usa los de Hábitos). */
export const FITPLAN_TEMPLATE = `
<div class="progress-bar" id="fpProgressBar">
  <div class="step-item">
    <div class="step-circle active" id="fpSc1">1</div>
    <div class="step-label">Perfil</div>
  </div>
  <div class="step-line" id="fpSl1"></div>
  <div class="step-item">
    <div class="step-circle" id="fpSc2">2</div>
    <div class="step-label">Cuerpo</div>
  </div>
  <div class="step-line" id="fpSl2"></div>
  <div class="step-item">
    <div class="step-circle" id="fpSc3">3</div>
    <div class="step-label">Entreno</div>
  </div>
  <div class="step-line" id="fpSl3"></div>
  <div class="step-item">
    <div class="step-circle" id="fpSc4">4</div>
    <div class="step-label">IMC</div>
  </div>
  <div class="step-line" id="fpSl4"></div>
  <div class="step-item">
    <div class="step-circle" id="fpSc5">★</div>
    <div class="step-label">Plan</div>
  </div>
</div>

<div class="container">

  <div class="section active" id="fpSec1">
    <div class="section-header">
      <span class="section-num">PASO 01</span>
      <span class="section-title">Tu Perfil</span>
    </div>
    <div class="cards-grid cards-grid--2">
      <div class="card">
        <div class="form-group">
          <label>¿Cuántos años tienes?</label>
          <div class="slider-value" id="fpAgeDisplay">25 <span class="slider-unit">años</span></div>
          <input type="range" id="fpAgeSlider" min="15" max="80" value="25">
          <div class="slider-labels"><span>15 años</span><span>80 años</span></div>
        </div>
      </div>
      <div class="card">
        <div class="form-group">
          <label>Sexo Biológico</label>
          <div class="radio-grid">
            <label class="radio-card">
              <input type="radio" name="fpSexo" value="masculino" checked>
              <div class="radio-label"><span class="icon">♂</span>Masculino</div>
            </label>
            <label class="radio-card">
              <input type="radio" name="fpSexo" value="femenino">
              <div class="radio-label"><span class="icon">♀</span>Femenino</div>
            </label>
          </div>
          <div class="alert alert-info">
            💡 El sexo biológico afecta el cálculo del metabolismo, composición corporal óptima y las recomendaciones calóricas.
          </div>
        </div>
      </div>
    </div>
    <button class="btn btn-primary" data-goto="2">CONTINUAR →</button>
  </div>

  <div class="section" id="fpSec2">
    <div class="section-header">
      <span class="section-num">PASO 02</span>
      <span class="section-title">Tu Cuerpo</span>
    </div>
    <div class="cards-grid cards-grid--2">
      <div class="card">
        <div class="card-title">Estatura</div>
        <div class="card-sub">¿Cuánto mides?</div>
        <div class="unit-toggle" style="margin-bottom:20px;">
          <button class="unit-btn active" id="fpCmBtn" data-unit-height="cm" type="button">Centímetros</button>
          <button class="unit-btn" id="fpFtBtn" data-unit-height="ft" type="button">Pies / Pulgadas</button>
        </div>
        <div id="fpHeightCm">
          <div class="slider-value" id="fpHeightDisplay">170 <span class="slider-unit">cm</span></div>
          <input type="range" id="fpHeightSlider" min="130" max="220" value="170">
          <div class="slider-labels"><span>1.30 m</span><span>2.20 m</span></div>
        </div>
        <div id="fpHeightFt" style="display:none;">
          <div class="inline-fields">
            <div class="form-group">
              <label>Pies</label>
              <input type="number" id="fpFeetInput" min="4" max="7" value="5">
            </div>
            <div class="form-group">
              <label>Pulgadas</label>
              <input type="number" id="fpInchesInput" min="0" max="11" value="7">
            </div>
          </div>
          <div class="ft-conversion" id="fpFtConversion">≈ 170 cm</div>
        </div>
      </div>
      <div class="card">
        <div class="card-title">Peso</div>
        <div class="card-sub">¿Cuánto pesas?</div>
        <div class="unit-toggle" style="margin-bottom:20px;">
          <button class="unit-btn active" id="fpKgBtn" data-unit-weight="kg" type="button">Kilogramos</button>
          <button class="unit-btn" id="fpLbBtn" data-unit-weight="lb" type="button">Libras</button>
        </div>
        <div class="slider-value" id="fpWeightDisplay">70 <span class="slider-unit" id="fpWeightUnitLabel">kg</span></div>
        <input type="range" id="fpWeightSlider" min="30" max="200" value="70">
        <div class="slider-labels" id="fpWeightLabels"><span>30 kg</span><span>200 kg</span></div>
      </div>
    </div>
    <div class="card">
      <div class="card-title">Somatotipo</div>
      <div class="card-sub">¿Cómo describirías tu tipo de cuerpo naturalmente?</div>
      <div class="radio-grid" style="grid-template-columns:repeat(3,1fr);">
        <label class="radio-card">
          <input type="radio" name="fpSomato" value="ectomorfo" checked>
          <div class="radio-label"><span class="icon">🏃</span>Ectomorfo<span class="radio-hint">Delgado, difícil ganar peso</span></div>
        </label>
        <label class="radio-card">
          <input type="radio" name="fpSomato" value="mesomorfo">
          <div class="radio-label"><span class="icon">💪</span>Mesomorfo<span class="radio-hint">Atlético, músculos definidos</span></div>
        </label>
        <label class="radio-card">
          <input type="radio" name="fpSomato" value="endomorfo">
          <div class="radio-label"><span class="icon">🏋️</span>Endomorfo<span class="radio-hint">Tendencia a ganar grasa</span></div>
        </label>
      </div>
      <div class="alert alert-info">
        💡 <strong>¿No sabes cuál eres?</strong><br>
        • <strong>Ectomorfo:</strong> Delgado naturalmente, huesos pequeños, metabolismo rápido.<br>
        • <strong>Mesomorfo:</strong> Atlético, gana músculo fácilmente.<br>
        • <strong>Endomorfo:</strong> Tendencia a acumular grasa en abdomen y cadera.
      </div>
    </div>
    <button class="btn btn-primary" data-goto="3">CONTINUAR →</button>
    <button class="btn btn-secondary" data-goto="1">← Volver</button>
  </div>

  <div class="section" id="fpSec3">
    <div class="section-header">
      <span class="section-num">PASO 03</span>
      <span class="section-title">Tu Entrenamiento</span>
    </div>
    <div class="cards-grid cards-grid--2">
      <div class="card">
        <div class="card-title">Días de Entrenamiento</div>
        <div class="card-sub">¿Cuántos días a la semana entrenas actualmente?</div>
        <div class="slider-value" id="fpDaysDisplay">3 <span class="slider-unit">días/semana</span></div>
        <input type="range" id="fpDaysSlider" min="0" max="6" value="3" step="1">
        <div class="slider-labels"><span>0 (Sedentario)</span><span>6 días</span></div>
        <div id="fpDaysDescBox" class="alert alert-info" style="margin-top:16px;"></div>
      </div>
      <div class="card">
        <div class="card-title">Objetivo Principal</div>
        <div class="card-sub">¿Qué quieres lograr?</div>
        <div class="radio-grid" style="grid-template-columns:repeat(2,1fr);">
          <label class="radio-card"><input type="radio" name="fpObjetivo" value="perder_grasa" checked><div class="radio-label"><span class="icon">🔥</span>Perder Grasa</div></label>
          <label class="radio-card"><input type="radio" name="fpObjetivo" value="ganar_musculo"><div class="radio-label"><span class="icon">💪</span>Ganar Músculo</div></label>
          <label class="radio-card"><input type="radio" name="fpObjetivo" value="definicion"><div class="radio-label"><span class="icon">⚡</span>Definición</div></label>
          <label class="radio-card"><input type="radio" name="fpObjetivo" value="salud_general"><div class="radio-label"><span class="icon">❤️</span>Salud General</div></label>
          <label class="radio-card"><input type="radio" name="fpObjetivo" value="resistencia"><div class="radio-label"><span class="icon">🏃</span>Resistencia</div></label>
          <label class="radio-card"><input type="radio" name="fpObjetivo" value="fuerza"><div class="radio-label"><span class="icon">🏋️</span>Fuerza Máx.</div></label>
        </div>
      </div>
      <div class="card">
        <div class="card-title">Nivel de Experiencia</div>
        <div class="radio-grid">
          <label class="radio-card"><input type="radio" name="fpNivel" value="principiante" checked><div class="radio-label"><span class="icon">🌱</span>Principiante<span class="radio-hint">0–6 meses</span></div></label>
          <label class="radio-card"><input type="radio" name="fpNivel" value="intermedio"><div class="radio-label"><span class="icon">⚙️</span>Intermedio<span class="radio-hint">6m – 2 años</span></div></label>
          <label class="radio-card"><input type="radio" name="fpNivel" value="avanzado"><div class="radio-label"><span class="icon">🏆</span>Avanzado<span class="radio-hint">2+ años</span></div></label>
        </div>
      </div>
      <div class="card">
        <div class="card-title">Equipamiento Disponible</div>
        <div class="radio-grid" style="grid-template-columns:repeat(3,1fr);">
          <label class="radio-card"><input type="radio" name="fpEquipo" value="gym_completo" checked><div class="radio-label"><span class="icon">🏋️</span>Gym Completo</div></label>
          <label class="radio-card"><input type="radio" name="fpEquipo" value="mancuernas"><div class="radio-label"><span class="icon">🔵</span>Mancuernas</div></label>
          <label class="radio-card"><input type="radio" name="fpEquipo" value="cuerpo"><div class="radio-label"><span class="icon">🤸</span>Sin Equipo</div></label>
        </div>
      </div>
    </div>
    <button class="btn btn-primary" data-action="calc-imc">CALCULAR IMC →</button>
    <button class="btn btn-secondary" data-goto="2">← Volver</button>
  </div>

  <div class="section" id="fpSec4">
    <div class="section-header">
      <span class="section-num">PASO 04</span>
      <span class="section-title">Tu IMC</span>
    </div>
    <div class="card">
      <div class="imc-display">
        <div class="imc-number" id="fpImcValue">—</div>
        <div class="imc-label" id="fpImcLabel">—</div>
        <div class="imc-desc" id="fpImcDesc"></div>
      </div>
      <div class="imc-bar-wrap">
        <div class="imc-bar"><div class="imc-pointer" id="fpImcPointer" style="left:0%"></div></div>
        <div class="imc-bar-labels">
          <span>Bajo Peso<br>&lt;18.5</span>
          <span>Normal<br>18.5–24.9</span>
          <span>Sobrepeso<br>25–29.9</span>
          <span>Obesidad I<br>30–34.9</span>
          <span>Obesidad II<br>≥35</span>
        </div>
      </div>
    </div>
    <div class="cards-grid cards-grid--2">
      <div class="card">
        <div class="card-title">Tu Resumen Físico</div>
        <div class="stats-grid" id="fpStatsGrid"></div>
        <div class="divider"></div>
        <div class="card-sub">Perfil detectado</div>
        <div class="profile-chips" id="fpProfileChips"></div>
        <div class="alert" id="fpMetabolicAlert"></div>
      </div>
      <div class="card">
        <div class="card-title">¿Qué significa tu IMC?</div>
        <div id="fpImcExplanation" class="imc-explanation"></div>
      </div>
    </div>
    <button class="btn btn-primary" data-action="generate-prompt">GENERAR MI PLAN ✦</button>
    <button class="btn btn-secondary" data-goto="3">← Volver</button>
  </div>

  <div class="section" id="fpSec5">
    <div class="section-header">
      <span class="section-num">PASO 05</span>
      <span class="section-title">Tu Plan</span>
    </div>
    <div class="card">
      <div class="card-title">¡Listo! 🎉</div>
      <div class="card-sub">Copia este prompt y pégalo en <strong class="text-brand">ChatGPT, Claude o Gemini</strong>. La IA te responderá con tu plan completo de entrenamiento y nutrición directamente en el chat.</div>
      <div class="divider"></div>
      <div class="prompt-box" id="fpPromptBox"></div>
      <div class="copy-toast" id="fpCopyToast">✅ ¡Prompt copiado! Ahora pégalo en tu IA favorita.</div>
    </div>
    <button class="btn btn-copy" data-action="copy-prompt">📋 COPIAR PROMPT COMPLETO</button>
    <div class="card" style="margin-top:20px;">
      <div class="card-title" style="font-size:20px;">📌 Cómo usar tu plan</div>
      <ol class="steps-list">
        <li>Presiona <strong>COPIAR PROMPT</strong> arriba.</li>
        <li>Abre <strong class="text-brand">ChatGPT, Claude o Gemini</strong> en tu celular o navegador.</li>
        <li>Pega el prompt con <strong>Ctrl+V</strong> (o mantén presionado → Pegar) y envíalo.</li>
        <li>La IA te devolverá tu plan completo en el mismo chat: rutina semanal, nutrición, suplementación y consejos.</li>
        <li>Lee, aplica y transforma tu cuerpo. 💪</li>
      </ol>
      <div class="alert alert-warn">
        ⚠️ Este plan es orientativo. Consulta con un médico, nutricionista o entrenador certificado antes de iniciar cualquier programa.
      </div>
    </div>
    <button class="btn btn-secondary" data-action="reset">🔄 Calcular de nuevo</button>
  </div>

</div>
`;
