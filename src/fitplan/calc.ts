import type { FitPlanState, ImcMetrics, ImcClass } from './types';

/** IMC, TMB/TDEE (Harris-Benedict), peso ideal (Devine) y grasa corporal (Deurenberg). */
export function computeMetrics(state: FitPlanState, pesoKg: number): ImcMetrics {
  const talla = state.height / 100;
  const imc = pesoKg / (talla * talla);
  const imcR = Math.round(imc * 10) / 10;

  const tmb =
    state.sexo === 'masculino'
      ? 88.362 + 13.397 * pesoKg + 4.799 * state.height - 5.677 * state.age
      : 447.593 + 9.247 * pesoKg + 3.098 * state.height - 4.33 * state.age;

  const factors = [1.2, 1.375, 1.375, 1.55, 1.725, 1.725, 1.9];
  const tdee = Math.round(tmb * factors[state.dias]);

  const pesoIdeal = Math.round(
    state.sexo === 'masculino'
      ? 50 + 2.3 * ((state.height - 152.4) / 2.54)
      : 45.5 + 2.3 * ((state.height - 152.4) / 2.54),
  );

  const sexMale = state.sexo === 'masculino' ? 1 : 0;
  const grasaCorp = Math.round(1.2 * imc + 0.23 * state.age - 10.8 * sexMale - 5.4);

  let cat: string;
  let cls: ImcClass;
  let desc: string;
  if (imc < 18.5) {
    cat = 'Bajo Peso';
    cls = 'bajo';
    desc = 'Tu peso está por debajo del rango saludable para tu estatura.';
  } else if (imc < 25) {
    cat = 'Peso Normal ✓';
    cls = 'normal';
    desc = '¡Excelente! Tu peso está dentro del rango saludable.';
  } else if (imc < 30) {
    cat = 'Sobrepeso';
    cls = 'sobrepeso';
    desc = 'Tu peso supera levemente el rango saludable recomendado.';
  } else if (imc < 35) {
    cat = 'Obesidad Grado I';
    cls = 'obesidad1';
    desc = 'Es importante tomar acción para mejorar tu salud.';
  } else {
    cat = 'Obesidad Grado II';
    cls = 'obesidad2';
    desc = 'Se recomienda atención médica profesional urgente.';
  }

  const pct = Math.min(100, Math.max(0, ((imc - 15) / 25) * 100));

  return {
    imc: imcR,
    cat,
    cls,
    desc,
    tdee,
    pesoIdeal,
    grasaCorp: Math.max(0, grasaCorp),
    pct,
    pesoKg: Math.round(pesoKg),
  };
}

export const IMC_EXPLANATIONS: Record<ImcClass, (imc: number, tdee: number) => string> = {
  bajo: (imc, tdee) =>
    `Con un IMC de ${imc}, estás por debajo del peso saludable. Puede indicar déficit nutricional o masa muscular baja. Tu plan se enfocará en aumentar calorías con alimentos de calidad y entrenamiento de fuerza progresivo. Calorías de mantenimiento: ${tdee} kcal/día.`,
  normal: (imc, tdee) =>
    `¡Felicitaciones! Con un IMC de ${imc} estás en el rango óptimo. Podemos mejorar tu composición (más músculo, menos grasa) según tu objetivo específico. Calorías de mantenimiento: ${tdee} kcal/día.`,
  sobrepeso: (imc, tdee) =>
    `Con un IMC de ${imc}, estás en sobrepeso. Un déficit de 300-500 kcal/día con ejercicio es la estrategia más efectiva y sostenible. Calorías de mantenimiento: ${tdee} kcal/día.`,
  obesidad1: (imc, tdee) =>
    `Con un IMC de ${imc} (Obesidad Grado I), es fundamental cambiar hábitos. Ejercicio aeróbico combinado con fuerza y dieta hipocalórica puede generar resultados en 3-6 meses. Calorías de mantenimiento: ${tdee} kcal/día.`,
  obesidad2: (imc, tdee) =>
    `Con un IMC de ${imc}, consulta con un médico antes de iniciar cualquier programa. El ejercicio de bajo impacto (caminata, natación, bicicleta estacionaria) es el punto de inicio más seguro. Calorías de mantenimiento: ${tdee} kcal/día.`,
};

const OBJETIVO_LABEL: Record<FitPlanState['objetivo'], string> = {
  perder_grasa: 'pérdida de grasa corporal',
  ganar_musculo: 'ganancia de masa muscular',
  definicion: 'definición y tonificación muscular',
  salud_general: 'salud general y bienestar integral',
  resistencia: 'resistencia cardiovascular y aeróbica',
  fuerza: 'desarrollo de fuerza máxima',
};
const NIVEL_LABEL: Record<FitPlanState['nivel'], string> = {
  principiante: 'principiante (0 a 6 meses de experiencia)',
  intermedio: 'intermedio (6 meses a 2 años de experiencia)',
  avanzado: 'avanzado (más de 2 años de entrenamiento constante)',
};
const EQUIPO_LABEL: Record<FitPlanState['equipo'], string> = {
  gym_completo: 'gimnasio completo con máquinas, barras olímpicas, pesas libres y poleas',
  mancuernas: 'mancuernas y pesas libres en casa o gym básico',
  cuerpo: 'solo peso corporal (calistenia), sin equipamiento adicional',
};
const SOMATO_LABEL: Record<FitPlanState['somato'], string> = {
  ectomorfo: 'ectomorfo — metabolismo rápido, estructura ósea pequeña, dificultad para ganar peso y músculo',
  mesomorfo: 'mesomorfo — respuesta muscular rápida, buena constitución atlética natural, facilidad para ganar músculo',
  endomorfo: 'endomorfo — metabolismo más lento, tendencia a acumular grasa especialmente en abdomen y caderas',
};
const DIAS_LABEL = [
  'sedentario (no realiza actividad física)',
  '1 día a la semana',
  '2 días a la semana',
  '3 días a la semana',
  '4 días a la semana',
  '5 días a la semana',
  '6 días a la semana',
];

export function buildPrompt(state: FitPlanState, metrics: ImcMetrics): string {
  let calObj = metrics.tdee;
  if (state.objetivo === 'perder_grasa') calObj = metrics.tdee - 400;
  if (state.objetivo === 'ganar_musculo') calObj = metrics.tdee + 300;
  if (state.objetivo === 'definicion') calObj = metrics.tdee - 250;
  if (metrics.imc >= 30 && state.objetivo !== 'ganar_musculo') calObj = metrics.tdee - 500;
  calObj = Math.max(1200, calObj);

  let pm = 2.0;
  if (state.objetivo === 'ganar_musculo') pm = 2.2;
  if (state.objetivo === 'perder_grasa' || state.objetivo === 'definicion') pm = 2.4;
  const prot = Math.round(metrics.pesoKg * pm);
  const carbs = Math.round((calObj * 0.4) / 4);
  const grasas = Math.round((calObj * 0.25) / 9);

  const diffPesoIdeal = metrics.pesoKg - metrics.pesoIdeal;
  const signoPeso = diffPesoIdeal > 0 ? '+' : '';

  return `Actúa como un entrenador personal certificado y nutricionista deportivo profesional. Basándote en los siguientes datos, responde directamente en este chat con un plan completo y personalizado. NO generes código HTML, NO generes PDF, NO uses markdown complejo. Solo responde con texto claro, estructurado con títulos, listas y tablas simples en el chat.

═══════════════════════════════════════════
👤 PERFIL DEL USUARIO
═══════════════════════════════════════════
• Edad: ${state.age} años
• Sexo biológico: ${state.sexo}
• Estatura: ${state.height} cm
• Peso actual: ${metrics.pesoKg} kg
• Somatotipo: ${SOMATO_LABEL[state.somato]}
• IMC: ${metrics.imc} (${metrics.cat})
• Grasa corporal estimada: ${metrics.grasaCorp}%
• Peso ideal estimado: ${metrics.pesoIdeal} kg
• Diferencia con peso ideal: ${signoPeso}${diffPesoIdeal} kg

═══════════════════════════════════════════
🎯 OBJETIVO Y CONDICIONES
═══════════════════════════════════════════
• Objetivo principal: ${OBJETIVO_LABEL[state.objetivo]}
• Nivel de experiencia: ${NIVEL_LABEL[state.nivel]}
• Frecuencia de entrenamiento: ${DIAS_LABEL[state.dias]}
• Equipamiento disponible: ${EQUIPO_LABEL[state.equipo]}

═══════════════════════════════════════════
🔥 METABOLISMO Y MACROS OBJETIVO
═══════════════════════════════════════════
• TDEE (mantenimiento): ${metrics.tdee} kcal/día
• Calorías objetivo: ${calObj} kcal/día
• Proteínas: ${prot} g/día (${Math.round(pm * 10) / 10} g por kg de peso)
• Carbohidratos: ${carbs} g/día (40% de calorías)
• Grasas saludables: ${grasas} g/día (25% de calorías)

═══════════════════════════════════════════
📋 QUÉ NECESITO QUE ME RESPONDAS
═══════════════════════════════════════════

Responde directamente en el chat con las siguientes 5 partes bien organizadas:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PARTE 1 — RESUMEN Y DIAGNÓSTICO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Análisis breve de mi situación actual
• Expectativas realistas de resultados en 4, 8 y 12 semanas
• Mensaje motivacional personalizado según mi objetivo

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PARTE 2 — RUTINA DE ENTRENAMIENTO SEMANAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Organiza la rutina de Lunes a Sábado (Domingo = descanso activo) adaptada a mi nivel ${NIVEL_LABEL[state.nivel]} y equipamiento ${EQUIPO_LABEL[state.equipo]}.

Para CADA día incluye:
1. Nombre del día y grupo(s) muscular(es) a trabajar
2. Calentamiento (5-10 min): 3-4 ejercicios de movilidad articular
3. Bloque principal: mínimo 6-8 ejercicios con formato tabla simple:
   - Nombre del ejercicio
   - Series × Repeticiones
   - Descanso entre series
   - Músculo trabajado
   - Dificultad (principiante/intermedio/avanzado)
4. Trabajo de core (2-3 ejercicios) si aplica
5. Enfriamiento y estiramientos (5 min)

Domingo: plan de descanso activo con movilidad, yoga o caminata.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PARTE 3 — PLAN NUTRICIONAL SEMANAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Plan de Lunes a Domingo. Objetivo: ${calObj} kcal/día, ${prot}g proteína, ${carbs}g carbos, ${grasas}g grasas.

Para CADA día incluye 5 comidas con horarios y cantidades en gramos:
• Desayuno (07:00-08:00)
• Snack mañana (10:30)
• Almuerzo (12:30-13:30)
• Snack tarde / pre-entreno (16:30)
• Cena (19:30-20:00)

Al final de cada día: total de calorías y macros del día.
Usa alimentos variados, accesibles en Latinoamérica. No repitas los mismos menús dos días consecutivos. Incluye nota de hidratación (mínimo 2.5L de agua/día).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PARTE 4 — CONSEJOS Y SUPLEMENTACIÓN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• 6 tips específicos para mi somatotipo ${state.somato}
• Suplementación básica según mi objetivo (qué, cuánto, cuándo)
• Señales de sobreentrenamiento a vigilar
• Progresión sugerida: semanas 1-4 vs semanas 5-8
• Hábitos de sueño y recuperación esenciales
• Tabla de seguimiento semanal (peso, medidas, cómo me siento)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PARTE 5 — RECORDATORIO IMPORTANTE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Nota final: este plan es orientativo y educativo, no reemplaza consulta con médico, nutricionista o entrenador certificado presencial.

═══════════════════════════════════════════
📝 INSTRUCCIONES DE FORMATO
═══════════════════════════════════════════
• Responde TODO en español
• Usa emojis para hacer el contenido visual
• Usa tablas simples en texto plano para ejercicios y comidas
• Separa claramente cada parte con títulos grandes
• Sé detallado, profesional, específico y motivador
• Responde COMPLETO en una sola respuesta en el chat
• No generes archivos, no generes código, solo texto formateado

Empieza ahora el plan.`;
}
