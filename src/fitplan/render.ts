import '../styles/fitplan.css';
import { FITPLAN_TEMPLATE } from './template';
import { computeMetrics, buildPrompt, IMC_EXPLANATIONS } from './calc';
import type { FitPlanState, ImcMetrics } from './types';

function qs<T extends HTMLElement = HTMLElement>(root: HTMLElement, selector: string): T {
  const found = root.querySelector<T>(selector);
  if (!found) throw new Error(`FitPlan: no se encontró "${selector}"`);
  return found;
}

const DAYS_DESC = [
  '😴 Sedentario — No realizas actividad física regular.',
  '🚶 Muy ligero — Algo de movimiento 1 vez/semana.',
  '🚴 Ligero — Actividad moderada 2 veces por semana.',
  '⚡ Moderado — Entrenas regularmente 3 veces/semana.',
  '💪 Activo — Entrenamiento frecuente, buen hábito.',
  '🔥 Muy Activo — Entrenamiento intenso casi todos los días.',
  '🏆 Atlético — Entrenamiento diario de alta intensidad.',
];

/** Monta el flujo de FitPlan (calculadora de IMC + generador de prompt) dentro del contenedor dado. */
export function renderFitPlan(root: HTMLElement): void {
  root.innerHTML = FITPLAN_TEMPLATE;

  const state: FitPlanState = {
    age: 25,
    height: 170,
    weight: 70,
    sexo: 'masculino',
    somato: 'ectomorfo',
    dias: 3,
    objetivo: 'perder_grasa',
    nivel: 'principiante',
    equipo: 'gym_completo',
    heightUnit: 'cm',
    weightUnit: 'kg',
  };
  let lastMetrics: ImcMetrics | null = null;
  let lastPrompt = '';

  // ---- Referencias ----
  const ageSlider = qs<HTMLInputElement>(root, '#fpAgeSlider');
  const ageDisplay = qs(root, '#fpAgeDisplay');
  const heightSlider = qs<HTMLInputElement>(root, '#fpHeightSlider');
  const heightDisplay = qs(root, '#fpHeightDisplay');
  const weightSlider = qs<HTMLInputElement>(root, '#fpWeightSlider');
  const weightDisplay = qs(root, '#fpWeightDisplay');
  const weightLabels = qs(root, '#fpWeightLabels');
  const daysSlider = qs<HTMLInputElement>(root, '#fpDaysSlider');
  const daysDisplay = qs(root, '#fpDaysDisplay');
  const daysDescBox = qs(root, '#fpDaysDescBox');

  const cmBtn = qs(root, '#fpCmBtn');
  const ftBtn = qs(root, '#fpFtBtn');
  const heightCm = qs(root, '#fpHeightCm');
  const heightFt = qs(root, '#fpHeightFt');
  const feetInput = qs<HTMLInputElement>(root, '#fpFeetInput');
  const inchesInput = qs<HTMLInputElement>(root, '#fpInchesInput');
  const ftConversion = qs(root, '#fpFtConversion');

  const kgBtn = qs(root, '#fpKgBtn');
  const lbBtn = qs(root, '#fpLbBtn');

  const imcValue = qs(root, '#fpImcValue');
  const imcLabel = qs(root, '#fpImcLabel');
  const imcDesc = qs(root, '#fpImcDesc');
  const imcPointer = qs<HTMLElement>(root, '#fpImcPointer');
  const statsGrid = qs(root, '#fpStatsGrid');
  const profileChips = qs(root, '#fpProfileChips');
  const metabolicAlert = qs(root, '#fpMetabolicAlert');
  const imcExplanation = qs(root, '#fpImcExplanation');

  const promptBox = qs(root, '#fpPromptBox');
  const copyToast = qs(root, '#fpCopyToast');

  // ---- Navegación de pasos ----
  function goTo(step: number): void {
    root.querySelectorAll('.section').forEach((s) => s.classList.remove('active'));
    qs(root, `#fpSec${step}`).classList.add('active');
    updateProgress(step);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function updateProgress(step: number): void {
    for (let i = 1; i <= 5; i++) {
      const circle = qs(root, `#fpSc${i}`);
      circle.classList.remove('active', 'done');
      if (i < step) {
        circle.classList.add('done');
        circle.textContent = '✓';
      } else if (i === step) {
        circle.classList.add('active');
        circle.textContent = i === 5 ? '★' : String(i);
      } else {
        circle.textContent = i === 5 ? '★' : String(i);
      }
      if (i < 5) qs(root, `#fpSl${i}`).classList.toggle('done', i < step);
    }
  }

  root.querySelectorAll<HTMLElement>('[data-goto]').forEach((btn) => {
    btn.addEventListener('click', () => goTo(Number(btn.dataset.goto)));
  });

  // ---- Sliders ----
  function updateAge(): void {
    state.age = Number(ageSlider.value);
    ageDisplay.innerHTML = `${state.age} <span class="slider-unit">años</span>`;
  }
  function updateHeight(): void {
    state.height = Number(heightSlider.value);
    heightDisplay.innerHTML = `${state.height} <span class="slider-unit">cm</span>`;
  }
  function updateWeightDisplay(): void {
    const raw = Number(weightSlider.value);
    weightDisplay.innerHTML = `${raw} <span class="slider-unit">${state.weightUnit}</span>`;
  }
  function updateDays(): void {
    state.dias = Number(daysSlider.value);
    daysDisplay.innerHTML = `${state.dias} <span class="slider-unit">días/semana</span>`;
    daysDescBox.textContent = DAYS_DESC[state.dias];
  }

  ageSlider.addEventListener('input', updateAge);
  heightSlider.addEventListener('input', updateHeight);
  weightSlider.addEventListener('input', updateWeightDisplay);
  daysSlider.addEventListener('input', updateDays);

  // ---- Unidades ----
  function setHeightUnit(unit: 'cm' | 'ft'): void {
    state.heightUnit = unit;
    cmBtn.classList.toggle('active', unit === 'cm');
    ftBtn.classList.toggle('active', unit === 'ft');
    heightCm.style.display = unit === 'cm' ? 'block' : 'none';
    heightFt.style.display = unit === 'ft' ? 'block' : 'none';

    if (unit === 'ft') {
      const totalInches = state.height / 2.54;
      const ft = Math.floor(totalInches / 12);
      const inc = Math.round(totalInches - ft * 12);
      feetInput.value = String(ft);
      inchesInput.value = String(inc);
      ftConversion.textContent = `≈ ${state.height} cm`;
    }
  }
  function convertFtToCm(): void {
    const ft = Number(feetInput.value) || 0;
    const inc = Number(inchesInput.value) || 0;
    state.height = Math.round(ft * 30.48 + inc * 2.54);
    ftConversion.textContent = `≈ ${state.height} cm`;
  }
  function getWeightKg(): number {
    const raw = Number(weightSlider.value);
    return state.weightUnit === 'lb' ? raw / 2.205 : raw;
  }
  function setWeightUnit(unit: 'kg' | 'lb'): void {
    if (state.weightUnit === unit) return;
    state.weightUnit = unit;
    kgBtn.classList.toggle('active', unit === 'kg');
    lbBtn.classList.toggle('active', unit === 'lb');
    const currentRaw = Number(weightSlider.value);

    if (unit === 'lb') {
      weightSlider.min = '66';
      weightSlider.max = '440';
      weightSlider.value = String(Math.round(currentRaw * 2.205));
      weightLabels.innerHTML = '<span>66 lb</span><span>440 lb</span>';
    } else {
      weightSlider.min = '30';
      weightSlider.max = '200';
      weightSlider.value = String(Math.round(currentRaw / 2.205));
      weightLabels.innerHTML = '<span>30 kg</span><span>200 kg</span>';
    }
    updateWeightDisplay();
  }

  cmBtn.addEventListener('click', () => setHeightUnit('cm'));
  ftBtn.addEventListener('click', () => setHeightUnit('ft'));
  feetInput.addEventListener('input', convertFtToCm);
  inchesInput.addEventListener('input', convertFtToCm);
  kgBtn.addEventListener('click', () => setWeightUnit('kg'));
  lbBtn.addEventListener('click', () => setWeightUnit('lb'));

  // ---- Cálculo de IMC ----
  function calcularIMC(): void {
    state.sexo = qs<HTMLInputElement>(root, '[name="fpSexo"]:checked').value as FitPlanState['sexo'];
    state.somato = qs<HTMLInputElement>(root, '[name="fpSomato"]:checked').value as FitPlanState['somato'];
    state.objetivo = qs<HTMLInputElement>(root, '[name="fpObjetivo"]:checked').value as FitPlanState['objetivo'];
    state.nivel = qs<HTMLInputElement>(root, '[name="fpNivel"]:checked').value as FitPlanState['nivel'];
    state.equipo = qs<HTMLInputElement>(root, '[name="fpEquipo"]:checked').value as FitPlanState['equipo'];

    const pesoKg = getWeightKg();
    const metrics = computeMetrics(state, pesoKg);
    lastMetrics = metrics;

    imcValue.textContent = String(metrics.imc);
    imcLabel.className = `imc-label ${metrics.cls}`;
    imcLabel.textContent = metrics.cat;
    imcDesc.textContent = metrics.desc;
    setTimeout(() => {
      imcPointer.style.left = `${metrics.pct}%`;
    }, 300);

    statsGrid.innerHTML = [
      { v: metrics.imc, l: 'Índice de Masa Corporal' },
      { v: `${metrics.tdee} kcal`, l: 'Calorías Mantenimiento' },
      { v: `${metrics.pesoIdeal} kg`, l: 'Peso Ideal Estimado' },
      { v: `${metrics.grasaCorp}%`, l: 'Grasa Corporal Est.' },
    ]
      .map((s) => `<div class="stat-card"><div class="stat-value">${s.v}</div><div class="stat-label">${s.l}</div></div>`)
      .join('');

    const oL: Record<FitPlanState['objetivo'], string> = {
      perder_grasa: '🔥 Perder Grasa',
      ganar_musculo: '💪 Ganar Músculo',
      definicion: '⚡ Definición',
      salud_general: '❤️ Salud General',
      resistencia: '🏃 Resistencia',
      fuerza: '🏋️ Fuerza',
    };
    const eL: Record<FitPlanState['equipo'], string> = {
      gym_completo: '🏋️ Gym',
      mancuernas: '🔵 Mancuernas',
      cuerpo: '🤸 Sin equipo',
    };
    const nL: Record<FitPlanState['nivel'], string> = {
      principiante: '🌱 Principiante',
      intermedio: '⚙️ Intermedio',
      avanzado: '🏆 Avanzado',
    };
    const soL: Record<FitPlanState['somato'], string> = {
      ectomorfo: '🏃 Ectomorfo',
      mesomorfo: '💪 Mesomorfo',
      endomorfo: '🏋️ Endomorfo',
    };
    const dL = ['😴 Sedentario', '🚶 1d/sem', '🚴 2d/sem', '⚡ 3d/sem', '💪 4d/sem', '🔥 5d/sem', '🏆 6d/sem'];

    profileChips.innerHTML = [
      state.sexo === 'masculino' ? '♂ Masculino' : '♀ Femenino',
      `${state.age} años`,
      `${state.height} cm`,
      `${metrics.pesoKg} kg`,
      soL[state.somato],
      dL[state.dias],
      oL[state.objetivo],
      nL[state.nivel],
      eL[state.equipo],
    ]
      .map((c) => `<span class="chip">${c}</span>`)
      .join('');

    let am = '';
    let ac = 'alert-info';
    if (metrics.imc < 18.5) {
      am = '⚠️ Con bajo peso, tu plan priorizará ganancia de masa muscular con superávit calórico y entrenamiento de fuerza progresivo.';
    } else if (metrics.cls === 'normal') {
      am = '✅ ¡Estás en el rango ideal! Tu plan optimizará tu composición corporal según tu objetivo.';
    } else {
      am = '⚠️ Con IMC elevado, el plan priorizará pérdida de grasa con déficit calórico moderado y ejercicio cardiovascular.';
      ac = 'alert-warn';
    }
    metabolicAlert.className = `alert ${ac}`;
    metabolicAlert.textContent = am;

    imcExplanation.textContent = IMC_EXPLANATIONS[metrics.cls](metrics.imc, metrics.tdee);

    goTo(4);
  }

  // ---- Generación de prompt ----
  function generarPrompt(): void {
    if (!lastMetrics) return;
    const prompt = buildPrompt(state, lastMetrics);
    lastPrompt = prompt;

    promptBox.innerHTML = prompt
      .replace(/═══[^═\n]*/g, (m) => `<span class="prompt-section">${m}</span>`)
      .replace(/━━━[^━\n]*/g, (m) => `<span class="prompt-section">${m}</span>`)
      .replace(/•\s[^:\n]+:/g, (m) => `<span class="prompt-highlight">${m}</span>`);

    goTo(5);
  }

  // ---- Copiar prompt ----
  let toastTimer = 0;
  function showToast(): void {
    copyToast.classList.add('copy-toast--visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => copyToast.classList.remove('copy-toast--visible'), 3200);
  }

  function copyPrompt(): void {
    if (!lastPrompt) return;
    const fallback = (): void => {
      const ta = document.createElement('textarea');
      ta.value = lastPrompt;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showToast();
    };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(lastPrompt).then(showToast).catch(fallback);
    } else {
      fallback();
    }
  }

  // ---- Reset ----
  function resetAll(): void {
    ageSlider.value = '25';
    heightSlider.value = '170';
    weightSlider.min = '30';
    weightSlider.max = '200';
    weightSlider.value = '70';
    daysSlider.value = '3';
    state.weightUnit = 'kg';
    state.heightUnit = 'cm';
    kgBtn.classList.add('active');
    lbBtn.classList.remove('active');
    cmBtn.classList.add('active');
    ftBtn.classList.remove('active');
    heightCm.style.display = 'block';
    heightFt.style.display = 'none';
    weightLabels.innerHTML = '<span>30 kg</span><span>200 kg</span>';
    updateAge();
    updateHeight();
    updateWeightDisplay();
    updateDays();
    qs<HTMLInputElement>(root, '[name="fpSexo"][value="masculino"]').checked = true;
    qs<HTMLInputElement>(root, '[name="fpSomato"][value="ectomorfo"]').checked = true;
    qs<HTMLInputElement>(root, '[name="fpObjetivo"][value="perder_grasa"]').checked = true;
    qs<HTMLInputElement>(root, '[name="fpNivel"][value="principiante"]').checked = true;
    qs<HTMLInputElement>(root, '[name="fpEquipo"][value="gym_completo"]').checked = true;
  }

  qs(root, '[data-action="calc-imc"]').addEventListener('click', calcularIMC);
  qs(root, '[data-action="generate-prompt"]').addEventListener('click', generarPrompt);
  qs(root, '[data-action="copy-prompt"]').addEventListener('click', copyPrompt);
  qs(root, '[data-action="reset"]').addEventListener('click', () => {
    goTo(1);
    resetAll();
  });

  // ---- Estado inicial ----
  updateDays();
}
